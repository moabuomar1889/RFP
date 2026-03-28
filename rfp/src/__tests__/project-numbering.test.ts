import { describe, expect, it } from 'vitest';
import {
    extractProjectNumber,
    findNextAvailableProjectNumber,
    formatProjectNumber,
} from '@/server/project-numbering';

describe('project numbering', () => {
    it('extracts numeric suffix from PRJ code', () => {
        expect(extractProjectNumber('PRJ-021')).toBe(21);
        expect(extractProjectNumber('PR-021')).toBe(21);
        expect(extractProjectNumber('21')).toBe(21);
    });

    it('returns null for invalid values', () => {
        expect(extractProjectNumber(null)).toBeNull();
        expect(extractProjectNumber('PRJ-')).toBeNull();
        expect(extractProjectNumber('abc')).toBeNull();
    });

    it('returns first missing number when trailing projects were deleted', () => {
        expect(findNextAvailableProjectNumber([1, 2, 3, 20, 23])).toBe(4);
        expect(findNextAvailableProjectNumber([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23,
        ])).toBe(21);
    });

    it('reuses the last deleted number when it creates a gap at the end', () => {
        expect(findNextAvailableProjectNumber([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21])).toBe(22);
        expect(findNextAvailableProjectNumber([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])).toBe(21);
    });

    it('ignores duplicates and preserves compact numbering', () => {
        expect(findNextAvailableProjectNumber([1, 1, 2, 2, 3])).toBe(4);
    });

    it('formats project number with PRJ prefix', () => {
        expect(formatProjectNumber(1)).toBe('PRJ-001');
        expect(formatProjectNumber(21)).toBe('PRJ-021');
        expect(formatProjectNumber(123)).toBe('PRJ-123');
    });
});
