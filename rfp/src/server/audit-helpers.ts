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
 * Rules (from verified Drive behavior):
 *   - If inherited AND inheritedFrom starts with "0A" → Shared Drive membership.
 *     These are NON-REMOVABLE via file permissions.delete.
 *     They MUST NOT be counted as violations.
 *   - If inherited AND inheritedFrom is a normal folder ID → parent folder.
 *     These are REMOVABLE after limitedAccess is enabled.
 *   - If not inherited → NOT_INHERITED (direct permission).
 */
export function classifyInheritedPermission(perm: any): InheritedClassification {
    const isInherited =
        (perm.inherited === true) ||
        (perm.permissionDetails?.some?.((d: any) => d.inherited) ?? false);

    if (!isInherited) return 'NOT_INHERITED';

    const inheritedFrom =
        perm.inheritedFrom ??
        perm.permissionDetails?.find?.((d: any) => d.inherited)?.inheritedFrom;

    // Shared Drive membership IDs start with "0A"
    if (inheritedFrom && typeof inheritedFrom === 'string' && inheritedFrom.startsWith('0A')) {
        return 'NON_REMOVABLE_DRIVE_MEMBERSHIP';
    }

    return 'REMOVABLE_PARENT_FOLDER';
}

// ─── Shared buildPermissionsMap ─────────────────────────────────────────────

export interface FolderPermissions {
    groups: any[];
    users: any[];
    limitedAccess: boolean;
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
        };

        const children = node.nodes || node.children || [];
        if (children.length > 0) {
            const childMap = buildPermissionsMap(children, path);
            Object.assign(map, childMap);
        }
    }

    return map;
}

// ─── Debug Logging ──────────────────────────────────────────────────────────

/**
 * Build a concise audit debug payload for a folder.
 */
export function buildFolderDebugPayload(
    folderPath: string,
    expectedLimitedAccess: boolean,
    actualLimitedAccess: boolean | null,
    actualPerms: any[]
): Record<string, unknown> {
    let direct = 0;
    let inherited = 0;
    let inheritedNonRemovable = 0;

    for (const p of actualPerms) {
        const cls = classifyInheritedPermission(p);
        if (cls === 'NOT_INHERITED') direct++;
        else if (cls === 'NON_REMOVABLE_DRIVE_MEMBERSHIP') inheritedNonRemovable++;
        else inherited++;
    }

    return {
        folderPath,
        expected_limitedAccess: expectedLimitedAccess,
        actual_limitedAccess: actualLimitedAccess,
        counts: { direct, inherited, inherited_non_removable: inheritedNonRemovable },
    };
}
