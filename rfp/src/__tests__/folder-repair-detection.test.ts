/**
 * folder-repair-detection.test.ts
 *
 * Unit tests for the detection / classification logic in folder-repair-helpers.
 * Uses pure functions only — no Drive API or DB calls.
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeSegment,
    normalizeDrivePath,
    matchesProjectPattern,
} from '@/server/folder-repair-helpers';

// ─── normalizeSegment ─────────────────────────────────────────────────────────
describe('normalizeSegment', () => {
    it('strips PRJ-021-PD- prefix', () => {
        expect(normalizeSegment('PRJ-021-PD-Document Control', 'PRJ-021')).toBe('Document Control');
    });

    it('strips PRJ-021-RFP- prefix', () => {
        expect(normalizeSegment('PRJ-021-RFP-SOW', 'PRJ-021')).toBe('SOW');
    });

    it('strips leading digit + PRJ-XXX-PD- prefix (legacy format)', () => {
        expect(normalizeSegment('1-PRJ-021-PD-Document Control', 'PRJ-021')).toBe('Document Control');
    });

    it('strips leading digit + PRJ-XXX-RFP- prefix (legacy format)', () => {
        expect(normalizeSegment('2-PRJ-021-RFP-Technical Proposal', 'PRJ-021')).toBe('Technical Proposal');
    });

    it('is case-insensitive for the suffix', () => {
        expect(normalizeSegment('PRJ-021-pd-Survey', 'PRJ-021')).toBe('Survey');
    });

    it('passes through plain folder name with no prefix', () => {
        expect(normalizeSegment('Document Control', 'PRJ-021')).toBe('Document Control');
    });

    it('does not strip prefix from a different project', () => {
        // PRJ-022 prefix should not be stripped when prCode is PRJ-021
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

    it('does not match partial project code overlap', () => {
        // PRJ-0210 should not match PRJ-021
        expect(matchesProjectPattern('PRJ-0210-PD-SOW', 'PRJ-021')).toBe(false);
    });
});
