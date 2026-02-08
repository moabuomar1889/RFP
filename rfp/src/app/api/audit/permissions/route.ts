import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { listPermissions, getDriveClient } from '@/server/google-drive';
import {
    normalizeRole,
    classifyInheritedPermission,
    buildPermissionsMap as sharedBuildPermissionsMap,
    buildFolderDebugPayload,
} from '@/server/audit-helpers';

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
    actualPermissions: { email: string; role: string; type: string; inherited?: boolean; classification?: string }[];
    // New detailed counters
    expectedCount: number;
    directActualCount: number;
    inheritedActualCount: number;
    inheritedNonRemovableCount?: number;
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
 * Delegates to shared normalizeRole from audit-helpers.
 * Google Shared Drives map "organizer" to "fileOrganizer" for groups.
 */

// Compare expected vs actual permissions with enhanced status semantics
function comparePermissions(
    expected: { groups: any[]; users: any[]; limitedAccess: boolean },
    actual: any[],
    driveId?: string
): {
    status: 'exact_match' | 'compliant' | 'non_compliant';
    statusLabel: 'Exact Match' | 'Compliant (Inheritance Allowed)' | 'Non-Compliant';
    discrepancies: string[];
    missing: string[];
    extraDirect: string[];
    extraInherited: string[];
    expectedCount: number;
    directActualCount: number;
    inheritedActualCount: number;
    inheritedNonRemovableCount: number;
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

    // Categorize actual permissions with Shared Drive classification
    const directActual: any[] = [];
    const inheritedActual: any[] = [];
    let inheritedNonRemovableCount = 0;

    for (const p of actual) {
        const cls = classifyInheritedPermission(p, driveId);
        if (cls === 'NOT_INHERITED') {
            directActual.push(p);
        } else if (cls === 'NON_REMOVABLE_DRIVE_MEMBERSHIP') {
            inheritedNonRemovableCount++;
            // Do NOT push to inheritedActual — these are never violations
        } else {
            inheritedActual.push(p);
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

    // Structured diff arrays
    const missing: string[] = [];
    for (const email of expectedEmails) {
        if (!actualEmails.has(email)) {
            missing.push(email);
            discrepancies.push(`Missing: ${email}`);
        }
    }

    // Check for extra DIRECT permissions (non-inherited)
    const extraDirect: string[] = [];
    for (const p of directActual) {
        if (!p.emailAddress && p.type !== 'domain' && p.type !== 'anyone') continue;

        const email = p.emailAddress?.toLowerCase();
        if (email && expectedEmails.has(email)) {
            // Check role match (normalizing organizer/fileOrganizer)
            const expectedRole = expectedRoleMap.get(email);
            const actualRole = normalizeRole(p.role);
            if (expectedRole && expectedRole !== actualRole) {
                discrepancies.push(`Role mismatch: ${email} (expected=${expectedRole}, actual=${actualRole})`);
            }
            continue;
        }
        if (email && protectedEmails.includes(email)) continue;

        // RULE: Domain/anyone on non-limited folders are allowed (skip)
        if (!expected.limitedAccess && (p.type === 'domain' || p.type === 'anyone')) {
            continue;
        }

        // Extra direct permission found
        extraDirect.push(email || p.type);
    }

    // Check for extra INHERITED permissions (only from parent folders, not Shared Drive membership)
    const extraInherited: string[] = [];
    for (const p of inheritedActual) {
        const email = p.emailAddress?.toLowerCase();
        if (email && expectedEmails.has(email)) continue;
        if (email && protectedEmails.includes(email)) continue;

        // RULE: If limitedAccess=true, inherited perms from parent folders are violations
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

    // Determine status
    const hasMissing = missing.length > 0;
    const hasExtraDirect = extraDirect.length > 0;
    const hasExtraInherited = extraInherited.length > 0;

    let status: 'exact_match' | 'compliant' | 'non_compliant';
    let statusLabel: 'Exact Match' | 'Compliant (Inheritance Allowed)' | 'Non-Compliant';

    if (hasMissing || hasExtraDirect || hasExtraInherited) {
        status = 'non_compliant';
        statusLabel = 'Non-Compliant';
    } else if (inheritedActualCount > 0 && !expected.limitedAccess) {
        status = 'compliant';
        statusLabel = 'Compliant (Inheritance Allowed)';
    } else {
        status = 'exact_match';
        statusLabel = 'Exact Match';
    }

    return {
        status,
        statusLabel,
        discrepancies,
        missing,
        extraDirect,
        extraInherited,
        expectedCount,
        directActualCount,
        inheritedActualCount,
        inheritedNonRemovableCount,
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

            // Get actual Limited Access status + driveId from Drive
            let actualLimitedAccess: boolean | null = null;
            let driveId: string | undefined;
            try {
                const drive = await getDriveClient();
                const folderRes = await drive.files.get({
                    fileId: folder.drive_folder_id,
                    supportsAllDrives: true,
                    fields: 'id,name,driveId,inheritedPermissionsDisabled'
                });
                actualLimitedAccess = folderRes.data.inheritedPermissionsDisabled ?? false;
                driveId = (folderRes.data as any).driveId;
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

            // Compare permissions (pass driveId for accurate classification)
            const comparison = comparePermissions(expectedPerms, actualPerms, driveId);

            // Count by status using structured diff arrays
            if (comparison.status === 'exact_match') {
                matchCount++;
            } else if (comparison.status === 'compliant') {
                extraCount++;
            } else if (comparison.status === 'non_compliant') {
                // Separate missing from mismatch using structured arrays
                if (comparison.missing.length > 0) {
                    missingCount++;
                }
                if (comparison.extraDirect.length > 0 || comparison.extraInherited.length > 0) {
                    mismatchCount++;
                }
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
                        inherited: (p.inherited === true) || (p.permissionDetails?.[0]?.inherited ?? false),
                        classification: classifyInheritedPermission(p, driveId),
                    })),
                status: comparison.status,
                statusLabel: comparison.statusLabel,
                discrepancies: comparison.discrepancies,
                expectedCount: comparison.expectedCount,
                directActualCount: comparison.directActualCount,
                inheritedActualCount: comparison.inheritedActualCount,
                inheritedNonRemovableCount: comparison.inheritedNonRemovableCount,
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
