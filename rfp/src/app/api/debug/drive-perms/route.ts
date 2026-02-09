import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/server/google-drive';

/**
 * DEBUG: Dump raw Drive API permission details for a folder
 * Usage: GET /api/debug/drive-perms?folderId=xxx
 * Purpose: Investigate "Access removed" vs "People with access" on limited-access folders
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
        return NextResponse.json({ error: 'folderId required' }, { status: 400 });
    }

    try {
        const drive = await getDriveClient();

        // 1. Get folder metadata (limited access flag, driveId)
        const folderMeta = await drive.files.get({
            fileId: folderId,
            supportsAllDrives: true,
            fields: 'id,name,driveId,inheritedPermissionsDisabled,parents'
        });

        // 2. Get ALL permission fields including view
        const permsResponse = await drive.permissions.list({
            fileId: folderId,
            supportsAllDrives: true,
            fields: 'permissions(id,type,role,emailAddress,domain,displayName,deleted,view,permissionDetails,expirationTime,pendingOwner)',
        });

        const permissions = permsResponse.data.permissions || [];

        // 3. For each permission, also try permissions.get with full fields
        const detailedPerms = [];
        for (const p of permissions) {
            let getResult: any = null;
            try {
                const res = await drive.permissions.get({
                    fileId: folderId,
                    permissionId: p.id!,
                    supportsAllDrives: true,
                    fields: '*'  // Get ALL fields
                });
                getResult = res.data;
            } catch (err: any) {
                getResult = { error: err.message };
            }
            detailedPerms.push({
                fromList: p,
                fromGet: getResult
            });
        }

        return NextResponse.json({
            folder: {
                id: folderMeta.data.id,
                name: folderMeta.data.name,
                driveId: (folderMeta.data as any).driveId,
                inheritedPermissionsDisabled: folderMeta.data.inheritedPermissionsDisabled,
                parents: (folderMeta.data as any).parents,
            },
            permissionCount: permissions.length,
            permissions: detailedPerms,
        }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
