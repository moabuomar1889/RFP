/**
 * Template Engine — Unit Tests
 * 
 * Tests all invariants:
 * 1. effectivePolicy.limitedAccess is ALWAYS defined
 * 2. Parent limited → descendants limited
 * 3. UI locks under limited parents
 * 4. Principals inherit with deduplication
 * 5. Invalid states are impossible by construction
 */

import { describe, it, expect } from 'vitest';
import {
    deserializeTemplate,
    serializeTemplate,
    recomputeSubtree,
    toggleLimitedAccess,
    clearLimitedAccess,
    addPrincipal,
    removePrincipal,
    enforceStructuralSafety,
    recomputeFullTree,
} from '../engine';
import type { RawTemplateNode, TemplateTreeState } from '../types';

// ─── Test Fixtures ──────────────────────────────────────────

function buildSimpleTree(): RawTemplateNode[] {
    return [
        {
            name: 'Bidding',
            groups: [
                { email: 'admin@dtgsa.com', role: 'organizer' },
                { email: 'technical-team@dtgsa.com', role: 'reader' },
            ],
            children: [
                {
                    name: 'SOW',
                    limitedAccess: true,
                    groups: [
                        { email: 'dc-team@dtgsa.com', role: 'organizer' },
                    ],
                },
                {
                    name: 'Vendors Quotations',
                    groups: [
                        { email: 'procurement@dtgsa.com', role: 'writer' },
                    ],
                    children: [
                        {
                            name: 'Vendor A',
                        },
                    ],
                },
            ],
        },
    ];
}

function findNodeByName(state: TemplateTreeState, name: string) {
    const entry = Object.entries(state.nodes).find(([, n]) => n.name === name);
    if (!entry) throw new Error(`Node "${name}" not found`);
    return entry[1];
}

// ─── Deserialization Tests ──────────────────────────────────

describe('deserializeTemplate', () => {
    it('creates correct tree structure', () => {
        const state = deserializeTemplate(buildSimpleTree());

        expect(state.rootIds).toHaveLength(1);

        const bidding = findNodeByName(state, 'Bidding');
        expect(bidding.parentId).toBeNull();
        expect(bidding.childrenIds).toHaveLength(2);

        const sow = findNodeByName(state, 'SOW');
        expect(sow.parentId).toBe(bidding.id);

        const vq = findNodeByName(state, 'Vendors Quotations');
        expect(vq.parentId).toBe(bidding.id);
        expect(vq.childrenIds).toHaveLength(1);

        const vendorA = findNodeByName(state, 'Vendor A');
        expect(vendorA.parentId).toBe(vq.id);
        expect(vendorA.childrenIds).toHaveLength(0);
    });

    it('preserves explicit policies', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const bidding = findNodeByName(state, 'Bidding');
        expect(bidding.explicitPolicy.limitedAccess).toBeUndefined();
        expect(bidding.explicitPolicy.groups).toHaveLength(2);

        const sow = findNodeByName(state, 'SOW');
        expect(sow.explicitPolicy.limitedAccess).toBe(true);
        expect(sow.explicitPolicy.groups).toHaveLength(1);

        const vendorA = findNodeByName(state, 'Vendor A');
        expect(vendorA.explicitPolicy.limitedAccess).toBeUndefined();
        expect(vendorA.explicitPolicy.groups).toHaveLength(0);
        expect(vendorA.explicitPolicy.users).toHaveLength(0);
    });
});

// ─── LimitedAccess Invariants ───────────────────────────────

describe('limitedAccess inheritance', () => {
    it('effectivePolicy.limitedAccess is always boolean', () => {
        const state = deserializeTemplate(buildSimpleTree());

        for (const node of Object.values(state.nodes)) {
            expect(typeof node.effectivePolicy.limitedAccess).toBe('boolean');
            expect(typeof node.derivedPolicy.limitedAccess).toBe('boolean');
        }
    });

    it('root without explicit limitedAccess defaults to false', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const bidding = findNodeByName(state, 'Bidding');
        expect(bidding.derivedPolicy.limitedAccess).toBe(false);
        expect(bidding.derivedPolicy.limitedAccessSource).toBe('system-default');
    });

    it('explicit limitedAccess=true is reflected in derived', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const sow = findNodeByName(state, 'SOW');
        expect(sow.derivedPolicy.limitedAccess).toBe(true);
        expect(sow.derivedPolicy.limitedAccessSource).toBe('explicit');
    });

    it('child without explicit inherits from parent', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const vq = findNodeByName(state, 'Vendors Quotations');
        expect(vq.derivedPolicy.limitedAccess).toBe(false);
        expect(vq.derivedPolicy.limitedAccessSource).toBe('inherited');
    });

    it('toggling parent to limited propagates to all descendants', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = toggleLimitedAccess(state, bidding.id, true);

        // All descendants must be limited
        for (const node of Object.values(state.nodes)) {
            expect(node.effectivePolicy.limitedAccess).toBe(true);
        }
    });
});

