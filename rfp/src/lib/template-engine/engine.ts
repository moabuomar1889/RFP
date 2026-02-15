/**
 * Template Inheritance Engine — Pure Functions
 * 
 * INVARIANTS (must hold at ALL times):
 * 1. effectivePolicy.limitedAccess is ALWAYS a concrete boolean
 * 2. If ANY ancestor has limitedAccess=true → this node's effective is true
 * 3. If ancestor is limited → uiLockState.limitedToggleLocked = true
 * 4. No node can represent limitedAccess=false under a limited ancestor
 * 5. If overrides exist, effective limitedAccess is forced true
 * 6. Overrides are subtractive only: remove or downgrade inherited principals
 * 
 * PERFORMANCE:
 * - recomputeSubtree() only recomputes the affected subtree
 * - No full-tree recomputation on single-node changes
 * 
 * ALL FUNCTIONS ARE PURE. No side effects. No async. No API calls.
 */

import type {
    FolderNode,
    TemplateTreeState,
    ExplicitPrincipal,
    EffectivePrincipal,
    DerivedPolicy,
    EffectivePolicy,
    UiLockState,
    RawTemplateNode,
    ExplicitPolicy,
    Overrides,
    OverrideEntry,
    DowngradeEntry,
    DriveRole,
} from './types';

import { hasActiveOverrides, roleRank, isRoleLessOrEqual } from './types';

// ─── Limited Access Computation ─────────────────────────────

/**
 * Compute the derived limitedAccess for a single node.
 * 
 * Logic:
 * 1. If overrides exist → force true (override-required)
 * 2. If node has explicit limitedAccess → use it
 * 3. Else if node has parent → inherit parent's derived value
 * 4. Else (root with no explicit) → system default = false
 */
function computeDerivedLimitedAccess(
    node: FolderNode,
    nodes: Record<string, FolderNode>
): DerivedPolicy {
    // Rule: overrides require limitedAccess to be enabled
    if (hasActiveOverrides(node.explicitPolicy.overrides)) {
        return {
            limitedAccess: true,
            limitedAccessSource: 'override-required',
            limitedAccessInheritedFrom: null,
        };
    }

    // Case 1: Explicit value on this node
    if (node.explicitPolicy.limitedAccess !== undefined) {
        return {
            limitedAccess: node.explicitPolicy.limitedAccess,
            limitedAccessSource: 'explicit',
            limitedAccessInheritedFrom: null,
        };
    }

    // Case 2: Has parent → inherit
    if (node.parentId !== null) {
        const parent = nodes[node.parentId];
        if (!parent) {
            // Orphan node safety — should never happen in valid tree
            return {
                limitedAccess: false,
                limitedAccessSource: 'system-default',
                limitedAccessInheritedFrom: null,
            };
        }

        // Trace back to the original source
        const sourceId = parent.derivedPolicy.limitedAccessSource === 'explicit'
            ? parent.id
            : parent.derivedPolicy.limitedAccessInheritedFrom;

        return {
            limitedAccess: parent.derivedPolicy.limitedAccess,
            limitedAccessSource: 'inherited',
            limitedAccessInheritedFrom: sourceId,
        };
    }

    // Case 3: Root with no explicit → system default
    return {
        limitedAccess: false,
        limitedAccessSource: 'system-default',
        limitedAccessInheritedFrom: null,
    };
}

// ─── UI Lock Computation ────────────────────────────────────

/**
 * Determine if the limitedAccess toggle should be locked.
 * 
 * Rules:
 * 1. If any ANCESTOR has limitedAccess=true (derived), lock this node.
 * 2. If overrides exist on this node, lock (because overrides force it true).
 */
function computeUiLockState(
    node: FolderNode,
    nodes: Record<string, FolderNode>
): UiLockState {
    // Lock if overrides force limitedAccess
    if (hasActiveOverrides(node.explicitPolicy.overrides)) {
        return {
            limitedToggleLocked: true,
            reason: 'Overrides require Limited Access to be enabled. Remove all overrides to unlock.',
        };
    }

    if (node.parentId === null) {
        // Root nodes are always editable (unless overrides lock them above)
        return { limitedToggleLocked: false, reason: null };
    }

    const parent = nodes[node.parentId];
    if (!parent) {
        return { limitedToggleLocked: false, reason: null };
    }

    if (parent.derivedPolicy.limitedAccess) {
        return {
            limitedToggleLocked: true,
            reason: `Locked: parent folder "${parent.name}" has Limited Access enabled. All descendants must be limited.`,
        };
    }

    return { limitedToggleLocked: false, reason: null };
}

