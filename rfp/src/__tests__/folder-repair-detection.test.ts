import { describe, expect, it } from 'vitest';
import {
    classifyRepairCandidates,
    matchesProjectPattern,
    normalizeDrivePath,
    normalizeSegment,
} from '@/server/folder-repair-helpers';

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

    it('is case-insensitive', () => {
        expect(normalizeSegment('PRJ-021-pd-Survey', 'PRJ-021')).toBe('Survey');
    });

    it('passes through plain names', () => {
        expect(normalizeSegment('Document Control', 'PRJ-021')).toBe('Document Control');
    });

    it('does not strip a different project prefix', () => {
        expect(normalizeSegment('PRJ-022-PD-Document Control', 'PRJ-021')).toBe('PRJ-022-PD-Document Control');
    });
});

describe('normalizeDrivePath', () => {
    it('normalizes a multi-segment path', () => {
        const raw = 'PRJ-021-PD-Document Control/PRJ-021-PD-Submittals/PRJ-021-PD-Ongoing';
        expect(normalizeDrivePath(raw, 'PRJ-021')).toBe('Document Control/Submittals/Ongoing');
    });

    it('passes through already-clean paths', () => {
        expect(normalizeDrivePath('Document Control/Submittals', 'PRJ-021')).toBe('Document Control/Submittals');
    });
});

describe('matchesProjectPattern', () => {
    it('matches PD prefix', () => {
        expect(matchesProjectPattern('PRJ-021-PD-Document Control', 'PRJ-021')).toBe(true);
    });

    it('matches numbered legacy prefix', () => {
        expect(matchesProjectPattern('1-PRJ-021-PD-Survey', 'PRJ-021')).toBe(true);
    });

    it('rejects different project codes', () => {
        expect(matchesProjectPattern('PRJ-022-PD-Document Control', 'PRJ-021')).toBe(false);
    });

    it('rejects plain folder names', () => {
        expect(matchesProjectPattern('Document Control', 'PRJ-021')).toBe(false);
    });
});

describe('classifyRepairCandidates', () => {
    const project = {
        id: 'p1',
        pr_number: 'PRJ-021',
        name: 'Example',
        drive_folder_id: 'root-1',
    };

    it('classifies a top-level out-of-root duplicate as HIGH confidence', () => {
        const result = classifyRepairCandidates(
            project,
            [
                { id: 'in-1', name: 'Document Control', path: 'Document Control', parentId: 'root-1' },
            ],
            [
                { id: 'in-1', name: 'PRJ-021-PD-Document Control', parents: ['root-1'] },
                { id: 'out-1', name: 'PRJ-021-PD-Document Control', parents: ['wrong-parent'] },
            ]
        );

        expect(result.misplaced).toHaveLength(1);
        expect(result.misplaced[0].folder.id).toBe('out-1');
        expect(result.misplaced[0].matchedCorrectFolderId).toBe('in-1');
        expect(result.ambiguous).toHaveLength(0);
    });

    it('keeps nested descendants ambiguous instead of auto-quarantining them', () => {
        const result = classifyRepairCandidates(
            project,
            [
                { id: 'in-1', name: 'Construction', path: 'Document Control/Submittals/Ongoing/Construction', parentId: 'root-1' },
            ],
            [
                { id: 'wrong-root', name: 'PRJ-021-PD-Ongoing', parents: ['wrong-parent'] },
                { id: 'wrong-child', name: 'PRJ-021-PD-Construction', parents: ['wrong-root'] },
            ]
        );

        expect(result.misplaced).toHaveLength(0);
        expect(result.ambiguous).toHaveLength(2);
        expect(result.ambiguous.find(item => item.folder.id === 'wrong-child')?.reason).toContain('Nested under another out-of-root');
    });

    it('marks unmatched top-level suspects as ambiguous', () => {
        const result = classifyRepairCandidates(
            project,
            [
                { id: 'in-1', name: 'Document Control', path: 'Document Control', parentId: 'root-1' },
            ],
            [
                { id: 'out-1', name: 'PRJ-021-PD-Commercial', parents: ['wrong-parent'] },
            ]
        );

        expect(result.misplaced).toHaveLength(0);
        expect(result.ambiguous).toHaveLength(1);
        expect(result.ambiguous[0].reason).toContain('no top-level in-root equivalent');
    });

    it('marks multiple top-level matches as ambiguous', () => {
        const result = classifyRepairCandidates(
            project,
            [
                { id: 'in-1', name: 'Forms', path: 'Forms', parentId: 'root-1' },
                { id: 'in-2', name: 'Forms', path: 'Forms', parentId: 'root-1' },
            ],
            [
                { id: 'out-1', name: 'PRJ-021-PD-Forms', parents: ['wrong-parent'] },
            ]
        );

        expect(result.misplaced).toHaveLength(0);
        expect(result.ambiguous).toHaveLength(1);
        expect(result.ambiguous[0].reason).toContain('multiple in-root equivalents');
    });
});