// ─── UI Lock Tests ──────────────────────────────────────────

describe('uiLockState', () => {
    it('root nodes are never locked', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const bidding = findNodeByName(state, 'Bidding');
        expect(bidding.uiLockState.limitedToggleLocked).toBe(false);
        expect(bidding.uiLockState.reason).toBeNull();
    });

    it('children under limited parent are locked', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = toggleLimitedAccess(state, bidding.id, true);

        const sow = findNodeByName(state, 'SOW');
        expect(sow.uiLockState.limitedToggleLocked).toBe(true);
        expect(sow.uiLockState.reason).toContain('Bidding');

        const vq = findNodeByName(state, 'Vendors Quotations');
        expect(vq.uiLockState.limitedToggleLocked).toBe(true);

        const vendorA = findNodeByName(state, 'Vendor A');
        expect(vendorA.uiLockState.limitedToggleLocked).toBe(true);
    });

    it('children under non-limited parent are not locked', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const vq = findNodeByName(state, 'Vendors Quotations');
        expect(vq.uiLockState.limitedToggleLocked).toBe(false);

        // SOW has explicit limited, but its parent (Bidding) is NOT limited
        // so SOW itself is NOT locked (it sets its own explicit value)
        const sow = findNodeByName(state, 'SOW');
        expect(sow.uiLockState.limitedToggleLocked).toBe(false);
    });

    it('locked nodes cannot be toggled', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = toggleLimitedAccess(state, bidding.id, true);

        const sow = findNodeByName(state, 'SOW');
        // Try to toggle — should be no-op
        const stateAfter = toggleLimitedAccess(state, sow.id, false);

        const sowAfter = findNodeByName(stateAfter, 'SOW');
        expect(sowAfter.effectivePolicy.limitedAccess).toBe(true);
    });
});

// ─── Structural Safety Tests ────────────────────────────────

describe('enforceStructuralSafety', () => {
    it('strips explicit false under limited parent', () => {
        // Simulate bad data from backend
        const rawNodes: RawTemplateNode[] = [
            {
                name: 'Root',
                limitedAccess: true,
                children: [
                    { name: 'Child', limitedAccess: false }, // INVALID
                ],
            },
        ];

        const state = deserializeTemplate(rawNodes);
        const child = findNodeByName(state, 'Child');

        // explicit false should have been stripped
        expect(child.explicitPolicy.limitedAccess).toBeUndefined();
        // effective must still be true (inherited)
        expect(child.effectivePolicy.limitedAccess).toBe(true);
    });
});

// ─── Principals Inheritance Tests ───────────────────────────

describe('principals inheritance', () => {
    it('explicit principals appear with scope=explicit', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const bidding = findNodeByName(state, 'Bidding');
        const explicitPrincipals = bidding.effectivePolicy.principals.filter(
            p => p.scope === 'explicit'
        );

        expect(explicitPrincipals).toHaveLength(2);
        expect(explicitPrincipals.map(p => p.email)).toContain('admin@dtgsa.com');
        expect(explicitPrincipals.map(p => p.email)).toContain('technical-team@dtgsa.com');
    });

    it('child inherits principals from parent', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const vendorA = findNodeByName(state, 'Vendor A');
        const principals = vendorA.effectivePolicy.principals;

        // Should have inherited from Bidding (admin, technical-team)
        // Plus inherited from VQ (procurement)
        expect(principals.length).toBeGreaterThanOrEqual(3);

        const inherited = principals.filter(p => p.scope === 'inherited');
        expect(inherited.length).toBeGreaterThanOrEqual(3);
        expect(inherited.map(p => p.email)).toContain('admin@dtgsa.com');
        expect(inherited.map(p => p.email)).toContain('procurement@dtgsa.com');
    });

    it('explicit principals override inherited (dedup by email)', () => {
        // Create tree where child has same email as parent but different role
        const raw: RawTemplateNode[] = [
            {
                name: 'Parent',
                groups: [{ email: 'team@dtgsa.com', role: 'reader' }],
                children: [
                    {
                        name: 'Child',
                        groups: [{ email: 'team@dtgsa.com', role: 'writer' }],
                    },
                ],
            },
        ];

        const state = deserializeTemplate(raw);
        const child = findNodeByName(state, 'Child');

        const teamPrincipals = child.effectivePolicy.principals.filter(
            p => p.email === 'team@dtgsa.com'
        );

        // Should have exactly 1 entry (explicit wins)
        expect(teamPrincipals).toHaveLength(1);
        expect(teamPrincipals[0].scope).toBe('explicit');
        expect(teamPrincipals[0].role).toBe('writer');
    });

    it('sourceNodeId tracks where inherited principal came from', () => {
        const state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        const vendorA = findNodeByName(state, 'Vendor A');
        const adminPrincipal = vendorA.effectivePolicy.principals.find(
            p => p.email === 'admin@dtgsa.com'
        );

        expect(adminPrincipal).toBeDefined();
        expect(adminPrincipal!.scope).toBe('inherited');
        expect(adminPrincipal!.sourceNodeId).toBe(bidding.id);
    });
});

