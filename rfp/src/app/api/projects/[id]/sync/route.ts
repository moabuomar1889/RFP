import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAllFoldersRecursive } from '@/server/google-drive';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/sync
 * Direct sync - immediately scan and index project folders from Drive
 * No Inngest required - runs synchronously
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabaseAdmin();

        console.log(`Starting direct sync for project ${id}`);

        // Get project using RPC
        const { data: projectData, error: projectError } = await supabase.rpc('get_project', {
            p_id: id,
        });

        if (projectError) {
            console.error('Error fetching project:', projectError);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch project' },
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

        if (!project.drive_folder_id) {
            return NextResponse.json(
                { success: false, error: 'Project has no Drive folder ID' },
                { status: 400 }
            );
        }

        console.log(`Scanning Drive folder: ${project.drive_folder_id}`);

        // Get all folders from Drive
        let folders: any[] = [];
        try {
            folders = await getAllFoldersRecursive(project.drive_folder_id);
            console.log(`Found ${folders.length} folders in Drive`);
        } catch (driveError) {
            console.error('Error scanning Drive folders:', driveError);
            return NextResponse.json(
                { success: false, error: 'Failed to scan Drive folders' },
                { status: 500 }
            );
        }

        // Insert/update folder index using RPC
        let indexed = 0;
        for (const folder of folders) {
            try {
                const { error: indexError } = await supabase.rpc('upsert_folder_index', {
                    p_project_id: id,
                    p_template_path: folder.path || folder.name,
                    p_drive_folder_id: folder.id,
                    p_drive_folder_name: folder.name,
                });

                if (indexError) {
                    console.error(`Error indexing folder ${folder.name}:`, indexError);
                } else {
                    indexed++;
                }
            } catch (e) {
                console.error(`Exception indexing folder ${folder.name}:`, e);
            }
        }

        // Update project last_synced_at
        await supabase.rpc('update_project_sync', {
            p_id: id,
        });

        console.log(`Sync complete: indexed ${indexed} of ${folders.length} folders`);

        return NextResponse.json({
            success: true,
            message: `Synced ${indexed} folders`,
            folders_found: folders.length,
            folders_indexed: indexed,
        });
    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to sync project' },
            { status: 500 }
        );
    }
}
