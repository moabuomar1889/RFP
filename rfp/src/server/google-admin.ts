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