// ─── Principals Computation ─────────────────────────────────

/**
 * Collect all inherited principals walking up the ancestor chain.
 * Returns principals from nearest ancestor to farthest, with dedup.
 */
function collectInheritedPrincipals(
    node: FolderNode,
    nodes: Record<string, FolderNode>,
    type: 'groups' | 'users'
): EffectivePrincipal[] {
    const result: EffectivePrincipal[] = [];
    const seen = new Set<string>(); // email keys for dedup

    let currentId = node.parentId;
    while (currentId !== null) {
        const ancestor = nodes[currentId];
        if (!ancestor) break;

        const principals = ancestor.explicitPolicy[type];
        for (const p of principals) {
            const key = p.email.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                result.push({
                    type: type === 'groups' ? 'group' : 'user',
                    email: p.email,
                    role: p.role,
                    scope: 'inherited',
                    sourceNodeId: ancestor.id,
                    overrideAction: 'none',
                });
            }
        }

        currentId = ancestor.parentId;
    }

    return result;
}

/**
 * Compute the full effective principal list for a node.
 * 
 * Merge strategy:
 * 1. Start with explicit principals on this node
 * 2. Add inherited principals from ancestors
 * 3. Deduplicate: explicit wins over inherited (by email)
 * 4. Apply overrides.remove (mark as removed, exclude from effective)
 * 5. Apply overrides.downgrade (cap role)
 * 6. Track scope and overrideAction for each principal
 */
function computeEffectivePrincipals(
    node: FolderNode,
    nodes: Record<string, FolderNode>
): EffectivePrincipal[] {
    const result: EffectivePrincipal[] = [];
    const seen = new Set<string>(); // email keys for dedup

    // Step 1: Explicit groups
    for (const g of node.explicitPolicy.groups) {
        const key = g.email.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            result.push({
                type: 'group',
                email: g.email,
                role: g.role,
                scope: 'explicit',
                sourceNodeId: null,
                overrideAction: 'none',
            });
        }
    }

    // Step 2: Explicit users
    for (const u of node.explicitPolicy.users) {
        const key = u.email.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            result.push({
                type: 'user',
                email: u.email,
                role: u.role,
                scope: 'explicit',
                sourceNodeId: null,
                overrideAction: 'none',
            });
        }
    }

    // Step 3: Inherited groups (skip if already explicit)
    const inheritedGroups = collectInheritedPrincipals(node, nodes, 'groups');
    for (const p of inheritedGroups) {
        const key = p.email.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            result.push(p);
        }
    }

    // Step 4: Inherited users (skip if already explicit)
    const inheritedUsers = collectInheritedPrincipals(node, nodes, 'users');
    for (const p of inheritedUsers) {
        const key = p.email.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            result.push(p);
        }
    }

    // Step 5: Apply overrides
    const overrides = node.explicitPolicy.overrides;
    if (overrides) {
        // Build lookup sets for fast checking
        const removeSet = new Set(
            (overrides.remove ?? []).map(r => r.identifier.toLowerCase())
        );
        const downgradeMap = new Map(
            (overrides.downgrade ?? []).map(d => [d.identifier.toLowerCase(), d])
        );

        for (const principal of result) {
            const key = principal.email.toLowerCase();

            if (removeSet.has(key) && principal.scope === 'inherited') {
                principal.overrideAction = 'removed';
            } else if (downgradeMap.has(key) && principal.scope === 'inherited') {
                const downgrade = downgradeMap.get(key)!;
                const originalRole = principal.role;
                // Cap to min(inherited, downgrade target)
                if (!isRoleLessOrEqual(downgrade.role, originalRole)) {
                    // Requested downgrade role is HIGHER than inherited — invalid, ignore
                    continue;
                }
                principal.inheritedRole = originalRole;
                principal.role = downgrade.role as 'reader' | 'writer' | 'organizer';
                principal.overrideAction = 'downgraded';
            }
        }
    }

    return result;
}

// ─── Full Node Recomputation ────────────────────────────────

/**
 * Recompute all derived/effective/lock state for a single node.
 * IMPORTANT: Parent's derived state must be up-to-date before calling this.
 */
