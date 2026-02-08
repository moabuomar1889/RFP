/**
 * Diagnostic endpoint: dump raw Drive API data for a folder
 * GET /api/audit/diagnose?folderId=xxx
 * 
 * Returns raw: files.get metadata + permissions.list with full permissionDetails
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient } from '@/server/google-drive';

export async function GET(request: NextRequest) {
    const folderId = request.nextUrl.searchParams.get('folderId');

    if (!folderId) {
        return NextResponse.json({ error: 'folderId param required' }, { status: 400 });
    }

    try {
        const drive = await getDriveClient();

        // 1) Folder metadata
        const fileRes = await drive.files.get({
            fileId: folderId,
            supportsAllDrives: true,
            fields: 'id,name,driveId,parents,inheritedPermissionsDisabled',
        });

        // 2) Permissions with full permissionDetails
        const permRes = await drive.permissions.list({
            fileId: folderId,
            supportsAllDrives: true,
            fields: 'permissions(id,type,role,emailAddress,domain,deleted,permissionDetails)',
        });

        const permissions = (permRes.data.permissions || []).map((p: any) => {
            // Extract inherited info from permissionDetails
            const details = (p.permissionDetails || []).map((d: any) => ({
                permissionType: d.permissionType,
                role: d.role,
                inherited: d.inherited,
                inheritedFrom: d.inheritedFrom,
            }));

            // DUAL-PERMISSION CHECK: if ANY entry has inherited:false → direct component exists
            const hasDirectComponent = details.some((d: any) => d.inherited === false);
            const isInheritedFromDetails = details.some((d: any) => d.inherited);
            const inheritedFromValue = details.find((d: any) => d.inherited)?.inheritedFrom;

            // Classification using same logic as shared helper
            const driveId = fileRes.data.driveId;
            let classification = 'NOT_INHERITED';
            if (hasDirectComponent) {
                classification = 'NOT_INHERITED';  // Direct component = removable
            } else if (isInheritedFromDetails) {
                if (inheritedFromValue === driveId) {
                    classification = 'NON_REMOVABLE_DRIVE_MEMBERSHIP';
                } else {
                    classification = 'REMOVABLE_PARENT_FOLDER';
                }
            }

            return {
                id: p.id,
                type: p.type,
                role: p.role,
                emailAddress: p.emailAddress,
                domain: p.domain,
                deleted: p.deleted,
                permissionDetails: details,
                _derived: {
                    isInherited: isInheritedFromDetails,
                    inheritedFrom: inheritedFromValue || null,
                    driveId,
                    driveIdMatch: inheritedFromValue === driveId,
                    classification,
                },
            };
        });

        return NextResponse.json({
            folder: {
                id: fileRes.data.id,
                name: fileRes.data.name,
                driveId: fileRes.data.driveId,
                parents: (fileRes.data as any).parents,
                inheritedPermissionsDisabled: fileRes.data.inheritedPermissionsDisabled,
            },
            permissionCount: permissions.length,
            permissions,
            _classificationSummary: {
                NOT_INHERITED: permissions.filter((p: any) => p._derived.classification === 'NOT_INHERITED').length,
                NON_REMOVABLE_DRIVE_MEMBERSHIP: permissions.filter((p: any) => p._derived.classification === 'NON_REMOVABLE_DRIVE_MEMBERSHIP').length,
                REMOVABLE_PARENT_FOLDER: permissions.filter((p: any) => p._derived.classification === 'REMOVABLE_PARENT_FOLDER').length,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
