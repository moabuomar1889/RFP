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
            .order('path');

        if (error) {
            console.error('Error fetching folders:', error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
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
        return NextResponse.json(
            { success: false, error: 'Failed to fetch folders' },
            { status: 500 }
        );
    }
}

interface FolderRecord {
    id: string;
    drive_id: string;
    folder_name: string;
    path: string;
    parent_id: string | null;
    expected_permissions: any;
    has_limited_access: boolean;
    last_scanned_at: string | null;
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
    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Create nodes
    for (const folder of folders) {
        nodeMap.set(folder.id, {
            id: folder.id,
            name: folder.folder_name,
            path: folder.path,
            driveId: folder.drive_id,
            limitedAccess: folder.has_limited_access,
            synced: !!folder.last_scanned_at,
            children: [],
        });
    }

    // Build tree
    for (const folder of folders) {
        const node = nodeMap.get(folder.id);
        if (!node) continue;

        if (folder.parent_id && nodeMap.has(folder.parent_id)) {
            const parent = nodeMap.get(folder.parent_id);
            parent?.children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}