function recomputeNode(
    node: FolderNode,
    nodes: Record<string, FolderNode>
): FolderNode {
    const derivedPolicy = computeDerivedLimitedAccess(node, nodes);
    const uiLockState = computeUiLockState(node, nodes);
    const principals = computeEffectivePrincipals(node, nodes);

    const effectivePolicy: EffectivePolicy = {
        limitedAccess: derivedPolicy.limitedAccess,
        principals,
    };

    return {
        ...node,
        derivedPolicy,
        effectivePolicy,
        uiLockState,
    };
}

// ─── Subtree Recomputation (Entry Point) ────────────────────

/**
 * Recompute policies for a node and ALL its descendants.
 * 
 * This is the main entry point called after any user edit action.
 * It processes nodes top-down (parent before children) to ensure
 * derived state is always based on up-to-date parent state.
 * 
 * PERFORMANCE: Only processes the subtree rooted at changedNodeId.
 * 
 * @param state - Current tree state (immutable, will return new copy)
 * @param changedNodeId - ID of the node that was directly modified
 * @returns New tree state with all affected nodes recomputed
 */
export function recomputeSubtree(
    state: TemplateTreeState,
    changedNodeId: string
): TemplateTreeState {
    // Shallow-clone nodes map so we don't mutate the original
    const newNodes = { ...state.nodes };

    // Process the changed node first
    const changedNode = newNodes[changedNodeId];
    if (!changedNode) return state;

    newNodes[changedNodeId] = recomputeNode(changedNode, newNodes);

    // Then propagate to all descendants (BFS, top-down)
    const queue = [...newNodes[changedNodeId].childrenIds];
    while (queue.length > 0) {
        const childId = queue.shift()!;
        const child = newNodes[childId];
        if (!child) continue;

        // Recompute with updated parent already in newNodes
        newNodes[childId] = recomputeNode(child, newNodes);

        // Enqueue grandchildren
        queue.push(...child.childrenIds);
    }

    return { ...state, nodes: newNodes };
}

/**
 * Recompute the ENTIRE tree from roots down.
 * Used only on initial load — not during editing.
 */
export function recomputeFullTree(state: TemplateTreeState): TemplateTreeState {
    const newNodes = { ...state.nodes };

    // BFS from all roots
    const queue = [...state.rootIds];
    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const node = newNodes[nodeId];
        if (!node) continue;

        newNodes[nodeId] = recomputeNode(node, newNodes);
        queue.push(...node.childrenIds);
    }

    return { ...state, nodes: newNodes };
}

// ─── Structural Safety ──────────────────────────────────────

/**
 * Enforce structural invariant: if parent is limited, strip any
 * explicit limitedAccess=false from children.
 * 
 * This makes the invalid state IMPOSSIBLE to represent.
 * Called during deserialization and after any limitedAccess toggle.
 */
export function enforceStructuralSafety(
    state: TemplateTreeState
): TemplateTreeState {
    const newNodes = { ...state.nodes };

    for (const nodeId of Object.keys(newNodes)) {
        const node = newNodes[nodeId];
        if (node.parentId === null) continue;

        const parent = newNodes[node.parentId];
        if (!parent) continue;

        // If parent is limited and child explicitly says false → strip it
        if (
            parent.derivedPolicy.limitedAccess &&
            node.explicitPolicy.limitedAccess === false
        ) {
            newNodes[nodeId] = {
                ...node,
                explicitPolicy: {
                    ...node.explicitPolicy,
                    limitedAccess: undefined, // Force inherit from parent
                },
            };
        }
    }

    return { ...state, nodes: newNodes };
}

// ─── Validation ─────────────────────────────────────────────

