import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics - DERIVED FROM DATABASE TABLES ONLY
 */
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Query REAL data from tables - NO MOCK DATA

        // 1. Projects count by status
        const { data: projects, error: projectsError } = await supabase
            .schema('rfp')
            .from('projects')
            .select('status');

        // 2. Indexed folders count
        const { count: indexedFolders, error: foldersError } = await supabase
            .schema('rfp')
            .from('folder_index')
            .select('*', { count: 'exact', head: true });

        // 3. Pending requests count
        const { count: pendingRequests, error: requestsError } = await supabase
            .schema('rfp')
            .from('project_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        // 4. Permission violations count (unresolved)
        const { count: violations, error: violationsError } = await supabase
            .schema('rfp')
            .from('permission_violations')
            .select('*', { count: 'exact', head: true })
            .is('resolved_at', null);

        // 5. Active jobs count
        const { count: activeJobs, error: jobsError } = await supabase
            .schema('rfp')
            .from('sync_jobs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'running');

        // 6. Last scan time
        const { data: lastJob } = await supabase
            .schema('rfp')
            .from('sync_jobs')
            .select('completed_at')
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1)
            .single();

        // Calculate stats from ACTUAL data
        const projectList = projects || [];
        const totalProjects = projectList.length;
        const biddingCount = projectList.filter(p => p.status === 'bidding').length;
        const executionCount = projectList.filter(p => p.status === 'execution').length;

        const stats = {
            totalProjects,
            biddingCount,
            executionCount,
            pendingRequests: pendingRequests || 0,
            indexedFolders: indexedFolders || 0,
            violations: violations || 0,
            activeJobs: activeJobs || 0,
            lastScan: lastJob?.completed_at || null,
        };

        console.log('Dashboard stats (from DB):', stats);

        const response = NextResponse.json({
            success: true,
            stats,
            source: 'database', // Confirm data is from DB, not mock
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);

        // Return zeros on error - NOT mock data
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
