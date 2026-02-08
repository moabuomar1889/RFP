/**
 * Shared normalization and classification helpers for audit + enforcement.
 * Single source of truth — used by both api/audit/permissions and server/jobs.ts.
 *
 * RULES:
 *   - Template structure is NOT changed.
 *   - Drive API calls are NOT changed.
 *   - Only measurement + classification logic lives here.
 */

// ─── Canonical Principal Model ──────────────────────────────────────────────
export interface CanonicalPrincipal {
    type: 'group' | 'user';
    identifier: string;   // email (always lowercased)
    role: string;         // DriveRole: reader, writer, fileOrganizer, organizer
}

/**
 * Convert a template group entry → CanonicalPrincipal.
 * Template shape: { email: string, role: string }
 */
export function normalizeTemplateGroup(g: any): CanonicalPrincipal | null {
    if (!g?.email) return null;
    return {
        type: 'group',
        identifier: g.email.toLowerCase(),
        role: normalizeRole(g.role || 'reader'),
    };
}

/**
 * Convert a template user entry → CanonicalPrincipal.
 * Template shape: { email: string, role: string }
 */
export function normalizeTemplateUser(u: any): CanonicalPrincipal | null {
    if (!u?.email) return null;
    return {
        type: 'user',
        identifier: u.email.toLowerCase(),
        role: normalizeRole(u.role || 'reader'),
    };
}

// ─── Role Normalization ─────────────────────────────────────────────────────

/**
 * Normalize roles for comparison.
 * Google Shared Drives map "organizer" → "fileOrganizer" for groups.
 */
export function normalizeRole(role: string): string {
    if (role === 'organizer' || role === 'fileOrganizer') {
        return 'fileOrganizer';
    }
    return role;
}

// ─── Project Normalization ──────────────────────────────────────────────────

export interface NormalizedProject {
    id: string;
    prNumber: string;
    name: string;
    phase: string;
    status: string;
    driveFolderId: string;
}

/**
 * Normalize a project row from any RPC (get_projects, list_projects, etc.).
 * Handles both snake_case (`pr_number`) and camelCase (`prNumber`) keys.
 */
export function normalizeProject(raw: any): NormalizedProject {
    return {
        id: raw.id ?? '',
        prNumber: raw.pr_number ?? raw.prNumber ?? raw.project_code ?? raw.projectCode ?? '',
        name: raw.name ?? raw.project_name ?? raw.projectName ?? '',
        phase: raw.phase ?? 'bidding',
        status: raw.status ?? 'active',
        driveFolderId: raw.drive_folder_id ?? raw.driveFolderId ?? '',
    };
}

/**
 * Validate that a normalized project has the minimum required fields.
 */
export function isValidProject(p: NormalizedProject): boolean {
    return !!(p.id && p.prNumber && p.name);
}

// ─── Inherited Permission Classification ────────────────────────────────────

export type InheritedClassification =
    | 'NON_REMOVABLE_DRIVE_MEMBERSHIP'
    | 'REMOVABLE_PARENT_FOLDER'
    | 'NOT_INHERITED';

/**
 * Classify an inherited permission by its source.
 *
 * ROBUST APPROACH (driveId equality):
 *   - If inherited AND (inheritedFrom === driveId) → Shared Drive membership.
 *     These are NON-REMOVABLE via file permissions.delete.
 *     They MUST NOT be counted as violations.
 *   - If inherited AND inheritedFrom is a folderId (NOT driveId) → parent folder.
 *     These are REMOVABLE when limitedAccess is enabled.
 *   - If not inherited → NOT_INHERITED (direct permission).
 *
 * @param perm - Permission object from Drive API (with permissionDetails)
 * @param driveId - The Shared Drive ID from files.get (optional, falls back to heuristic)
 */
export function classifyInheritedPermission(perm: any, driveId?: string): InheritedClassification {
    const details: any[] = perm.permissionDetails || [];

    // DUAL-PERMISSION CHECK: if ANY permissionDetails entry has inherited:false,
    // the permission has a direct component that IS removable → NOT_INHERITED
    if (details.length > 0) {
        const hasDirectComponent = details.some((d: any) => d.inherited === false);
        if (hasDirectComponent) return 'NOT_INHERITED';
    }

    // Check inherited from permissionDetails (most reliable) or top-level
    const isInherited =
        (perm.inherited === true) ||
        (details.some((d: any) => d.inherited) ?? false);

    if (!isInherited) return 'NOT_INHERITED';

    // Get inheritedFrom: prefer permissionDetails (API v3 detailed), fallback to top-level
    const inheritedFrom =
        details.find((d: any) => d.inherited)?.inheritedFrom ??
        perm.inheritedFrom;

    if (!inheritedFrom) {
        // Inherited but no source info — treat conservatively as drive membership
        return 'NON_REMOVABLE_DRIVE_MEMBERSHIP';
    }

    // PRIMARY: Compare against driveId (from files.get)
    if (driveId && inheritedFrom === driveId) {
        return 'NON_REMOVABLE_DRIVE_MEMBERSHIP';
    }

    // FALLBACK when driveId not available: prefix heuristic (less reliable)
    if (!driveId && typeof inheritedFrom === 'string' && inheritedFrom.startsWith('0A')) {
        return 'NON_REMOVABLE_DRIVE_MEMBERSHIP';
    }

    return 'REMOVABLE_PARENT_FOLDER';
}

