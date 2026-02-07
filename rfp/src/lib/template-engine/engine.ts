/**
 * Template Inheritance Engine — Pure Functions
 * 
 * INVARIANTS (must hold at ALL times):
 * 1. effectivePolicy.limitedAccess is ALWAYS a concrete boolean
 * 2. If ANY ancestor has limitedAccess=true → this node's effective is true
 * 3. If ancestor is limited → uiLockState.limitedToggleLocked = true
 * 4. No node can represent limitedAccess=false under a limited ancestor
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
} from './types';

// ─── Limited Access Computation ─────────────────────────────

/**
 * Compute the derived limitedAccess for a single node.
 * 
 * Logic:
 * 1. If node has explicit limitedAccess → use it
 * 2. Else if node has parent → inherit parent's derived value
 * 3. Else (root with no explicit) → system default = false
 */
function computeDerivedLimitedAccess(
    node: FolderNode,
    nodes: Record<string, FolderNode>
): DerivedPolicy {
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
 * Rule: If any ANCESTOR has limitedAccess=true (derived), lock this node.
 * The toggle is locked because the child MUST be limited — no override allowed.
 */
function computeUiLockState(
    node: FolderNode,
    nodes: Record<string, FolderNode>
): UiLockState {
    if (node.parentId === null) {
        // Root nodes are always editable
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
            const key = `${p.email}|${p.role}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push({
                    type: type === 'groups' ? 'group' : 'user',
                    email: p.email,
                    role: p.role,
                    scope: 'inherited',
                    sourceNodeId: ancestor.id,
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
 * 4. Track scope for each principal
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

// ─── Serialization ──────────────────────────────────────────

/**
 * Convert backend template JSON into TemplateTreeState.
 * 
 * - Assigns unique IDs to each node
 * - Sets up parent/child relationships
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
 * SAFETY: If parent is limited, this is a no-op (UI should prevent this).
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
    // (strip any child explicit false under newly-limited parent)
    newState = enforceStructuralSafety(newState);

    // Recompute again after safety cleanup
    newState = recomputeSubtree(newState, nodeId);

    return newState;
}

/**
 * Clear explicit limitedAccess on a node (revert to inherit).
 * Only allowed if parent is NOT limited.
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
