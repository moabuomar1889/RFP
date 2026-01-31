import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CONFIG, APP_CONFIG, DriveRole, PermissionType } from '@/lib/config';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt, encrypt } from '@/lib/crypto';

/**
 * Get OAuth2 client with valid tokens
 */
export async function getOAuth2Client(): Promise<OAuth2Client> {
    const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CONFIG.clientId,
        GOOGLE_CONFIG.clientSecret,
        GOOGLE_CONFIG.redirectUri
    );

    // Get stored tokens from database using RPC (bypasses schema issue)
    const supabase = getSupabaseAdmin();
    const { data: tokenData, error } = await supabase.rpc('get_user_token_full', {
        p_email: APP_CONFIG.adminEmail
    });

    if (error || !tokenData) {
        console.error('Token fetch error:', error);
        throw new Error('No stored tokens found. Please login first.');
    }

    const accessToken = decrypt(tokenData.access_token_encrypted);
    const refreshToken = decrypt(tokenData.refresh_token_encrypted);

    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: new Date(tokenData.token_expiry).getTime(),
    });

    // Check if token is expired and refresh if needed
    const tokenInfo = oauth2Client.credentials;
    if (tokenInfo.expiry_date && tokenInfo.expiry_date < Date.now()) {
        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update stored tokens using RPC
        await supabase.rpc('update_user_token', {
            p_email: APP_CONFIG.adminEmail,
            p_access_token: encrypt(credentials.access_token!),
            p_token_expiry: new Date(credentials.expiry_date!).toISOString(),
        });

        oauth2Client.setCredentials(credentials);
    }

    return oauth2Client;
}

/**
 * Get Google Drive API v3 client
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
    const auth = await getOAuth2Client();
    return google.drive({ version: 'v3', auth });
}

/**
 * List folders in a Shared Drive
 */
export async function listFolders(
    parentId: string,
    driveId: string = APP_CONFIG.sharedDriveId
): Promise<drive_v3.Schema$File[]> {
    const drive = await getDriveClient();

    const response = await drive.files.list({
        q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        driveId,
        corpora: 'drive',
        fields: 'files(id, name, parents, mimeType, createdTime, modifiedTime)',
    });

    return response.data.files || [];
}

/**
 * Get a single folder by ID
 */
export async function getFolder(folderId: string): Promise<drive_v3.Schema$File | null> {
    const drive = await getDriveClient();

    try {
        const response = await drive.files.get({
            fileId: folderId,
            supportsAllDrives: true,
            fields: 'id, name, parents, mimeType, createdTime, modifiedTime',
        });
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * Create a folder in Shared Drive
 */
export async function createFolder(
    name: string,
    parentId: string,
    driveId: string = APP_CONFIG.sharedDriveId
): Promise<drive_v3.Schema$File> {
    const drive = await getDriveClient();

    const response = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        supportsAllDrives: true,
        fields: 'id, name, parents',
    });

    return response.data;
}

/**
 * Rename a folder
 */
export async function renameFolder(
    folderId: string,
    newName: string
): Promise<drive_v3.Schema$File> {
    const drive = await getDriveClient();

    const response = await drive.files.update({
        fileId: folderId,
        requestBody: { name: newName },
        supportsAllDrives: true,
        fields: 'id, name',
    });

    return response.data;
}

/**
 * Enable/disable inherited permissions (Limited Access)
 */
export async function setLimitedAccess(
    folderId: string,
    enabled: boolean
): Promise<void> {
    const drive = await getDriveClient();

    await drive.files.update({
        fileId: folderId,
        requestBody: {
            // Note: This is done via permissions, not a folder property
        },
        supportsAllDrives: true,
    });
}

/**
 * List permissions on a folder
 */
export async function listPermissions(
    folderId: string
): Promise<drive_v3.Schema$Permission[]> {
    const drive = await getDriveClient();

    const response = await drive.permissions.list({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'permissions(id, type, role, emailAddress, domain, displayName, deleted, permissionDetails)',
    });

    return response.data.permissions || [];
}

/**
 * Add a permission to a folder
 */
export async function addPermission(
    folderId: string,
    type: PermissionType,
    role: DriveRole,
    emailOrDomain: string
): Promise<drive_v3.Schema$Permission> {
    const drive = await getDriveClient();

    const permissionBody: drive_v3.Schema$Permission = {
        type,
        role: role === 'organizer' ? 'fileOrganizer' : role, // organizer only at drive root
    };

    if (type === 'user' || type === 'group') {
        permissionBody.emailAddress = emailOrDomain;
    } else if (type === 'domain') {
        permissionBody.domain = emailOrDomain;
    }

    const response = await drive.permissions.create({
        fileId: folderId,
        requestBody: permissionBody,
        supportsAllDrives: true,
        sendNotificationEmail: false,
        fields: 'id, type, role, emailAddress, domain',
    });

    return response.data;
}

/**
 * Remove a permission from a folder
 */
export async function removePermission(
    folderId: string,
    permissionId: string
): Promise<void> {
    const drive = await getDriveClient();

    await drive.permissions.delete({
        fileId: folderId,
        permissionId,
        supportsAllDrives: true,
    });
}

/**
 * Check if a permission is protected (should never be removed)
 */
export async function isProtectedPermission(
    permission: drive_v3.Schema$Permission,
    protectedPrincipals: string[]
): Promise<boolean> {
    const email = permission.emailAddress?.toLowerCase();

    if (!email) return false;

    return protectedPrincipals.some(p => p.toLowerCase() === email);
}

/**
 * Get all projects (folders in the Projects folder)
 */
export async function getAllProjects(): Promise<drive_v3.Schema$File[]> {
    const drive = await getDriveClient();

    // Use projectsFolderId as the parent for project folders
    const parentFolderId = APP_CONFIG.projectsFolderId;

    console.log('getAllProjects: Starting with projectsFolderId:', parentFolderId);
    console.log('getAllProjects: sharedDriveId:', APP_CONFIG.sharedDriveId);

    const response = await drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        driveId: APP_CONFIG.sharedDriveId,
        corpora: 'drive',
        orderBy: 'name',
        pageSize: 1000,
        fields: 'files(id, name, parents, createdTime, modifiedTime)',
    });

    console.log('getAllProjects: Raw response files count:', response.data.files?.length || 0);

    // Log first few folder names for debugging
    const allFolders = response.data.files || [];
    console.log('getAllProjects: First 5 folder names:', allFolders.slice(0, 5).map(f => f.name));

    // Filter to only project folders (matching PRJ-XXX pattern)
    // Example: PRJ-005-Construction of Site Occupied Buildings
    const projects = allFolders.filter(f =>
        f.name && /^PRJ-\d+-/.test(f.name)
    );

    console.log(`getAllProjects: Found ${allFolders.length} total folders, ${projects.length} matching PRJ pattern`);

    return projects;
}

/**
 * Recursively get all folders in a project
 */
export async function getAllFoldersRecursive(
    parentId: string,
    path: string = '',
    results: Array<{ id: string; name: string; path: string; parentId: string }> = []
): Promise<Array<{ id: string; name: string; path: string; parentId: string }>> {
    const folders = await listFolders(parentId);

    for (const folder of folders) {
        const folderPath = path ? `${path}/${folder.name}` : folder.name!;
        results.push({
            id: folder.id!,
            name: folder.name!,
            path: folderPath,
            parentId,
        });

        // Recursively get children
        await getAllFoldersRecursive(folder.id!, folderPath, results);
    }

    return results;
}
