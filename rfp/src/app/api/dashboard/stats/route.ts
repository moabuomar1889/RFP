// Dashboard Stats API - Updated 2026-02-19
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/dashboard/stats
 * Uses Supabase RPCs for ALL data (bypasses PostgREST schema issues)
 */
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // 1. Dashboard stats from RPC (queries rfp schema internally)
        const { data: dbStats, error: statsError } = await supabase.rpc('get_dashboard_stats');

        if (statsError) {
            console.error('RPC get_dashboard_stats error:', statsError);
            throw new Error(statsError.message);
        }

        // 2. Users & Groups from RPCs (already working)
        const { data: users } = await supabase.rpc('get_users_with_groups');
        const totalUsers = users?.length || 0;
        const usersWithoutGroups = users?.filter((u: any) => !u.groups || u.groups.length === 0).length || 0;

        const { data: groups } = await supabase.rpc('get_groups');
        const totalGroups = groups?.length || 0;

        // Map RPC result fields (handle both old and new field names)
        const stats = {
            totalProjects: dbStats?.totalProjects ?? dbStats?.total_projects ?? 0,
            biddingProjects: dbStats?.biddingProjects ?? dbStats?.biddingCount ?? 0,
            executionProjects: dbStats?.executionProjects ?? dbStats?.executionCount ?? 0,
            totalFolders: dbStats?.totalFolders ?? dbStats?.indexedFolders ?? 0,
            compliantFolders: dbStats?.compliantFolders ?? dbStats?.compliant_folders ?? 0,
            violations: dbStats?.violations ?? 0,
            activeJobs: dbStats?.activeJobs ?? dbStats?.active_jobs ?? 0,
            lastSync: dbStats?.lastSync ?? dbStats?.last_sync ?? null,
            totalUsers,
            usersWithoutGroups,
            totalGroups,
            pendingRequests: dbStats?.pendingRequests ?? 0,
        };

        console.log('Dashboard stats (RPC):', stats);

        const response = NextResponse.json({
            success: true,
            stats,
            source: 'rpc',
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
