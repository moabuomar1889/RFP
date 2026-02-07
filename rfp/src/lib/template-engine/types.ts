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

// ─── Principals ─────────────────────────────────────────────

export interface ExplicitPrincipal {
    email: string;
    role: 'reader' | 'writer' | 'organizer';
}

export interface EffectivePrincipal {
    type: 'user' | 'group';
    email: string;
    role: 'reader' | 'writer' | 'organizer';
    scope: 'explicit' | 'inherited';
    /** ID of the node that defines this principal (null if explicit on current node) */
    sourceNodeId: string | null;
}

// ─── Policy Layers ──────────────────────────────────────────

export interface ExplicitPolicy {
    /** undefined = inherit from parent. true/false = explicit override. */
    limitedAccess?: boolean;
    groups: ExplicitPrincipal[];
    users: ExplicitPrincipal[];
}

export interface DerivedPolicy {
    /** Always resolved to a concrete boolean. */
    limitedAccess: boolean;
    /** Where limitedAccess came from. */
    limitedAccessSource: 'explicit' | 'inherited' | 'system-default';
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
    children?: RawTemplateNode[];
}
