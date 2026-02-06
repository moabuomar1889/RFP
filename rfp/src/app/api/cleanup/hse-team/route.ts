import { NextRequest, NextResponse } from 'next/server';
import { listPermissions, removePermission } from '@/server/google-drive';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/cleanup/hse-team
 * Remove HSE-Team from all Bidding folders across all projects
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const targetEmail = body.email || 'hse-team@dtgsa.com';
        const dryRun = body.dryRun !== false; // Default to dry run for safety

        console.log(`Starting HSE-Team cleanup (dryRun: ${dryRun}, target: ${targetEmail})`);

        // Get all Bidding folders from folder_index
        const { data: biddingFolders, error } = await supabaseAdmin
            .schema('rfp')
            .from('folder_index')
            .select('id, project_id, drive_folder_id, template_path, physical_path')
            .ilike('template_path', '%Bidding%')
            .not('drive_folder_id', 'is', null);

        if (error) {
            console.error('Error fetching folders:', error);
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        const results: any[] = [];
        let removed = 0;
        let skipped = 0;
        let failed = 0;

        for (const folder of biddingFolders || []) {
            try {
                // Get permissions for this folder
                const permissions = await listPermissions(folder.drive_folder_id);

                // Find HSE-Team permission
                const hsePermission = permissions.find(
                    p => p.emailAddress?.toLowerCase() === targetEmail.toLowerCase()
                );

                if (!hsePermission) {
                    skipped++;
                    continue;
                }

                const result: {
                    folder_id: any;
                    drive_folder_id: any;
                    template_path: any;
                    permission_id: string | null | undefined;
                    email: string | null | undefined;
                    role: string | null | undefined;
                    inherited: boolean;
                    action: string;
                    error?: string;
                } = {
                    folder_id: folder.id,
                    drive_folder_id: folder.drive_folder_id,
                    template_path: folder.template_path,
                    permission_id: hsePermission.id,
                    email: hsePermission.emailAddress,
                    role: hsePermission.role,
                    inherited: hsePermission.permissionDetails?.[0]?.inherited || false,
                    action: dryRun ? 'would_remove' : 'removing'
                };

                if (!dryRun) {
                    try {
                        await removePermission(folder.drive_folder_id, hsePermission.id!);
                        result.action = 'removed';
                        removed++;
                    } catch (removeError: any) {
                        result.action = 'failed';
                        result.error = removeError.message;
                        failed++;
                    }
                } else {
                    removed++; // Count as "would remove" in dry run
                }

                results.push(result);

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (err: any) {
                results.push({
                    folder_id: folder.id,
                    template_path: folder.template_path,
                    action: 'error',
                    error: err.message
                });
                failed++;
            }
        }

        return NextResponse.json({
            success: true,
            dryRun,
            targetEmail,
            summary: {
                totalFolders: biddingFolders?.length || 0,
                removed,
                skipped,
                failed
            },
            results
        });

    } catch (error: any) {
        console.error('Cleanup error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
