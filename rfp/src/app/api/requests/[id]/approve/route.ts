import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createFolder, createProjectFolderStructure } from '@/server/google-drive';
import { APP_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/requests/[id]/approve
 * Approve a project request and create the folder structure in Google Drive
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
        const phase = data?.phase || 'bidding';

        if (!projectId) {
            return NextResponse.json({
                success: true,
                message: 'Request approved (no project created)',
            });
        }

        // Step 2: Create main project folder in Google Drive
        let rootFolderId = null;
        try {
            const folderName = `${prNumber} - ${projectName}`;
            console.log(`Creating Drive folder: ${folderName}`);

            const folder = await createFolder(
                folderName,
                APP_CONFIG.projectsFolderId
            );

            rootFolderId = folder.id;
            console.log(`Created root folder with ID: ${rootFolderId}`);
        } catch (driveError) {
            console.error('Error creating Drive folder:', driveError);
            return NextResponse.json({
                success: true,
                message: 'Request approved but folder creation failed. Please create folder manually.',
                project_id: projectId,
                folder_error: String(driveError),
            });
        }

        // Step 3: Get active template using RPC (not .schema!)
        let templateJson = null;
        try {
            const { data: template, error: templateError } = await supabase.rpc('get_active_template');

            if (templateError) {
                console.error('Error fetching template via RPC:', templateError);
            } else {
                // RPC returns array (TABLE), so we need first row
                const templateRow = Array.isArray(template) ? template[0] : template;
                templateJson = templateRow?.template_json;
                console.log('Template fetched:', {
                    hasTemplate: !!templateJson,
                    isArray: Array.isArray(templateJson),
                    topLevelKeys: templateJson ? Object.keys(templateJson) : [],
                    firstNodeText: Array.isArray(templateJson) ? templateJson[0]?.text : templateJson?.folders?.[0]?.text,
                });
            }
        } catch (templateError) {
            console.error('Error fetching template:', templateError);
        }

        // Step 4: Create folder structure from template
        let createdFolders: any[] = [];
        if (templateJson && rootFolderId) {
            try {
                console.log(`Creating folder structure for phase: ${phase}`);
                createdFolders = await createProjectFolderStructure(
                    rootFolderId,
                    templateJson,
                    phase
                );
                console.log(`Created ${createdFolders.length} subfolders`);

                // Save created folders to folder_index table using RPC
                for (const folder of createdFolders) {
                    const { error: indexError } = await supabase.rpc('insert_folder_index', {
                        p_project_id: projectId,
                        p_template_path: folder.templatePath,
                        p_drive_folder_id: folder.driveFolderId,
                        p_drive_folder_name: folder.driveFolderName,
                        p_limited_access_enabled: folder.limitedAccessEnabled,
                    });

                    if (indexError) {
                        console.error('Error inserting folder index:', indexError);
                    }
                }
            } catch (structureError) {
                console.error('Error creating folder structure:', structureError);
                // Continue - main folder was created
            }
        }

        // Step 5: Update project with folder ID and set status to active
        if (rootFolderId) {
            const { error: updateError } = await supabase.rpc('update_project_folder', {
                p_project_id: projectId,
                p_drive_folder_id: rootFolderId,
            });

            if (updateError) {
                console.error('Error updating project with folder ID:', updateError);
            }

            // Log the folder creation
            await supabase.rpc('log_audit', {
                p_action: 'folder_created',
                p_entity_type: 'project',
                p_entity_id: projectId,
                p_performed_by: reviewedBy,
                p_details: {
                    folder_id: rootFolderId,
                    folder_name: `${prNumber} - ${projectName}`,
                    subfolders_created: createdFolders.length,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: `Request approved, folder created with ${createdFolders.length} subfolders`,
            project_id: projectId,
            folder_id: rootFolderId,
            subfolders_count: createdFolders.length,
        });
    } catch (error) {
        console.error('Approve request error:', error);
        return NextResponse.json({ success: false, error: 'Failed to approve request' }, { status: 500 });
    }
}
