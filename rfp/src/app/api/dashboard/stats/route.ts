import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

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
            const response = NextResponse.json({
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
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return response;
        }

        const response = NextResponse.json({
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
            },
        }, { status: 500 });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    }
}
