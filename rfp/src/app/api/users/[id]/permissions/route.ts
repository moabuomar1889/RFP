import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface TemplateNode {
    text: string;
    limitedAccess?: boolean;
    groups?: { name: string; role: string; email?: string }[];
    users?: { email: string; role: string; type?: string }[];
    nodes?: TemplateNode[];
    _expanded?: boolean;
    folderType?: string;
}

interface FolderPermission {
    path: string;
    folderName: string;
    role: string | null; // organizer, fileOrganizer, writer, commenter, reader, or null
    accessType: 'direct' | 'group' | 'public' | 'none';
    groupName?: string;
    depth: number;
}

/**
 * Traverse template tree and compute user's permissions
 */
function computePermissions(
    nodes: TemplateNode[],
    userEmail: string,
    userGroups: string[],
    parentPath: string = '',
    depth: number = 0
): FolderPermission[] {
    const permissions: FolderPermission[] = [];

    for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath}/${node.text}` : node.text;

        let role: string | null = null;
        let accessType: 'direct' | 'group' | 'public' | 'none' = 'none';
        let groupName: string | undefined;

        // Check if folder has limited access
        if (node.limitedAccess === false || node.limitedAccess === undefined) {
            // Public folder - everyone has access
            accessType = 'public';
            role = 'reader'; // Default read access for public folders
        } else {
            // Limited access - check if user has permission

            // 1. Check direct user assignment
            if (node.users && node.users.length > 0) {
                const directAccess = node.users.find(
                    u => u.email?.toLowerCase() === userEmail.toLowerCase()
                );
                if (directAccess) {
                    role = directAccess.role;
                    accessType = 'direct';
                }
            }

            // 2. Check group membership (if not already found direct access)
            if (!role && node.groups && node.groups.length > 0) {
                for (const group of node.groups) {
                    const groupNameLower = group.name?.toLowerCase();
                    const hasGroupAccess = userGroups.some(
                        ug => ug.toLowerCase() === groupNameLower
                    );
                    if (hasGroupAccess) {
                        // Take the highest permission if in multiple groups
                        const roleOrder = ['organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'];
                        const currentRoleIndex = role ? roleOrder.indexOf(role) : 999;
                        const newRoleIndex = roleOrder.indexOf(group.role);
                        if (newRoleIndex < currentRoleIndex) {
                            role = group.role;
                            groupName = group.name;
                            accessType = 'group';
                        }
                    }
                }
            }
        }

        permissions.push({
            path: currentPath,
            folderName: node.text,
            role,
            accessType,
            groupName,
            depth,
        });

        // Recursively process child nodes
        if (node.nodes && node.nodes.length > 0) {
            const childPermissions = computePermissions(
                node.nodes,
                userEmail,
                userGroups,
                currentPath,
                depth + 1
            );
            permissions.push(...childPermissions);
        }
    }

    return permissions;
}

/**
 * GET /api/users/[id]/permissions
 * Get folder permissions for a user based on their groups and the template
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabaseAdmin();

        // 1. Get user info using RPC
        const { data: user, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id
        });

        if (userError || !user || (Array.isArray(user) && user.length === 0)) {
            console.error('User lookup error:', userError);
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        const userData = Array.isArray(user) ? user[0] : user;
        const userEmail = userData?.email?.toLowerCase();
        const userName = userData?.name;

        if (!userEmail) {
            return NextResponse.json(
                { success: false, error: 'User email not found' },
                { status: 404 }
            );
        }

        // 2. Get user's group memberships
        const { data: memberships, error: membershipError } = await supabase
            .from('rfp.user_group_membership')
            .select('group_email')
            .eq('user_email', userEmail);

        // Fallback: query using RPC if direct access fails
        let userGroups: string[] = [];
        if (membershipError) {
            console.log('Direct membership query failed, using groups from user data');
            // Get from users with groups RPC
            const { data: usersWithGroups } = await supabase.rpc('get_users_with_groups');
            const userWithGroups = usersWithGroups?.find(
                (u: any) => u.email?.toLowerCase() === userEmail
            );
            userGroups = userWithGroups?.groups || [];
        } else {
            // Get group names from group_directory
            const groupEmails = (memberships || []).map((m: any) => m.group_email);
            if (groupEmails.length > 0) {
                const { data: groups } = await supabase.rpc('get_groups');
                userGroups = (groups || [])
                    .filter((g: any) => groupEmails.includes(g.email?.toLowerCase()))
                    .map((g: any) => g.name);
            }
        }

        console.log(`User ${userEmail} groups:`, userGroups);

        // 3. Get active template
        const { data: templateData, error: templateError } = await supabase.rpc('get_active_template');

        if (templateError) {
            console.error('Template error:', templateError);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch template' },
                { status: 500 }
            );
        }

        const template = Array.isArray(templateData) ? templateData[0] : templateData;
        const templateJson = template?.template_json;

        if (!templateJson || !templateJson.template) {
            return NextResponse.json(
                { success: false, error: 'No active template found' },
                { status: 404 }
            );
        }

        // 4. Compute permissions
        const permissions = computePermissions(
            templateJson.template as TemplateNode[],
            userEmail,
            userGroups
        );

        return NextResponse.json({
            success: true,
            user: {
                id,
                email: userEmail,
                name: userName,
                groups: userGroups,
            },
            permissions,
            templateVersion: template?.version_number,
        });
    } catch (error: any) {
        console.error('Permissions API error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch permissions' },
            { status: 500 }
        );
    }
}
