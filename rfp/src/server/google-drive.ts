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
 * Move a folder to a different parent folder
 * Used for moving deleted projects to the Deleted Projects folder
 */
export async function moveFolder(
    folderId: string,
    newParentId: string
): Promise<drive_v3.Schema$File> {
    const drive = await getDriveClient();

    // First get current parents
    const file = await drive.files.get({
        fileId: folderId,
        fields: 'parents',
        supportsAllDrives: true,
    });

    const previousParents = file.data.parents?.join(',') || '';

    // Move to new parent
    const response = await drive.files.update({
        fileId: folderId,
        addParents: newParentId,
        removeParents: previousParents,
        supportsAllDrives: true,
        fields: 'id, name, parents',
    });

    console.log(`Moved folder ${folderId} to ${newParentId}`);
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
 * Apply limited access to a folder by removing inherited permissions
 * Only keeps the owner and specified groups/users
 */
export async function applyLimitedAccess(
    folderId: string,
    allowedEmails: string[],
    protectedEmails: string[] = ['admin@dtgsa.com', 'mo.abuomar@dtgsa.com']
): Promise<void> {
    console.log(`\n========== APPLYING LIMITED ACCESS ==========`);
    console.log(`Folder ID: ${folderId}`);
    console.log(`Allowed emails: ${JSON.stringify(allowedEmails)}`);

    const permissions = await listPermissions(folderId);
    console.log(`Found ${permissions.length} existing permissions`);

    // Normalize allowed emails to lowercase
    const allowedSet = new Set(allowedEmails.map(e => e.toLowerCase()));
    const protectedSet = new Set(protectedEmails.map(e => e.toLowerCase()));

    let removedCount = 0;
    let keptCount = 0;

    for (const perm of permissions) {
        console.log(`Checking permission: type=${perm.type}, role=${perm.role}, email=${perm.emailAddress || perm.domain}`);

        // Skip owner - cannot remove owner
        if (perm.role === 'owner') {
            console.log(`  -> KEEPING: Owner cannot be removed`);
            keptCount++;
            continue;
        }

        // For domain permissions - always remove for limited access folders
        if (perm.type === 'domain') {
            try {
                console.log(`  -> REMOVING: Domain permission ${perm.domain}`);
                await removePermission(folderId, perm.id!);
                removedCount++;
            } catch (error: any) {
                console.error(`  -> FAILED to remove domain permission: ${error.message}`);
            }
            continue;
        }

        const email = perm.emailAddress?.toLowerCase();
        if (!email) {
            console.log(`  -> SKIPPING: No email address`);
            continue;
        }

        // Skip if this email is allowed or protected
        if (allowedSet.has(email) || protectedSet.has(email)) {
            console.log(`  -> KEEPING: Email is allowed or protected`);
            keptCount++;
            continue;
        }

        // Remove this permission
        try {
            console.log(`  -> REMOVING: ${email} (${perm.role})`);
            await removePermission(folderId, perm.id!);
            removedCount++;
        } catch (error: any) {
            console.error(`  -> FAILED to remove ${email}: ${error.message}`);
        }
    }

    console.log(`========== LIMITED ACCESS COMPLETE ==========`);
    console.log(`Removed: ${removedCount}, Kept: ${keptCount}`);
    console.log(`=============================================\n`);
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

interface TemplateNode {
    text?: string;
    name?: string;
    nodes?: TemplateNode[];
    children?: TemplateNode[];
    limitedAccess?: boolean;
    groups?: any[];
    users?: any[];
    folderType?: string;
}

interface CreatedFolder {
    templatePath: string;
    driveFolderId: string;
    driveFolderName: string;
    limitedAccessEnabled: boolean;
}

/**
 * Create project folder structure from template
 * All folders get the naming convention: PRJ-XXX-RFP-FolderName or PRJ-XXX-PD-FolderName
 * 
 * @param projectRootFolderId - The root folder (PRJ-001-ProjectName) ID
 * @param templateJson - Template with folder structure
 * @param phase - 'bidding' (RFP) or 'execution' (PD)
 * @param projectNumber - Project number like "PRJ-001"
 */
export async function createProjectFolderStructure(
    projectRootFolderId: string,
    templateJson: TemplateNode[] | { folders: TemplateNode[] },
    phase: 'bidding' | 'execution' = 'bidding',
    projectNumber: string = 'PRJ-000'
): Promise<CreatedFolder[]> {
    const createdFolders: CreatedFolder[] = [];

    // Determine phase suffix: RFP for bidding, PD for project delivery
    const phaseCode = phase === 'bidding' ? 'RFP' : 'PD';
    const prefix = `${projectNumber}-${phaseCode}`;

    console.log(`Creating folder structure with prefix: ${prefix}`);

    // Handle both array format and object format
    const templateArray = Array.isArray(templateJson)
        ? templateJson
        : templateJson.folders || [];

    console.log(`Template has ${templateArray.length} top-level nodes`);

    // Find the correct phase node in template
    // Template has two root nodes: "Bidding" and "Project Delivery" (execution)
    // Support both 'text' and 'name' properties
    let phaseNode: TemplateNode | undefined;
    for (const node of templateArray) {
        const nodeName = (node.text || node.name || '').toLowerCase();
        console.log(`Checking node: "${node.text || node.name}" for phase "${phase}"`);

        if (phase === 'bidding' && nodeName.includes('bidding')) {
            phaseNode = node;
            console.log(`Found bidding phase node: ${node.text || node.name}`);
            break;
        } else if (phase === 'execution' && (nodeName.includes('delivery') || nodeName.includes('execution'))) {
            phaseNode = node;
            console.log(`Found execution phase node: ${node.text || node.name}`);
            break;
        }
    }

    if (!phaseNode) {
        console.warn(`No phase node found for "${phase}" in template. Creating empty structure.`);
        console.warn(`Available nodes: ${templateArray.map(n => n.text || n.name).join(', ')}`);
        return createdFolders;
    }

    // Step 1: Create the phase folder (PRJ-001-RFP or PRJ-001-PD) inside root
    const phaseFolderName = prefix;
    console.log(`Creating phase folder: ${phaseFolderName}`);

    const phaseFolder = await createFolder(phaseFolderName, projectRootFolderId);

    createdFolders.push({
        templatePath: phaseNode.text || phaseNode.name || '',
        driveFolderId: phaseFolder.id!,
        driveFolderName: phaseFolderName,
        limitedAccessEnabled: phaseNode.limitedAccess || false,
    });

    // Apply Smart Permissions to Phase Folder
    // Use the helper we defined below (hoisted) or ensure it's available
    // Note: JS functions are hoisted, so hasLimitedDescendants is available if defined in scope
    const phaseHasRestrictedDescendants = hasLimitedDescendants(phaseNode);

    const phaseGroups = phaseNode.groups || [];

    let phaseGroupsToApply: any[] = [];
    let phaseGroupsToPush: any[] = [];

    if (phaseNode.limitedAccess) {
        phaseGroupsToApply = phaseGroups;
        phaseGroupsToPush = [];
    } else if (phaseHasRestrictedDescendants) {
        console.log(`  [PRIVACY] Phase Node ${phaseFolderName} has LIMITED descendants.`);
        phaseGroupsToApply = phaseGroups.filter((g: any) => {
            const role = (g.role || 'reader').toLowerCase();
            return role === 'organizer' || role === 'fileorganizer' || role === 'owner';
        });
        phaseGroupsToPush = phaseGroups.filter((g: any) => !phaseGroupsToApply.includes(g));
    } else {
        phaseGroupsToApply = phaseGroups;
        phaseGroupsToPush = [];
    }

    // Apply safe permissions to phase folder
    for (const group of phaseGroupsToApply) {
        const email = group.email || group.name;
        if (email) {
            try {
                await addPermission(phaseFolder.id!, 'group', group.role || 'reader', email);
                console.log(`Applied phase permission: ${email}`);
            } catch (e: any) {
                console.error(`Failed phase permission ${email}:`, e.message);
            }
        }
    }

    // Helper: Check if a node has any limited access descendants
    function hasLimitedDescendants(node: TemplateNode): boolean {
        const children = node.nodes || node.children || [];
        if (children.length === 0) return false;

        // Immediate child check
        if (children.some(child => child.limitedAccess)) return true;

        // Recursive check
        return children.some(child => hasLimitedDescendants(child));
    }

    // Step 2: Create all child folders with the prefix
    async function createFoldersRecursively(
        nodes: TemplateNode[],
        parentId: string,
        parentPath: string,
        pushedPermissions: any[] = [] // Permissions passed down from parent due to restriction
    ): Promise<void> {
        for (const node of nodes) {
            const nodeName = node.text || node.name;
            if (!nodeName) continue;

            // Folder name: PRJ-001-RFP-FolderName (e.g., PRJ-001-RFP-Pre-Tender Meeting)
            const folderName = `${prefix}-${nodeName}`;
            const templatePath = parentPath ? `${parentPath}/${nodeName}` : nodeName;

            // DEBUG: Log template node data (Reduced logs)
            console.log(`\n=== Creating folder: ${folderName} ===`);
            // console.log(`Template path: ${templatePath}`);

            // Determine if we need to "Push Down" permissions
            const isLimited = node.limitedAccess;
            const hasRestrictedDescendants = hasLimitedDescendants(node);

            // Combine template groups with pushed permissions
            // We use a Map to merge duplicates by email/role key
            const combinedGroups = [...(node.groups || []), ...pushedPermissions];

            // Deduplicate groups (prefer template rule over pushed rule)
            const uniqueGroupsMap = new Map();
            for (const g of combinedGroups) {
                const key = (g.email || g.name || '').toLowerCase();
                if (key && !uniqueGroupsMap.has(key)) {
                    uniqueGroupsMap.set(key, g);
                }
            }
            const allGroups = Array.from(uniqueGroupsMap.values());

            let groupsToApplyHere: any[] = [];
            let groupsToPushDown: any[] = [];

            if (isLimited) {
                console.log(`  [PRIVACY] Node is LIMITED ACCESS. Breaking inheritance.`);
                groupsToApplyHere = node.groups || [];
                groupsToPushDown = [];
            } else if (hasRestrictedDescendants) {
                console.log(`  [PRIVACY] Node has LIMITED descendants. Pushing 'unsafe' permissions down.`);

                // Apply ONLY Owners/Organizers/FileOrganizers (Admins/Managers).
                groupsToApplyHere = allGroups.filter(g => {
                    const role = (g.role || 'reader').toLowerCase();
                    return role === 'organizer' || role === 'fileorganizer' || role === 'owner';
                });

                // Unsafe groups (Readers, Writers) are pushed to children
                groupsToPushDown = allGroups.filter(g => !groupsToApplyHere.includes(g));

                console.log(`  -> Applied to Self: ${groupsToApplyHere.map(g => g.email).join(', ')}`);
                console.log(`  -> Pushed to Children: ${groupsToPushDown.map(g => g.email).join(', ')}`);
            } else {
                console.log(`  [PRIVACY] Node is SAFE (No limited descendants). Applying all permissions.`);
                groupsToApplyHere = allGroups;
                groupsToPushDown = [];
            }

            // Create the folder in Drive
            const folder = await createFolder(folderName, parentId);

            // Track created folder
            createdFolders.push({
                templatePath: templatePath,
                driveFolderId: folder.id!,
                driveFolderName: folderName, // Store the actual Drive folder name
                limitedAccessEnabled: node.limitedAccess || false,
            });

            // Apply calculated group permissions (Safe subset)
            if (groupsToApplyHere.length > 0) {
                for (const group of groupsToApplyHere) {
                    const groupEmail = group.email || group.name;
                    if (groupEmail) {
                        try {
                            await addPermission(
                                folder.id!,
                                'group',
                                group.role || 'reader',
                                groupEmail
                            );
                            console.log(`Applied group permission: ${groupEmail} (${group.role || 'reader'}) to ${folderName}`);
                        } catch (err: any) {
                            console.error(`Failed to add group ${groupEmail} to ${folderName}:`, err.message || err);
                        }
                    }
                }
            }

            // Apply user permissions from template
            if (node.users && node.users.length > 0) {
                for (const user of node.users) {
                    if (user.email) {
                        try {
                            await addPermission(
                                folder.id!,
                                'user',
                                user.role || 'reader',
                                user.email
                            );
                            console.log(`Applied user permission: ${user.email} (${user.role || 'reader'}) to ${folderName}`);
                        } catch (err: any) {
                            console.error(`Failed to add user ${user.email} to ${folderName}:`, err.message || err);
                        }
                    }
                }
            }

            // Apply limited access - remove inherited permissions not in template
            if (node.limitedAccess) {
                console.log(`\n>>> Applying LIMITED ACCESS to ${folderName} <<<`);

                // Build list of allowed emails from template groups and users
                const allowedEmails: string[] = [];

                if (node.groups) {
                    for (const group of node.groups) {
                        const email = group.email || group.name;
                        if (email) allowedEmails.push(email);
                    }
                }

                if (node.users) {
                    for (const user of node.users) {
                        if (user.email) allowedEmails.push(user.email);
                    }
                }

                // Apply limited access (remove inherited permissions not in allowed list)
                await applyLimitedAccess(folder.id!, allowedEmails);
            }

            // Create children recursively (nested inside this folder)
            // Support both 'nodes' and 'children' arrays
            const childNodes = node.nodes || node.children || [];
            if (childNodes.length > 0) {
                await createFoldersRecursively(childNodes, folder.id!, templatePath, groupsToPushDown);
            }
        }
    }

    // Start creating from the phase node's children
    // Support both 'nodes' and 'children' arrays
    const phaseChildren = phaseNode.nodes || phaseNode.children || [];
    const phaseNodeName = phaseNode.text || phaseNode.name || '';
    if (phaseChildren.length > 0) {
        await createFoldersRecursively(phaseChildren, phaseFolder.id!, phaseNodeName, phaseGroupsToPush);
    }

    console.log(`Created ${createdFolders.length} folders with prefix ${prefix}`);
    return createdFolders;
}

