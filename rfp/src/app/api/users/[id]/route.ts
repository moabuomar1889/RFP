import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[id]
 * Get a specific user and their folder access based on template groups
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabaseAdmin();

        // Get user details using RPC
        const { data: users, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id
        });

        if (userError || !users || users.length === 0) {
            console.error('User fetch error:', userError);
            return NextResponse.json({
                success: false,
                error: 'User not found',
            }, { status: 404 });
        }

        const user = users[0]; // RPC returns array

        // Get active template to find folder permissions
        const { data: template } = await supabase.rpc('get_active_template');

        // Extract folders that user can access via their groups
        const accessibleFolders: Array<{
            path: string;
            name: string;
            role: string;
            accessVia: string;
        }> = [];

        if (template?.template_json) {
            const templateData = template.template_json;
            const folders = Array.isArray(templateData) ? templateData : templateData.folders || [];
            const userEmail = user.email;

            // Recursive function to traverse template and find accessible folders
            const traverseFolders = (nodes: any[], parentPath: string = '') => {
                for (const node of nodes) {
                    if (!node) continue;

                    const nodeName = node.text || node.name || 'Unnamed';
                    const currentPath = parentPath ? `${parentPath}/${nodeName}` : nodeName;
                    const permissions = node.permissions || [];

                    // Check if user has direct access or via group
                    for (const perm of permissions) {
                        if (perm.email === userEmail) {
                            accessibleFolders.push({
                                path: currentPath,
                                name: nodeName,
                                role: perm.role || 'reader',
                                accessVia: 'Direct',
                            });
                        }
                        // Check if user is in a group that has access
                        // This would require checking user's group memberships
                    }

                    // Recursively check children
                    const children = node.nodes || node.children || [];
                    if (children.length > 0) {
                        traverseFolders(children, currentPath);
                    }
                }
            };

            traverseFolders(folders);
        }

        return NextResponse.json({
            success: true,
            user,
            accessibleFolders,
        });
    } catch (error) {
        console.error('User detail API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch user details',
        }, { status: 500 });
    }
}
