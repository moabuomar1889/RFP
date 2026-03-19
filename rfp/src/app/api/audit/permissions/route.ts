import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { listPermissions, getDriveClient } from '@/server/google-drive';
import {
    normalizeRole,
    classifyInheritedPermission,
    buildEffectivePermissionsMap,
    buildNodeMap,
    comparePermissions as sharedComparePermissions,
    computeDesiredEffectivePolicy,
    isFullyCompliant,
    type PermComparison,
} from '@/server/audit-helpers';
import { CANONICAL_RANK, canonicalRoleLabel } from '@/lib/template-engine/types';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Structured Row Model ───────────────────────────────────
interface ComparisonRow {
    type: 'group' | 'user';
    identifier: string;
    expectedRole: string | null;      // canonical label (e.g. "Manager")
    expectedRoleRaw: string | null;   // canonical key (e.g. "manager")
    actualRole: string | null;        // canonical label
    actualRoleRaw: string | null;     // canonical key
    status: 'match' | 'missing' | 'extra' | 'mismatch' | 'drive_member' | 'no_effective_access';
    tags: string[];                   // e.g. ["More restrictive"], ["Drive Member"]
    inherited: boolean;
}

interface PermissionComparison {
    folderPath: string;
    normalizedPath: string;
    driveFolderId: string;
    expectedGroups: { email: string; role: string }[];
    expectedUsers: { email: string; role: string }[];
    actualPermissions: { email: string; role: string; type: string; inherited?: boolean; classification?: string }[];
    comparisonRows: ComparisonRow[];
    // Per-principal counters
    matchCount: number;
    extraCount: number;
    missingCount: number;
    mismatchCount: number;
    // Legacy counters
    expectedCount: number;
    directActualCount: number;
    inheritedActualCount: number;
    inheritedNonRemovableCount?: number;
    totalActualCount: number;
    // Status
    status: 'exact_match' | 'compliant' | 'non_compliant';
    statusLabel: string;
    discrepancies: string[];
    limitedAccessExpected: boolean;
    limitedAccessActual: boolean;
}

interface AuditResult {
    projectId: string;
    projectName: string;
    projectCode: string;
    phase?: string;
    phaseLabels?: string[];
    totalFolders: number;
    matchCount: number;
    extraCount: number;
    missingCount: number;
    mismatchCount: number;
    comparisons: PermissionComparison[];
    templateFolderCounts?: { phase: string; count: number }[];
    indexedFolderCount?: number;
}

// ─── Compare Permissions ────────────────────────────────────

// ─── Compare Permissions (strict — wraps shared audit-helpers model) ────────
// Maps PermComparison[] → ComparisonRow[] for audit UI.
// Strict classification: STRONGER and WEAKER are mismatches, not matches.

