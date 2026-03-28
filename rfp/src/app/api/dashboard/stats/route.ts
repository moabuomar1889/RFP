// Dashboard Stats API - Updated 2026-02-19
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type FolderIndexRow = {
    project_id: string;
    normalized_template_path: string | null;
    template_path: string | null;
};

type VerifyTaskRow = {
    project_id: string | null;
    task_details: {
        message?: string;
        details?: {
            compliant?: boolean;
        };
    } | null;
    completed_at: string | null;
};

async function countRows(query: Promise<{ count: number | null; error: any }>) {
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
}

async function loadLatestComplianceSnapshot(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    validFolderKeys: Set<string>
) {
    const latestByFolder = new Map<string, boolean>();
    let from = 0;
    const pageSize = 1000;

    while (latestByFolder.size < validFolderKeys.size) {
        const { data, error } = await supabase
            .schema('rfp')
            .from('sync_tasks')
            .select('project_id, task_details, completed_at')
            .eq('task_type', 'folder_verify_summary')
            .order('completed_at', { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) throw error;

        const rows = (data ?? []) as VerifyTaskRow[];
        if (rows.length === 0) break;

        for (const row of rows) {
            const projectId = row.project_id;
            const folderPath = row.task_details?.message;
            if (!projectId || !folderPath || folderPath === 'Project Root') continue;

            const key = `${projectId}:${folderPath}`;
            if (!validFolderKeys.has(key) || latestByFolder.has(key)) continue;

            latestByFolder.set(key, row.task_details?.details?.compliant === true);
        }

        from += rows.length;
        if (rows.length < pageSize) break;
    }

    const compliantFolders = Array.from(latestByFolder.values()).filter(Boolean).length;
    const verifiedFolders = latestByFolder.size;
    const violations = Math.max(verifiedFolders - compliantFolders, 0);

    return {
        compliantFolders,
        verifiedFolders,
        violations,
        unverifiedFolders: Math.max(validFolderKeys.size - verifiedFolders, 0),
        usedLiveSnapshot: verifiedFolders > 0,
    };
}

/**
 * GET /api/dashboard/stats
 * Uses live rfp-schema counts and the latest folder_verify_summary snapshot.
 */
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        const [
            totalProjects,
            biddingProjects,
            executionProjects,
            pendingRequests,
            totalFolders,
            activeJobs,
            projectsLastSync,
            folderRowsResult,
            usersResult,
            groupsResult,
        ] = await Promise.all([
            countRows(supabase.schema('rfp').from('projects').select('*', { count: 'exact', head: true })),
            countRows(supabase.schema('rfp').from('projects').select('*', { count: 'exact', head: true }).eq('phase', 'bidding')),
            countRows(supabase.schema('rfp').from('projects').select('*', { count: 'exact', head: true }).eq('phase', 'execution')),
            countRows(supabase.schema('rfp').from('project_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
            countRows(supabase.schema('rfp').from('folder_index').select('*', { count: 'exact', head: true })),
            countRows(supabase.schema('rfp').from('sync_jobs').select('*', { count: 'exact', head: true }).eq('status', 'running')),
            supabase.schema('rfp').from('projects').select('last_synced_at').order('last_synced_at', { ascending: false }).limit(1),
            supabase.schema('rfp').from('folder_index').select('project_id, normalized_template_path, template_path'),
            supabase.rpc('get_users_with_groups'),
            supabase.rpc('get_groups'),
        ]);

        if (folderRowsResult.error) throw folderRowsResult.error;
        if (projectsLastSync.error) throw projectsLastSync.error;
        if (usersResult.error) throw usersResult.error;
        if (groupsResult.error) throw groupsResult.error;

        const folderRows = (folderRowsResult.data ?? []) as FolderIndexRow[];
        const validFolderKeys = new Set(
            folderRows.map((row) => `${row.project_id}:${row.normalized_template_path || row.template_path || ''}`)
        );

        const complianceSnapshot = await loadLatestComplianceSnapshot(supabase, validFolderKeys);

        const users = usersResult.data ?? [];
        const groups = groupsResult.data ?? [];
        const totalUsers = users.length;
        const usersWithoutGroups = users.filter((u: any) => !u.groups || u.groups.length === 0).length;
        const totalGroups = groups.length;
        const lastSync = projectsLastSync.data?.[0]?.last_synced_at ?? null;

        const stats = {
            totalProjects,
            biddingProjects,
            executionProjects,
            totalFolders,
            compliantFolders: complianceSnapshot.compliantFolders,
            violations: complianceSnapshot.violations,
            verifiedFolders: complianceSnapshot.verifiedFolders,
            unverifiedFolders: complianceSnapshot.unverifiedFolders,
            activeJobs,
            lastSync,
            totalUsers,
            usersWithoutGroups,
            totalGroups,
            pendingRequests,
        };
        console.log('Dashboard stats (live):', {
            ...stats,
            verifiedFolders: complianceSnapshot.verifiedFolders,
            unverifiedFolders: complianceSnapshot.unverifiedFolders,
            complianceSnapshotSource: complianceSnapshot.usedLiveSnapshot ? 'sync_tasks.folder_verify_summary' : 'empty',
        });

        const response = NextResponse.json({
            success: true,
            stats,
            source: complianceSnapshot.usedLiveSnapshot ? 'live-verify-snapshot' : 'live-counts',
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;

    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);

        const response = NextResponse.json({
            success: false,
            error: 'Failed to fetch dashboard stats',
            details: error.message,
            stats: {
                totalProjects: 0,
                biddingProjects: 0,
                executionProjects: 0,
                pendingRequests: 0,
                totalFolders: 0,
                compliantFolders: 0,
                violations: 0,
                activeJobs: 0,
                lastSync: null,
                totalUsers: 0,
                usersWithoutGroups: 0,
                totalGroups: 0,
            },
            source: 'error-fallback',
        }, { status: 500 });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    }
}
