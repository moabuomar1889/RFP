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
        const prNumber = data?.pr_number; // This is PR-XXX or PRJ-XXX format
        const phase = data?.phase || 'bidding';
        const requestType = data?.request_type;
        const existingFolderId = data?.existing_folder_id;

        // Extract project number for folder naming (convert PR-XXX to PRJ-XXX if needed)
        const projectNumber = prNumber?.startsWith('PR-')
            ? prNumber.replace('PR-', 'PRJ-')
            : prNumber || 'PRJ-000';

        if (!projectId) {
            return NextResponse.json({
                success: true,
                message: 'Request approved (no project created)',
            });
        }

        console.log(`Processing ${requestType} request for ${projectNumber} - ${projectName}`);
        console.log(`Phase: ${phase}, Existing folder: ${existingFolderId || 'none'}`);

        // Step 2: Determine root folder ID
        // For new projects: create new root folder
        // For upgrades: use existing folder
        let rootFolderId = null;

        if (requestType === 'upgrade_to_pd' && existingFolderId) {
            // UPGRADE: Use existing project folder - don't create a new one!
            console.log(`Upgrade: Using existing folder ${existingFolderId}`);
            rootFolderId = existingFolderId;
        } else {
            // NEW PROJECT: Create main project folder in Google Drive
            // Format: PRJ-001-ProjectName
            try {
                const folderName = `${projectNumber}-${projectName}`;
                console.log(`Creating new root folder: ${folderName}`);

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

                // Debug: Log full template structure
                console.log('=== TEMPLATE DEBUG ===');
                console.log('Template fetched:', {
                    hasTemplate: !!templateJson,
                    isArray: Array.isArray(templateJson),
                    topLevelKeys: templateJson ? Object.keys(templateJson) : [],
                });

                // Log each top-level node and its structure
                const templateArray = Array.isArray(templateJson) ? templateJson : templateJson?.folders || [];
                for (const node of templateArray) {
                    console.log(`Top-level node: ${node.text || node.name}`, {
                        hasChildren: !!(node.nodes || node.children),
                        childCount: (node.nodes || node.children || []).length,
                        hasGroups: !!(node.groups && node.groups.length > 0),
                    });
                }
                console.log('Full template (first 2000 chars):', JSON.stringify(templateJson).substring(0, 2000));
            }
        } catch (templateError) {
            console.error('Error fetching template:', templateError);
        }

        // Step 4: Create folder structure from template
        // For new project: creates PRJ-XXX-RFP-* folders (bidding)
        // For upgrade: creates PRJ-XXX-PD-* folders (execution) inside existing folder
        let createdFolders: any[] = [];
        if (templateJson && rootFolderId) {
            try {
                // Use 'execution' phase for upgrades to create PD folders
                const folderPhase = requestType === 'upgrade_to_pd' ? 'execution' : phase;
                console.log(`Creating folder structure for phase: ${folderPhase}, project: ${projectNumber}`);

                createdFolders = await createProjectFolderStructure(
                    rootFolderId,
                    templateJson,
                    folderPhase,
                    projectNumber  // Pass project number for folder naming
                );
                console.log(`Created ${createdFolders.length} subfolders for ${folderPhase} phase`);

                // Save created folders to folder_index table using RPC
                for (const folder of createdFolders) {
                    const { error: indexError } = await supabase.rpc('upsert_folder_index', {
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
        // Only update folder ID for new projects (upgrades already have it)
        if (rootFolderId && requestType !== 'upgrade_to_pd') {
            const { error: updateError } = await supabase.rpc('update_project_folder', {
                p_project_id: projectId,
                p_drive_folder_id: rootFolderId,
            });

            if (updateError) {
                console.error('Error updating project with folder ID:', updateError);
            }
        }

        // Log the folder creation
        await supabase.rpc('log_audit', {
            p_action: requestType === 'upgrade_to_pd' ? 'project_upgraded_to_pd' : 'folder_created',
            p_entity_type: 'project',
            p_entity_id: projectId,
            p_performed_by: reviewedBy,
            p_details: {
                folder_id: rootFolderId,
                folder_name: `${prNumber} - ${projectName}`,
                subfolders_created: createdFolders.length,
                request_type: requestType,
            },
        });

        return NextResponse.json({
            success: true,
            message: requestType === 'upgrade_to_pd'
                ? `Project upgraded to Project Delivery with ${createdFolders.length} PD folders created`
                : `Request approved, folder created with ${createdFolders.length} subfolders`,
            project_id: projectId,
            folder_id: rootFolderId,
            subfolders_count: createdFolders.length,
        });
    } catch (error) {
        console.error('Approve request error:', error);
        return NextResponse.json({ success: false, error: 'Failed to approve request' }, { status: 500 });
    }
}