function comparePermissions(
    expected: { groups: any[]; users: any[]; limitedAccess: boolean; overrides?: any },
    actual: any[],
    driveId?: string,
    actualLimitedAccess?: boolean | null,
): {
    comparisonRows: ComparisonRow[];
    matchCount: number;
    extraCount: number;
    missingCount: number;
    mismatchCount: number;
    discrepancies: string[];
    expectedCount: number;
    directActualCount: number;
    inheritedActualCount: number;
    inheritedNonRemovableCount: number;
    totalActualCount: number;
    status: 'exact_match' | 'compliant' | 'non_compliant';
    statusLabel: string;
} {
    const discrepancies: string[] = [];
    const rows: ComparisonRow[] = [];
    let matchCount = 0, extraCount = 0, missingCount = 0, mismatchCount = 0;
    let inheritedNonRemovableCount = 0;

    // Build expected principals with overrides applied (via shared helper)
    const desiredPrincipals = computeDesiredEffectivePolicy(expected);

    // Run shared strict comparison
    const comparisons = sharedComparePermissions(
        desiredPrincipals,
        actual,
        expected.limitedAccess,
        actualLimitedAccess ?? null,
        driveId,
    );

    // Count classification breakdown for legacy counters
    let directActualCount = 0;
    let inheritedActualCount = 0;
    for (const perm of actual) {
        if (!perm.emailAddress) continue;
        const cls = classifyInheritedPermission(perm, driveId);
        if (cls === 'NOT_INHERITED') directActualCount++;
        else if (cls === 'NON_REMOVABLE_DRIVE_MEMBERSHIP') inheritedNonRemovableCount++;
        else inheritedActualCount++;
    }

    const protectedEmails = ['mo.abuomar@dtgsa.com'];

    // Map shared PermComparison → ComparisonRow
    for (const c of comparisons) {
        // Skip the LA mismatch row — it's surfaced via limitedAccessExpected/Actual fields
        if (c.status === 'LIMITED_ACCESS_MISMATCH') {
            discrepancies.push(`Limited Access mismatch: expected=${c.expectedRole}, actual=${c.actualRole}`);
            continue;
        }

        if (!c.principal || c.principal === '__limited_access__') continue;
        if (protectedEmails.includes(c.principal)) continue;

        const expectedRoleLabel = c.expectedRole ? canonicalRoleLabel(c.expectedRole) : null;
        const actualRoleLabel = c.actualRole ? canonicalRoleLabel(c.actualRole) : null;
        const principalType: 'group' | 'user' = (c.principalType === 'group' ? 'group' : 'user');

        switch (c.status) {
            case 'EXACT_MATCH':
                matchCount++;
                rows.push({
                    type: principalType,
                    identifier: c.principal,
                    expectedRole: expectedRoleLabel,
                    expectedRoleRaw: c.expectedRole ?? null,
                    actualRole: actualRoleLabel,
                    actualRoleRaw: c.actualRole ?? null,
                    status: 'match',
                    tags: [],
                    inherited: false,
                });
                break;

            case 'STRONGER_THAN_TEMPLATE':
                // STRICT: stronger-than-template is a mismatch, not a match.
                // The folder has more access than the template allows.
                mismatchCount++;
                discrepancies.push(`Stronger than template: ${c.principal} (actual=${c.actualRole}, expected=${c.expectedRole})`);
                rows.push({
                    type: principalType,
                    identifier: c.principal,
                    expectedRole: expectedRoleLabel,
                    expectedRoleRaw: c.expectedRole ?? null,
                    actualRole: actualRoleLabel,
                    actualRoleRaw: c.actualRole ?? null,
                    status: 'mismatch',
                    tags: ['Stronger Than Template'],
                    inherited: false,
                });
                break;

            case 'WEAKER_THAN_TEMPLATE':
                // STRICT: weaker-than-template is a mismatch — policy is being under-applied.
                mismatchCount++;
                discrepancies.push(`Weaker than template: ${c.principal} (actual=${c.actualRole}, expected=${c.expectedRole})`);
                rows.push({
                    type: principalType,
                    identifier: c.principal,
                    expectedRole: expectedRoleLabel,
                    expectedRoleRaw: c.expectedRole ?? null,
                    actualRole: actualRoleLabel,
                    actualRoleRaw: c.actualRole ?? null,
                    status: 'mismatch',
                    tags: ['Weaker Than Template'],
                    inherited: false,
                });
                break;

            case 'MISSING':
                missingCount++;
                discrepancies.push(`Missing: ${c.principal}`);
                rows.push({
                    type: principalType,
                    identifier: c.principal,
                    expectedRole: expectedRoleLabel,
                    expectedRoleRaw: c.expectedRole ?? null,
                    actualRole: null,
                    actualRoleRaw: null,
                    status: 'missing',
                    tags: [],
                    inherited: false,
                });
                break;

            case 'EXTRA':
                extraCount++;
                discrepancies.push(`Extra: ${c.principal}`);
                rows.push({
                    type: principalType,
                    identifier: c.principal,
                    expectedRole: null,
                    expectedRoleRaw: null,
                    actualRole: actualRoleLabel,
                    actualRoleRaw: c.actualRole ?? null,
                    status: 'extra',
                    tags: [],
                    inherited: false,
                });
                break;

            case 'NON_REMOVABLE_MEMBERSHIP':
                inheritedNonRemovableCount++;
                rows.push({
                    type: principalType,
                    identifier: c.principal,
                    expectedRole: c.expectedRole ? canonicalRoleLabel(c.expectedRole) : null,
                    expectedRoleRaw: c.expectedRole ?? null,
                    actualRole: actualRoleLabel,
                    actualRoleRaw: c.actualRole ?? null,
                    status: 'drive_member',
                    tags: ['Drive Member', ...(c.reason ? [c.reason] : [])],
                    inherited: true,
                });
                break;
        }
    }

    // Sort: issues first, drive_member at bottom
    const order: Record<string, number> = { missing: 0, mismatch: 1, extra: 2, match: 3, no_effective_access: 4, drive_member: 5 };
    rows.sort((a, b) => (order[a.status] ?? 6) - (order[b.status] ?? 6));

    const totalActualCount = directActualCount + inheritedActualCount;

    let status: 'exact_match' | 'compliant' | 'non_compliant';
    let statusLabel: string;

    if (missingCount > 0 || mismatchCount > 0 || extraCount > 0) {
        status = 'non_compliant';
        statusLabel = 'Non-Compliant';
    } else if (inheritedActualCount > 0 && !expected.limitedAccess) {
        status = 'compliant';
        statusLabel = 'Compliant';
    } else {
        status = 'exact_match';
        statusLabel = 'Compliant';
    }

    return {
        comparisonRows: rows,
        matchCount,
        extraCount,
        missingCount,
        mismatchCount,
        discrepancies,
        expectedCount: desiredPrincipals.filter(p => p.overrideAction !== 'removed').length,
        directActualCount,
        inheritedActualCount,
        inheritedNonRemovableCount,
        totalActualCount,
        status,
        statusLabel,
    };
}

