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

        // Get dashboard stats using RPC
        const { data, error } = await supabase.rpc('get_dashboard_stats');

        if (error) {
            console.error('Error fetching dashboard stats:', error);
            // Return default stats on error
            return NextResponse.json({
                success: true,
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
            });
        }

        return NextResponse.json({
            success: true,
            stats: data || {
                totalProjects: 0,
                biddingCount: 0,
                executionCount: 0,
                pendingRequests: 0,
                indexedFolders: 0,
                violations: 0,
                activeJobs: 0,
            },
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return NextResponse.json({
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
            },
        }, { status: 500 });
    }
}
