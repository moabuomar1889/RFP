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

        const { data, error } = await supabase.rpc('list_project_folders', {
            p_project_id: projectId,
        });

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
    normalized_template_path?: string | null;
    drive_folder_id: string;
    expected_limited_access?: boolean | null;
    actual_limited_access?: boolean | null;
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
    const sortedFolders = [...folders].sort((a, b) => {
        const aPath = getDisplayPath(a);
        const bPath = getDisplayPath(b);
        const depthDiff = aPath.split('/').length - bPath.split('/').length;
        return depthDiff !== 0 ? depthDiff : aPath.localeCompare(bPath);
    });

    const nodeMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    for (const folder of sortedFolders) {
        const path = getDisplayPath(folder);
        const name = getDisplayName(path);
        const node: TreeNode = {
            id: folder.id,
            name,
            path,
            driveId: folder.drive_folder_id,
            limitedAccess: folder.actual_limited_access ?? folder.expected_limited_access ?? false,
            synced: !!folder.last_verified_at,
            children: [],
        };

        nodeMap.set(path, node);

        const parentPath = getParentPath(path);
        if (parentPath && nodeMap.has(parentPath)) {
            nodeMap.get(parentPath)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

function getDisplayPath(folder: FolderRecord): string {
    return folder.normalized_template_path?.trim() || folder.template_path.trim();
}

function getDisplayName(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] || path;
}

function getParentPath(path: string): string | null {
    const segments = path.split('/').filter(Boolean);
    if (segments.length <= 1) return null;
    return segments.slice(0, -1).join('/');
}
