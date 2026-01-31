import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createFolder } from '@/server/google-drive';
import { APP_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/requests/[id]/approve
 * Approve a project request and create the folder in Google Drive
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get session from cookie
        const session = request.cookies.get('rfp_session');
        const reviewedBy = session?.value || 'admin';

        const supabase = getSupabaseAdmin();

        // Step 1: Approve the request (creates project with pending_creation status)
        const { data, error } = await supabase.rpc('approve_request', {
            p_request_id: id,
            p_reviewed_by: reviewedBy,
        });

        if (error) {
            console.error('Error approving request:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data?.success === false) {
            return NextResponse.json({ success: false, error: data.error }, { status: 400 });
        }

        const projectId = data?.project_id;
        const projectName = data?.project_name;
        const prNumber = data?.pr_number;

        if (!projectId) {
            return NextResponse.json({
                success: true,
                message: 'Request approved (no project created)',
            });
        }

        // Step 2: Create folder in Google Drive
        let folderId = null;
        try {
            const folderName = `${prNumber} - ${projectName}`;
            console.log(`Creating Drive folder: ${folderName}`);

            const folder = await createFolder(
                folderName,
                APP_CONFIG.projectsFolderId
            );

            folderId = folder.id;
            console.log(`Created folder with ID: ${folderId}`);
        } catch (driveError) {
            console.error('Error creating Drive folder:', driveError);
            // Continue - folder creation failed but request is approved
            // The project stays in pending_creation status
            return NextResponse.json({
                success: true,
                message: 'Request approved but folder creation failed. Please create folder manually.',
                project_id: projectId,
                folder_error: String(driveError),
            });
        }

        // Step 3: Update project with folder ID and set status to active
        if (folderId) {
            const { error: updateError } = await supabase.rpc('update_project_folder', {
                p_project_id: projectId,
                p_drive_folder_id: folderId,
            });

            if (updateError) {
                console.error('Error updating project with folder ID:', updateError);
                // Folder was created but DB update failed - still return success
            }

            // Log the folder creation
            await supabase.rpc('log_audit', {
                p_action: 'folder_created',
                p_entity_type: 'project',
                p_entity_id: projectId,
                p_performed_by: reviewedBy,
                p_details: { folder_id: folderId, folder_name: `${prNumber} - ${projectName}` },
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Request approved and folder created',
            project_id: projectId,
            folder_id: folderId,
        });
    } catch (error) {
        console.error('Approve request error:', error);
        return NextResponse.json({ success: false, error: 'Failed to approve request' }, { status: 500 });
    }
}
