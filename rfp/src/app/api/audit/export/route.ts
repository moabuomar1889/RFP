import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDriveClient } from '@/server/google-drive';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EnhancedPermission {
    permissionId: string;
    type: string;
    identifier: string; // email, domain, or "anyone"
    role: string;
    displayName?: string;
    isInherited: boolean;
    inheritedFrom?: string;
    deleted: boolean;
    allowFileDiscovery?: boolean;
}

interface ExportFolder {
    project_code: string;
    project_name: string;
    folder_path: string;
    drive_folder_id: string;
    drive_url: string;
    expected_limited_access: boolean;
    actual_limited_access: boolean | null;
    status: string;
    expected_count: number;
    actual_total_count: number;
    actual_direct_count: number;
    actual_inherited_count: number;
    missing_count: number;
    role_mismatch_count: number;
    extra_direct_count: number;
    extra_inherited_count: number;
    domain_count: number;
    anyone_count: number;
    protected_present: boolean;
    protected_list: string;
    missing_list: string;
    role_mismatch_list: string;
    extra_direct_list: string;
    extra_inherited_list: string;
    domain_list: string;
    anyone_list: string;
    recommended_action: string;
    expected_principals: Array<{ type: string; identifier: string; role: string }>;
    actual_permissions: EnhancedPermission[];
}

// Build permissions map from template
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
            Object.assign(map, buildPermissionsMap(node.children, currentPath));
        }
    }
    return map;
}

// Enhanced permissions fetcher with all required fields
async function getEnhancedPermissions(folderId: string): Promise<{
    permissions: EnhancedPermission[];
    actualLimitedAccess: boolean | null;
}> {
    const drive = await getDriveClient();

    // Get folder metadata to check inheritedPermissionsDisabled
    const folderRes = await drive.files.get({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'capabilities'
    });

    const actualLimitedAccess = (folderRes.data as any).permissionRestrictionsInfo?.inheritedPermissionsDisabled ?? null;

    // Get permissions with all fields
    const response = await drive.permissions.list({
        fileId: folderId,
        supportsAllDrives: true,
        fields: 'permissions(id,type,role,emailAddress,domain,displayName,deleted,allowFileDiscovery,permissionDetails)',
    });

    const permissions = (response.data.permissions || []).map((p: any) => {
        const isInherited = p.inherited === true || p.permissionDetails?.some((d: any) => d.inherited) || false;
        const inheritedFrom = p.inheritedFrom || p.permissionDetails?.find((d: any) => d.inherited)?.inheritedFrom;

        let identifier = '';
        if (p.emailAddress) identifier = p.emailAddress.toLowerCase();
        else if (p.domain) identifier = p.domain.toLowerCase();
        else if (p.type === 'anyone') identifier = 'anyone';

        return {
            permissionId: p.id,
            type: p.type,
            identifier,
            role: p.role,
            displayName: p.displayName,
            isInherited,
            inheritedFrom,
            deleted: p.deleted || false,
            allowFileDiscovery: p.allowFileDiscovery
        };
    });

    return { permissions, actualLimitedAccess };
}

