import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Get all projects
        const { data: projects, error: projectsError } = await supabase.rpc('get_projects', {
            p_status: null,
            p_phase: null,
        });

        if (projectsError) {
            throw projectsError;
        }

        const projectList = projects || [];
        const totalProjects = projectList.length;
        const biddingCount = projectList.filter((p: any) => p.phase === 'bidding').length;
        const executionCount = projectList.filter((p: any) => p.phase === 'execution').length;

        // Get pending requests count
        const { data: requests } = await supabase.rpc('get_pending_requests');
        const pendingRequests = Array.isArray(requests) ? requests.length : 0;

        // Get last scan info
        const { data: lastScan } = await supabase.rpc('get_last_scan');

        return NextResponse.json({
            success: true,
            stats: {
                totalProjects,
                biddingCount,
                executionCount,
                pendingRequests,
                indexedFolders: 0, // Will be implemented when folder_index is populated
                violations: 0, // Will be implemented when violations are tracked
                activeJobs: 0, // Will be implemented when jobs are running
                lastScan: lastScan?.created_at || null,
            },
            projects: projectList,
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch dashboard stats' },
            { status: 500 }
        );
    }
}