export interface ValidationError {
    nodeId: string;
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

/**
 * Validate overrides on a node.
 * Returns an array of validation errors.
 */
export function validateOverrides(
    node: FolderNode,
    nodes: Record<string, FolderNode>
): ValidationError[] {
    const errors: ValidationError[] = [];
    const overrides = node.explicitPolicy.overrides;
    if (!overrides) return errors;

    // Collect inherited principal emails for existence checks
    const inheritedGroups = collectInheritedPrincipals(node, nodes, 'groups');
    const inheritedUsers = collectInheritedPrincipals(node, nodes, 'users');
    const inheritedMap = new Map<string, EffectivePrincipal>();
    for (const p of [...inheritedGroups, ...inheritedUsers]) {
        inheritedMap.set(p.email.toLowerCase(), p);
    }

    // Track identifiers for conflict detection
    const removeSet = new Set<string>();
    const downgradeSet = new Set<string>();

    // Validate remove entries
    for (const entry of overrides.remove ?? []) {
        // Adjustment #2: Only user|group with email identifiers
        if (entry.type !== 'user' && entry.type !== 'group') {
            errors.push({
                nodeId: node.id,
                field: 'overrides.remove',
                message: `Override remove only supports type 'user' or 'group', got '${entry.type}'.`,
                severity: 'error',
            });
            continue;
        }
        if (!entry.identifier || !entry.identifier.includes('@')) {
            errors.push({
                nodeId: node.id,
                field: 'overrides.remove',
                message: `Override remove requires a valid email identifier, got '${entry.identifier}'.`,
                severity: 'error',
            });
            continue;
        }

        const key = entry.identifier.toLowerCase();
        removeSet.add(key);

        if (!inheritedMap.has(key)) {
            errors.push({
                nodeId: node.id,
                field: 'overrides.remove',
                message: `Cannot remove "${entry.identifier}" — not found in inherited principals.`,
                severity: 'error',
            });
        }
    }

    // Validate downgrade entries
    for (const entry of overrides.downgrade ?? []) {
        // Adjustment #2: Only user|group with email identifiers
        if (entry.type !== 'user' && entry.type !== 'group') {
            errors.push({
                nodeId: node.id,
                field: 'overrides.downgrade',
                message: `Override downgrade only supports type 'user' or 'group', got '${entry.type}'.`,
                severity: 'error',
            });
            continue;
        }
        if (!entry.identifier || !entry.identifier.includes('@')) {
            errors.push({
                nodeId: node.id,
                field: 'overrides.downgrade',
                message: `Override downgrade requires a valid email identifier, got '${entry.identifier}'.`,
                severity: 'error',
            });
            continue;
        }

        const key = entry.identifier.toLowerCase();
        downgradeSet.add(key);

        const inherited = inheritedMap.get(key);
        if (!inherited) {
            errors.push({
                nodeId: node.id,
                field: 'overrides.downgrade',
                message: `Cannot downgrade "${entry.identifier}" — not found in inherited principals.`,
                severity: 'error',
            });
        } else if (!isRoleLessOrEqual(entry.role, inherited.role)) {
            errors.push({
                nodeId: node.id,
                field: 'overrides.downgrade',
                message: `Cannot downgrade "${entry.identifier}" to "${entry.role}" — must be ≤ inherited role "${inherited.role}".`,
                severity: 'error',
            });
        }

        // Conflict check
        if (removeSet.has(key)) {
            errors.push({
                nodeId: node.id,
                field: 'overrides',
                message: `Conflict: "${entry.identifier}" is in both remove and downgrade.`,
                severity: 'error',
            });
        }
    }

    return errors;
}

// ─── Serialization ──────────────────────────────────────────

/**
 * Convert backend template JSON into TemplateTreeState.
 * 
 * - Assigns unique IDs to each node
 * - Sets up parent/child relationships
 * - Reads overrides from raw nodes
 * - Runs full recomputation after deserialization
 * - Runs structural safety enforcement
 */
export function deserializeTemplate(
    rawNodes: RawTemplateNode[]
): TemplateTreeState {
    const nodes: Record<string, FolderNode> = {};
    const rootIds: string[] = [];
    let idCounter = 0;

    function generateId(): string {
        return `node_${++idCounter}`;
    }

    function processNode(raw: RawTemplateNode, parentId: string | null): string {
        const id = generateId();

        const explicitPolicy: ExplicitPolicy = {
            limitedAccess: raw.limitedAccess, // undefined if absent
            groups: raw.groups ?? [],
            users: raw.users ?? [],
            overrides: raw.overrides, // NEW: read overrides
        };

        nodes[id] = {
            id,
            name: raw.name,
            parentId,
            childrenIds: [],
            explicitPolicy,
            // Placeholders — will be computed by recomputeFullTree
            derivedPolicy: {
                limitedAccess: false,
                limitedAccessSource: 'system-default',
                limitedAccessInheritedFrom: null,
            },
            effectivePolicy: {
                limitedAccess: false,
                principals: [],
            },
            uiLockState: {
                limitedToggleLocked: false,
                reason: null,
            },
        };

        if (parentId !== null) {
            nodes[parentId].childrenIds.push(id);
        } else {
            rootIds.push(id);
        }

        // Process children
        if (raw.children) {
            for (const child of raw.children) {
                processNode(child, id);
            }
        }

        return id;
    }

    // Build tree structure
    for (const root of rawNodes) {
        processNode(root, null);
    }

    // Create initial state
    let state: TemplateTreeState = { nodes, rootIds };

    // Enforce structural safety first (clean any invalid data from backend)
    state = recomputeFullTree(state);
    state = enforceStructuralSafety(state);
    state = recomputeFullTree(state); // Re-derive after cleanup

    return state;
}

/**
 * Serialize TemplateTreeState back to backend format.
 * 
 * CRITICAL: Only serializes EXPLICIT values.
 * Derived/effective/uiLock are never persisted.
 */
export function serializeTemplate(state: TemplateTreeState): RawTemplateNode[] {
    function serializeNode(nodeId: string): RawTemplateNode {
        const node = state.nodes[nodeId];

        const raw: RawTemplateNode = {
            name: node.name,
        };

        // Only include limitedAccess if explicitly set
        if (node.explicitPolicy.limitedAccess !== undefined) {
            raw.limitedAccess = node.explicitPolicy.limitedAccess;
        }

        // Only include groups if non-empty
        if (node.explicitPolicy.groups.length > 0) {
            raw.groups = node.explicitPolicy.groups;
        }

        // Only include users if non-empty
        if (node.explicitPolicy.users.length > 0) {
            raw.users = node.explicitPolicy.users;
        }

        // Only include overrides if has active entries
        if (hasActiveOverrides(node.explicitPolicy.overrides)) {
            raw.overrides = node.explicitPolicy.overrides;
        }

        // Serialize children
        if (node.childrenIds.length > 0) {
            raw.children = node.childrenIds.map(serializeNode);
        }

        return raw;
    }

    return state.rootIds.map(serializeNode);
}

// ─── Mutation Helpers (Immutable) ───────────────────────────

/**
 * Toggle limitedAccess on a node.
 * Returns new tree state with all derived values recomputed.
 * 
 * SAFETY: If parent is limited or overrides lock it, this is a no-op.
 */
export function toggleLimitedAccess(
    state: TemplateTreeState,
    nodeId: string,
    value: boolean
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;

    // Safety check: if locked, refuse
    if (node.uiLockState.limitedToggleLocked) {
        return state; // No-op — UI should have prevented this click
    }

    // Update explicit policy
    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                limitedAccess: value,
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };

