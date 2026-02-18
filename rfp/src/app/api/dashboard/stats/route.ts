import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics using Prisma (direct PostgreSQL, bypasses PostgREST)
 * Uses raw SQL for projects to access columns not in Prisma schema (phase, status)
 */
export async function GET() {
    try {
        // ── Prisma queries (direct DB, no PostgREST) ──

        // 1. Projects - use raw SQL to get phase column (not in Prisma schema)
        const projects: any[] = await prisma.$queryRaw`
            SELECT id, name, pr_number, status, phase, drive_folder_id, 
                   last_synced_at, last_enforced_at, created_at
            FROM rfp.projects
        `;
        const totalProjects = projects.length;
        const biddingProjects = projects.filter(p => p.phase?.toLowerCase() === 'bidding').length;
        const executionProjects = projects.filter(p => p.phase?.toLowerCase() === 'execution').length;

        // 2. Folder counts
        const totalFolders = await prisma.folderIndex.count();
        const compliantFolders = await prisma.folderIndex.count({
            where: { is_compliant: true }
        });
        const violations = totalFolders - compliantFolders;

        // 3. Active jobs
        const activeJobs = await prisma.resetJob.count({
            where: { status: { in: ['running', 'pending'] } }
        });

        // 4. Last scan (most recent folder update)
        const lastFolder = await prisma.folderIndex.findFirst({
            orderBy: { updated_at: 'desc' },
            select: { updated_at: true }
        });
        const lastScan = lastFolder?.updated_at || null;

        // ── Supabase RPCs (for users/groups from auth schema) ──
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

        console.log('Dashboard stats (Prisma):', stats);

        const response = NextResponse.json({
            success: true,
            stats,
            source: 'prisma-direct',
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
                violations: 0,
                activeJobs: 0,
                lastSync: null,
                compliantFolders: 0,
            },
            source: 'error-fallback',
        }, { status: 500 });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    }
}
