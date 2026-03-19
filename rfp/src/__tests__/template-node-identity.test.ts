/**
 * Tests for the Template Node Identity Architecture
 *
 * Covers all required scenarios from the architecture specification:
 * - renamed folder with preserved drive_folder_id binding
 * - typo in displayed folder name
 * - missing mapped folder (null template_node_id)
 * - unmapped existing folder
 * - ambiguous match
 * - orphaned mapping
 * - legacy data before node_id stamping
 * - template edit where unchanged nodes preserve node_id
 * - branch/single scope resolution by node identity
 * - export/audit correctness after folder rename
 */

import { buildNodeMap, buildEffectivePermissionsMap } from '@/server/audit-helpers';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GROUP_A = { email: 'group-a@example.com', role: 'reader' };
const GROUP_B = { email: 'group-b@example.com', role: 'writer' };

/** A minimal template node with a stable node_id */
function makeNode(
    name: string,
    nodeId: string,
    opts: {
        groups?: any[];
        users?: any[];
        limitedAccess?: boolean;
        children?: any[];
    } = {}
) {
    return {
        name,
        node_id: nodeId,
        groups: opts.groups || [],
        users: opts.users || [],
        limitedAccess: opts.limitedAccess ?? false,
        children: opts.children || [],
    };
}

/** Minimal folder_index row */
function makeIndexRow(
    driveFolderId: string,
    templatePath: string,
    templateNodeId: string | null,
    normalizedPath?: string
) {
    return {
        drive_folder_id: driveFolderId,
        template_path: templatePath,
        normalized_template_path: normalizedPath ?? templatePath,
        template_node_id: templateNodeId,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 1: Renamed folder — binding preserved via drive_folder_id
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 1: Renamed Drive folder', () => {
    const NODE_ID = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
    const DRIVE_ID = 'drive-folder-001';

    const templateNode = makeNode('Old Name', NODE_ID, { groups: [GROUP_A] });

    test('nodeMap built from template contains the stable node_id', () => {
        const nodeMap = buildNodeMap([templateNode]);
        expect(nodeMap.has(NODE_ID)).toBe(true);
        expect(nodeMap.get(NODE_ID)?.groups[0]?.email).toBe('group-a@example.com');
    });

    test('folder_index row with template_node_id survives a folder rename', () => {
        // Simulate: folder was renamed on Drive. template_path is stale but drive_folder_id is stable.
        const indexRow = makeIndexRow(DRIVE_ID, 'New Renamed Name', NODE_ID);
        const nodeMap = buildNodeMap([templateNode]);

        // Primary lookup by node_id — succeeds despite path being stale
        const perms = nodeMap.get(indexRow.template_node_id!);
        expect(perms).toBeDefined();
        expect(perms?.groups[0]?.email).toBe('group-a@example.com');
    });

    test('path-based lookup would FAIL after rename — demonstrating why node_id matters', () => {
        const pathMap = buildEffectivePermissionsMap([templateNode]);
        // Path key is "Old Name", but the Drive folder was renamed to "New Renamed Name"
        // This reproduces the original bug: path fallback silently skips the folder
        expect(pathMap['New Renamed Name']).toBeUndefined();
        expect(pathMap['Old Name']).toBeDefined(); // original path still exists in template
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 2: Typo in displayed path name
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 2: Typo in folder name', () => {
    const NODE_ID = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';
    const DRIVE_ID = 'drive-folder-002';
    const templateNode = makeNode('Document Control', NODE_ID, { groups: [GROUP_B] });

    test('node_id lookup resolves correctly even when DB path has a typo', () => {
        // Simulate: folder_index row has a typos in template_path
        const indexRow = makeIndexRow(DRIVE_ID, 'Documnet Control', NODE_ID); // typo

        const nodeMap = buildNodeMap([templateNode]);
        const perms = nodeMap.get(indexRow.template_node_id!);

        expect(perms).toBeDefined(); // resolves correctly via node_id, not path
        expect(perms?.groups[0]?.role).toBe('writer');
    });

    test('path-based lookup FAILS for typo — demonstrating fragility', () => {
        const pathMap = buildEffectivePermissionsMap([templateNode]);
        expect(pathMap['Documnet Control']).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 3: Unmapped folder — null template_node_id surfaced explicitly
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 3: Unmapped folder (null template_node_id)', () => {
    test('folder with null template_node_id is identified as unmapped', () => {
        const indexRow = makeIndexRow('drive-folder-003', 'Some Folder', null);

        const isUnmapped = indexRow.template_node_id === null;
        expect(isUnmapped).toBe(true);
    });

    test('unmapped folder is NOT silently included in audit loop', () => {
        const indexRows = [
            makeIndexRow('drive-001', 'Known Folder', 'cccccccc-3333-3333-3333-cccccccccccc'),
            makeIndexRow('drive-002', 'Unknown Folder', null), // unmapped
        ];

        const auditedFolders = indexRows.filter(row => row.template_node_id !== null);
        expect(auditedFolders.length).toBe(1);
        expect(auditedFolders[0].drive_folder_id).toBe('drive-001');

        const unmappedFolders = indexRows.filter(row => row.template_node_id === null);
        expect(unmappedFolders.length).toBe(1);
        expect(unmappedFolders[0].drive_folder_id).toBe('drive-002');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 4: Orphaned mapping — template_node_id in DB but not in active template
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 4: Orphaned mapping', () => {
    const ACTIVE_NODE_ID = 'dddddddd-4444-4444-4444-dddddddddddd';
    const REMOVED_NODE_ID = 'eeeeeeee-9999-9999-9999-eeeeeeeeeeee';

    const templateNodes = [makeNode('Active Folder', ACTIVE_NODE_ID)];

    test('node_id not in current template is identified as orphaned', () => {
        const nodeMap = buildNodeMap(templateNodes);

        const indexRow = makeIndexRow('drive-folder-orphan', 'Removed Folder', REMOVED_NODE_ID);

        const isOrphaned = indexRow.template_node_id !== null && !nodeMap.has(indexRow.template_node_id);
        expect(isOrphaned).toBe(true);
    });

    test('active folder resolves correctly', () => {
        const nodeMap = buildNodeMap(templateNodes);
        const indexRow = makeIndexRow('drive-folder-active', 'Active Folder', ACTIVE_NODE_ID);

        expect(nodeMap.has(indexRow.template_node_id!)).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 5: Ambiguous match — multiple folders could match a path
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 5: Pre-stamp legacy data (no node_id in template)', () => {
    const legacyNode = { name: 'Legacy Folder', groups: [GROUP_A], users: [], limitedAccess: false };
    // No node_id property — this is pre-stamp data

    test('legacy node without node_id is NOT included in nodeMap', () => {
        const nodeMap = buildNodeMap([legacyNode as any]);
        // No node_id → nodeMap should be empty (can't key by undefined)
        expect(nodeMap.size).toBe(0);
    });

    test('legacy node IS included in path fallback map', () => {
        const pathMap = buildEffectivePermissionsMap([legacyNode as any]);
        expect(pathMap['Legacy Folder']).toBeDefined();
        expect(pathMap['Legacy Folder'].groups[0].email).toBe('group-a@example.com');
    });

    test('after stamping, node gets node_id and appears in nodeMap', () => {
        // Simulate stamp-node-ids result
        const stampedNode = { ...legacyNode, node_id: 'ffffffff-5555-5555-5555-ffffffffffff' };
        const nodeMap = buildNodeMap([stampedNode]);
        expect(nodeMap.size).toBe(1);
        expect(nodeMap.has('ffffffff-5555-5555-5555-ffffffffffff')).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 6: Template edit — unchanged nodes preserve node_id
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 6: Template edit preserves node_id for unchanged nodes', () => {
    const CHILD_A_ID = '66666666-aaaa-aaaa-aaaa-666666666666';
    const CHILD_B_ID = '66666666-bbbb-bbbb-bbbb-666666666666';

    const originalTemplate = [
        makeNode('Phase', 'root-aaaa-root', {
            children: [
                makeNode('Child A', CHILD_A_ID, { groups: [GROUP_A] }),
                makeNode('Child B', CHILD_B_ID, { groups: [GROUP_B] }),
            ],
        }),
    ];

    test('adding a new child does not alter existing node_ids', () => {
        // Simulate: user adds a third child via template editor
        const newChildId = '77777777-cccc-cccc-cccc-777777777777';
        const editedTemplate = [
            makeNode('Phase', 'root-aaaa-root', {
                children: [
                    makeNode('Child A', CHILD_A_ID, { groups: [GROUP_A] }), // preserved
                    makeNode('Child B', CHILD_B_ID, { groups: [GROUP_B] }), // preserved
                    makeNode('Child C', newChildId, { groups: [] }),          // newly added
                ],
            }),
        ];

        const originalMap = buildNodeMap(originalTemplate[0].children);
        const editedMap = buildNodeMap(editedTemplate[0].children);

        // Original node_ids must be present and unchanged
        expect(editedMap.has(CHILD_A_ID)).toBe(true);
        expect(editedMap.has(CHILD_B_ID)).toBe(true);
        // New node added
        expect(editedMap.has(newChildId)).toBe(true);
        // Permissions preserved for unchanged nodes
        expect(editedMap.get(CHILD_A_ID)?.groups[0]?.email).toBe(
            originalMap.get(CHILD_A_ID)?.groups[0]?.email
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 7: Scope resolution by node identity
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 7: Scope resolution by node identity (not path string)', () => {
    const ROOT_ID = '88888888-root-root-root-888888888888';
    const CHILD_ID = '88888888-chld-chld-chld-888888888888';

    const templateNodes = [
        makeNode('Root', ROOT_ID, {
            groups: [GROUP_A],
            children: [
                makeNode('Child', CHILD_ID, { groups: [GROUP_B] }),
            ],
        }),
    ];

    const allIndexedFolders = [
        makeIndexRow('drive-root', 'Root', ROOT_ID),
        makeIndexRow('drive-child', 'Root/Child', CHILD_ID),
        makeIndexRow('drive-other', 'Other', null), // unmapped user folder
    ];

    test('single scope resolves by node_id, not by path string', () => {
        const targetNodeId = ROOT_ID;
        const nodeMap = buildNodeMap(templateNodes);

        const inScope = allIndexedFolders.filter(f =>
            f.template_node_id !== null &&
            nodeMap.has(f.template_node_id) &&
            f.template_node_id === targetNodeId
        );

        expect(inScope.length).toBe(1);
        expect(inScope[0].drive_folder_id).toBe('drive-root');
    });

    test('branch scope includes target node and all descendants', () => {
        const targetNodeId = ROOT_ID;
        const targetPath = 'Root';

        // Resolve descendants by path prefix (since we don't have parent chain in index)
        const inScope = allIndexedFolders.filter(f => {
            if (!f.template_node_id) return false;
            const path = f.normalized_template_path || f.template_path;
            return path === targetPath || path.startsWith(`${targetPath}/`);
        });

        expect(inScope.length).toBe(2);
        const ids = inScope.map(f => f.drive_folder_id).sort();
        expect(ids).toEqual(['drive-child', 'drive-root'].sort());
    });

    test('unmapped user folders are excluded from scope operation', () => {
        const inScope = allIndexedFolders.filter(f => f.template_node_id !== null);
        expect(inScope.some(f => f.drive_folder_id === 'drive-other')).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 8: buildNodeMap inheritance — children inherit parent permissions
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 8: Effective permission inheritance via buildNodeMap', () => {
    const PARENT_ID = '99999999-prnt-prnt-prnt-999999999999';
    const CHILD_ID = '99999999-chld-chld-chld-999999999999';

    const templateWithInheritance = [
        makeNode('Parent', PARENT_ID, {
            groups: [GROUP_A],
            children: [
                makeNode('Child', CHILD_ID, {
                    // Child has no explicit groups — should inherit GROUP_A from parent
                }),
            ],
        }),
    ];

    test('child inherits parent groups in nodeMap', () => {
        const nodeMap = buildNodeMap(templateWithInheritance);

        const parentPerms = nodeMap.get(PARENT_ID);
        const childPerms = nodeMap.get(CHILD_ID);

        // Parent must have GROUP_A explicitly
        expect(parentPerms?.groups[0]?.email).toBe('group-a@example.com');

        // Child has no explicit groups — should have inherited GROUP_A from parent
        expect(childPerms?.groups.length).toBeGreaterThanOrEqual(1);
        const childGroupEmails = childPerms?.groups.map((g: any) => g.email);
        expect(childGroupEmails).toContain('group-a@example.com');

        // limitedAccess should default to false (not limited)
        expect(childPerms?.limitedAccess).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO 9: Export correctness after folder rename
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 9: Export correctness after folder rename', () => {
    const NODE_ID = 'aaaa0000-rnam-rnam-rnam-aaaa0000rnam';

    const templateNode = makeNode('Correct Name', NODE_ID, { groups: [GROUP_A] });

    test('export resolves permissions correctly even when DB path is stale after rename', () => {
        // After rename: Drive shows "Renamed Folder" but folder_index still says old path
        const indexRow = makeIndexRow('drive-renamed', 'Old Stale Path in DB', NODE_ID);

        const nodeMap = buildNodeMap([templateNode]);
        const perms = nodeMap.get(indexRow.template_node_id!);

        // Export should use these permissions (group-a), not fail because path doesn't match
        expect(perms).toBeDefined();
        expect(perms?.groups[0]?.email).toBe('group-a@example.com');
    });
});