    // Recompute this node + all descendants
    newState = recomputeSubtree(newState, nodeId);

    // Enforce structural safety on descendants
    newState = enforceStructuralSafety(newState);

    // Recompute again after safety cleanup
    newState = recomputeSubtree(newState, nodeId);

    return newState;
}

/**
 * Clear explicit limitedAccess on a node (revert to inherit).
 * Only allowed if parent is NOT limited and no overrides exist.
 */
export function clearLimitedAccess(
    state: TemplateTreeState,
    nodeId: string
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;

    if (node.uiLockState.limitedToggleLocked) {
        return state; // No-op
    }

    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                limitedAccess: undefined, // Revert to inherit
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };
    newState = recomputeSubtree(newState, nodeId);
    return newState;
}

/**
 * Add a principal (group or user) to a node's explicit policy.
 */
export function addPrincipal(
    state: TemplateTreeState,
    nodeId: string,
    type: 'groups' | 'users',
    principal: ExplicitPrincipal
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;


    // Dedup check: skip if already exists on this node
    const existing = node.explicitPolicy[type];
    if (existing.some(p => p.email.toLowerCase() === principal.email.toLowerCase())) {
        return state;
    }

    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                [type]: [...existing, principal],
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };
    newState = recomputeSubtree(newState, nodeId);
    return newState;
}

/**
 * Remove a principal from a node's explicit policy.
 * SAFETY: Only explicit principals can be removed. Inherited are skipped.
 */
export function removePrincipal(
    state: TemplateTreeState,
    nodeId: string,
    type: 'groups' | 'users',
    email: string
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;

    const newList = node.explicitPolicy[type].filter(
        p => p.email.toLowerCase() !== email.toLowerCase()
    );

    // No change if email wasn't in explicit list
    if (newList.length === node.explicitPolicy[type].length) {
        return state;
    }

    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                [type]: newList,
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };
    newState = recomputeSubtree(newState, nodeId);
    return newState;
}

/**
 * Change the role of an existing explicit principal (group or user).
 * Only works on explicit principals — inherited principals cannot be changed here.
 */
