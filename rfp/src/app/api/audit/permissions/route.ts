import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { listPermissions } from '@/server/google-drive';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PermissionComparison {
    folderPath: string;
    normalizedPath: string;
    driveFolderId: string;
    expectedGroups: { email: string; role: string }[];
    expectedUsers: { email: string; role: string }[];
    actualPermissions: { email: string; role: string; type: string }[];
    status: 'match' | 'extra' | 'missing' | 'mismatch';
    discrepancies: string[];
    limitedAccessExpected: boolean;
    limitedAccessActual: boolean;
}

interface AuditResult {
    projectId: string;
    projectName: string;
    projectCode: string;
    totalFolders: number;
    matchCount: number;
    extraCount: number;
    missingCount: number;
    mismatchCount: number;
    comparisons: PermissionComparison[];
}

// Build permissions map from template JSON
function buildPermissionsMap(nodes: any[], parentPath = ''): Record<string, any> {
    const map: Record<string, any> = {};

    for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;

        map[currentPath] = {
            groups: node.groups || [],
            users: node.users || [],
            limitedAccess: node.limitedAccess || false
        };

        if (node.children && node.children.length > 0) {
            const childMap = buildPermissionsMap(node.children, currentPath);
            Object.assign(map, childMap);
        }
    }

    return map;
}

// Compare expected vs actual permissions
function comparePermissions(
    expected: { groups: any[]; users: any[]; limitedAccess: boolean },
    actual: any[]
): { status: 'match' | 'extra' | 'missing' | 'mismatch'; discrepancies: string[] } {
    const discrepancies: string[] = [];

    const expectedEmails = new Set<string>();
    for (const g of expected.groups) {
        if (g.email) expectedEmails.add(g.email.toLowerCase());
    }
    for (const u of expected.users) {
        if (u.email) expectedEmails.add(u.email.toLowerCase());
    }

    const actualEmails = new Set<string>();
    for (const p of actual) {
        if (p.emailAddress && p.type !== 'domain') {
            actualEmails.add(p.emailAddress.toLowerCase());
        }
    }

    // Protected principals to ignore
    const protectedEmails = ['mo.abuomar@dtgsa.com'];

    // Check for missing permissions
    for (const email of expectedEmails) {
        if (!actualEmails.has(email)) {
            discrepancies.push(`Missing: ${email}`);
        }
    }

    // Check for extra permissions
    for (const email of actualEmails) {
        if (!expectedEmails.has(email) && !protectedEmails.includes(email)) {
            discrepancies.push(`Extra: ${email}`);
        }
    }

    if (discrepancies.length === 0) {
        return { status: 'match', discrepancies: [] };
    }

    const hasMissing = discrepancies.some(d => d.startsWith('Missing'));
    const hasExtra = discrepancies.some(d => d.startsWith('Extra'));

    if (hasMissing && hasExtra) {
        return { status: 'mismatch', discrepancies };
    } else if (hasMissing) {
        return { status: 'missing', discrepancies };
    } else {
        return { status: 'extra', discrepancies };
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Get project info
        const { data: project, error: projectError } = await supabaseAdmin
            .schema('rfp')
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get active template
        const { data: templateData } = await supabaseAdmin.rpc('get_active_template');
        const template = Array.isArray(templateData) ? templateData[0] : templateData;

        if (!template?.template_json) {
            return NextResponse.json({ error: 'No active template found' }, { status: 404 });
        }

        // Build permissions map from template
        const templateNodes = Array.isArray(template.template_json)
            ? template.template_json
            : template.template_json.template || [];
        const permissionsMap = buildPermissionsMap(templateNodes);

        // Get indexed folders for this project
        const { data: folders } = await supabaseAdmin.rpc('list_project_folders', {
            p_project_id: projectId
        });

        if (!folders || folders.length === 0) {
            return NextResponse.json({
                success: true,
                result: {
                    projectId: project.id,
                    projectName: project.name,
                    projectCode: project.project_code,
                    totalFolders: 0,
                    matchCount: 0,
                    extraCount: 0,
                    missingCount: 0,
                    mismatchCount: 0,
                    comparisons: []
                }
            });
        }

        const comparisons: PermissionComparison[] = [];
        let matchCount = 0, extraCount = 0, missingCount = 0, mismatchCount = 0;

        // Process each folder
        for (const folder of folders) {
            const templatePath = folder.normalized_template_path || folder.template_path;
            const expectedPerms = permissionsMap[templatePath];

            if (!expectedPerms) continue;

            // Get actual permissions from Drive
            let actualPerms: any[] = [];
            try {
                actualPerms = await listPermissions(folder.drive_folder_id);
            } catch (err) {
                console.error(`Failed to get permissions for ${folder.drive_folder_id}:`, err);
                continue;
            }

            // Compare permissions
            const { status, discrepancies } = comparePermissions(expectedPerms, actualPerms);

            // Count by status
            switch (status) {
                case 'match': matchCount++; break;
                case 'extra': extraCount++; break;
                case 'missing': missingCount++; break;
                case 'mismatch': mismatchCount++; break;
            }

            comparisons.push({
                folderPath: folder.template_path,
                normalizedPath: templatePath,
                driveFolderId: folder.drive_folder_id,
                expectedGroups: expectedPerms.groups.map((g: any) => ({
                    email: g.email,
                    role: g.role || 'reader'
                })),
                expectedUsers: expectedPerms.users?.map((u: any) => ({
                    email: u.email,
                    role: u.role || 'reader'
                })) || [],
                actualPermissions: actualPerms
                    .filter((p: any) => p.emailAddress && p.type !== 'domain')
                    .map((p: any) => ({
                        email: p.emailAddress,
                        role: p.role,
                        type: p.type
                    })),
                status,
                discrepancies,
                limitedAccessExpected: expectedPerms.limitedAccess || false,
                limitedAccessActual: false // TODO: Check actual Limited Access status
            });
        }

        const result: AuditResult = {
            projectId: project.id,
            projectName: project.name,
            projectCode: project.project_code,
            totalFolders: comparisons.length,
            matchCount,
            extraCount,
            missingCount,
            mismatchCount,
            comparisons
        };

        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('Audit error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
