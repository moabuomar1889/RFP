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

// ─── Role Ranking (Shared Drive Canonical) ──────────────────

export type DriveRole = 'reader' | 'commenter' | 'writer' | 'fileOrganizer' | 'organizer';

/** Canonical role ranking: higher number = more access.
 *  organizer and fileOrganizer are treated as equivalent rank (3).
 *  Google Shared Drives map organizer ↔ fileOrganizer for groups.
 */
export const ROLE_RANK: Record<string, number> = {
    reader: 0,
    commenter: 1,
    writer: 2,
    fileOrganizer: 3,
    organizer: 3,
};

/**
 * Normalize organizer/fileOrganizer to 'organizer' for comparison purposes.
 * Google Shared Drives map organizer ↔ fileOrganizer; treat them as equivalent.
 */
export function normalizeRoleForRank(role: string): string {
    if (role === 'fileOrganizer') return 'organizer';
    return role;
}

/** Get the numeric rank of a role (higher = more access). */
export function roleRank(role: string): number {
    return ROLE_RANK[normalizeRoleForRank(role)] ?? 0;
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
