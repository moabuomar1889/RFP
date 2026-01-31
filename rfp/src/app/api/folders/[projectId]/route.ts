import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/folders/[projectId]
 * Get folder index for a project
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .schema('rfp')
            .from('folder_index')
            .select('*')
            .eq('project_id', projectId)
            .order('template_path');

        if (error) {
            console.error('Error fetching folders:', error);
            // Return empty array if table doesn't exist or other DB error
            const response = NextResponse.json({
                success: true,
                folders: [],
                count: 0,
                message: 'No folders indexed yet',
            });
            response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return response;
        }

        // Build tree structure from flat list
        const folders = data || [];
        const tree = buildFolderTree(folders);

        const response = NextResponse.json({
            success: true,
            folders: tree,
            count: folders.length,
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    } catch (error) {
        console.error('Error fetching folders:', error);
        // Return empty on error instead of 500
        const response = NextResponse.json({
            success: true,
            folders: [],
            count: 0,
        });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        return response;
    }
}

interface FolderRecord {
    id: string;
    project_id: string;
    template_path: string;
    drive_folder_id: string;
    drive_folder_name: string;
    limited_access_enabled: boolean;
    permissions_hash: string | null;
    last_verified_at: string | null;
}

interface TreeNode {
    id: string;
    name: string;
    path: string;
    driveId: string;
    limitedAccess: boolean;
    synced: boolean;
    children: TreeNode[];
}

function buildFolderTree(folders: FolderRecord[]): TreeNode[] {
    // For now, return flat list as tree nodes (no parent-child in current schema)
    return folders.map(folder => ({
        id: folder.id,
        name: folder.drive_folder_name,
        path: folder.template_path,
        driveId: folder.drive_folder_id,
        limitedAccess: folder.limited_access_enabled || false,
        synced: !!folder.last_verified_at,
        children: [],
    }));
}
