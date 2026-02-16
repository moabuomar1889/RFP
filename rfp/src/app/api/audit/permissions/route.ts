import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { listPermissions, getDriveClient } from '@/server/google-drive';
import {
    normalizeRole,
    classifyInheritedPermission,
    buildEffectivePermissionsMap,
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
    status: 'match' | 'missing' | 'extra' | 'mismatch' | 'drive_member';
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
}

// ─── Compare Permissions ────────────────────────────────────

function comparePermissions(
    expected: { groups: any[]; users: any[]; limitedAccess: boolean; overrides?: any },
    actual: any[],
    driveId?: string
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

    // Build expected set with canonical roles
    const expectedEmails = new Set<string>();
    const expectedRoleMap = new Map<string, string>(); // email → canonical role
    const expectedTypeMap = new Map<string, 'group' | 'user'>();

    for (const g of expected.groups || []) {
        if (g?.email) {
            const key = g.email.toLowerCase();
            expectedEmails.add(key);
            expectedRoleMap.set(key, normalizeRole(g.role || 'reader'));
            expectedTypeMap.set(key, 'group');
        }
    }
    for (const u of expected.users || []) {
        if (u?.email) {
            const key = u.email.toLowerCase();
            expectedEmails.add(key);
            expectedRoleMap.set(key, normalizeRole(u.role || 'reader'));
            expectedTypeMap.set(key, 'user');
        }
    }

    // Extract override-removed set for drive membership tracking
    const overrideRemovedSet = new Set<string>();
    if (expected.overrides?.remove) {
        for (const r of expected.overrides.remove) {
            if (r.identifier) overrideRemovedSet.add(r.identifier.toLowerCase());
        }
    }

    // Protected principals to exclude from extra/mismatch counting
    const protectedEmails = ['mo.abuomar@dtgsa.com'];

    // Categorize actual permissions
    const directActual: any[] = [];
    const inheritedActual: any[] = [];
    const driveMembers: any[] = [];
    let inheritedNonRemovableCount = 0;

    for (const p of actual) {
        // Skip "Access removed" permissions (view=metadata) — these are phantom permissions
        // on limited-access folders that can only see folder name, NOT contents. Never count them.
        if (p.view === 'metadata') continue;

        const cls = classifyInheritedPermission(p, driveId);
        if (cls === 'NOT_INHERITED') {
            directActual.push(p);
        } else if (cls === 'NON_REMOVABLE_DRIVE_MEMBERSHIP') {
            inheritedNonRemovableCount++;
            driveMembers.push(p);
            // Flag override-removed principals persisting as drive membership
            const email = p.emailAddress?.toLowerCase();
            if (email && overrideRemovedSet.has(email)) {
                discrepancies.push(`Requires Drive membership change: ${email}`);
            }
        } else {
            inheritedActual.push(p);
        }
    }

    // Legacy counters
    const expectedCount = expectedEmails.size;
    const directActualCount = directActual.filter(p => {
        const e = p.emailAddress?.toLowerCase();
        return e && !protectedEmails.includes(e);
    }).length;
    const inheritedActualCount = inheritedActual.filter(p => {
        const e = p.emailAddress?.toLowerCase();
        return e && !protectedEmails.includes(e);
    }).length;
    const totalActualCount = directActualCount + inheritedActualCount;

    // Build lookup of actual emails → permission data (direct + inherited, excluding drive members)
    const actualEmailsProcessed = new Set<string>();
    const allActual = [...directActual, ...inheritedActual];

    for (const p of allActual) {
        const email = p.emailAddress?.toLowerCase();
        if (!email) continue;
        if (actualEmailsProcessed.has(email)) continue;
        actualEmailsProcessed.add(email);

        const isInherited = (p.inherited === true) || (p.permissionDetails?.[0]?.inherited ?? false);
        const actualCanonical = normalizeRole(p.role);
        const actualRank = CANONICAL_RANK[actualCanonical] ?? 0;

        if (expectedEmails.has(email)) {
            // Expected and present — check role
            const expectedCanonical = expectedRoleMap.get(email)!;
            const expectedRank = CANONICAL_RANK[expectedCanonical] ?? 0;
            const tags: string[] = [];

            if (actualRank > expectedRank) {
                // Higher privilege than expected — MISMATCH
                mismatchCount++;
                discrepancies.push(`Role mismatch: ${email} (expected=${canonicalRoleLabel(expectedCanonical)}, actual=${canonicalRoleLabel(actualCanonical)})`);
                rows.push({
                    type: expectedTypeMap.get(email) || (p.type === 'group' ? 'group' : 'user'),
                    identifier: email,
                    expectedRole: canonicalRoleLabel(expectedCanonical),
                    expectedRoleRaw: expectedCanonical,
                    actualRole: canonicalRoleLabel(actualCanonical),
                    actualRoleRaw: actualCanonical,
                    status: 'mismatch',
                    tags,
                    inherited: isInherited,
                });
            } else {
                // actualRank <= expectedRank — MATCH (compliant)
                if (actualRank < expectedRank) {
                    tags.push('More restrictive');
                }
                matchCount++;
                rows.push({
                    type: expectedTypeMap.get(email) || (p.type === 'group' ? 'group' : 'user'),
                    identifier: email,
                    expectedRole: canonicalRoleLabel(expectedCanonical),
                    expectedRoleRaw: expectedCanonical,
                    actualRole: canonicalRoleLabel(actualCanonical),
                    actualRoleRaw: actualCanonical,
                    status: 'match',
                    tags,
                    inherited: isInherited,
                });
            }
            expectedEmails.delete(email); // Mark as processed
        } else {
            // Not expected — is it extra?
            if (protectedEmails.includes(email)) continue;

            // Domain/anyone on non-limited folders: skip
            if (!expected.limitedAccess && (p.type === 'domain' || p.type === 'anyone')) continue;

            // Inherited from parent folder on non-limited folder: NOT a violation
            if (!expected.limitedAccess && isInherited) continue;

            // Extra permission
            extraCount++;
            discrepancies.push(`Extra: ${email}`);
            rows.push({
                type: p.type === 'group' ? 'group' : 'user',
                identifier: email,
                expectedRole: null,
                expectedRoleRaw: null,
                actualRole: canonicalRoleLabel(actualCanonical),
                actualRoleRaw: actualCanonical,
                status: 'extra',
                tags: isInherited ? ['Inherited'] : [],
                inherited: isInherited,
            });
        }
    }

    // Remaining expected = MISSING
    for (const email of expectedEmails) {
        missingCount++;
        discrepancies.push(`Missing: ${email}`);
        rows.push({
            type: expectedTypeMap.get(email) || 'user',
            identifier: email,
            expectedRole: canonicalRoleLabel(expectedRoleMap.get(email)!),
            expectedRoleRaw: expectedRoleMap.get(email)!,
            actualRole: null,
            actualRoleRaw: null,
            status: 'missing',
            tags: [],
            inherited: false,
        });
    }

    // Drive members — always add as neutral rows (never counted as extra/mismatch)
    for (const p of driveMembers) {
        const email = p.emailAddress?.toLowerCase();
        if (!email) continue;
        if (protectedEmails.includes(email)) continue;
        const actualCanonical = normalizeRole(p.role);
        rows.push({
            type: p.type === 'group' ? 'group' : 'user',
            identifier: email,
            expectedRole: null,
            expectedRoleRaw: null,
            actualRole: canonicalRoleLabel(actualCanonical),
            actualRoleRaw: actualCanonical,
            status: 'drive_member',
            tags: ['Drive Member'],
            inherited: true,
        });
    }

    // Sort: issues first, drive_member at bottom
    const order: Record<string, number> = { missing: 0, mismatch: 1, extra: 2, match: 3, drive_member: 4 };
    rows.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));

    // Determine folder status (excluding drive members)
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
        expectedCount,
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

        // Build effective permissions map from template
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

        // Build permissionsMap with phase-prefixed keys
        // e.g. "Bidding/SOW", "Project Delivery/Document Control"
        const permissionsMap: Record<string, any> = {};
        for (const phaseNodeName of phasesToAudit) {
            const phaseNode = templateNodes.find((n: any) => {
                const nodeName = (n.name || n.text || '').trim();
                return nodeName === phaseNodeName;
            });

            if (phaseNode?.children) {
                const phaseMap = buildEffectivePermissionsMap(phaseNode.children);
                for (const [path, perms] of Object.entries(phaseMap)) {
                    permissionsMap[`${phaseNodeName}/${path}`] = perms;
                }
            } else {
                console.warn(`[AUDIT] Phase node '${phaseNodeName}' not found`);
            }
        }

        // Get indexed folders for this project
        const { data: rawFolders } = await supabaseAdmin.rpc('list_project_folders', {
            p_project_id: projectId
        });

        if (!rawFolders || rawFolders.length === 0) {
            return NextResponse.json({
                success: true,
                result: {
                    projectId: project.id,
                    projectName: project.name,
                    projectCode: project.pr_number,
                    phase: projectPhase,
                    phaseLabels: phasesToAudit,
                    totalFolders: 0,
                    matchCount: 0,
                    extraCount: 0,
                    missingCount: 0,
                    mismatchCount: 0,
                    comparisons: []
                }
            });
        }

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

            // Strip phase prefix if present
            let pathWithoutPhase = templatePath.replace(/^(Bidding|Project Delivery)\//, '');

            // Build phase-prefixed key for permissionsMap lookup
            const prefixedPath = `${folderPhase}/${pathWithoutPhase}`;
            let expectedPerms = permissionsMap[prefixedPath];

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

            console.log('[AUDIT DEBUG]', {
                templatePath,
                folderPhase,
                prefixedPath,
                hasMatch: !!expectedPerms,
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

            // Compare permissions
            const comparison = comparePermissions(expectedPerms, actualPerms, driveId);

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
            comparisons
        };

        return NextResponse.json({ success: true, result });

    } catch (error: any) {
        console.error('Audit error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
