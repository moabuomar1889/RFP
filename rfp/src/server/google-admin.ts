import { google, admin_directory_v1 } from 'googleapis';
import { getOAuth2Client } from './google-drive';

/**
 * Get Google Admin Directory API client
 */
export async function getAdminClient(): Promise<admin_directory_v1.Admin> {
    const auth = await getOAuth2Client();
    return google.admin({ version: 'directory_v1', auth });
}

/**
 * List all users in the domain
 */
export async function listUsers(
    query?: string,
    maxResults: number = 100
): Promise<admin_directory_v1.Schema$User[]> {
    const admin = await getAdminClient();

    const params: admin_directory_v1.Params$Resource$Users$List = {
        customer: 'my_customer',
        maxResults,
        orderBy: 'email',
    };

    if (query) {
        params.query = query;
    }

    const response = await admin.users.list(params);
    return response.data.users || [];
}

/**
 * Get a single user by email
 */
export async function getUser(
    email: string
): Promise<admin_directory_v1.Schema$User | null> {
    const admin = await getAdminClient();

    try {
        const response = await admin.users.get({
            userKey: email,
        });
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * List all groups in the domain
 */
export async function listGroups(
    query?: string,
    maxResults: number = 100
): Promise<admin_directory_v1.Schema$Group[]> {
    const admin = await getAdminClient();

    const params: admin_directory_v1.Params$Resource$Groups$List = {
        customer: 'my_customer',
        maxResults,
        orderBy: 'email',
    };

    if (query) {
        params.query = query;
    }

    const response = await admin.groups.list(params);
    return response.data.groups || [];
}

/**
 * Get a single group by email
 */
export async function getGroup(
    email: string
): Promise<admin_directory_v1.Schema$Group | null> {
    const admin = await getAdminClient();

    try {
        const response = await admin.groups.get({
            groupKey: email,
        });
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * List members of a group
 */
export async function listGroupMembers(
    groupEmail: string
): Promise<admin_directory_v1.Schema$Member[]> {
    const admin = await getAdminClient();

    try {
        const response = await admin.members.list({
            groupKey: groupEmail,
            maxResults: 200,
        });
        return response.data.members || [];
    } catch (error) {
        return [];
    }
}

/**
 * Search users by name or email
 */
export async function searchUsers(
    searchTerm: string,
    maxResults: number = 50
): Promise<admin_directory_v1.Schema$User[]> {
    // Query format: name:'John*' or email:john*
    const query = `name:'${searchTerm}*' email:${searchTerm}*`;
    return listUsers(query, maxResults);
}

/**
 * Search groups by name or email
 */
export async function searchGroups(
    searchTerm: string,
    maxResults: number = 50
): Promise<admin_directory_v1.Schema$Group[]> {
    // Query format: name:'Team*' or email:team*
    const query = `name:'${searchTerm}*' email:${searchTerm}*`;
    return listGroups(query, maxResults);
}

/**
 * Get user's groups
 */
export async function getUserGroups(
    userEmail: string
): Promise<admin_directory_v1.Schema$Group[]> {
    const admin = await getAdminClient();

    try {
        const response = await admin.groups.list({
            userKey: userEmail,
        });
        return response.data.groups || [];
    } catch (error) {
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE SYNC FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Sync users from Google Admin SDK to database
 */
export async function syncUsersToDatabase(): Promise<{
    success: boolean;
    syncedCount: number;
    error?: string;
}> {
    try {
        const admin = await getAdminClient();
        const supabase = getSupabaseAdmin();

        let syncedCount = 0;
        let pageToken: string | undefined;

        do {
            const response = await admin.users.list({
                customer: 'my_customer',
                maxResults: 100,
                pageToken,
                projection: 'full',
            });

            const users = response.data.users || [];

            for (const user of users) {
                const { error } = await supabase
                    .schema('rfp')
                    .from('user_directory')
                    .upsert({
                        google_id: user.id,
                        email: user.primaryEmail,
                        name: user.name?.fullName || user.primaryEmail?.split('@')[0],
                        given_name: user.name?.givenName,
                        family_name: user.name?.familyName,
                        photo_url: user.thumbnailPhotoUrl,
                        department: user.organizations?.[0]?.department,
                        role: user.isAdmin ? 'Admin' : 'User',
                        status: user.suspended ? 'Suspended' : 'Active',
                        last_login: user.lastLoginTime,
                        synced_at: new Date().toISOString(),
                    }, { onConflict: 'email' });

                if (!error) syncedCount++;
            }

            pageToken = response.data.nextPageToken || undefined;
        } while (pageToken);

        // Log the sync
        await supabase.rpc('log_audit', {
            p_action: 'users_synced',
            p_entity_type: 'user',
            p_entity_id: null,
            p_performed_by: 'system',
            p_details: { synced_count: syncedCount },
        });

        return { success: true, syncedCount };
    } catch (error: any) {
        console.error('Error syncing users to database:', error);
        return {
            success: false,
            syncedCount: 0,
            error: error.message || 'Failed to sync users',
        };
    }
}

/**
 * Sync groups from Google Admin SDK to database
 */
export async function syncGroupsToDatabase(): Promise<{
    success: boolean;
    syncedCount: number;
    error?: string;
}> {
    try {
        const admin = await getAdminClient();
        const supabase = getSupabaseAdmin();

        let syncedCount = 0;
        let pageToken: string | undefined;

        do {
            const response = await admin.groups.list({
                customer: 'my_customer',
                maxResults: 100,
                pageToken,
            });

            const groups = response.data.groups || [];

            for (const group of groups) {
                // Get member count
                let memberCount = 0;
                try {
                    const membersResponse = await admin.members.list({
                        groupKey: group.email!,
                    });
                    memberCount = membersResponse.data.members?.length || 0;
                } catch {
                    // Ignore member count errors
                }

                const { error } = await supabase
                    .schema('rfp')
                    .from('group_directory')
                    .upsert({
                        google_id: group.id,
                        email: group.email,
                        name: group.name,
                        description: group.description,
                        member_count: memberCount,
                        synced_at: new Date().toISOString(),
                    }, { onConflict: 'email' });

                if (!error) syncedCount++;
            }

            pageToken = response.data.nextPageToken || undefined;
        } while (pageToken);

        // Log the sync
        await supabase.rpc('log_audit', {
            p_action: 'groups_synced',
            p_entity_type: 'group',
            p_entity_id: null,
            p_performed_by: 'system',
            p_details: { synced_count: syncedCount },
        });

        return { success: true, syncedCount };
    } catch (error: any) {
        console.error('Error syncing groups to database:', error);
        return {
            success: false,
            syncedCount: 0,
            error: error.message || 'Failed to sync groups',
        };
    }
}