// Comprehensive comparison logic
function analyzeFolder(
    expected: { groups: any[]; users: any[]; limitedAccess: boolean },
    actual: EnhancedPermission[],
    actualLimitedAccess: boolean | null
): {
    status: string;
    missing: string[];
    roleMismatches: string[];
    extraDirect: string[];
    extraInherited: string[];
    domains: string[];
    anyone: string[];
    protected: string[];
    counts: {
        expected: number;
        actualTotal: number;
        actualDirect: number;
        actualInherited: number;
        domain: number;
        anyone: number;
    };
    recommendedAction: string;
} {
    const protectedEmails = ['mo.abuomar@dtgsa.com'];

    // Build expected set
    const expectedMap = new Map<string, string>();
    for (const g of expected.groups) {
        if (g.email) expectedMap.set(g.email.toLowerCase(), g.role || 'reader');
    }
    for (const u of expected.users) {
        if (u.email) expectedMap.set(u.email.toLowerCase(), u.role || 'reader');
    }

    // Categorize actual
    const directPerms = actual.filter(p => !p.isInherited && !p.deleted);
    const inheritedPerms = actual.filter(p => p.isInherited && !p.deleted);
    const domainPerms = actual.filter(p => p.type === 'domain' && !p.deleted);
    const anyonePerms = actual.filter(p => p.type === 'anyone' && !p.deleted);

    // Find protected
    const protectedList: string[] = [];
    for (const p of actual) {
        if (protectedEmails.includes(p.identifier)) {
            protectedList.push(`${p.identifier}(${p.role})`);
        }
    }

    // Find missing
    const missing: string[] = [];
    const actualSet = new Set(actual.map(p => p.identifier));
    for (const [email, role] of expectedMap) {
        if (!actualSet.has(email)) {
            missing.push(`${email}(${role})`);
        }
    }

    // Find role mismatches
    const roleMismatches: string[] = [];
    for (const p of actual) {
        if (expectedMap.has(p.identifier)) {
            const expectedRole = expectedMap.get(p.identifier)!;
            if (p.role !== expectedRole) {
                roleMismatches.push(`${p.identifier}(${expectedRole}→${p.role})`);
            }
        }
    }

    // Find extra direct
    const extraDirect: string[] = [];
    for (const p of directPerms) {
        if (!expectedMap.has(p.identifier) && !protectedEmails.includes(p.identifier)) {
            if (p.type === 'domain' || p.type === 'anyone') {
                if (expected.limitedAccess) {
                    extraDirect.push(`${p.identifier}(${p.role})`);
                }
            } else {
                extraDirect.push(`${p.identifier}(${p.role})`);
            }
        }
    }

    // Find extra inherited
    const extraInherited: string[] = [];
    for (const p of inheritedPerms) {
        if (!expectedMap.has(p.identifier) && !protectedEmails.includes(p.identifier)) {
            const fromPart = p.inheritedFrom ? ` from ${p.inheritedFrom}` : '';
            extraInherited.push(`${p.identifier}(${p.role})${fromPart}`);
        }
    }

    // Domains and anyone
    const domains = domainPerms.map(p => `${p.identifier}(${p.role})`);
    const anyone = anyonePerms.map(p => `${p.identifier}(${p.role})`);

    // Determine status
    let status = 'exact_match';
    if (missing.length > 0 || roleMismatches.length > 0 || extraDirect.length > 0) {
        status = 'non_compliant';
    } else if (expected.limitedAccess && extraInherited.length > 0) {
        status = 'non_compliant';
    } else if (!expected.limitedAccess && (inheritedPerms.length > 0 || domainPerms.length > 0)) {
        status = 'compliant_inheritance_allowed';
    }

    // Recommended action
    let recommendedAction = 'none';
    if (actualLimitedAccess === null) {
        recommendedAction = 'verify_drive_truth';
    } else if (expected.limitedAccess && !actualLimitedAccess) {
        recommendedAction = 'enable_limited_access';
    } else if (!expected.limitedAccess && actualLimitedAccess) {
        recommendedAction = 'fix_template';
    } else if (missing.length > 0 || extraDirect.length > 0) {
        recommendedAction = 'reset_to_template';
    } else if (extraInherited.length > 0 && expected.limitedAccess) {
        recommendedAction = 'remove_extras';
    }

    return {
        status,
        missing,
        roleMismatches,
        extraDirect,
        extraInherited,
        domains,
        anyone,
        protected: protectedList,
        counts: {
            expected: expectedMap.size,
            actualTotal: actual.filter(p => !p.deleted && !protectedEmails.includes(p.identifier)).length,
            actualDirect: directPerms.filter(p => !protectedEmails.includes(p.identifier)).length,
            actualInherited: inheritedPerms.filter(p => !protectedEmails.includes(p.identifier)).length,
            domain: domainPerms.length,
            anyone: anyonePerms.length
        },
        recommendedAction
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const format = searchParams.get('format') || 'csv'; // csv or json

        if (!projectId) {
            return NextResponse.json({ error: 'projectId required' }, { status: 400 });
        }

        // Get project
        const { data: projectsData } = await supabaseAdmin.rpc('get_projects', {
            p_status: null,
            p_phase: null
        });
        const project = projectsData?.find((p: any) => p.id === projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get template
        const { data: templateData } = await supabaseAdmin.rpc('get_active_template');
        const template = Array.isArray(templateData) ? templateData[0] : templateData;
        if (!template?.template_json) {
            return NextResponse.json({ error: 'No template' }, { status: 404 });
        }

        const templateNodes = Array.isArray(template.template_json)
            ? template.template_json
            : template.template_json.template || [];
        const permissionsMap = buildPermissionsMap(templateNodes);

        // Get folders
        const { data: folders } = await supabaseAdmin.rpc('list_project_folders', {
            p_project_id: projectId
        });

        if (!folders || folders.length === 0) {
            return NextResponse.json({ error: 'No folders' }, { status: 404 });
        }

        const exportData: ExportFolder[] = [];

        for (const folder of folders) {
            const templatePath = folder.normalized_template_path || folder.template_path;
            const expectedPerms = permissionsMap[templatePath];
            if (!expectedPerms) continue;

            const { permissions, actualLimitedAccess } = await getEnhancedPermissions(folder.drive_folder_id);
            const analysis = analyzeFolder(expectedPerms, permissions, actualLimitedAccess);

            const expectedPrincipals = [
                ...expectedPerms.groups.map((g: any) => ({ type: 'group', identifier: g.email.toLowerCase(), role: g.role || 'reader' })),
                ...expectedPerms.users.map((u: any) => ({ type: 'user', identifier: u.email.toLowerCase(), role: u.role || 'reader' }))
            ];

            exportData.push({
                project_code: project.pr_number,
                project_name: project.name,
                folder_path: templatePath,
                drive_folder_id: folder.drive_folder_id,
                drive_url: `https://drive.google.com/drive/folders/${folder.drive_folder_id}`,
                expected_limited_access: expectedPerms.limitedAccess,
                actual_limited_access: actualLimitedAccess,
                status: analysis.status,
                expected_count: analysis.counts.expected,
                actual_total_count: analysis.counts.actualTotal,
                actual_direct_count: analysis.counts.actualDirect,
                actual_inherited_count: analysis.counts.actualInherited,
                missing_count: analysis.missing.length,
                role_mismatch_count: analysis.roleMismatches.length,
                extra_direct_count: analysis.extraDirect.length,
                extra_inherited_count: analysis.extraInherited.length,
                domain_count: analysis.counts.domain,
                anyone_count: analysis.counts.anyone,
                protected_present: analysis.protected.length > 0,
                protected_list: analysis.protected.join('; '),
                missing_list: analysis.missing.join('; '),
                role_mismatch_list: analysis.roleMismatches.join('; '),
                extra_direct_list: analysis.extraDirect.join('; '),
                extra_inherited_list: analysis.extraInherited.join('; '),
                domain_list: analysis.domains.join('; '),
                anyone_list: analysis.anyone.join('; '),
                recommended_action: analysis.recommendedAction,
                expected_principals: expectedPrincipals,
                actual_permissions: permissions
            });
        }

        if (format === 'json') {
            // JSON v2 export
            const jsonExport = {
                export_version: 'v2',
                exported_at: new Date().toISOString(),
                policy: {
                    protected_principals: ['mo.abuomar@dtgsa.com'],
                    inheritance_rules: 'limitedAccess=true blocks inheritance; limitedAccess=false allows inheritance'
                },
                projects: [{
                    project_code: project.pr_number,
                    project_name: project.name,
                    folders: exportData.map(f => ({
                        folder_path: f.folder_path,
                        drive_folder_id: f.drive_folder_id,
                        drive_url: f.drive_url,
                        expected: {
                            limitedAccess: f.expected_limited_access,
                            principals: f.expected_principals
                        },
                        actual: {
                            limitedAccess: f.actual_limited_access,
                            permissions: f.actual_permissions,
                            counts: {
                                total: f.actual_total_count,
                                direct: f.actual_direct_count,
                                inherited: f.actual_inherited_count,
                                domain: f.domain_count,
                                anyone: f.anyone_count
                            }
                        },
                        diff: {
                            status: f.status,
                            missing: f.missing_list.split('; ').filter(Boolean),
                            roleMismatches: f.role_mismatch_list.split('; ').filter(Boolean),
                            extraDirect: f.extra_direct_list.split('; ').filter(Boolean),
                            extraInherited: f.extra_inherited_list.split('; ').filter(Boolean)
                        },
                        recommendedAction: f.recommended_action,
                        notes: []
                    })),
                    summary: {
                        totalFolders: exportData.length,
                        exactMatch: exportData.filter(f => f.status === 'exact_match').length,
                        compliant: exportData.filter(f => f.status === 'compliant_inheritance_allowed').length,
                        nonCompliant: exportData.filter(f => f.status === 'non_compliant').length
                    }
                }],
                summary: {
                    totalProjects: 1,
                    totalFolders: exportData.length
                }
            };

            return NextResponse.json(jsonExport);
        } else {
            // CSV v2 export
            const headers = [
                'export_version', 'exported_at', 'project_code', 'project_name',
                'folder_path', 'drive_folder_id', 'drive_url',
                'expected_limited_access', 'actual_limited_access', 'status',
                'expected_count', 'actual_total_count', 'actual_direct_count', 'actual_inherited_count',
                'missing_count', 'role_mismatch_count', 'extra_direct_count', 'extra_inherited_count',
                'domain_count', 'anyone_count',
                'protected_present', 'protected_list',
                'missing_list', 'role_mismatch_list', 'extra_direct_list', 'extra_inherited_list',
                'domain_list', 'anyone_list',
                'recommended_action'
            ];

            const rows = exportData.map(f => [
                'v2',
                new Date().toISOString(),
                f.project_code,
                f.project_name,
                f.folder_path,
                f.drive_folder_id,
                f.drive_url,
                f.expected_limited_access.toString(),
                String(f.actual_limited_access ?? 'null'),
                f.status,
                f.expected_count.toString(),
                f.actual_total_count.toString(),
                f.actual_direct_count.toString(),
                f.actual_inherited_count.toString(),
                f.missing_count.toString(),
                f.role_mismatch_count.toString(),
                f.extra_direct_count.toString(),
                f.extra_inherited_count.toString(),
                f.domain_count.toString(),
                f.anyone_count.toString(),
                f.protected_present.toString(),
                f.protected_list,
                f.missing_list,
                f.role_mismatch_list,
                f.extra_direct_list,
                f.extra_inherited_list,
                f.domain_list,
                f.anyone_list,
                f.recommended_action
            ]);

            const csv = [headers, ...rows].map(row =>
                row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
            ).join('\n');

            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="audit_export_v2_${project.pr_number}_${new Date().toISOString().split('T')[0]}.csv"`
                }
            });
        }
    } catch (error: any) {
        console.error('Export error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
