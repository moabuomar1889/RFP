/**
 * folder-repair-detection.test.ts  (v2 — Tree-Root Detection)
 *
 * Tests for the pure classification helpers in folder-repair-helpers.ts.
 * No Drive API calls are made — all inputs are in-memory fixtures.
 *
 * Coverage:
 * - normalizeSegment / normalizeDrivePath / matchesProjectPattern (unchanged)
 * - identifyTreeRoots — isolates tree roots from non-root tagged folders
 * - scoreTreeRoot — HIGH vs AMBIGUOUS scoring using in-root segment sets
 * - Tree-root coverage scenarios (real-world PRJ-021-style RFP/PD trees)
 * - Safety cases (no false positives, no aggressive fuzzy matching)
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeSegment,
    normalizeDrivePath,
    matchesProjectPattern,
    filterActiveMisplacedCandidates,
    identifyTreeRoots,
    scoreTreeRoot,
    type TaggedFolder,
} from '@/server/folder-repair-helpers';

// ─── normalizeSegment ─────────────────────────────────────────────────────────
describe('normalizeSegment', () => {
    it('strips PRJ-021-PD- prefix', () => {
        expect(normalizeSegment('PRJ-021-PD-Document Control', 'PRJ-021')).toBe('Document Control');
    });

    it('strips PRJ-021-RFP- prefix', () => {
        expect(normalizeSegment('PRJ-021-RFP-SOW', 'PRJ-021')).toBe('SOW');
    });

    it('strips leading digit + PRJ-XXX-PD- prefix', () => {
        expect(normalizeSegment('1-PRJ-021-PD-Document Control', 'PRJ-021')).toBe('Document Control');
    });

    it('strips leading digit + PRJ-XXX-RFP- prefix', () => {
        expect(normalizeSegment('2-PRJ-021-RFP-Technical Proposal', 'PRJ-021')).toBe('Technical Proposal');
    });

    it('is case-insensitive for the phase suffix', () => {
        expect(normalizeSegment('PRJ-021-pd-Survey', 'PRJ-021')).toBe('Survey');
    });

    it('passes through plain folder name untouched', () => {
        expect(normalizeSegment('Document Control', 'PRJ-021')).toBe('Document Control');
    });

    it('does not strip prefix from a different project code', () => {
        expect(normalizeSegment('PRJ-022-PD-Document Control', 'PRJ-021')).toBe('PRJ-022-PD-Document Control');
    });
});

// ─── normalizeDrivePath ───────────────────────────────────────────────────────
describe('normalizeDrivePath', () => {
    it('normalizes a multi-segment path', () => {
        const raw = 'PRJ-021-PD-Document Control/PRJ-021-PD-Submittals/PRJ-021-PD-Ongoing';
        expect(normalizeDrivePath(raw, 'PRJ-021')).toBe('Document Control/Submittals/Ongoing');
    });

    it('normalizes a single-segment path', () => {
        expect(normalizeDrivePath('PRJ-021-RFP-SOW', 'PRJ-021')).toBe('SOW');
    });

    it('passes through already-clean paths', () => {
        expect(normalizeDrivePath('Document Control/Submittals', 'PRJ-021')).toBe('Document Control/Submittals');
    });
});

// ─── matchesProjectPattern ────────────────────────────────────────────────────
describe('matchesProjectPattern', () => {
    it('matches PRJ-021-PD- prefixed name', () => {
        expect(matchesProjectPattern('PRJ-021-PD-Document Control', 'PRJ-021')).toBe(true);
    });

    it('matches PRJ-021-RFP- prefixed name', () => {
        expect(matchesProjectPattern('PRJ-021-RFP-SOW', 'PRJ-021')).toBe(true);
    });

    it('matches numbered prefix format', () => {
        expect(matchesProjectPattern('1-PRJ-021-PD-Survey', 'PRJ-021')).toBe(true);
    });

    it('does not match a different project code', () => {
        expect(matchesProjectPattern('PRJ-022-PD-Document Control', 'PRJ-021')).toBe(false);
    });

    it('does not match a plain folder name', () => {
        expect(matchesProjectPattern('Document Control', 'PRJ-021')).toBe(false);
    });

    it('does not match partial project code (PRJ-0210 ≠ PRJ-021)', () => {
        expect(matchesProjectPattern('PRJ-0210-PD-SOW', 'PRJ-021')).toBe(false);
    });
});

// ─── filterActiveMisplacedCandidates ──────────────────────────────────────────
describe('filterActiveMisplacedCandidates', () => {
    const prCode = 'PRJ-021';
    
    it('keeps valid out-of-root misplaced candidates', () => {
        const allTagged: TaggedFolder[] = [
            { id: 'bad-1', name: 'PRJ-021-RFP-Commercial Proposal', parents: ['ext-1'] }
        ];
        const result = filterActiveMisplacedCandidates(allTagged, prCode, new Set(), new Set());
        expect(result).toHaveLength(1);
    });

    it('excludes folders that are already inside the project root', () => {
        const allTagged: TaggedFolder[] = [
            { id: 'good-1', name: 'PRJ-021-RFP-SOW', parents: ['ext-1'] }
        ];
        const inRootIds = new Set(['good-1']);
        const result = filterActiveMisplacedCandidates(allTagged, prCode, inRootIds, new Set());
        expect(result).toHaveLength(0);
    });

    it('excludes folders that are already inside _REPAIR_QUARANTINE', () => {
        const allTagged: TaggedFolder[] = [
            { id: 'q-root-1', name: 'PRJ-021-RFP-Technical', parents: ['quarantine-parent'] }
        ];
        // The quarantine log check returned 'q-root-1' as a quarantined subtree ID
        const quarantinedIds = new Set(['q-root-1']);
        const result = filterActiveMisplacedCandidates(allTagged, prCode, new Set(), quarantinedIds);
        expect(result).toHaveLength(0);
    });

    it('excludes descendants of quarantined folders', () => {
        const allTagged: TaggedFolder[] = [
            { id: 'q-root-1', name: 'PRJ-021-RFP-Technical', parents: ['quarantine-parent'] },
            { id: 'q-child-1', name: 'PRJ-021-RFP-Deep-File', parents: ['q-root-1'] }
        ];
        // The DB fetch for descendants returned both the root and child IDs
        const quarantinedIds = new Set(['q-root-1', 'q-child-1']);
        const result = filterActiveMisplacedCandidates(allTagged, prCode, new Set(), quarantinedIds);
        expect(result).toHaveLength(0);
    });
});

// ─── identifyTreeRoots ────────────────────────────────────────────────────────
describe('identifyTreeRoots', () => {
    it('returns the single tagged folder when there is only one', () => {
        const folders: TaggedFolder[] = [
            { id: 'a', name: 'PRJ-021-RFP-SOW', parents: ['ext-parent'] },
        ];
        expect(identifyTreeRoots(folders)).toHaveLength(1);
        expect(identifyTreeRoots(folders)[0].id).toBe('a');
    });

    it('identifies top-of-tree roots correctly', () => {
        // Root: 'a' (parent is external)
        // Descendant: 'b' (parent is 'a' which is in the tagged set)
        const folders: TaggedFolder[] = [
            { id: 'a', name: 'PRJ-021-RFP-Commercial Proposal', parents: ['ext-parent'] },
            { id: 'b', name: 'PRJ-021-RFP-Vendors Quotations', parents: ['a'] },
        ];
        const roots = identifyTreeRoots(folders);
        expect(roots).toHaveLength(1);
        expect(roots[0].id).toBe('a');
    });

    it('returns multiple independent sibling roots', () => {
        // Both a and b have no parent in the tagged set → both are roots
        const folders: TaggedFolder[] = [
            { id: 'a', name: 'PRJ-021-RFP-Commercial Proposal', parents: ['ext-1'] },
            { id: 'b', name: 'PRJ-021-RFP-Technical Proposal', parents: ['ext-2'] },
        ];
        const roots = identifyTreeRoots(folders);
        expect(roots).toHaveLength(2);
    });

    it('correctly separates root from multiple non-root descendants', () => {
        // a → root; b, c, d → descendants of a
        const folders: TaggedFolder[] = [
            { id: 'a', name: 'PRJ-021-PD-Root', parents: ['external'] },
            { id: 'b', name: 'PRJ-021-PD-Child1', parents: ['a'] },
            { id: 'c', name: 'PRJ-021-PD-Child2', parents: ['a'] },
            { id: 'd', name: 'PRJ-021-PD-Grandchild', parents: ['b'] },
        ];
        const roots = identifyTreeRoots(folders);
        expect(roots).toHaveLength(1);
        expect(roots[0].id).toBe('a');
    });

    it('returns empty array when no tagged folders exist', () => {
        expect(identifyTreeRoots([])).toHaveLength(0);
    });
});

// ─── scoreTreeRoot ────────────────────────────────────────────────────────────
describe('scoreTreeRoot', () => {
    const prCode = 'PRJ-021';

    // In-root segment set simulating a real project with Commercial Proposal, SOW, etc.
    const inRootSegments = new Set([
        'commercial proposal',
        'vendors quotations',
        'technical proposal',
        'sow',
        'admin only',
        'mechanical',
        'e&i',
        'it',
        'civil and finishes',
    ]);

    it('scores HIGH when the normalized root name matches an in-root segment', () => {
        const root: TaggedFolder = {
            id: 'r1',
            name: 'PRJ-021-RFP-Commercial Proposal',
            parents: ['ext'],
        };
        const { confidence } = scoreTreeRoot(root, inRootSegments, prCode);
        expect(confidence).toBe('HIGH');
    });

    it('scores HIGH for PRJ-021-RFP-SOW branch root', () => {
        const root: TaggedFolder = { id: 'r2', name: 'PRJ-021-RFP-SOW', parents: ['ext'] };
        const { confidence } = scoreTreeRoot(root, inRootSegments, prCode);
        expect(confidence).toBe('HIGH');
    });

    it('scores HIGH for PRJ-021-RFP-Technical Proposal branch root', () => {
        const root: TaggedFolder = { id: 'r3', name: 'PRJ-021-RFP-Technical Proposal', parents: ['ext'] };
        const { confidence } = scoreTreeRoot(root, inRootSegments, prCode);
        expect(confidence).toBe('HIGH');
    });

    it('scores AMBIGUOUS when no in-root segment matches', () => {
        const root: TaggedFolder = {
            id: 'r4',
            name: 'PRJ-021-RFP-Lost Orphan Branch',
            parents: ['ext'],
        };
        const { confidence } = scoreTreeRoot(root, inRootSegments, prCode);
        expect(confidence).toBe('AMBIGUOUS');
    });

    it('scores AMBIGUOUS when in-root segments are empty (no in-root equivalent at all)', () => {
        const root: TaggedFolder = {
            id: 'r5',
            name: 'PRJ-021-PD-Document Control',
            parents: ['ext'],
        };
        const { confidence } = scoreTreeRoot(root, new Set<string>(), prCode);
        expect(confidence).toBe('AMBIGUOUS');
    });

    it('returns the matched segment name in the result for HIGH', () => {
        const root: TaggedFolder = { id: 'r6', name: 'PRJ-021-RFP-SOW', parents: ['ext'] };
        const result = scoreTreeRoot(root, inRootSegments, prCode);
        expect(result.matchedSegment).toBe('SOW');
    });

    it('does not score HIGH from a plain untagged folder name (leaf-level match is not sufficient alone)', () => {
        // matchesProjectPattern must pass for the folder to even reach scoreTreeRoot
        // Here we confirm that a plain name 'Admin Only' does NOT match project pattern
        // (so it would never be passed to scoreTreeRoot in the first place)
        expect(matchesProjectPattern('Admin Only', prCode)).toBe(false);
    });

    it('repeated bad run: two sibling tagged roots with same normalized name both score HIGH', () => {
        // PRJ-021-RFP-Commercial Proposal appears twice from two different bad runs
        const root1: TaggedFolder = { id: 'r1', name: 'PRJ-021-RFP-Commercial Proposal', parents: ['ext-1'] };
        const root2: TaggedFolder = { id: 'r2', name: 'PRJ-021-RFP-Commercial Proposal', parents: ['ext-2'] };

        const { confidence: c1 } = scoreTreeRoot(root1, inRootSegments, prCode);
        const { confidence: c2 } = scoreTreeRoot(root2, inRootSegments, prCode);

        expect(c1).toBe('HIGH');
        expect(c2).toBe('HIGH');
        // Both are independently quarantine candidates — operators must resolve duplicates
    });
});

// ─── Integration: identifyTreeRoots + scoreTreeRoot (real-world PRJ-021 case) ─
describe('Tree-root detection: real-world PRJ-021 RFP tree scenario', () => {
    const prCode = 'PRJ-021';
    const inRootSegments = new Set([
        'commercial proposal',
        'vendors quotations',
        'technical proposal',
        'sow',
        'admin only',
        'tbe',
        'technical submittal',
        'mechanical',
        'e&i',
        'it',
        'civil and finishes',
    ]);

    // Simulated out-of-root tagged folders from Drive search
    // 4 branch roots + their descendants (non-tagged children would be found by subtree scan)
    const taggedOutOfRoot: TaggedFolder[] = [
        { id: 'rfp-commercial', name: 'PRJ-021-RFP-Commercial Proposal', parents: ['bad-parent'] },
        { id: 'rfp-vendors',    name: 'PRJ-021-RFP-Vendors Quotations',   parents: ['bad-parent'] },
        { id: 'rfp-technical',  name: 'PRJ-021-RFP-Technical Proposal',   parents: ['bad-parent'] },
        { id: 'rfp-sow',        name: 'PRJ-021-RFP-SOW',                  parents: ['bad-parent'] },
    ];

    it('identifies 4 RFP tree roots (all 4 have external parents)', () => {
        const roots = identifyTreeRoots(taggedOutOfRoot);
        expect(roots).toHaveLength(4);
    });

    it('scores all 4 RFP tree roots as HIGH', () => {
        const roots = identifyTreeRoots(taggedOutOfRoot);
        const confidences = roots.map(r => scoreTreeRoot(r, inRootSegments, prCode).confidence);
        expect(confidences.every(c => c === 'HIGH')).toBe(true);
    });

    it('descendants of HIGH roots are NOT in the tagged set — they are found by subtree scan separately', () => {
        // Verify that untagged children (TBE, Admin Only etc.) would not appear in identifyTreeRoots
        // because matchesProjectPattern('TBE', 'PRJ-021') is false — they'd never be in the input set
        const untaggedChildren = ['TBE', 'Technical Submittal', 'Admin Only', 'Mechanical'];
        for (const name of untaggedChildren) {
            expect(matchesProjectPattern(name, prCode)).toBe(false);
        }
    });

    it('a tagged child of another tagged root is NOT a tree root', () => {
        // If a tagged folder's parent is itself tagged → it's a descendant, not a root
        const nestedTagged: TaggedFolder[] = [
            { id: 'root', name: 'PRJ-021-RFP-Commercial Proposal', parents: ['bad-parent'] },
            { id: 'child', name: 'PRJ-021-RFP-Nested', parents: ['root'] },
        ];
        const roots = identifyTreeRoots(nestedTagged);
        expect(roots).toHaveLength(1);
        expect(roots[0].id).toBe('root');
    });

    it('out-of-root branch with no in-root evidence stays AMBIGUOUS — not auto-moved', () => {
        const orphan: TaggedFolder = {
            id: 'orphan',
            name: 'PRJ-021-RFP-Unknown Phase',
            parents: ['bad-parent'],
        };
        const { confidence } = scoreTreeRoot(orphan, inRootSegments, prCode);
        expect(confidence).toBe('AMBIGUOUS');
    });
});