// ─── Shared buildPermissionsMap ─────────────────────────────────────────────

export interface FolderPermissions {
    groups: any[];
    users: any[];
    limitedAccess: boolean;
    overrides?: {
        remove?: { type: string; identifier: string }[];
        downgrade?: { type: string; identifier: string; role: string }[];
    };
}

/**
 * Build a flat map of template paths → their expected permissions.
 * Handles both template shapes:
 *   - children key: "nodes" (tree editor v2) or "children" (legacy)
 *   - name key: "text" (tree editor v2) or "name" (legacy)
 */
export function buildPermissionsMap(
    nodes: any[],
    parentPath: string = ''
): Record<string, FolderPermissions> {
    const map: Record<string, FolderPermissions> = {};

    for (const node of nodes) {
        const nodeName = node.text || node.name;
        if (!nodeName) continue;

        const path = parentPath ? `${parentPath}/${nodeName}` : nodeName;

        map[path] = {
            groups: node.groups || [],
            users: node.users || [],
            limitedAccess: node.limitedAccess || false,
            overrides: node.overrides,
        };

        const children = node.nodes || node.children || [];
        if (children.length > 0) {
            const childMap = buildPermissionsMap(children, path);
            Object.assign(map, childMap);
        }
    }

    return map;
}

/**
 * Build a flat map of template paths → their EFFECTIVE permissions.
 * Unlike buildPermissionsMap (explicit-only), this accumulates inherited
 * groups/users from parent nodes down the tree, then applies per-node
 * overrides (remove/downgrade).
 *
 * This matches what the Template Editor Effective Policy panel shows.
 */
export function buildEffectivePermissionsMap(
    nodes: any[],
    parentPath: string = '',
    parentGroups: any[] = [],
    parentUsers: any[] = [],
): Record<string, FolderPermissions> {
    const map: Record<string, FolderPermissions> = {};

    for (const node of nodes) {
        const nodeName = node.text || node.name;
        if (!nodeName) continue;

        const path = parentPath ? `${parentPath}/${nodeName}` : nodeName;

        // Merge: start with inherited from parent, then layer node's own explicit
        const nodeGroups: any[] = node.groups || [];
        const nodeUsers: any[] = node.users || [];

        // Dedup merge: node explicit principals override inherited (by email)
        const mergedGroupMap = new Map<string, any>();
        for (const g of parentGroups) {
            if (g?.email) mergedGroupMap.set(g.email.toLowerCase(), { ...g });
        }
        for (const g of nodeGroups) {
            if (g?.email) mergedGroupMap.set(g.email.toLowerCase(), { ...g });
        }

        const mergedUserMap = new Map<string, any>();
        for (const u of parentUsers) {
            if (u?.email) mergedUserMap.set(u.email.toLowerCase(), { ...u });
        }
        for (const u of nodeUsers) {
            if (u?.email) mergedUserMap.set(u.email.toLowerCase(), { ...u });
        }

        let effectiveGroups = Array.from(mergedGroupMap.values());
        let effectiveUsers = Array.from(mergedUserMap.values());

        // Apply subtractive overrides at this node
        const overrides = node.overrides;
        if (overrides) {
            const removeSet = new Set(
                (overrides.remove ?? []).map((r: any) => (r.identifier || '').toLowerCase())
            );
            const downgradeMap = new Map(
                (overrides.downgrade ?? []).map((d: any) => [(d.identifier || '').toLowerCase(), d])
            );

            // Filter removed
            effectiveGroups = effectiveGroups.filter(g => !removeSet.has(g.email.toLowerCase()));
            effectiveUsers = effectiveUsers.filter(u => !removeSet.has(u.email.toLowerCase()));

            // Apply downgrades
            for (const g of effectiveGroups) {
                const d = downgradeMap.get(g.email.toLowerCase()) as any;
                if (d) {
                    const currentRank = ROLE_RANK[normalizeRole(g.role || 'reader')] ?? 0;
                    const targetRank = ROLE_RANK[normalizeRole(d.role)] ?? 0;
                    if (targetRank < currentRank) {
                        g.role = d.role;
                    }
                }
            }
            for (const u of effectiveUsers) {
                const d = downgradeMap.get(u.email.toLowerCase()) as any;
                if (d) {
                    const currentRank = ROLE_RANK[normalizeRole(u.role || 'reader')] ?? 0;
                    const targetRank = ROLE_RANK[normalizeRole(d.role)] ?? 0;
                    if (targetRank < currentRank) {
                        u.role = d.role;
                    }
                }
            }
        }

        map[path] = {
            groups: effectiveGroups,
            users: effectiveUsers,
            limitedAccess: node.limitedAccess || false,
            overrides: node.overrides,
        };

        // Recurse into children, passing this node's effective principals as parent
        const children = node.nodes || node.children || [];
        if (children.length > 0) {
            const childMap = buildEffectivePermissionsMap(
                children,
                path,
                effectiveGroups,
                effectiveUsers,
            );
            Object.assign(map, childMap);
        }
    }

    return map;
}

