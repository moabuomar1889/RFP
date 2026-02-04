import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { moveFolder } from '@/server/google-drive';
import { APP_CONFIG } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/projects/[id]
 * Get a single project by ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('get_project_by_id', {
            p_id: id,
        });

        if (error) {
            console.error('Error fetching project:', error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        // RPC returns array, get first item
        const project = Array.isArray(data) ? data[0] : data;

        if (!project) {
            return NextResponse.json(
                { success: false, error: 'Project not found' },
                { status: 404 }
            );
        }

        const response = NextResponse.json({
            success: true,
            project,
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    } catch (error) {
        console.error('Error fetching project:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch project' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project:
 * 1. Move the Drive folder to "Deleted Projects" folder
 * 2. Delete from database
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabaseAdmin();

        // Step 1: Get project details (need the drive_folder_id)
        const { data: projectData, error: fetchError } = await supabase.rpc('get_project_by_id', {
            p_id: id,
        });

        if (fetchError) {
            console.error('Error fetching project for deletion:', fetchError);
            return NextResponse.json(
                { success: false, error: fetchError.message },
                { status: 500 }
            );
        }

        const project = Array.isArray(projectData) ? projectData[0] : projectData;

        if (!project) {
            return NextResponse.json(
                { success: false, error: 'Project not found' },
                { status: 404 }
            );
        }

        console.log(`Deleting project: ${project.pr_number} - ${project.name}`);
        console.log(`Project drive_folder_id: ${project.drive_folder_id || 'NULL'}`);

        // Step 2: Move Drive folder to Deleted Projects folder (if exists)
        let folderMoved = false;
        if (project.drive_folder_id) {
            try {
                console.log(`Attempting to move folder ${project.drive_folder_id} to ${APP_CONFIG.deletedProjectsFolderId}`);
                await moveFolder(
                    project.drive_folder_id,
                    APP_CONFIG.deletedProjectsFolderId
                );
                console.log(`Successfully moved folder ${project.drive_folder_id} to Deleted Projects`);
                folderMoved = true;
            } catch (driveError: any) {
                console.error('Error moving folder to Deleted Projects:', driveError?.message || driveError);
                // Continue with deletion even if folder move fails
                // (folder might not exist or already be deleted)
            }
        } else {
            console.log('No drive_folder_id found for this project, skipping folder move');
        }

        // Step 3: Delete related folder_index entries
        const { error: folderIndexError } = await supabase.rpc('delete_folder_index_by_project', {
            p_project_id: id,
        });

        if (folderIndexError) {
            console.warn('Error deleting folder index entries:', folderIndexError);
            // Continue - not critical
        }

        // Step 4: Delete project from database
        const { error: deleteError } = await supabase.rpc('delete_project', {
            p_id: id,
        });

        if (deleteError) {
            console.error('Error deleting project from database:', deleteError);
            return NextResponse.json(
                { success: false, error: deleteError.message },
                { status: 500 }
            );
        }

        console.log(`Successfully deleted project ${id}`);

        return NextResponse.json({
            success: true,
            message: `Project ${project.pr_number} deleted and moved to Deleted Projects folder`,
        });

    } catch (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete project' },
            { status: 500 }
        );
    }
}
