import { APP_CONFIG } from '@/lib/config';
import { getRawSupabaseAdmin } from '@/lib/supabase';
import { getAllFoldersRecursive, getDriveClient, moveFolder } from '@/server/google-drive';

export type FolderConfidence = 'HIGH' | 'AMBIGUOUS' | 'CORRECT';

export interface ScannedFolder {
    id: string;
    name: string;
    parentId: string;
    path: string;
    normalizedPath: string;
}

export interface FolderClassification {
    folder: ScannedFolder;
    confidence: FolderConfidence;
    reason: string;
    matchedCorrectFolderId?: string;
    matchedCorrectPath?: string;
}

export interface ProjectScanResult {
    projectId: string;
    projectCode: string;
    projectRootId: string;
    correct: FolderClassification[];
    misplaced: FolderClassification[];
    ambiguous: FolderClassification[];
    scanDurationMs: number;
}

export interface QuarantineResult {
    projectId: string;
    projectCode: string;
    moved: number;
    skipped: number;
    errors: string[];
    logEntries: Array<{
        folderId: string;
        folderName: string;
        oldParentId: string;
        quarantineFolderId: string;
        reason: string;
        confidence: string;
    }>;
}

type InRootFolder = { id: string; name: string; path: string; parentId: string };
type TaggedDriveFolder = { id: string; name: string; parents: string[] };

export function normalizeSegment(segment: string, prCode: string): string {
    const escaped = prCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const full = new RegExp(`^(?:\\d+-)?${escaped}-(RFP|PD)-`, 'i');
    const stripped = segment.replace(full, '');
    return stripped !== segment ? stripped : segment;
}

export function normalizeDrivePath(drivePath: string, prCode: string): string {
    return drivePath
        .split('/')
        .map(segment => normalizeSegment(segment, prCode))
        .filter(Boolean)
        .join('/');
}

export function matchesProjectPattern(name: string, prCode: string): boolean {
    const escaped = prCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^(?:\\d+-)?${escaped}-(RFP|PD)-`, 'i').test(name);
}

export async function searchProjectFoldersByPattern(
    prCode: string,
    driveId: string = APP_CONFIG.sharedDriveId
): Promise<TaggedDriveFolder[]> {
    const drive = await getDriveClient();
    const results: TaggedDriveFolder[] = [];
    let pageToken: string | undefined;

    const collectPages = async (mode: 'drive' | 'allDrives') => {
        pageToken = undefined;

        do {
            const response = await drive.files.list({
                q: `name contains '${prCode}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                ...(mode === 'drive' && driveId
                    ? { driveId, corpora: 'drive' as const }
                    : { corpora: 'allDrives' as const }),
                fields: 'nextPageToken, files(id, name, parents)',
                pageToken,
            });

            for (const folder of response.data.files || []) {
                if (folder.id && folder.name) {
                    results.push({
                        id: folder.id,
                        name: folder.name,
                        parents: folder.parents || [],
                    });
                }
            }

            pageToken = response.data.nextPageToken ?? undefined;
        } while (pageToken);
    };

    try {
        await collectPages('drive');
    } catch (error: any) {
        const message = error?.message || '';
        const shouldFallback =
            !driveId ||
            message.includes('Shared drive not found') ||
            message.includes('driveId parameter must be specified') ||
            message.includes('teamDriveIdRequiresTeamDriveCorpora');

        if (!shouldFallback) {
            throw error;
        }

        await collectPages('allDrives');
    }

    return results;
}