export function changePrincipalRole(
    state: TemplateTreeState,
    nodeId: string,
    type: 'groups' | 'users',
    email: string,
    newRole: DriveRole
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;

    const existing = node.explicitPolicy[type];
    const idx = existing.findIndex(p => p.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) return state; // Not found in explicit list

    // Create new list with updated role
    const newList = [...existing];
    newList[idx] = { ...newList[idx], role: newRole as ExplicitPrincipal['role'] };

    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                [type]: newList,
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };
    newState = recomputeSubtree(newState, nodeId);
    return newState;
}

// ─── Override Mutation Helpers (Immutable) ───────────────────

/**
 * Add a "remove" override for an inherited principal at this node.
 */
export function addOverrideRemove(
    state: TemplateTreeState,
    nodeId: string,
    type: 'group' | 'user',
    identifier: string
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;

    const overrides = node.explicitPolicy.overrides ?? { remove: [], downgrade: [] };
    const key = identifier.toLowerCase();

    // Already in remove set?
    if ((overrides.remove ?? []).some(r => r.identifier.toLowerCase() === key)) {
        return state;
    }

    // Remove from downgrade if present (conflict: can't be in both)
    const newDowngrade = (overrides.downgrade ?? []).filter(
        d => d.identifier.toLowerCase() !== key
    );

    const newOverrides: Overrides = {
        ...overrides,
        remove: [...(overrides.remove ?? []), { type, identifier: identifier.toLowerCase() }],
        downgrade: newDowngrade,
    };

    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                overrides: newOverrides,
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };
    newState = recomputeSubtree(newState, nodeId);
    return newState;
}

/**
 * Remove a "remove" override (undo removal of an inherited principal).
 */
export function removeOverrideRemove(
    state: TemplateTreeState,
    nodeId: string,
    identifier: string
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;

    const overrides = node.explicitPolicy.overrides;
    if (!overrides?.remove) return state;

    const key = identifier.toLowerCase();
    const newRemove = overrides.remove.filter(
        r => r.identifier.toLowerCase() !== key
    );

    // No change?
    if (newRemove.length === overrides.remove.length) return state;

    const newOverrides: Overrides = {
        ...overrides,
        remove: newRemove,
    };

    // Clean up: if both arrays are empty, set overrides to undefined
    const cleanOverrides = hasActiveOverrides(newOverrides) ? newOverrides : undefined;

    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                overrides: cleanOverrides,
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };
    newState = recomputeSubtree(newState, nodeId);
    return newState;
}

/**
 * Set a "downgrade" override for an inherited principal at this node.
 */
export function setOverrideDowngrade(
    state: TemplateTreeState,
    nodeId: string,
    type: 'group' | 'user',
    identifier: string,
    role: DriveRole
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;

    const overrides = node.explicitPolicy.overrides ?? { remove: [], downgrade: [] };
    const key = identifier.toLowerCase();

    // Remove from remove set if present (conflict)
    const newRemove = (overrides.remove ?? []).filter(
        r => r.identifier.toLowerCase() !== key
    );

    // Replace or add in downgrade
    const newDowngrade = (overrides.downgrade ?? []).filter(
        d => d.identifier.toLowerCase() !== key
    );
    newDowngrade.push({ type, identifier: identifier.toLowerCase(), role });

    const newOverrides: Overrides = {
        ...overrides,
        remove: newRemove,
        downgrade: newDowngrade,
    };

    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                overrides: newOverrides,
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };
    newState = recomputeSubtree(newState, nodeId);
    return newState;
}

/**
 * Remove a "downgrade" override (undo role cap on an inherited principal).
 */
export function removeOverrideDowngrade(
    state: TemplateTreeState,
    nodeId: string,
    identifier: string
): TemplateTreeState {
    const node = state.nodes[nodeId];
    if (!node) return state;

    const overrides = node.explicitPolicy.overrides;
    if (!overrides?.downgrade) return state;

    const key = identifier.toLowerCase();
    const newDowngrade = overrides.downgrade.filter(
        d => d.identifier.toLowerCase() !== key
    );

    if (newDowngrade.length === overrides.downgrade.length) return state;

    const newOverrides: Overrides = {
        ...overrides,
        downgrade: newDowngrade,
    };

    const cleanOverrides = hasActiveOverrides(newOverrides) ? newOverrides : undefined;

    const newNodes = {
        ...state.nodes,
        [nodeId]: {
            ...node,
            explicitPolicy: {
                ...node.explicitPolicy,
                overrides: cleanOverrides,
            },
        },
    };

    let newState: TemplateTreeState = { ...state, nodes: newNodes };
    newState = recomputeSubtree(newState, nodeId);
    return newState;
}