// ─── Mutation Helper Tests ──────────────────────────────────

describe('addPrincipal', () => {
    it('adds new principal to explicit policy', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = addPrincipal(state, bidding.id, 'users', {
            email: 'new.user@dtgsa.com',
            role: 'writer',
        });

        const updated = findNodeByName(state, 'Bidding');
        expect(updated.explicitPolicy.users).toHaveLength(1);
        expect(updated.explicitPolicy.users[0].email).toBe('new.user@dtgsa.com');
    });

    it('does not add duplicate email', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        // admin@dtgsa.com already exists in groups
        state = addPrincipal(state, bidding.id, 'groups', {
            email: 'admin@dtgsa.com',
            role: 'writer', // different role but same email
        });

        const updated = findNodeByName(state, 'Bidding');
        expect(updated.explicitPolicy.groups).toHaveLength(2); // unchanged
    });

    it('propagates new principal to descendants', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = addPrincipal(state, bidding.id, 'users', {
            email: 'new.user@dtgsa.com',
            role: 'writer',
        });

        const vendorA = findNodeByName(state, 'Vendor A');
        const newUser = vendorA.effectivePolicy.principals.find(
            p => p.email === 'new.user@dtgsa.com'
        );

        expect(newUser).toBeDefined();
        expect(newUser!.scope).toBe('inherited');
    });
});

describe('removePrincipal', () => {
    it('removes explicit principal', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = removePrincipal(state, bidding.id, 'groups', 'admin@dtgsa.com');

        const updated = findNodeByName(state, 'Bidding');
        expect(updated.explicitPolicy.groups).toHaveLength(1);
        expect(updated.explicitPolicy.groups[0].email).toBe('technical-team@dtgsa.com');
    });

    it('no-ops for emails not in explicit list', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const vendorA = findNodeByName(state, 'Vendor A');

        // admin@dtgsa.com is inherited, not explicit on Vendor A
        const stateBefore = state;
        state = removePrincipal(state, vendorA.id, 'groups', 'admin@dtgsa.com');

        // Should be no-op (same reference)
        expect(state).toBe(stateBefore);
    });
});

// ─── Serialization Roundtrip ────────────────────────────────

describe('serializeTemplate', () => {
    it('roundtrips correctly', () => {
        const raw = buildSimpleTree();
        const state = deserializeTemplate(raw);
        const serialized = serializeTemplate(state);

        expect(serialized).toHaveLength(1);
        expect(serialized[0].name).toBe('Bidding');
        expect(serialized[0].limitedAccess).toBeUndefined(); // not explicitly set
        expect(serialized[0].groups).toHaveLength(2);
        expect(serialized[0].children).toHaveLength(2);

        const sow = serialized[0].children![0];
        expect(sow.name).toBe('SOW');
        expect(sow.limitedAccess).toBe(true);
        expect(sow.groups).toHaveLength(1);
    });

    it('omits undefined/empty fields', () => {
        const raw: RawTemplateNode[] = [
            { name: 'Empty', children: [{ name: 'Child' }] },
        ];

        const state = deserializeTemplate(raw);
        const serialized = serializeTemplate(state);

        expect(serialized[0].limitedAccess).toBeUndefined();
        expect(serialized[0].groups).toBeUndefined();
        expect(serialized[0].users).toBeUndefined();

        const child = serialized[0].children![0];
        expect(child.limitedAccess).toBeUndefined();
        expect(child.groups).toBeUndefined();
        expect(child.users).toBeUndefined();
        expect(child.children).toBeUndefined();
    });
});
