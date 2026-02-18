import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/dashboard/stats
 * Uses pg client for rfp schema queries (bypasses PostgREST schema cache issues)
 * Uses Supabase RPCs for user/group data (works via public schema)
 */
export async function GET() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        return NextResponse.json({
            success: false,
            error: 'Missing database connection URL',
            stats: fallbackStats(),
            source: 'error-no-url',
        }, { status: 500 });
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Projects (with phase column)
        const { rows: projects } = await client.query(
            'SELECT id, name, pr_number, status, phase, drive_folder_id, last_synced_at, last_enforced_at, created_at FROM rfp.projects'
        );
        const totalProjects = projects.length;
        const biddingProjects = projects.filter(p => p.phase?.toLowerCase() === 'bidding').length;
        const executionProjects = projects.filter(p => p.phase?.toLowerCase() === 'execution').length;

        // 2. Folder counts
        const { rows: [folderRow] } = await client.query('SELECT count(*) as total FROM rfp.folder_index');
        const totalFolders = parseInt(folderRow?.total || '0', 10);

        const { rows: [compliantRow] } = await client.query('SELECT count(*) as total FROM rfp.folder_index WHERE is_compliant = true');
        const compliantFolders = parseInt(compliantRow?.total || '0', 10);

        const violations = totalFolders - compliantFolders;

        // 3. Active jobs
        const { rows: [jobRow] } = await client.query("SELECT count(*) as total FROM rfp.reset_jobs WHERE status IN ('running', 'pending')");
        const activeJobs = parseInt(jobRow?.total || '0', 10);

        // 4. Last scan
        const { rows: [lastRow] } = await client.query('SELECT updated_at FROM rfp.folder_index ORDER BY updated_at DESC LIMIT 1');
        const lastScan = lastRow?.updated_at || null;

        // ── Supabase RPCs (for users/groups from auth/public schema) ──
        const supabase = getSupabaseAdmin();

        const { data: users } = await supabase.rpc('get_users_with_groups');
        const totalUsers = users?.length || 0;
        const usersWithoutGroups = users?.filter((u: any) => !u.groups || u.groups.length === 0).length || 0;

        const { data: groups } = await supabase.rpc('get_groups');
        const totalGroups = groups?.length || 0;

        const stats = {
            totalProjects,
            biddingProjects,
            executionProjects,
            totalFolders,
            totalUsers,
            usersWithoutGroups,
            totalGroups,
            pendingRequests: 0,
            violations,
            activeJobs,
            lastSync: lastScan,
            compliantFolders,
        };

        console.log('Dashboard stats (pg+rpc):', stats);

        const response = NextResponse.json({
            success: true,
            stats,
            source: 'pg-direct',
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;

    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);

        const response = NextResponse.json({
            success: false,
            error: 'Failed to fetch dashboard stats',
            details: error.message,
            stats: fallbackStats(),
            source: 'error-fallback',
        }, { status: 500 });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    } finally {
        await client.end().catch(() => { });
    }
}

function fallbackStats() {
    return {
        totalProjects: 0,
        biddingProjects: 0,
        executionProjects: 0,
        pendingRequests: 0,
        totalFolders: 0,
        violations: 0,
        activeJobs: 0,
        lastSync: null,
        compliantFolders: 0,
    };
}
