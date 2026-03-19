/**
 * folder-repair-helpers.ts
 *
 * Server-side logic for the batch folder-repair workflow.
 * Detects misplaced folders (created outside the real project root) and
 * safely moves them to a quarantine location instead of deleting them.
 *
 * Three phases:
 *   Phase 1 — Detection:  classify each suspicious folder
 *   Phase 2 — Quarantine: move HIGH-confidence misplaced → quarantine folder
 *   Phase 3 — Recovery:   rebuild index + enforce handled by existing job system
 */

import { getDriveClient } from '@/server/google-drive';
import { getAllFoldersRecursive, moveFolder } from '@/server/google-drive';
import { APP_CONFIG } from '@/lib/config';
import { getRawSupabaseAdmin } from '@/lib/supabase';

export type FolderConfidence = 'HIGH' | 'AMBIGUOUS' | 'CORRECT';

export interface ScannedFolder {
    id: string;
    name: string;
    parentId: string;
    path: string;                     // path relative to where it was found
    normalizedPath: string;           // template-style path (prefix stripped)
}

export interface FolderClassification {
    folder: ScannedFolder;
    confidence: FolderConfidence;
    reason: string;
    matchedCorrectFolderId?: string;  // the in-root equivalent, if any
    matchedCorrectPath?: string;
}

export interface ProjectScanResult {
    projectId: string;
    projectCode: string;
    projectRootId: string;
    correct: FolderClassification[];
    misplaced: FolderClassification[];   // HIGH confidence — has in-root equivalent
    ambiguous: FolderClassification[];   // no clear equivalent or multiple matches
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

// ─────────────────────────────────────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip project-code prefixes from a Drive folder name segment.
 * Handles:
 *   PRJ-021-PD-Document Control    → Document Control
 *   PRJ-021-RFP-SOW                → SOW
 *   1-PRJ-021-PD-Document Control  → Document Control
 *   Document Control               → Document Control  (no-op)
 */
export function normalizeSegment(segment: string, prCode: string): string {
    const escaped = prCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Pattern: optional leading N-, then PRJ-XXX-(RFP|PD)-
    const full = new RegExp(`^(?:\\d+-)?${escaped}-(RFP|PD)-`, 'i');
    const stripped = segment.replace(full, '');
    return stripped !== segment ? stripped : segment;
}

/**
 * Build a normalized template-style path from a Drive path string.
 * Each segment has its project prefix stripped.
 */
export function normalizeDrivePath(drivePath: string, prCode: string): string {
    return drivePath
        .split('/')
        .map(seg => normalizeSegment(seg, prCode))
        .filter(Boolean)
        .join('/');
}

/**
 * Return true if the folder name matches the project naming convention.
 * Used to filter out random unrelated folders in the Shared Drive.
 */
export function matchesProjectPattern(name: string, prCode: string): boolean {
    const escaped = prCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^(?:\\d+-)?${escaped}-(RFP|PD)-`, 'i').test(name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search the Shared Drive for any folder whose name contains the project code.
 * This finds ALL project-named folders regardless of where they live.
 * Returns raw Drive file objects.
 */
export async function searchProjectFoldersByPattern(
    prCode: string,
    driveId: string = APP_CONFIG.sharedDriveId
): Promise<Array<{ id: string; name: string; parents: string[] }>> {
    const drive = await getDriveClient();
    const results: Array<{ id: string; name: string; parents: string[] }> = [];
    let pageToken: string | undefined;

    do {
        const resp = await drive.files.list({
            q: `name contains '${prCode}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            driveId,
            corpora: 'drive',
            fields: 'nextPageToken, files(id, name, parents)',
            pageToken,
        });
        for (const f of resp.data.files || []) {
            if (f.id && f.name) {
                results.push({ id: f.id, name: f.name, parents: f.parents || [] });
            }
        }
        pageToken = resp.data.nextPageToken ?? undefined;
    } while (pageToken);

    return results;
}

/**
 * Get or create a quarantine folder at the Shared Drive root level.
 * Name: _REPAIR_QUARANTINE
 * Returns the folder ID.
 */
