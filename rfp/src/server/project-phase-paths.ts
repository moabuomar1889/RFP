export type PhaseName = 'Bidding' | 'Project Delivery';
export type PhaseCode = 'RFP' | 'PD';

// Historical system-created typos seen repeatedly across many projects.
// Keep this list intentionally small and exact so we do not rewrite arbitrary user content.
const MANAGED_SEGMENT_ALIASES = new Map<string, string>([
    ['technical propsal', 'Technical Proposal'],
    ['commercial propsal', 'Commercial Proposal'],
    ['quantity survuy', 'Quantity Survey'],
    ['procurment', 'Procurement'],
]);

export function getPhaseNamesForProject(projectPhase: string | null | undefined): PhaseName[] {
    return projectPhase === 'bidding'
        ? ['Bidding']
        : ['Bidding', 'Project Delivery'];
}

export function getPhaseCodeForName(phaseName: string): PhaseCode {
    return phaseName === 'Bidding' ? 'RFP' : 'PD';
}

export function getProjectCode(prNumber: string): string {
    return /^PRJ-/i.test(prNumber) ? prNumber : `PRJ-${prNumber}`;
}

export function getPhaseRootFolderName(projectCode: string, phaseName: string): string {
    return `${getProjectCode(projectCode)}-${getPhaseCodeForName(phaseName)}`;
}

export function resolveDrivePlacementForTemplatePath(
    projectCode: string,
    normalizedTemplatePath: string
): {
    phaseName: PhaseName;
    folderName: string;
    parentNormalizedPath: string | null;
    isPhaseRoot: boolean;
} {
    const parts = normalizedTemplatePath.split('/').filter(Boolean);
    const phaseName = parts[0] as PhaseName | undefined;

    if (!phaseName || (phaseName !== 'Bidding' && phaseName !== 'Project Delivery')) {
        throw new Error(`Unsupported template path '${normalizedTemplatePath}'`);
    }

    if (parts.length === 1) {
        return {
            phaseName,
            folderName: getPhaseRootFolderName(projectCode, phaseName),
            parentNormalizedPath: null,
            isPhaseRoot: true,
        };
    }

    return {
        phaseName,
        folderName: parts[parts.length - 1],
        parentNormalizedPath: parts.slice(0, -1).join('/'),
        isPhaseRoot: false,
    };
}

export function rankDrivePathCandidateForTemplatePath(
    drivePath: string,
    normalizedTemplatePath: string
): { depthDelta: number; driveDepth: number } {
    const driveDepth = drivePath.split('/').filter(Boolean).length;
    const templateDepth = normalizedTemplatePath.split('/').filter(Boolean).length;

    return {
        depthDelta: Math.abs(driveDepth - templateDepth),
        driveDepth,
    };
}

export function stripProjectPhasePrefix(segment: string, projectCode: string): {
    cleaned: string;
    phaseName: PhaseName | null;
} {
    const escaped = projectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        new RegExp(`^\\d+-${escaped}-(RFP|PD)$`, 'i'),
        new RegExp(`^${escaped}-(RFP|PD)$`, 'i'),
        new RegExp(`^\\d+-${escaped}-(RFP|PD)-`, 'i'),
        new RegExp(`^${escaped}-(RFP|PD)-`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = segment.match(pattern);
        if (match) {
            const exactRoot = match[0].length === segment.length;
            return {
                cleaned: exactRoot ? '' : segment.replace(pattern, ''),
                phaseName: match[1].toUpperCase() === 'RFP' ? 'Bidding' : 'Project Delivery',
            };
        }
    }

    return { cleaned: segment, phaseName: null };
}

export function normalizeManagedSegmentAlias(segment: string): string {
    const trimmed = segment.trim();
    if (!trimmed) return trimmed;
    return MANAGED_SEGMENT_ALIASES.get(trimmed.toLowerCase()) ?? trimmed;
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
            cleanedSegments.push(normalizeManagedSegmentAlias(normalized.cleaned));
        }
    }

    const innerPath = cleanedSegments.join('/');
    if (!phaseName) return innerPath;
    return innerPath ? `${phaseName}/${innerPath}` : phaseName;
}
