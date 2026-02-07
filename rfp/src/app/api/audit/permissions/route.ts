import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { listPermissions, getDriveClient } from '@/server/google-drive';

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
    actualPermissions: { email: string; role: string; type: string; inherited?: boolean }[];
    // New detailed counters
    expectedCount: number;
    directActualCount: number;
    inheritedActualCount: number;
    totalActualCount: number;
    // Enhanced status
    status: 'exact_match' | 'compliant' | 'non_compliant';
    statusLabel: 'Exact Match' | 'Compliant (Inheritance Allowed)' | 'Non-Compliant';
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

/**
 * Normalize roles for comparison to reduce noise from Shared Drive role mapping.
 * Google Shared Drives map "organizer" to "fileOrganizer" for groups.
 */
function normalizeRole(role: string): string {
    if (role === 'organizer' || role === 'fileOrganizer') {
        return 'fileOrganizer';
    }
    return role;
}

// Compare expected vs actual permissions with enhanced status semantics
function comparePermissions(
    expected: { groups: any[]; users: any[]; limitedAccess: boolean },
    actual: any[]
): {
    status: 'exact_match' | 'compliant' | 'non_compliant';
    statusLabel: 'Exact Match' | 'Compliant (Inheritance Allowed)' | 'Non-Compliant';
    discrepancies: string[];
    expectedCount: number;
    directActualCount: number;
    inheritedActualCount: number;
    totalActualCount: number;
} {
    const discrepancies: string[] = [];

    // Build expected set (with normalized roles for comparison)
    const expectedEmails = new Set<string>();
    const expectedRoleMap = new Map<string, string>();
    for (const g of expected.groups) {
        if (g.email) {
            const emailLower = g.email.toLowerCase();
            expectedEmails.add(emailLower);
            expectedRoleMap.set(emailLower, normalizeRole(g.role || 'reader'));
        }
    }
    for (const u of expected.users) {
        if (u.email) {
            const emailLower = u.email.toLowerCase();
            expectedEmails.add(emailLower);
            expectedRoleMap.set(emailLower, normalizeRole(u.role || 'reader'));
        }
    }

    // Protected principals to ignore
    const protectedEmails = ['mo.abuomar@dtgsa.com'];

    // Categorize actual permissions
    const directActual: any[] = [];
    const inheritedActual: any[] = [];

    for (const p of actual) {
        const isInherited = (p.inherited === true) || (p.permissionDetails?.[0]?.inherited ?? false);

        if (isInherited) {
            inheritedActual.push(p);
        } else {
            directActual.push(p);
        }
    }

    // Counters
    const expectedCount = expectedEmails.size;
    const directActualCount = directActual.filter(p => {
        const email = p.emailAddress?.toLowerCase();
        return email && !protectedEmails.includes(email);
    }).length;
    const inheritedActualCount = inheritedActual.filter(p => {
        const email = p.emailAddress?.toLowerCase();
        return email && !protectedEmails.includes(email);
    }).length;
    const totalActualCount = directActualCount + inheritedActualCount;

    // Check for missing expected permissions
    const actualEmails = new Set<string>();
    for (const p of actual) {
        if (p.emailAddress && p.type !== 'domain') {
            actualEmails.add(p.emailAddress.toLowerCase());
        }
    }

    for (const email of expectedEmails) {
        if (!actualEmails.has(email)) {
            discrepancies.push(`Missing: ${email}`);
        }
    }

    // Check for extra DIRECT permissions (non-inherited)
    const extraDirect: string[] = [];
    for (const p of directActual) {
        if (!p.emailAddress && p.type !== 'domain' && p.type !== 'anyone') continue;

        const email = p.emailAddress?.toLowerCase();
        if (email && expectedEmails.has(email)) continue;
        if (email && protectedEmails.includes(email)) continue;

        // RULE: Domain/anyone on non-limited folders are allowed (skip)
        if (!expected.limitedAccess && (p.type === 'domain' || p.type === 'anyone')) {
            continue;
        }

        // Extra direct permission found
        extraDirect.push(email || p.type);
    }

    // Check for extra INHERITED permissions
    const extraInherited: string[] = [];
    for (const p of inheritedActual) {
        const email = p.emailAddress?.toLowerCase();
        if (email && expectedEmails.has(email)) continue;
        if (email && protectedEmails.includes(email)) continue;

        // RULE: If limitedAccess=true, inherited perms are violations
        // RULE: If limitedAccess=false, inherited perms are allowed
        if (expected.limitedAccess) {
            extraInherited.push(email || p.type || 'inherited');
        }
    }

    // Build discrepancies for extra direct
    for (const item of extraDirect) {
        discrepancies.push(`Extra (direct): ${item}`);
    }

    // Build discrepancies for extra inherited (only if limitedAccess=true)
    for (const item of extraInherited) {
        discrepancies.push(`Extra (inherited): ${item}`);
    }

    // Determine status based on new semantics
    const hasMissing = discrepancies.some(d => d.startsWith('Missing'));
    const hasExtraDirect = extraDirect.length > 0;
    const hasExtraInherited = extraInherited.length > 0;

    let status: 'exact_match' | 'compliant' | 'non_compliant';
    let statusLabel: 'Exact Match' | 'Compliant (Inheritance Allowed)' | 'Non-Compliant';

    if (hasMissing || hasExtraDirect || hasExtraInherited) {
        // Non-compliant: missing expected, extra direct, or extra inherited (when limitedAccess=true)
        status = 'non_compliant';
        statusLabel = 'Non-Compliant';
    } else if (inheritedActualCount > 0 && !expected.limitedAccess) {
        // Compliant: all expected exist, no extra direct, but has inherited (allowed)
        status = 'compliant';
        statusLabel = 'Compliant (Inheritance Allowed)';
    } else {
        // Exact match: all expected exist, no extras at all
        status = 'exact_match';
        statusLabel = 'Exact Match';
    }

    return {
        status,
        statusLabel,
        discrepancies,
        expectedCount,
        directActualCount,
        inheritedActualCount,
        totalActualCount
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Get project info using RPC (schema-based queries not supported)
        console.log('Fetching project with ID:', projectId);
        const { data: projectsData, error: projectError } = await supabaseAdmin.rpc('get_projects', {
            p_status: null,
            p_phase: null
        });

        const project = projectsData?.find((p: any) => p.id === projectId);
        console.log('Project result:', { project, projectError });

        if (projectError || !project) {
            console.error('Project lookup failed:', projectError);
            return NextResponse.json({
                error: 'Project not found',
                details: projectError?.message || 'Project ID not in list',
                projectId
            }, { status: 404 });
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
                    projectCode: project.pr_number,
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

            console.log('[AUDIT DEBUG]', {
                templatePath,
                hasMatch: !!expectedPerms,
                availableKeys: Object.keys(permissionsMap).slice(0, 5)
            });

            if (!expectedPerms) continue;

            // Get actual Limited Access status from Drive
            let actualLimitedAccess: boolean | null = null;
            try {
                const drive = await getDriveClient();
                const folderRes = await drive.files.get({
                    fileId: folder.drive_folder_id,
                    supportsAllDrives: true,
                    fields: 'id,name,inheritedPermissionsDisabled'
                });
                actualLimitedAccess = folderRes.data.inheritedPermissionsDisabled ?? false;
            } catch (err) {
                console.error(`Failed to get folder metadata for ${folder.drive_folder_id}:`, err);
                actualLimitedAccess = null;
            }

            // Get actual permissions from Drive
            let actualPerms: any[] = [];
            try {
                actualPerms = await listPermissions(folder.drive_folder_id);
            } catch (err) {
                console.error(`Failed to get permissions for ${folder.drive_folder_id}:`, err);
                continue;
            }

            // Compare permissions
            const comparison = comparePermissions(expectedPerms, actualPerms);

            // Count by status (updated for new statuses)
            if (comparison.status === 'exact_match') {
                matchCount++;
            } else if (comparison.status === 'compliant') {
                extraCount++; // Reuse extraCount for compliant (has extras but allowed)
            } else if (comparison.status === 'non_compliant') {
                mismatchCount++; // Map non_compliant to mismatchCount
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
                        type: p.type,
                        inherited: (p.inherited === true) || (p.permissionDetails?.[0]?.inherited ?? false)
                    })),
                status: comparison.status,
                statusLabel: comparison.statusLabel,
                discrepancies: comparison.discrepancies,
                expectedCount: comparison.expectedCount,
                directActualCount: comparison.directActualCount,
                inheritedActualCount: comparison.inheritedActualCount,
                totalActualCount: comparison.totalActualCount,
                limitedAccessExpected: expectedPerms.limitedAccess || false,
                limitedAccessActual: actualLimitedAccess ?? false
            });
        }

        const result: AuditResult = {
            projectId: project.id,
            projectName: project.name,
            projectCode: project.pr_number,
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
