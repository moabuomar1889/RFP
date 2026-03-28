import { describe, expect, it } from 'vitest';
import {
    getPhaseRootFolderName,
    getManagedPhaseChildFolderName,
    getPhaseCodeForName,
    getPhaseNamesForProject,
    getProjectCode,
    normalizeManagedSegmentAlias,
    normalizeIndexedDrivePath,
    rankDrivePathCandidateForTemplatePath,
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

    it('builds the correct managed child folder names inside phase roots', () => {
        expect(getManagedPhaseChildFolderName('PRJ-015', 'Bidding', 'Technical Proposal')).toBe('PRJ-015-RFP-Technical Proposal');
        expect(getManagedPhaseChildFolderName('PRJ-015', 'Project Delivery', 'Document Control')).toBe('PRJ-015-PD-Document Control');
    });

    it('places phase roots directly under the project root', () => {
        expect(resolveDrivePlacementForTemplatePath('PRJ-015', 'Bidding')).toEqual({
            phaseName: 'Bidding',
            folderName: 'PRJ-015-RFP',
            parentNormalizedPath: null,
            isPhaseRoot: true,
        });
    });

    it('places Bidding children inside the RFP phase root with managed prefixed names', () => {
        expect(resolveDrivePlacementForTemplatePath('PRJ-015', 'Bidding/Technical Proposal')).toEqual({
            phaseName: 'Bidding',
            folderName: 'PRJ-015-RFP-Technical Proposal',
            parentNormalizedPath: 'Bidding',
            isPhaseRoot: false,
        });
    });

    it('places PD children inside the PD phase root with managed prefixed names', () => {
        expect(resolveDrivePlacementForTemplatePath('PRJ-015', 'Project Delivery/Document Control')).toEqual({
            phaseName: 'Project Delivery',
            folderName: 'PRJ-015-PD-Document Control',
            parentNormalizedPath: 'Project Delivery',
            isPhaseRoot: false,
        });
    });

    it('keeps managed prefixes for nested descendants too', () => {
        expect(resolveDrivePlacementForTemplatePath('PRJ-015', 'Bidding/Technical Proposal/TBE')).toEqual({
            phaseName: 'Bidding',
            folderName: 'PRJ-015-RFP-TBE',
            parentNormalizedPath: 'Bidding/Technical Proposal',
            isPhaseRoot: false,
        });
    });

    it('prefers structurally correct drive candidates over root-level polluted siblings', () => {
        const wrong = rankDrivePathCandidateForTemplatePath(
            'PRJ-002-RFP-Commercial Proposal',
            'Bidding/Commercial Proposal'
        );
        const correct = rankDrivePathCandidateForTemplatePath(
            'PRJ-002-RFP/PRJ-002-RFP-Commercial Proposal',
            'Bidding/Commercial Proposal'
        );

        expect(correct.depthDelta).toBeLessThan(wrong.depthDelta);
    });

    it('normalizes RFP-prefixed folders into the Bidding namespace', () => {
        expect(
            normalizeIndexedDrivePath(
                'PRJ-021-RFP-Commercial Proposal/PRJ-021-RFP-Admin Only',
                'PRJ-021'
            )
        ).toBe('Bidding/Commercial Proposal/Admin Only');
    });

    it('normalizes an exact RFP phase root to the Bidding phase path', () => {
        expect(normalizeIndexedDrivePath('PRJ-021-RFP', 'PRJ-021')).toBe('Bidding');
    });

    it('normalizes descendants under an exact RFP phase root correctly', () => {
        expect(
            normalizeIndexedDrivePath(
                'PRJ-021-RFP/PRJ-021-RFP-Technical Proposal/PRJ-021-RFP-TBE',
                'PRJ-021'
            )
        ).toBe('Bidding/Technical Proposal/TBE');
    });

    it('normalizes PD-prefixed folders into the Project Delivery namespace', () => {
        expect(
            normalizeIndexedDrivePath(
                'PRJ-021-PD-Document Control/PRJ-021-PD-Submittals/PRJ-021-PD-Received',
                'PRJ-021'
            )
        ).toBe('Project Delivery/Document Control/Submittals/Received');
    });

    it('normalizes an exact PD phase root to the Project Delivery phase path', () => {
        expect(normalizeIndexedDrivePath('PRJ-021-PD', 'PRJ-021')).toBe('Project Delivery');
    });

    it('normalizes numbered descendants under an exact PD phase root correctly', () => {
        expect(
            normalizeIndexedDrivePath(
                'PRJ-021-PD/PRJ-021-PD-Document Control/2-PRJ-021-PD-Received',
                'PRJ-021'
            )
        ).toBe('Project Delivery/Document Control/Received');
    });

    it('maps historical managed typos to canonical names', () => {
        expect(normalizeManagedSegmentAlias('Technical Propsal')).toBe('Technical Proposal');
        expect(normalizeManagedSegmentAlias('Commercial Propsal')).toBe('Commercial Proposal');
        expect(normalizeManagedSegmentAlias('Quantity Survuy')).toBe('Quantity Survey');
        expect(normalizeManagedSegmentAlias('Procurment')).toBe('Procurement');
    });

    it('normalizes historical RFP typo paths to their canonical template paths', () => {
        expect(
            normalizeIndexedDrivePath(
                'PRJ-001-RFP/PRJ-001-RFP-Technical Propsal/PRJ-001-RFP-TBE',
                'PRJ-001'
            )
        ).toBe('Bidding/Technical Proposal/TBE');
    });

    it('normalizes historical PD typo paths to their canonical template paths', () => {
        expect(
            normalizeIndexedDrivePath(
                'PRJ-001-PD/PRJ-001-PD-Document Control/PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/4-PRJ-001-PD-Procurment',
                'PRJ-001'
            )
        ).toBe('Project Delivery/Document Control/Submittals/Received/Procurement');
    });

    it('does not rewrite arbitrary user-created folder names', () => {
        expect(normalizeManagedSegmentAlias('Photos')).toBe('Photos');
        expect(normalizeManagedSegmentAlias('Geosol Latest')).toBe('Geosol Latest');
    });
});
