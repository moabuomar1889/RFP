import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listPermissions } from '@/server/google-drive';

/**
 * GET /api/admin/verify-folder?folderId=xxx
 * Verify a single folder's permissions against template expectations
 * CODE-FIRST: Uses Prisma Client
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get('folderId');

        if (!folderId) {
            return NextResponse.json(
                { error: 'folderId parameter required' },
                { status: 400 }
            );
        }

        // Get folder from database
        const folder = await prisma.folderIndex.findUnique({
            where: { id: folderId },
            include: {
                project: {
                    select: {
                        name: true,
                        pr_number: true
                    }
                }
            }
        });

        if (!folder) {
            return NextResponse.json(
                { error: 'Folder not found in database' },
                { status: 404 }
            );
        }

        // Get current permissions from Drive
        let actualPermissions;
        try {
            actualPermissions = await listPermissions(folder.drive_folder_id);
        } catch (error: any) {
            return NextResponse.json(
                { error: 'Failed to fetch Drive permissions', details: error.message },
                { status: 500 }
            );
        }

        // Parse expected permissions from folder_index
        const expectedGroups = folder.expected_groups as any[];
        const expectedUsers = folder.expected_users as any[];
        const expectedLimitedAccess = folder.expected_limited_access;

        // Build verification report
        const expectedEmails = new Set([
            ...expectedGroups.map(g => g.email?.toLowerCase()),
            ...expectedUsers.map(u => u.email?.toLowerCase())
        ].filter(Boolean));

        const actualEmails = new Set(
            actualPermissions
                .filter(p => p.type === 'user' || p.type === 'group')
                .map(p => p.emailAddress?.toLowerCase())
                .filter(Boolean)
        );

        const missing = Array.from(expectedEmails).filter(e => !actualEmails.has(e));
        const unexpected = Array.from(actualEmails).filter(e => !expectedEmails.has(e));

        const limitedAccessMatch = folder.actual_limited_access === expectedLimitedAccess;

        return NextResponse.json({
            folder: {
                id: folder.id,
                template_path: folder.template_path,
                drive_folder_id: folder.drive_folder_id,
                project_name: folder.project?.name,
                pr_number: folder.project?.pr_number
            },
            expected: {
                limited_access: expectedLimitedAccess,
                groups: expectedGroups,
                users: expectedUsers,
                total_principals: expectedEmails.size
            },
            actual: {
                limited_access: folder.actual_limited_access,
                permissions: actualPermissions.map(p => ({
                    type: p.type,
                    email: p.emailAddress,
                    role: p.role,
                    inherited: p.inherited
                })),
                total_principals: actualEmails.size
            },
            compliance: {
                is_compliant: folder.is_compliant,
                limited_access_match: limitedAccessMatch,
                missing_principals: missing,
                unexpected_principals: unexpected,
                last_verified_at: folder.last_verified_at
            }
        });

    } catch (error: any) {
        console.error('Verify folder API error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