export async function getOrCreateQuarantineFolder(
    driveId: string = APP_CONFIG.sharedDriveId
): Promise<string> {
    const drive = await getDriveClient();

    // Search for existing quarantine folder
    const resp = await drive.files.list({
        q: `name = '_REPAIR_QUARANTINE' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        driveId,
        corpora: 'drive',
        fields: 'files(id, name)',
    });

    if (resp.data.files && resp.data.files.length > 0) {
        return resp.data.files[0].id!;
    }

    // Create it at drive root
    const created = await drive.files.create({
        requestBody: {
            name: '_REPAIR_QUARANTINE',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [driveId],
        },
        supportsAllDrives: true,
        fields: 'id, name',
    });

    return created.data.id!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection — Phase 1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main detection function.
 *
 * For a single project:
 * 1. Get all folders recursively inside the real project root
 * 2. Search Drive-wide for folders matching the project naming pattern
 * 3. Anything NOT inside the root but matching the pattern = suspect
 * 4. Classify suspects as HIGH (in-root equivalent exists) or AMBIGUOUS
 *
 * Returns a ProjectScanResult for use in dry-run or execute mode.
 */
export async function detectMisplacedFolders(
    project: {
        id: string;
        pr_number: string;
        name: string;
        drive_folder_id: string | null;
    },
    dryRun = true
): Promise<ProjectScanResult> {
    const t0 = Date.now();
    const prCode = project.pr_number;
    const rootId = project.drive_folder_id;

    const empty: ProjectScanResult = {
        projectId: project.id,
        projectCode: prCode,
        projectRootId: rootId || '',
        correct: [],
        misplaced: [],
        ambiguous: [],
        scanDurationMs: 0,
    };

    if (!rootId) {
        return { ...empty, ambiguous: [/* surfaced separately by caller */], scanDurationMs: Date.now() - t0 };
    }

    // Step 1: collect all folders inside the root
    const inRootRaw = await getAllFoldersRecursive(rootId);
    const inRootById = new Map(inRootRaw.map(f => [f.id, f]));

    // Build normalized-path → in-root folder map (for matching suspects)
    const inRootByNormPath = new Map<string, typeof inRootRaw[0]>();
    for (const f of inRootRaw) {
        const norm = normalizeDrivePath(f.path, prCode);
        if (norm) inRootByNormPath.set(norm.toLowerCase(), f);
    }

    // Step 2: Drive-wide search for project-named folders
    let allProjectFolders: Array<{ id: string; name: string; parents: string[] }>;
    try {
        allProjectFolders = await searchProjectFoldersByPattern(prCode);
    } catch (err: any) {
        // Search quota or permission issue — return safe empty result
        return { ...empty, ambiguous: [], scanDurationMs: Date.now() - t0 };
    }

    // Step 3: Classify
    const correct: FolderClassification[] = [];
    const misplaced: FolderClassification[] = [];
    const ambiguous: FolderClassification[] = [];

    for (const f of allProjectFolders) {
        if (!matchesProjectPattern(f.name, prCode)) continue; // skip unrelated matches

        const normalizedName = normalizeSegment(f.name, prCode);
        const normPath = normalizedName; // for top-level folders, path = name

        if (inRootById.has(f.id)) {
            // It IS inside the root → correct
            const inRoot = inRootById.get(f.id)!;
            correct.push({
                folder: {
                    id: f.id,
                    name: f.name,
                    parentId: f.parents[0] || '',
                    path: inRoot.path,
                    normalizedPath: normalizeDrivePath(inRoot.path, prCode),
                },
                confidence: 'CORRECT',
                reason: 'Folder is inside the project root',
            });
            continue;
        }

        // Not inside root — suspect
        // Look for in-root equivalent by normalized name
        const matchedInRoot = inRootByNormPath.get(normPath.toLowerCase());

        const scanned: ScannedFolder = {
            id: f.id,
            name: f.name,
            parentId: f.parents[0] || '',
            path: f.name,
            normalizedPath: normPath,
        };

        if (matchedInRoot) {
            // HIGH confidence — misplaced duplicate
            misplaced.push({
                folder: scanned,
                confidence: 'HIGH',
                reason: `Outside project root — in-root equivalent found at '${normalizeDrivePath(matchedInRoot.path, prCode)}'`,
                matchedCorrectFolderId: matchedInRoot.id,
                matchedCorrectPath: normalizeDrivePath(matchedInRoot.path, prCode),
            });
        } else {
            // Ambiguous — outside root, no in-root equivalent
            ambiguous.push({
                folder: scanned,
                confidence: 'AMBIGUOUS',
                reason: 'Outside project root — no in-root equivalent found to confirm it is a duplicate',
            });
        }
    }

    return {
        projectId: project.id,
        projectCode: prCode,
        projectRootId: rootId,
        correct,
        misplaced,
        ambiguous,
        scanDurationMs: Date.now() - t0,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quarantine — Phase 2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Move all HIGH-confidence misplaced folders to the quarantine folder.
 * Logs every action to rfp.repair_quarantine_log.
 * AMBIGUOUS folders are never touched.
 */
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

            // Move the folder in Google Drive
            await moveFolder(item.folder.id, quarantineFolderId);

            // Log to DB
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

        } catch (err: any) {
            result.errors.push(`${item.folder.name} (${item.folder.id}): ${err.message}`);
            result.skipped++;
        }
    }

    return result;
}

/**
 * Batch scan multiple projects — returns all results.
 */
export async function batchScanProjects(
    projects: Array<{ id: string; pr_number: string; name: string; drive_folder_id: string | null }>
): Promise<ProjectScanResult[]> {
    const results: ProjectScanResult[] = [];
    for (const project of projects) {
        const r = await detectMisplacedFolders(project);
        results.push(r);
    }
    return results;
}
