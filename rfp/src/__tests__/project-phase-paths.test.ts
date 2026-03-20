import { describe, expect, it } from 'vitest';
import {
    getPhaseRootFolderName,
    getPhaseCodeForName,
    getPhaseNamesForProject,
    getProjectCode,
    normalizeIndexedDrivePath,
    resolveDrivePlacementForTemplatePath,
} from '@/server/project-phase-paths';

describe('project-phase-paths helpers', () => {
    it('returns both phases for execution projects', () => {
        expect(getPhaseNamesForProject('execution')).toEqual(['Bidding', 'Project Delivery']);
    });

    it('maps phase names to the correct Drive prefix code', () => {
        expect(getPhaseCodeForName('Bidding')).toBe('RFP');
        expect(getPhaseCodeForName('Project Delivery')).toBe('PD');
    });

    it('normalizes project codes consistently', () => {
        expect(getProjectCode('015')).toBe('PRJ-015');
        expect(getProjectCode('PRJ-015')).toBe('PRJ-015');
    });

    it('builds the correct phase root folder names', () => {
        expect(getPhaseRootFolderName('PRJ-015', 'Bidding')).toBe('PRJ-015-RFP');
        expect(getPhaseRootFolderName('PRJ-015', 'Project Delivery')).toBe('PRJ-015-PD');
    });

    it('places phase roots directly under the project root', () => {
        expect(resolveDrivePlacementForTemplatePath('PRJ-015', 'Bidding')).toEqual({
            phaseName: 'Bidding',
            folderName: 'PRJ-015-RFP',
            parentNormalizedPath: null,
            isPhaseRoot: true,
        });
    });

    it('places Bidding children inside the RFP phase root with plain names', () => {
        expect(resolveDrivePlacementForTemplatePath('PRJ-015', 'Bidding/Technical Proposal')).toEqual({
            phaseName: 'Bidding',
            folderName: 'Technical Proposal',
            parentNormalizedPath: 'Bidding',
            isPhaseRoot: false,
        });
    });

    it('places PD children inside the PD phase root with plain names', () => {
        expect(resolveDrivePlacementForTemplatePath('PRJ-015', 'Project Delivery/Document Control')).toEqual({
            phaseName: 'Project Delivery',
            folderName: 'Document Control',
            parentNormalizedPath: 'Project Delivery',
            isPhaseRoot: false,
        });
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
