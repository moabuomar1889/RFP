/**
 * Standalone Test Runner for Template Engine
 * 
 * Runs without vitest — uses simple assert-based testing.
 * Execute with: npx tsx src/lib/template-engine/__tests__/run-tests.ts
 */

import {
    deserializeTemplate,
    serializeTemplate,
    toggleLimitedAccess,
    addPrincipal,
    removePrincipal,
} from '../engine';
import type { RawTemplateNode, TemplateTreeState } from '../types';

let passed = 0;
let failed = 0;
let currentSuite = '';

function describe(name: string, fn: () => void) {
    currentSuite = name;
    console.log(`\n  📦 ${name}`);
    fn();
}

function it(name: string, fn: () => void) {
    try {
        fn();
        passed++;
        console.log(`    ✅ ${name}`);
    } catch (e: any) {
        failed++;
        console.log(`    ❌ ${name}`);
        console.log(`       ${e.message}`);
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual: any, expected: any, label = '') {
    if (actual !== expected) {
        throw new Error(`${label} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

// ─── Fixtures ───────────────────────────────────────────────

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
                        { name: 'Vendor A' },
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

// ─── Tests ──────────────────────────────────────────────────

console.log('\n🧪 Template Engine Test Suite\n');

describe('deserializeTemplate', () => {
    it('creates correct tree structure', () => {
        const state = deserializeTemplate(buildSimpleTree());
        assertEqual(state.rootIds.length, 1, 'rootIds');

        const bidding = findNodeByName(state, 'Bidding');
        assertEqual(bidding.parentId, null, 'bidding.parentId');
        assertEqual(bidding.childrenIds.length, 2, 'bidding.children');

        const sow = findNodeByName(state, 'SOW');
        assertEqual(sow.parentId, bidding.id, 'sow.parentId');

        const vendorA = findNodeByName(state, 'Vendor A');
        assertEqual(vendorA.childrenIds.length, 0, 'vendorA.children');
    });

    it('preserves explicit policies', () => {
        const state = deserializeTemplate(buildSimpleTree());

        const bidding = findNodeByName(state, 'Bidding');
        assertEqual(bidding.explicitPolicy.limitedAccess, undefined, 'bidding.limitedAccess');
        assertEqual(bidding.explicitPolicy.groups.length, 2, 'bidding.groups');

        const sow = findNodeByName(state, 'SOW');
        assertEqual(sow.explicitPolicy.limitedAccess, true, 'sow.limitedAccess');
        assertEqual(sow.explicitPolicy.groups.length, 1, 'sow.groups');
    });
});

describe('limitedAccess inheritance', () => {
    it('effectivePolicy.limitedAccess is always boolean', () => {
        const state = deserializeTemplate(buildSimpleTree());
        for (const node of Object.values(state.nodes)) {
            assertEqual(typeof node.effectivePolicy.limitedAccess, 'boolean', `${node.name}.effective`);
            assertEqual(typeof node.derivedPolicy.limitedAccess, 'boolean', `${node.name}.derived`);
        }
    });

    it('root without explicit defaults to false', () => {
        const state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');
        assertEqual(bidding.derivedPolicy.limitedAccess, false, 'bidding.derived');
        assertEqual(bidding.derivedPolicy.limitedAccessSource, 'system-default', 'source');
    });

    it('explicit limitedAccess=true is reflected', () => {
        const state = deserializeTemplate(buildSimpleTree());
        const sow = findNodeByName(state, 'SOW');
        assertEqual(sow.derivedPolicy.limitedAccess, true, 'sow.derived');
        assertEqual(sow.derivedPolicy.limitedAccessSource, 'explicit', 'source');
    });

    it('child without explicit inherits from parent', () => {
        const state = deserializeTemplate(buildSimpleTree());
        const vq = findNodeByName(state, 'Vendors Quotations');
        assertEqual(vq.derivedPolicy.limitedAccess, false, 'vq.derived');
        assertEqual(vq.derivedPolicy.limitedAccessSource, 'inherited', 'source');
    });

    it('toggling parent to limited propagates to ALL descendants', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = toggleLimitedAccess(state, bidding.id, true);

        for (const node of Object.values(state.nodes)) {
            assertEqual(node.effectivePolicy.limitedAccess, true, `${node.name}.effective`);
        }
    });
});

describe('uiLockState', () => {
    it('root nodes are never locked', () => {
        const state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');
        assertEqual(bidding.uiLockState.limitedToggleLocked, false, 'locked');
        assertEqual(bidding.uiLockState.reason, null, 'reason');
    });

    it('children under limited parent are locked', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = toggleLimitedAccess(state, bidding.id, true);

        const sow = findNodeByName(state, 'SOW');
        assertEqual(sow.uiLockState.limitedToggleLocked, true, 'sow.locked');
        assert(sow.uiLockState.reason!.includes('Bidding'), 'reason mentions parent');

        const vendorA = findNodeByName(state, 'Vendor A');
        assertEqual(vendorA.uiLockState.limitedToggleLocked, true, 'vendorA.locked');
    });

    it('locked nodes cannot be toggled (no-op)', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = toggleLimitedAccess(state, bidding.id, true);

        const sow = findNodeByName(state, 'SOW');
        const stateAfter = toggleLimitedAccess(state, sow.id, false);

        const sowAfter = findNodeByName(stateAfter, 'SOW');
        assertEqual(sowAfter.effectivePolicy.limitedAccess, true, 'still limited');
    });
});

describe('enforceStructuralSafety', () => {
    it('strips explicit false under limited parent', () => {
        const raw: RawTemplateNode[] = [
            {
                name: 'Root',
                limitedAccess: true,
                children: [
                    { name: 'Child', limitedAccess: false }, // INVALID
                ],
            },
        ];

        const state = deserializeTemplate(raw);
        const child = findNodeByName(state, 'Child');

        assertEqual(child.explicitPolicy.limitedAccess, undefined, 'explicit stripped');
        assertEqual(child.effectivePolicy.limitedAccess, true, 'effective still true');
    });
});

describe('principals inheritance', () => {
    it('explicit principals have scope=explicit', () => {
        const state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        const explicit = bidding.effectivePolicy.principals.filter(p => p.scope === 'explicit');
        assertEqual(explicit.length, 2, 'explicit count');
        assert(explicit.some(p => p.email === 'admin@dtgsa.com'), 'admin present');
        assert(explicit.some(p => p.email === 'technical-team@dtgsa.com'), 'tech present');
    });

    it('child inherits principals from ancestors', () => {
        const state = deserializeTemplate(buildSimpleTree());
        const vendorA = findNodeByName(state, 'Vendor A');

        const inherited = vendorA.effectivePolicy.principals.filter(p => p.scope === 'inherited');
        assert(inherited.length >= 3, `expected >=3 inherited, got ${inherited.length}`);
        assert(inherited.some(p => p.email === 'admin@dtgsa.com'), 'admin inherited');
        assert(inherited.some(p => p.email === 'procurement@dtgsa.com'), 'procurement inherited');
    });

    it('explicit wins over inherited (dedup by email)', () => {
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
        assertEqual(teamPrincipals.length, 1, 'dedup count');
        assertEqual(teamPrincipals[0].scope, 'explicit', 'explicit wins');
        assertEqual(teamPrincipals[0].role, 'writer', 'child role wins');
    });

    it('sourceNodeId tracks origin', () => {
        const state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');
        const vendorA = findNodeByName(state, 'Vendor A');

        const admin = vendorA.effectivePolicy.principals.find(
            p => p.email === 'admin@dtgsa.com'
        );
        assert(admin !== undefined, 'admin found');
        assertEqual(admin!.scope, 'inherited', 'scope');
        assertEqual(admin!.sourceNodeId, bidding.id, 'source');
    });
});

describe('addPrincipal', () => {
    it('adds new principal', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = addPrincipal(state, bidding.id, 'users', {
            email: 'new.user@dtgsa.com',
            role: 'writer',
        });

        const updated = findNodeByName(state, 'Bidding');
        assertEqual(updated.explicitPolicy.users.length, 1, 'user added');
        assertEqual(updated.explicitPolicy.users[0].email, 'new.user@dtgsa.com', 'email');
    });

    it('propagates to descendants', () => {
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
        assert(newUser !== undefined, 'propagated to descendant');
        assertEqual(newUser!.scope, 'inherited', 'scope is inherited');
    });

    it('does not add duplicate email', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = addPrincipal(state, bidding.id, 'groups', {
            email: 'admin@dtgsa.com',
            role: 'writer',
        });

        const updated = findNodeByName(state, 'Bidding');
        assertEqual(updated.explicitPolicy.groups.length, 2, 'no duplicate');
    });
});

describe('removePrincipal', () => {
    it('removes explicit principal', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const bidding = findNodeByName(state, 'Bidding');

        state = removePrincipal(state, bidding.id, 'groups', 'admin@dtgsa.com');

        const updated = findNodeByName(state, 'Bidding');
        assertEqual(updated.explicitPolicy.groups.length, 1, 'removed');
        assertEqual(updated.explicitPolicy.groups[0].email, 'technical-team@dtgsa.com', 'correct one remains');
    });

    it('no-ops for inherited (not explicit) principal', () => {
        let state = deserializeTemplate(buildSimpleTree());
        const vendorA = findNodeByName(state, 'Vendor A');

        const before = state;
        state = removePrincipal(state, vendorA.id, 'groups', 'admin@dtgsa.com');

        assertEqual(state, before, 'same reference (no-op)');
    });
});

describe('serializeTemplate', () => {
    it('roundtrips correctly', () => {
        const raw = buildSimpleTree();
        const state = deserializeTemplate(raw);
        const serialized = serializeTemplate(state);

        assertEqual(serialized.length, 1, 'root count');
        assertEqual(serialized[0].name, 'Bidding', 'name');
        assertEqual(serialized[0].limitedAccess, undefined, 'no explicit la');
        assertEqual(serialized[0].groups!.length, 2, 'groups');
        assertEqual(serialized[0].children!.length, 2, 'children');

        const sow = serialized[0].children![0];
        assertEqual(sow.name, 'SOW', 'sow name');
        assertEqual(sow.limitedAccess, true, 'sow la');
    });

    it('omits empty/undefined fields', () => {
        const raw: RawTemplateNode[] = [
            { name: 'Empty', children: [{ name: 'Child' }] },
        ];

        const state = deserializeTemplate(raw);
        const serialized = serializeTemplate(state);

        assertEqual(serialized[0].limitedAccess, undefined, 'no la');
        assertEqual(serialized[0].groups, undefined, 'no groups');
        assertEqual(serialized[0].users, undefined, 'no users');
    });
});

// ─── Results ────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`\n  Results: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
    console.log('  ❌ SOME TESTS FAILED\n');
    process.exit(1);
} else {
    console.log('  ✅ ALL TESTS PASSED\n');
    process.exit(0);
}
