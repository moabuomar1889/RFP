import { describe, expect, it } from 'vitest';
import {
    getPhaseCodeForName,
    getPhaseNamesForProject,
    normalizeIndexedDrivePath,
} from '@/server/project-phase-paths';

describe('project-phase-paths helpers', () => {
    it('returns both phases for execution projects', () => {
        expect(getPhaseNamesForProject('execution')).toEqual(['Bidding', 'Project Delivery']);
    });

    it('maps phase names to the correct Drive prefix code', () => {
        expect(getPhaseCodeForName('Bidding')).toBe('RFP');
        expect(getPhaseCodeForName('Project Delivery')).toBe('PD');
    });

    it('normalizes RFP-prefixed folders into the Bidding namespace', () => {
        expect(
            normalizeIndexedDrivePath(
                'PRJ-021-RFP-Commercial Proposal/PRJ-021-RFP-Admin Only',
                'PRJ-021'
            )
        ).toBe('Bidding/Commercial Proposal/Admin Only');
    });

    it('normalizes PD-prefixed folders into the Project Delivery namespace', () => {
        expect(
            normalizeIndexedDrivePath(
                'PRJ-021-PD-Document Control/PRJ-021-PD-Submittals/PRJ-021-PD-Received',
                'PRJ-021'
            )
        ).toBe('Project Delivery/Document Control/Submittals/Received');
    });
});

