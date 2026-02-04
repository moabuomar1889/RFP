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

        // 1. Get projects and count by status
        const { data: projects, error: projectsError } = await supabase.rpc('get_projects', {
            p_status: null,
            p_phase: null
        });

        if (projectsError) {
            console.error('get_projects RPC error:', projectsError);
        }

        // 2. Count indexed folders using RPC
        const { data: folderCountData } = await supabase.rpc('get_folder_count');
        const indexedFolders = folderCountData || 0;

        // 3. Count pending requests using RPC
        const { data: pendingData } = await supabase.rpc('get_pending_requests_count');
        const pendingRequests = pendingData || 0;

        // 4. Count violations using RPC
        const { data: violationsData } = await supabase.rpc('get_violations_count');
        const violations = violationsData || 0;

        // 5. Active jobs count using RPC
        const { data: activeJobsData } = await supabase.rpc('get_active_jobs_count');
        const activeJobs = activeJobsData || 0;

        // 6. Get last scan time
        const { data: lastScanData } = await supabase.rpc('get_last_scan_time');
        const lastScan = lastScanData || null;

        // Calculate stats from ACTUAL project data
        const projectList = projects || [];
        const totalProjects = projectList.length;
        const biddingCount = projectList.filter((p: any) => p.status === 'bidding').length;
        const executionCount = projectList.filter((p: any) => p.status === 'execution').length;

        const stats = {
            totalProjects,
            biddingCount,
            executionCount,
            pendingRequests,
            indexedFolders,
            violations,
            activeJobs,
            lastScan,
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
