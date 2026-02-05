import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

interface FolderNode {
    text: string;
    name: string;
    driveId: string;
    limitedAccess: boolean;
    groups: { name: string; email?: string; role: string }[];
    users: { email: string; role: string }[];
    nodes: FolderNode[];
}

/**
 * GET /api/drive/extract-structure?folderId=xxx
 * Extract folder structure and permissions from a Google Drive folder
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get('folderId');

        if (!folderId) {
            return NextResponse.json(
                { success: false, error: 'folderId parameter required' },
                { status: 400 }
            );
        }

        // Initialize Google Drive API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        console.log(`[Extract] Starting extraction for folder: ${folderId}`);

        // Recursive function to get folder structure
        async function extractFolder(id: string, depth: number = 0): Promise<FolderNode> {
            const indent = '  '.repeat(depth);
            console.log(`${indent}📁 Extracting folder: ${id}`);

            // Get folder metadata
            const folderRes = await drive.files.get({
                fileId: id,
                fields: 'id,name,mimeType',
                supportsAllDrives: true,
            });

            const folderName = folderRes.data.name || 'Unknown';
            console.log(`${indent}   Name: ${folderName}`);

            // Get permissions
            let permissions: any[] = [];
            try {
                const permRes = await drive.permissions.list({
                    fileId: id,
                    fields: 'permissions(id,emailAddress,role,type,displayName)',
                    supportsAllDrives: true,
                });
                permissions = permRes.data.permissions || [];
                console.log(`${indent}   Permissions: ${permissions.length}`);
            } catch (e: any) {
                console.log(`${indent}   ⚠️ Cannot read permissions: ${e.message}`);
            }

            // Categorize permissions into groups and users
            const groups: { name: string; email?: string; role: string }[] = [];
            const users: { email: string; role: string }[] = [];

            for (const perm of permissions) {
                const email = perm.emailAddress || '';
                const role = perm.role || 'reader';
                const type = perm.type || 'user';

                // Skip owner-type permissions (usually the service account)
                if (role === 'owner') continue;

                if (type === 'group') {
                    groups.push({
                        name: email.split('@')[0],
                        email: email,
                        role: role,
                    });
                } else if (type === 'user' && email) {
                    users.push({
                        email: email,
                        role: role,
                    });
                }
            }

            // Determine if limited access (has specific permissions vs inherited)
            const limitedAccess = groups.length > 0 || users.length > 0;

            // Get child folders
            const childrenRes = await drive.files.list({
                q: `'${id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id,name)',
                orderBy: 'name',
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
            });

            const children = childrenRes.data.files || [];
            console.log(`${indent}   Children: ${children.length}`);

            // Recursively extract children
            const childNodes: FolderNode[] = [];
            for (const child of children) {
                if (child.id) {
                    const childNode = await extractFolder(child.id, depth + 1);
                    childNodes.push(childNode);
                }
            }

            return {
                text: folderName,
                name: folderName,
                driveId: id,
                limitedAccess,
                groups,
                users,
                nodes: childNodes,
            };
        }

        // Extract the structure
        const structure = await extractFolder(folderId);

        // Create template-compatible format
        function toTemplate(node: FolderNode): any {
            return {
                text: node.text,
                limitedAccess: node.limitedAccess,
                groups: node.groups.map(g => ({ name: g.name, role: g.role })),
                users: node.users,
                nodes: node.nodes.map(n => toTemplate(n)),
            };
        }

        const templateFormat = [toTemplate(structure)];

        console.log(`[Extract] Extraction complete!`);

        return NextResponse.json({
            success: true,
            folderId,
            folderName: structure.name,
            fullStructure: structure,
            templateFormat: templateFormat,
            stats: {
                totalFolders: countFolders(structure),
                foldersWithPermissions: countFoldersWithPermissions(structure),
            },
        });
    } catch (error: any) {
        console.error('[Extract] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Extraction failed' },
            { status: 500 }
        );
    }
}

function countFolders(node: FolderNode): number {
    return 1 + node.nodes.reduce((sum, child) => sum + countFolders(child), 0);
}

function countFoldersWithPermissions(node: FolderNode): number {
    const hasPerms = node.groups.length > 0 || node.users.length > 0 ? 1 : 0;
    return hasPerms + node.nodes.reduce((sum, child) => sum + countFoldersWithPermissions(child), 0);
}
