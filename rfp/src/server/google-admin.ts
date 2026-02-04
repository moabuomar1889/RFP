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

/**
 * Add a user to a Google Workspace group
 * Returns true if successful, false if failed
 */
export async function addGroupMember(
    groupEmail: string,
    userEmail: string,
    role: 'MEMBER' | 'MANAGER' | 'OWNER' = 'MEMBER'
): Promise<{ success: boolean; error?: string }> {
    const admin = await getAdminClient();

    try {
        await admin.members.insert({
            groupKey: groupEmail,
            requestBody: {
                email: userEmail,
                role: role,
            },
        });
        console.log(`Added ${userEmail} to group ${groupEmail}`);
        return { success: true };
    } catch (error: any) {
        // Check if user is already a member (409 conflict)
        if (error.code === 409) {
            console.log(`${userEmail} is already a member of ${groupEmail}`);
            return { success: true }; // Already a member is still success
        }
        console.error(`Failed to add ${userEmail} to group ${groupEmail}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Remove a user from a Google Workspace group
 * Returns true if successful, false if failed
 */
export async function removeGroupMember(
    groupEmail: string,
    userEmail: string
): Promise<{ success: boolean; error?: string }> {
    const admin = await getAdminClient();

    try {
        await admin.members.delete({
            groupKey: groupEmail,
            memberKey: userEmail,
        });
        console.log(`Removed ${userEmail} from group ${groupEmail}`);
        return { success: true };
    } catch (error: any) {
        // Check if user is not a member (404 not found)
        if (error.code === 404) {
            console.log(`${userEmail} is not a member of ${groupEmail}`);
            return { success: true }; // Not a member is still success for removal
        }
        console.error(`Failed to remove ${userEmail} from group ${groupEmail}:`, error.message);
        return { success: false, error: error.message };
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
                // Use RPC to upsert user (accesses rfp schema internally)
                const { error } = await supabase.rpc('upsert_user_directory', {
                    p_google_id: user.id,
                    p_email: user.primaryEmail,
                    p_name: user.name?.fullName || user.primaryEmail?.split('@')[0],
                    p_given_name: user.name?.givenName || null,
                    p_family_name: user.name?.familyName || null,
                    p_photo_url: user.thumbnailPhotoUrl || null,
                    p_department: user.organizations?.[0]?.department || null,
                    p_role: user.isAdmin ? 'Admin' : 'User',
                    p_status: user.suspended ? 'Suspended' : 'Active',
                    p_last_login: user.lastLoginTime || null,
                });

                if (!error) syncedCount++;
                else console.error('User upsert error:', error);
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

                // Use RPC to upsert group (accesses rfp schema internally)
                const { error } = await supabase.rpc('upsert_group_directory', {
                    p_google_id: group.id,
                    p_email: group.email,
                    p_name: group.name,
                    p_description: group.description || null,
                    p_member_count: memberCount,
                });

                if (!error) syncedCount++;
                else console.error('Group upsert error:', error);
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

