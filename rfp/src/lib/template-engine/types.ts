/**
 * Template Engine — Type Definitions
 * 
 * CORE RULE: OPTION A — STRICT RESTRICTIVE TREE
 * - Parent limitedAccess=true → ALL descendants limitedAccess=true
 * - Child public under limited parent is IMPOSSIBLE
 * - Invalid states are prevented by construction
 * 
 * State Separation:
 * - explicitPolicy: user-defined values (stored in template JSON)
 * - derivedPolicy: computed from ancestors (never persisted)
 * - effectivePolicy: final merged result (used for display + enforcement)
 * - uiLockState: controls what the UI allows editing
 */

// ─── Canonical Role Model (Match Google Drive UI) ───────────

/**
 * Drive API roles (stored in template JSON and returned by Drive API).
 * These are the RAW API-level roles. Use toCanonicalRole() for comparison.
 */
export type DriveRole = 'reader' | 'commenter' | 'writer' | 'fileOrganizer' | 'organizer';

/**
 * Canonical roles matching the Google Drive UI.
 * This is the SINGLE SOURCE OF TRUTH for role comparison, ranking, and display.
 */
export type CanonicalRole = 'viewer' | 'commenter' | 'contributor' | 'contentManager' | 'manager';

/**
 * Map Drive API role → Canonical role.
 *
 *   reader         → viewer
 *   commenter      → commenter
 *   writer         → contributor
 *   fileOrganizer  → contentManager
 *   organizer      → manager
 *
 * IMPORTANT: organizer ≠ fileOrganizer. They are DIFFERENT in Google Drive UI.
 */
export function toCanonicalRole(apiRole: string): CanonicalRole {
    switch (apiRole) {
        case 'reader': return 'viewer';
        case 'commenter': return 'commenter';
        case 'writer': return 'contributor';
        case 'fileOrganizer': return 'contentManager';
        case 'organizer': return 'manager';
        // Canonical roles passed through unchanged
        case 'viewer': return 'viewer';
        case 'contributor': return 'contributor';
        case 'contentManager': return 'contentManager';
        case 'manager': return 'manager';
        default: return 'viewer';
    }
}

/** Canonical role ranking: higher number = more access. */
export const CANONICAL_RANK: Record<string, number> = {
    viewer: 0,
    commenter: 1,
    contributor: 2,
    contentManager: 3,
    manager: 4,
};

/** Map canonical role key → human-readable UI label. */
export function canonicalRoleLabel(role: string): string {
    switch (role) {
        case 'viewer': return 'Viewer';
        case 'commenter': return 'Commenter';
        case 'contributor': return 'Contributor';
        case 'contentManager': return 'Content Manager';
        case 'manager': return 'Manager';
        default: return role;
    }
}


/**
 * Legacy ROLE_RANK — uses API-level roles.
 * organizer (4) ≠ fileOrganizer (3). They are DIFFERENT ranks.
 */
export const ROLE_RANK: Record<string, number> = {
    reader: 0,
    commenter: 1,
    writer: 2,
    fileOrganizer: 3,
    organizer: 4,
};

/**
 * Normalize a role string to its canonical form for ranking.
 * @deprecated Use toCanonicalRole + CANONICAL_RANK instead.
 */
export function normalizeRoleForRank(role: string): string {
    return role; // No longer collapses organizer→fileOrganizer
}

/** Get the numeric rank of a role (higher = more access). */
export function roleRank(role: string): number {
    // Use canonical ranking for consistency
    return CANONICAL_RANK[toCanonicalRole(role)] ?? 0;
}

/** True if roleA provides ≤ access than roleB. */
export function isRoleLessOrEqual(roleA: string, roleB: string): boolean {
    return roleRank(roleA) <= roleRank(roleB);
}

// ─── Overrides ──────────────────────────────────────────────

export interface OverrideEntry {
    type: 'group' | 'user';
    identifier: string; // email (always lowercased)
}

export interface DowngradeEntry extends OverrideEntry {
    role: DriveRole; // max allowed role at this node
}

export interface Overrides {
    remove?: OverrideEntry[];
    downgrade?: DowngradeEntry[];
}

/** Check if an Overrides object has any active entries. */
export function hasActiveOverrides(o?: Overrides): boolean {
    if (!o) return false;
    return (o.remove && o.remove.length > 0) || (o.downgrade && o.downgrade.length > 0) || false;
}

// ─── Principals ─────────────────────────────────────────────

export interface ExplicitPrincipal {
    email: string;
    role: 'reader' | 'writer' | 'fileOrganizer' | 'organizer';
}

export interface EffectivePrincipal {
    type: 'user' | 'group';
    email: string;
    role: 'reader' | 'writer' | 'fileOrganizer' | 'organizer';
    scope: 'explicit' | 'inherited';
    /** ID of the node that defines this principal (null if explicit on current node) */
    sourceNodeId: string | null;
    /** Original role before downgrade override (undefined if no downgrade). */
    inheritedRole?: string;
    /** Override action applied at this node. */
    overrideAction?: 'none' | 'removed' | 'downgraded';
}

// ─── Policy Layers ──────────────────────────────────────────

export interface ExplicitPolicy {
    /** undefined = inherit from parent. true/false = explicit override. */
    limitedAccess?: boolean;
    groups: ExplicitPrincipal[];
    users: ExplicitPrincipal[];
    /** Subtractive overrides: remove or downgrade inherited principals. */
    overrides?: Overrides;
}

export interface DerivedPolicy {
    /** Always resolved to a concrete boolean. */
    limitedAccess: boolean;
    /** Where limitedAccess came from. */
    limitedAccessSource: 'explicit' | 'inherited' | 'system-default' | 'override-required';
    /** Node ID that set this value (null if system default or self). */
    limitedAccessInheritedFrom: string | null;
}

export interface EffectivePolicy {
    limitedAccess: boolean;
    principals: EffectivePrincipal[];
}

// ─── UI Lock ────────────────────────────────────────────────

export interface UiLockState {
    /** If true, user cannot toggle limitedAccess on this node. */
    limitedToggleLocked: boolean;
    /** Human-readable reason for the lock. null if not locked. */
    reason: string | null;
}

// ─── Folder Node ────────────────────────────────────────────

export interface FolderNode {
    id: string;
    name: string;
    parentId: string | null;
    childrenIds: string[];

    explicitPolicy: ExplicitPolicy;
    derivedPolicy: DerivedPolicy;
    effectivePolicy: EffectivePolicy;
    uiLockState: UiLockState;
}

// ─── Tree State ─────────────────────────────────────────────

export interface TemplateTreeState {
    /** All nodes keyed by ID. */
    nodes: Record<string, FolderNode>;
    /** IDs of root-level folders (parentId === null). */
    rootIds: string[];
}

// ─── Serialization (Backend Format) ─────────────────────────

export interface RawTemplateNode {
    name: string;
    limitedAccess?: boolean;
    groups?: ExplicitPrincipal[];
    users?: ExplicitPrincipal[];
    overrides?: Overrides;
    children?: RawTemplateNode[];
}