// ─── Effective Policy Resolver (for Enforcement/Audit) ──────────────────────

/** Canonical role ranking for override comparison. */
const ROLE_RANK: Record<string, number> = {
    reader: 0,
    commenter: 1,
    writer: 2,
    fileOrganizer: 3,
    organizer: 3,
};

export interface DesiredPrincipal {
    type: 'group' | 'user';
    identifier: string;
    role: string;
    overrideAction: 'none' | 'removed' | 'downgraded';
}

/**
 * Compute the desired effective policy for a folder by applying overrides.
 * 
 * This is a standalone helper for enforcement/audit.
 * It takes the raw folder permissions (explicit only) and produces the final
 * list indicating which principals should be present and at what role,
 * accounting for override removals and downgrades.
 * 
 * NOTE: This does NOT resolve template inheritance — it expects `perms`
 * to contain the fully-merged explicit + inherited principals as stored
 * in the template JSON at each node level.
 */
export function computeDesiredEffectivePolicy(
    perms: FolderPermissions
): DesiredPrincipal[] {
    const result: DesiredPrincipal[] = [];

    // Collect all explicit principals
    for (const g of perms.groups || []) {
        if (!g?.email) continue;
        result.push({
            type: 'group',
            identifier: g.email.toLowerCase(),
            role: normalizeRole(g.role || 'reader'),
            overrideAction: 'none',
        });
    }
    for (const u of perms.users || []) {
        if (!u?.email) continue;
        result.push({
            type: 'user',
            identifier: u.email.toLowerCase(),
            role: normalizeRole(u.role || 'reader'),
            overrideAction: 'none',
        });
    }

    // Apply overrides
    const overrides = perms.overrides;
    if (overrides) {
        const removeSet = new Set(
            (overrides.remove ?? []).map(r => r.identifier.toLowerCase())
        );
        const downgradeMap = new Map(
            (overrides.downgrade ?? []).map(d => [d.identifier.toLowerCase(), d])
        );

        for (const p of result) {
            const key = p.identifier.toLowerCase();
            if (removeSet.has(key)) {
                p.overrideAction = 'removed';
            } else if (downgradeMap.has(key)) {
                const d = downgradeMap.get(key)!;
                const targetRole = normalizeRole(d.role);
                const currentRank = ROLE_RANK[p.role] ?? 0;
                const targetRank = ROLE_RANK[targetRole] ?? 0;
                if (targetRank < currentRank) {
                    p.role = targetRole;
                    p.overrideAction = 'downgraded';
                }
            }
        }
    }

    return result;
}

// ─── Debug Logging ──────────────────────────────────────────────────────────

/**
 * Build a concise audit debug payload for a folder.
 */
export function buildFolderDebugPayload(
    folderPath: string,
    expectedLimitedAccess: boolean,
    actualLimitedAccess: boolean | null,
    actualPerms: any[],
    driveId?: string
): Record<string, unknown> {
    let direct = 0;
    let inherited = 0;
    let inheritedNonRemovable = 0;

    for (const p of actualPerms) {
        const cls = classifyInheritedPermission(p, driveId);
        if (cls === 'NOT_INHERITED') direct++;
        else if (cls === 'NON_REMOVABLE_DRIVE_MEMBERSHIP') inheritedNonRemovable++;
        else inherited++;
    }

    return {
        folderPath,
        expected_limitedAccess: expectedLimitedAccess,
        actual_limitedAccess: actualLimitedAccess,
        driveId: driveId || 'unknown',
        counts: { direct, inherited, inherited_non_removable: inheritedNonRemovable },
    };
}
