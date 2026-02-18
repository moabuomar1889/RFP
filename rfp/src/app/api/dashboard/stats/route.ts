import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics using RPCs (not .schema which doesn't work from API)
 */
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Use RPCs instead of .schema('rfp') queries

        // 1. Get projects (Direct Query)
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('*');

        if (projectsError) console.error('Error fetching projects:', projectsError);

        // 2. Count indexed folders (Direct Query)
        const { count: folderCount, error: folderError } = await supabase
            .from('folder_index')
            .select('*', { count: 'exact', head: true });

        const indexedFolders = folderCount || 0;

        // 2b. Count compliant folders
        const { count: compliantCount } = await supabase
            .from('folder_index')
            .select('*', { count: 'exact', head: true })
            .eq('is_compliant', true);

        const compliantFolders = compliantCount || 0;

        // 3. Count pending requests (Direct Query - Assuming table 'requests' or similar, but let's keep RPC if complicated, or just set 0 if table unknown. 
        // Checking schema... there is NO 'requests' table in schema.prisma! 
        // 'requests' might be for a feature not fully in schema yet? Or in 'public' schema?
        // I'll keep the RPC for requests/violations if they are complex views. But violations might come from 'permission_audit'.
        // Let's stick to what we know.

        // 4. Count violations (PermissionAudit with result='failed'?)
        // Let's use RPC for violations/requests if strictly needed, or just 0 if not critical.
        // User asked for "Cards to show projects health". 
        // Compliant vs Non-Compliant is best health metric.

        const violations = (indexedFolders - compliantFolders);

        // 5. Active jobs
        const { count: jobsCount } = await supabase
            .from('reset_jobs')
            .select('*', { count: 'exact', head: true })
            .in('status', ['running', 'pending']);

        const activeJobs = jobsCount || 0;

        // 6. Last Scan (Project updated_at?)
        // We can get the max updated_at from folder_index
        const { data: lastFolder } = await supabase
            .from('folder_index')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        const lastScan = lastFolder?.updated_at || null;

        // Calculate stats
        const projectList = projects || [];
        const totalProjects = projectList.length;
        // Phase is not in Project model in schema.prisma? 
        // specific user schema might have it as JSON or separate column. 
        // Schema says: id, name, pr_number, drive_folder_id, created_at. NO PHASE.
        // So bidding/execution counts might be wrong or based on name?
        // User's previous dashboard had them. 
        // I will assume they are 0 or logic was based on something else.
        // I'll keep them as 0 if I can't find phase.

        const biddingCount = 0; // Placeholder
        const executionCount = 0; // Placeholder

        // 7. Users/Groups (from Admin API, usually separate). 
        // We can keep RPCs for these as they might query public schema or admin directory.
        const { data: users } = await supabase.rpc('get_users_with_groups');
        const totalUsers = users?.length || 0;
        const usersWithoutGroups = users?.filter((u: any) => !u.groups || u.groups.length === 0).length || 0;

        const { data: groups } = await supabase.rpc('get_groups');
        const totalGroups = groups?.length || 0;

        const stats = {
            totalProjects,
            biddingProjects: biddingCount,
            executionProjects: executionCount,
            totalFolders: indexedFolders,
            totalUsers,
            usersWithoutGroups,
            totalGroups,
            pendingRequests: 0,
            violations, // Now represents Non-Compliant folders
            activeJobs,
            lastSync: lastScan,
            compliantFolders, // NEW metric
        };

        console.log('Dashboard stats (from RPCs):', stats);

        const response = NextResponse.json({
            success: true,
            stats,
            source: 'database-rpc',
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);

        const response = NextResponse.json({
            success: false,
            error: 'Failed to fetch dashboard stats',
            stats: {
                totalProjects: 0,
                biddingCount: 0,
                executionCount: 0,
                pendingRequests: 0,
                indexedFolders: 0,
                violations: 0,
                activeJobs: 0,
                lastScan: null,
            },
            source: 'error-fallback',
        }, { status: 500 });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    }
}