// ─── GET Handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        // Get project info
        console.log('Fetching project with ID:', projectId);
        const { data: projectsData, error: projectError } = await supabaseAdmin.rpc('get_projects', {
            p_status: null,
            p_phase: null
        });

        const project = projectsData?.find((p: any) => p.id === projectId);
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

        // Build effective permissions map from template — DUAL STRATEGY:
        // PRIMARY:  nodeMap keyed by stable node_id UUID → immune to renames
        // FALLBACK: permissionsMap keyed by phase/path → for folders not yet stamped
        const templateNodes = Array.isArray(template.template_json)
            ? template.template_json
            : template.template_json.template || [];

        // Determine which phases to audit:
        // - bidding: only Bidding
        // - execution: BOTH Bidding + Project Delivery
        const projectPhase = project.phase || 'bidding';
        const phasesToAudit = projectPhase === 'bidding'
            ? ['Bidding']
            : ['Bidding', 'Project Delivery'];

        // Build nodeMap by node_id (primary — stable across renames)
        const nodeMap = new Map<string, any>();
        // Build permissionsMap by phase/path (fallback — for unmapped folders)
        const permissionsMap: Record<string, any> = {};
        const templateFolderCounts: { phase: string; count: number }[] = [];
        for (const phaseNodeName of phasesToAudit) {
            const phaseNode = templateNodes.find((n: any) => {
                const nodeName = (n.name || n.text || '').trim();
                return nodeName === phaseNodeName;
            });

            if (phaseNode?.children) {
                // node_id map (primary)
                const phaseNodeMap = buildNodeMap(phaseNode.children);
                for (const [nid, perms] of phaseNodeMap) {
                    nodeMap.set(nid, perms);
                }
                // path map (fallback)
                const phaseMap = buildEffectivePermissionsMap(phaseNode.children);
                templateFolderCounts.push({ phase: phaseNodeName, count: Object.keys(phaseMap).length + 1 });
                for (const [path, perms] of Object.entries(phaseMap)) {
                    permissionsMap[`${phaseNodeName}/${path}`] = perms;
                }
            } else {
                console.warn(`[AUDIT] Phase node '${phaseNodeName}' not found`);
                templateFolderCounts.push({ phase: phaseNodeName, count: 0 });
            }
        }
        console.log(`[AUDIT] nodeMap size: ${nodeMap.size}, permissionsMap size: ${Object.keys(permissionsMap).length}`);

        // Get indexed folders for this project
        const { data: rawFoldersData } = await supabaseAdmin.rpc('list_project_folders', {
            p_project_id: projectId
        });
        const rawFolders = rawFoldersData || [];

        // Deduplicate folders by drive_folder_id
        const folderMap = new Map<string, any>();
        for (const folder of rawFolders) {
            const existing = folderMap.get(folder.drive_folder_id);
            if (!existing) {
                folderMap.set(folder.drive_folder_id, folder);
            } else {
                // Prefer the path that matches a permissionsMap key
                const existingNorm = existing.normalized_template_path || existing.template_path || '';
                const newNorm = folder.normalized_template_path || folder.template_path || '';
                // Check both with and without phase prefix
                const existingHasMatch = Object.keys(permissionsMap).some(k => k.endsWith(`/${existingNorm}`) || k === existingNorm);
                const newHasMatch = Object.keys(permissionsMap).some(k => k.endsWith(`/${newNorm}`) || k === newNorm);
                if (!existingHasMatch && newHasMatch) {
                    folderMap.set(folder.drive_folder_id, folder);
                }
            }
        }
        const folders = Array.from(folderMap.values());

        // Helper: Normalize Drive-style paths to template-matching paths
        const projectCode = project.pr_number || '';
        function normalizeDrivePathToTemplate(drivePath: string): string {
            const segments = drivePath.split('/');
            const remaining = segments.slice(1);
            const cleaned = remaining.map(seg => {
                const prefixPattern = new RegExp(
                    `^\\d+-${projectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(RFP|PD)-`, 'i'
                );
                let result = seg.replace(prefixPattern, '');
                if (result === seg) {
                    const altPattern = new RegExp(
                        `^${projectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(RFP|PD)-`, 'i'
                    );
                    result = seg.replace(altPattern, '');
                }
                return result;
            });
            return cleaned.filter(s => s).join('/');
        }

        // Helper: Determine phase from template_path
        // Supports both prefixed paths (e.g. "PRJ-017-RFP/...") and clean paths (e.g. "Bidding/...")
        function detectFolderPhase(templatePath: string): string {
            if (templatePath.startsWith('Bidding/') || templatePath === 'Bidding' ||
                /-RFP[-/]/i.test(templatePath) || templatePath.includes('-RFP')) {
                return 'Bidding';
            }
            return 'Project Delivery';
        }

        const comparisons: PermissionComparison[] = [];
        let totalMatch = 0, totalExtra = 0, totalMissing = 0, totalMismatch = 0;

        for (const folder of folders) {
            let templatePath = folder.normalized_template_path || folder.template_path;
            const folderPhase = detectFolderPhase(folder.template_path || '');

            // ─── PRIMARY LOOKUP: template_node_id → nodeMap ───
            // This is stable across renames and typos.
            let expectedPerms = folder.template_node_id
                ? nodeMap.get(folder.template_node_id)
                : null;

            let pathWithoutPhase = templatePath.replace(/^(Bidding|Project Delivery)\//, '');

            // ─── FALLBACK LOOKUP: path-based ─────────────────
            // Used when template_node_id is null (not yet stamped or manually mapped)
            if (!expectedPerms) {
                const prefixedPath = `${folderPhase}/${pathWithoutPhase}`;
                expectedPerms = permissionsMap[prefixedPath];

                // If no match, try normalizing as a Drive-style path
                if (!expectedPerms) {
                    const normalizedPath = normalizeDrivePathToTemplate(templatePath);
                    if (normalizedPath) {
                        const altPrefixed = `${folderPhase}/${normalizedPath}`;
                        expectedPerms = permissionsMap[altPrefixed];
                        if (expectedPerms) {
                            pathWithoutPhase = normalizedPath;
                        }
                    }
                }

                if (expectedPerms) {
                    console.log(`[AUDIT] Path fallback used for: '${templatePath}' (template_node_id=${folder.template_node_id ?? 'null'})`);
                }
            }

            console.log('[AUDIT DEBUG]', {
                templatePath,
                folderPhase,
                template_node_id: folder.template_node_id ?? null,
                resolvedVia: folder.template_node_id && nodeMap.has(folder.template_node_id) ? 'node_id' : 'path',
                hasMatch: !!expectedPerms,
            });

            if (!expectedPerms) {
                console.warn(`[AUDIT] UNMAPPED: '${templatePath}' — no node_id match and no path match. Use /folder-mapping to bind it.`);
                continue;
            }

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

            // Compare permissions (strict shared model — STRONGER/WEAKER are mismatches)
            const comparison = comparePermissions(expectedPerms, actualPerms, driveId, actualLimitedAccess);


            // Accumulate per-principal counters
            totalMatch += comparison.matchCount;
            totalExtra += comparison.extraCount;
            totalMissing += comparison.missingCount;
            totalMismatch += comparison.mismatchCount;

            comparisons.push({
                folderPath: folder.template_path,
                normalizedPath: `${folderPhase}/${pathWithoutPhase}`,
                driveFolderId: folder.drive_folder_id,
                expectedGroups: (expectedPerms.groups || []).map((g: any) => ({
                    email: g.email,
                    role: g.role || 'reader'
                })),
                expectedUsers: (expectedPerms.users || []).map((u: any) => ({
                    email: u.email,
                    role: u.role || 'reader'
                })),
                actualPermissions: actualPerms
                    .filter((p: any) => p.emailAddress && p.type !== 'domain')
                    .map((p: any) => ({
                        email: p.emailAddress,
                        role: p.role,
                        type: p.type,
                        inherited: (p.inherited === true) || (p.permissionDetails?.[0]?.inherited ?? false),
                        classification: classifyInheritedPermission(p, driveId),
                    })),
                comparisonRows: comparison.comparisonRows,
                matchCount: comparison.matchCount,
                extraCount: comparison.extraCount,
                missingCount: comparison.missingCount,
                mismatchCount: comparison.mismatchCount,
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

        // ── Second pass: template paths NOT in folder_index ──────────
        // Show template folders that have no folder_index entry so the
        // audit tree displays ALL expected folders, not just indexed ones.
        const coveredPaths = new Set(comparisons.map(c => c.normalizedPath));
        for (const [tplPath, perms] of Object.entries(permissionsMap)) {
            if (coveredPaths.has(tplPath)) continue;

            const missingGroups = (perms.groups || []).length;
            const missingUsers = (perms.users || []).length;
            totalMissing += missingGroups + missingUsers;

            comparisons.push({
                folderPath: tplPath,
                normalizedPath: tplPath,
                driveFolderId: '',
                expectedGroups: (perms.groups || []).map((g: any) => ({
                    email: g.email,
                    role: g.role || 'reader',
                })),
                expectedUsers: (perms.users || []).map((u: any) => ({
                    email: u.email,
                    role: u.role || 'reader',
                })),
                actualPermissions: [],
                comparisonRows: [
                    ...(perms.groups || []).map((g: any) => ({
                        type: 'group' as const,
                        identifier: g.email,
                        expectedRole: g.role || 'reader',
                        expectedRoleRaw: g.role || 'reader',
                        actualRole: null,
                        actualRoleRaw: null,
                        status: 'missing' as const,
                        tags: [] as string[],
                        inherited: false,
                    })),
                    ...(perms.users || []).map((u: any) => ({
                        type: 'user' as const,
                        identifier: u.email,
                        expectedRole: u.role || 'reader',
                        expectedRoleRaw: u.role || 'reader',
                        actualRole: null,
                        actualRoleRaw: null,
                        status: 'missing' as const,
                        tags: [] as string[],
                        inherited: false,
                    })),
                ],
                matchCount: 0,
                extraCount: 0,
                missingCount: missingGroups + missingUsers,
                mismatchCount: 0,
                status: 'non_compliant',
                statusLabel: 'Not Indexed',
                discrepancies: ['Folder not found in index — run Rebuild Index'],
                expectedCount: missingGroups + missingUsers,
                directActualCount: 0,
                inheritedActualCount: 0,
                totalActualCount: 0,
                limitedAccessExpected: perms.limitedAccess || false,
                limitedAccessActual: false,
            });
        }

        // Count indexed folders (deduplicated)
        const indexedFolderCount = folders.length;

        const result: AuditResult = {
            projectId: project.id,
            projectName: project.name,
            projectCode: project.pr_number,
            phase: projectPhase,
            phaseLabels: phasesToAudit,
            totalFolders: comparisons.length,
            matchCount: totalMatch,
            extraCount: totalExtra,
            missingCount: totalMissing,
            mismatchCount: totalMismatch,
            comparisons,
            templateFolderCounts,
            indexedFolderCount,
        };

        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('Audit error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
