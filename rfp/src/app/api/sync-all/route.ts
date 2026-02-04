import { NextRequest, NextResponse } from 'next/server';
import { syncUsersToDatabase, syncGroupsToDatabase } from '@/server/google-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync-all
 * Sync both users and groups from Google Workspace
 * This populates user_directory, group_directory, and user_group_membership
 */
export async function POST(request: NextRequest) {
    try {
        console.log('=== Starting full sync from Google Workspace ===');

        // Sync users first
        console.log('Syncing users...');
        const usersResult = await syncUsersToDatabase();
        console.log('Users sync result:', usersResult);

        // Then sync groups (which includes memberships)
        console.log('Syncing groups and memberships...');
        const groupsResult = await syncGroupsToDatabase();
        console.log('Groups sync result:', groupsResult);

        if (usersResult.success && groupsResult.success) {
            return NextResponse.json({
                success: true,
                message: `Synced ${usersResult.syncedCount} users and ${groupsResult.syncedCount} groups`,
                users: usersResult.syncedCount,
                groups: groupsResult.syncedCount,
            });
        } else {
            return NextResponse.json({
                success: false,
                error: usersResult.error || groupsResult.error || 'Partial sync failure',
                users: usersResult.syncedCount,
                groups: groupsResult.syncedCount,
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Full sync error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to sync',
        }, { status: 500 });
    }
}
