export type PhaseName = 'Bidding' | 'Project Delivery';
export type PhaseCode = 'RFP' | 'PD';

export function getPhaseNamesForProject(projectPhase: string | null | undefined): PhaseName[] {
    return projectPhase === 'bidding'
        ? ['Bidding']
        : ['Bidding', 'Project Delivery'];
}

export function getPhaseCodeForName(phaseName: string): PhaseCode {
    return phaseName === 'Bidding' ? 'RFP' : 'PD';
}

export function stripProjectPhasePrefix(segment: string, projectCode: string): {
    cleaned: string;
    phaseName: PhaseName | null;
} {
    const escaped = projectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        new RegExp(`^\\d+-${escaped}-(RFP|PD)-`, 'i'),
        new RegExp(`^${escaped}-(RFP|PD)-`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = segment.match(pattern);
        if (match) {
            return {
                cleaned: segment.replace(pattern, ''),
                phaseName: match[1].toUpperCase() === 'RFP' ? 'Bidding' : 'Project Delivery',
            };
        }
    }

    return { cleaned: segment, phaseName: null };
}

export function normalizeIndexedDrivePath(drivePath: string, projectCode: string): string {
    const segments = drivePath.split('/').filter(Boolean);
    const cleanedSegments: string[] = [];
    let phaseName: PhaseName | null = null;

    for (const segment of segments) {
        const normalized = stripProjectPhasePrefix(segment, projectCode);
        if (!phaseName && normalized.phaseName) {
            phaseName = normalized.phaseName;
        }
        if (normalized.cleaned) {
            cleanedSegments.push(normalized.cleaned);
        }
    }

    const innerPath = cleanedSegments.join('/');
    if (!phaseName) return innerPath;
    return innerPath ? `${phaseName}/${innerPath}` : phaseName;
}