export async function getOrCreateQuarantineFolder(parentFolderId: string): Promise<string> {
    const drive = await getDriveClient();

    const existing = await drive.files.list({
        q: `'${parentFolderId}' in parents and name = '_REPAIR_QUARANTINE' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
        fields: 'files(id, name)',
    });

    if (existing.data.files && existing.data.files.length > 0) {
        return existing.data.files[0].id!;
    }

    const created = await drive.files.create({
        requestBody: {
            name: '_REPAIR_QUARANTINE',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        },
        supportsAllDrives: true,
        fields: 'id, name',
    });

    return created.data.id!;
}

function buildTopLevelCorrectMap(inRootFolders: InRootFolder[], prCode: string): Map<string, InRootFolder[]> {
    const map = new Map<string, InRootFolder[]>();

    for (const folder of inRootFolders) {
        if (folder.path.includes('/')) continue;

        const normalized = normalizeDrivePath(folder.path, prCode).toLowerCase();
        const existing = map.get(normalized) || [];
        existing.push(folder);
        map.set(normalized, existing);
    }

    return map;
}

export function classifyRepairCandidates(
    project: {
        id: string;
        pr_number: string;
        name: string;
        drive_folder_id: string | null;
    },
    inRootFolders: InRootFolder[],
    allProjectFolders: TaggedDriveFolder[]
): Omit<ProjectScanResult, 'scanDurationMs'> {
    const prCode = project.pr_number;
    const rootId = project.drive_folder_id || '';

    const inRootById = new Map(inRootFolders.map(folder => [folder.id, folder]));
    const topLevelCorrectByName = buildTopLevelCorrectMap(inRootFolders, prCode);
    const taggedFolders = allProjectFolders.filter(folder => matchesProjectPattern(folder.name, prCode));
    const outsideTaggedIds = new Set(
        taggedFolders
            .filter(folder => !inRootById.has(folder.id))
            .map(folder => folder.id)
    );

    const correct: FolderClassification[] = [];
    const misplaced: FolderClassification[] = [];
    const ambiguous: FolderClassification[] = [];

    for (const folder of taggedFolders) {
        if (inRootById.has(folder.id)) {
            const inRoot = inRootById.get(folder.id)!;
            correct.push({
                folder: {
                    id: folder.id,
                    name: folder.name,
                    parentId: folder.parents[0] || '',
                    path: inRoot.path,
                    normalizedPath: normalizeDrivePath(inRoot.path, prCode),
                },
                confidence: 'CORRECT',
                reason: 'Folder is inside the project root',
            });
            continue;
        }

        const scanned: ScannedFolder = {
            id: folder.id,
            name: folder.name,
            parentId: folder.parents[0] || '',
            path: folder.name,
            normalizedPath: normalizeSegment(folder.name, prCode),
        };

        const parentId = folder.parents[0] || '';
        if (parentId && outsideTaggedIds.has(parentId)) {
            ambiguous.push({
                folder: scanned,
                confidence: 'AMBIGUOUS',
                reason: 'Nested under another out-of-root project-tagged folder; only top-level suspect roots are auto-quarantined',
            });
            continue;
        }

        const candidates = topLevelCorrectByName.get(scanned.normalizedPath.toLowerCase()) || [];
        if (candidates.length === 1) {
            const matched = candidates[0];
            misplaced.push({
                folder: scanned,
                confidence: 'HIGH',
                reason: `Outside project root - top-level in-root equivalent found at '${normalizeDrivePath(matched.path, prCode)}'`,
                matchedCorrectFolderId: matched.id,
                matchedCorrectPath: normalizeDrivePath(matched.path, prCode),
            });
            continue;
        }

        ambiguous.push({
            folder: scanned,
            confidence: 'AMBIGUOUS',
            reason: candidates.length > 1
                ? 'Outside project root - multiple in-root equivalents found, so the folder will not be auto-moved'
                : 'Outside project root - no top-level in-root equivalent found to confirm a safe quarantine target',
        });
    }

    return {
        projectId: project.id,
        projectCode: prCode,
        projectRootId: rootId,
        correct,
        misplaced,
        ambiguous,
    };
}

export async function detectMisplacedFolders(
    project: {
        id: string;
        pr_number: string;
        name: string;
        drive_folder_id: string | null;
    },
    _dryRun = true
): Promise<ProjectScanResult> {
    const startedAt = Date.now();
    const rootId = project.drive_folder_id;

    const empty: ProjectScanResult = {
        projectId: project.id,
        projectCode: project.pr_number,
        projectRootId: rootId || '',
        correct: [],
        misplaced: [],
        ambiguous: [],
        scanDurationMs: 0,
    };

    if (!rootId) {
        return {
            ...empty,
            scanDurationMs: Date.now() - startedAt,
        };
    }

    const inRootFolders = await getAllFoldersRecursive(rootId);

    let allProjectFolders: TaggedDriveFolder[];
    try {
        allProjectFolders = await searchProjectFoldersByPattern(project.pr_number);
    } catch (error) {
        return {
            ...empty,
            scanDurationMs: Date.now() - startedAt,
        };
    }

    const classified = classifyRepairCandidates(project, inRootFolders, allProjectFolders);

    return {
        ...classified,
        scanDurationMs: Date.now() - startedAt,
    };
}

export async function quarantineMisplacedFolders(
    project: { id: string; pr_number: string },
    misplacedFolders: FolderClassification[],
    quarantineFolderId: string,
    performedBy: string
): Promise<QuarantineResult> {
    const client = getRawSupabaseAdmin();
    const result: QuarantineResult = {
        projectId: project.id,
        projectCode: project.pr_number,
        moved: 0,
        skipped: 0,
        errors: [],
        logEntries: [],
    };

    for (const item of misplacedFolders) {
        if (item.confidence !== 'HIGH') {
            result.skipped++;
            continue;
        }

        try {
            const oldParentId = item.folder.parentId;
            await moveFolder(item.folder.id, quarantineFolderId);

            await client.schema('rfp').from('repair_quarantine_log').insert({
                project_id: project.id,
                project_code: project.pr_number,
                folder_id: item.folder.id,
                folder_name: item.folder.name,
                old_parent_id: oldParentId,
                new_parent_id: quarantineFolderId,
                confidence: 'HIGH',
                reason: item.reason,
                matched_correct_folder_id: item.matchedCorrectFolderId ?? null,
                matched_correct_path: item.matchedCorrectPath ?? null,
                quarantined_by: performedBy,
            });

            result.logEntries.push({
                folderId: item.folder.id,
                folderName: item.folder.name,
                oldParentId,
                quarantineFolderId,
                reason: item.reason,
                confidence: 'HIGH',
            });
            result.moved++;
        } catch (error: any) {
            result.errors.push(`${item.folder.name} (${item.folder.id}): ${error.message}`);
            result.skipped++;
        }
    }

    return result;
}

export async function batchScanProjects(
    projects: Array<{ id: string; pr_number: string; name: string; drive_folder_id: string | null }>
): Promise<ProjectScanResult[]> {
    const results: ProjectScanResult[] = [];

    for (const project of projects) {
        results.push(await detectMisplacedFolders(project));
    }

    return results;
}
