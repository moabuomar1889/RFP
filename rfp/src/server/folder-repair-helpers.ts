/**
 * folder-repair-helpers.ts  (v2 — Tree-Root Detection)
 *
 * Upgrade over v1: instead of checking each folder individually against
 * in-root duplicates, the engine now:
 *
 * 1. Finds all out-of-root project-tagged folders (via Drive name search)
 * 2. Identifies TREE ROOTS — tagged folders whose parent is not another
 *    tagged folder (= the top of a wrongly-placed subtree)
 * 3. Scans the subtree under each tree root
 * 4. Scores the tree root as HIGH when the in-root folder tree already
 *    contains a folder whose last-segment name matches the root's
 *    normalized name (segment-based matching, not full-path matching)
 * 5. Marks all subtree descendants as COVERED_BY_ROOT — they do NOT require
 *    separate quarantine actions; moving the root captures them
 * 6. Anything without strong in-root evidence stays AMBIGUOUS
 *
 * Quarantine still moves only the HIGH-confidence tree root.
 * Descendants follow automatically because they live inside it.
 */

import { getDriveClient } from '@/server/google-drive';
import { getAllFoldersRecursive, moveFolder } from '@/server/google-drive';
import { APP_CONFIG } from '@/lib/config';
import { getRawSupabaseAdmin } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FolderConfidence = 'HIGH' | 'AMBIGUOUS' | 'CORRECT' | 'COVERED_BY_ROOT';

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
    /** For COVERED_BY_ROOT: the ID of the misplaced tree root that covers this folder */
    coveredByRootId?: string;
    /** Number of descendants covered (populated on HIGH roots) */
    descendantCount?: number;
}

export interface ProjectScanResult {
    projectId: string;
    projectCode: string;
    projectRootId: string;
    correct: FolderClassification[];
    /** HIGH-confidence misplaced tree roots — quarantine candidates */
    misplaced: FolderClassification[];
    /** Ambiguous — no strong evidence, never auto-moved */
    ambiguous: FolderClassification[];
    /** Descendants of HIGH roots — covered by moving their root */
    coveredByRoot: FolderClassification[];
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

// Internal type for Drive-search results (includes parents array)
export interface TaggedFolder {
    id: string;
    name: string;
    parents: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization helpers (pure — exported for unit tests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip the project-code + phase prefix from a single folder name segment.
 *   PRJ-021-PD-Document Control   → Document Control
 *   PRJ-021-RFP-SOW               → SOW
 *   1-PRJ-021-PD-Document Control → Document Control
 *   Document Control              → Document Control  (no-op)
 */
export function normalizeSegment(segment: string, prCode: string): string {
    const escaped = prCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const full = new RegExp(`^(?:\\d+-)?${escaped}-(RFP|PD)-`, 'i');
    const stripped = segment.replace(full, '');
    return stripped !== segment ? stripped : segment;
}

/**
 * Strip project prefixes from every segment of a slash-separated Drive path.
 */
export function normalizeDrivePath(drivePath: string, prCode: string): string {
    return drivePath
        .split('/')
        .map(seg => normalizeSegment(seg, prCode))
        .filter(Boolean)
        .join('/');
}

/**
 * Return true if a folder name matches the project naming convention.
 * Accepts: PRJ-021-PD-*, PRJ-021-RFP-*, 1-PRJ-021-PD-*
 * Rejects: PRJ-0210-PD-* (different project), plain names.
 */
export function matchesProjectPattern(name: string, prCode: string): boolean {
    const escaped = prCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^(?:\\d+-)?${escaped}-(RFP|PD)-`, 'i').test(name);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree-root identification  (pure — exported for unit tests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter the raw Drive search results to only actively misplaced candidates.
 * Excludes:
 * - folders that don't match the strict project naming pattern
 * - folders that are correctly located inside the project root
 * - folders that are already inside the _REPAIR_QUARANTINE subtree
 */
export function filterActiveMisplacedCandidates(
    allTagged: TaggedFolder[],
    prCode: string,
    inRootIds: Set<string>,
    quarantinedIds: Set<string>
): TaggedFolder[] {
    return allTagged.filter(
        f => matchesProjectPattern(f.name, prCode) && !inRootIds.has(f.id) && !quarantinedIds.has(f.id)
    );
}

/**
 * From a list of out-of-root tagged folders, identify the TREE ROOTS.
 *
 * A folder is a tree root when none of its parents is also in the tagged set.
 * This means it is the top of an out-of-root tagged subtree, not a child
 * of another out-of-root tagged folder.
 */
export function identifyTreeRoots(taggedOutOfRoot: TaggedFolder[]): TaggedFolder[] {
    const taggedIds = new Set(taggedOutOfRoot.map(f => f.id));
    return taggedOutOfRoot.filter(f => !f.parents.some(p => taggedIds.has(p)));
}

/**
 * Score a single tree root against the set of in-root segment names.
 *
 * HIGH when the root's normalized name appears as any last-path-segment
 * in the in-root folder tree.  This uses segment-based matching (not
 * full-path matching) so "Commercial Proposal" inside
 * "Bidding/Commercial Proposal" still matches "PRJ-021-RFP-Commercial Proposal".
 *
 * AMBIGUOUS otherwise.
 */
export function scoreTreeRoot(
    root: TaggedFolder,
    inRootSegments: Set<string>,  // lowercased last segments of all in-root folders
    prCode: string
): { confidence: 'HIGH' | 'AMBIGUOUS'; reason: string; matchedSegment?: string } {
    const normalizedSeg = normalizeSegment(root.name, prCode);
    const key = normalizedSeg.toLowerCase();

    if (inRootSegments.has(key)) {
        return {
            confidence: 'HIGH',
            reason: `Out-of-root branch root — in-root segment '${normalizedSeg}' confirmed`,
            matchedSegment: normalizedSeg,
        };
    }

    return {
        confidence: 'AMBIGUOUS',
        reason: `Out-of-root folder — no in-root equivalent for '${normalizedSeg}'`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drive-wide name search for project-tagged folders.
 * Returns ALL folders matching PRJ-XXX anywhere in the Shared Drive.
 */
export async function searchProjectFoldersByPattern(
    prCode: string,
    driveId: string = APP_CONFIG.sharedDriveId
): Promise<TaggedFolder[]> {
    const drive = await getDriveClient();
    const results: TaggedFolder[] = [];
    let pageToken: string | undefined;

    do {
        let resp;
        try {
            resp = await drive.files.list({
                q: `name contains '${prCode}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                ...(driveId ? { driveId, corpora: 'drive' as const } : { corpora: 'allDrives' as const }),
                fields: 'nextPageToken, files(id, name, parents)',
                pageToken,
            });
        } catch (err: any) {
            const msg = err?.message || '';
            if (!driveId || !msg.includes('Shared drive not found')) throw err;
            resp = await drive.files.list({
                q: `name contains '${prCode}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true,
                corpora: 'allDrives',
                fields: 'nextPageToken, files(id, name, parents)',
                pageToken,
            });
        }
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
 * Get or create the _REPAIR_QUARANTINE folder under the specified parent folder.
 */
export async function getOrCreateQuarantineFolder(
    parentId: string,
    driveId: string = APP_CONFIG.sharedDriveId
): Promise<string> {
    const drive = await getDriveClient();

    let resp;
    try {
        resp = await drive.files.list({
            q: `name = '_REPAIR_QUARANTINE' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            ...(driveId ? { driveId, corpora: 'drive' as const } : { corpora: 'allDrives' as const }),
            fields: 'files(id)',
        });
    } catch (err: any) {
        const msg = err?.message || '';
        if (!driveId || !msg.includes('Shared drive not found')) throw err;
        resp = await drive.files.list({
            q: `name = '_REPAIR_QUARANTINE' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            corpora: 'allDrives',
            fields: 'files(id)',
        });
    }

    if (resp.data.files && resp.data.files.length > 0) {
        return resp.data.files[0].id!;
    }

    const created = await drive.files.create({
        requestBody: {
            name: '_REPAIR_QUARANTINE',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        supportsAllDrives: true,
        fields: 'id',
    });

    return created.data.id!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection — Phase 1
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main detection function — tree-root detection model.
 *
 * Per project:
 * 1. Collect all in-root folders recursively
 * 2. Build inRootSegments (lowercase last-segment name set)
 * 3. Search Drive-wide for project-tagged folders
 * 4. Separate: in-root (correct) vs out-of-root (suspect)
 * 5. Identify tree roots from out-of-root set
 * 6. Score each tree root: HIGH or AMBIGUOUS
 * 7. For HIGH roots: recursively scan subtree → mark descendants as COVERED_BY_ROOT
 * 8. For AMBIGUOUS roots: scan subtree → mark descendants as AMBIGUOUS (informational)
 */
export async function detectMisplacedFolders(
    project: {
        id: string;
        pr_number: string;
        name: string;
        drive_folder_id: string | null;
    }
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
        coveredByRoot: [],
        scanDurationMs: 0,
    };

    if (!rootId) {
        return { ...empty, ambiguous: [], scanDurationMs: Date.now() - t0 };
    }

    // ── Step 1: In-root inventory ────────────────────────────────────────────
    const inRootRaw = await getAllFoldersRecursive(rootId);
    const inRootById = new Map(inRootRaw.map(f => [f.id, f]));

    //   (a) Full normalized-path lookup
    const inRootByNormPath = new Map<string, typeof inRootRaw[0]>();
    //   (b) Last-segment lookup (for scoring tree roots)
    const inRootSegments = new Set<string>();
    //   (c) Segment → first matching in-root folder (for matchedCorrectFolderId)
    const inRootBySegment = new Map<string, typeof inRootRaw[0]>();

    for (const f of inRootRaw) {
        const norm = normalizeDrivePath(f.path, prCode);
        if (norm) inRootByNormPath.set(norm.toLowerCase(), f);

        const parts = norm.split('/').filter(Boolean);
        for (const seg of parts) {
            const key = seg.toLowerCase();
            inRootSegments.add(key);
            if (!inRootBySegment.has(key)) inRootBySegment.set(key, f);
        }
    }

    // ── Step 2: Drive-wide search ────────────────────────────────────────────
    let allTagged: TaggedFolder[];
    try {
        allTagged = await searchProjectFoldersByPattern(prCode);
    } catch {
        return { ...empty, scanDurationMs: Date.now() - t0 };
    }

    // ── NEW Step 2.5: Build exclusion list of previously quarantined subtrees ──
    const quarantinedSubtreeIds = new Set<string>();
    try {
        const { data: qLogs } = await getRawSupabaseAdmin()
            .schema('rfp')
            .from('repair_quarantine_log')
            .select('folder_id')
            .eq('project_id', project.id);

        const quarantinedRoots = qLogs?.map(r => r.folder_id) || [];
        for (const qId of quarantinedRoots) {
            quarantinedSubtreeIds.add(qId);
            try {
                // Fetch descendants so the entire quarantined subtree is ignored
                const descendants = await getAllFoldersRecursive(qId);
                for (const d of descendants) quarantinedSubtreeIds.add(d.id);
            } catch {
                // Ignore errors if a quarantined folder was manually deleted later
            }
        }
    } catch (err) {
        console.warn(`[REPAIR] Failed to fetch quarantine logs for ${prCode}`, err);
    }

    // Filter to only correctly-patterned names AND exclude in-root folders AND exclude quarantined trees
    const taggedOutOfRoot = filterActiveMisplacedCandidates(
        allTagged,
        prCode,
        new Set(inRootById.keys()),
        quarantinedSubtreeIds
    );

    if (taggedOutOfRoot.length === 0) {
        // All tagged folders are inside the root — project is clean
        const correct = inRootRaw.map(f => ({
            folder: { id: f.id, name: f.name, parentId: f.parentId, path: f.path, normalizedPath: normalizeDrivePath(f.path, prCode) },
            confidence: 'CORRECT' as const,
            reason: 'Inside project root',
        }));
        return { ...empty, correct, scanDurationMs: Date.now() - t0 };
    }

    // ── Step 3: Identify tree roots ──────────────────────────────────────────
    const treeRoots = identifyTreeRoots(taggedOutOfRoot);
    const taggedOutOfRootIds = new Set(taggedOutOfRoot.map(f => f.id));

    const misplaced: FolderClassification[] = [];
    const ambiguous: FolderClassification[] = [];
    const coveredByRoot: FolderClassification[] = [];
    const classifiedIds = new Set<string>();

    // ── Step 4: Score each tree root + scan its subtree ──────────────────────
    for (const root of treeRoots) {
        const { confidence, reason, matchedSegment } = scoreTreeRoot(root, inRootSegments, prCode);
        const inRootMatch = matchedSegment ? inRootBySegment.get(matchedSegment.toLowerCase()) : undefined;

        // Scan the subtree under this root (to report descendants)
        let subtree: Array<{ id: string; name: string; path: string; parentId: string }> = [];
        try {
            subtree = await getAllFoldersRecursive(root.id);
        } catch {
            // Subtree scan failed — classify root only, no descendant info
        }

        const rootClassification: FolderClassification = {
            folder: {
                id: root.id,
                name: root.name,
                parentId: root.parents[0] || '',
                path: root.name,
                normalizedPath: normalizeSegment(root.name, prCode),
            },
            confidence,
            reason: `${reason}; subtree covers ${subtree.length} descendant(s)`,
            matchedCorrectFolderId: inRootMatch?.id,
            matchedCorrectPath: inRootMatch ? normalizeDrivePath(inRootMatch.path, prCode) : undefined,
            descendantCount: subtree.length,
        };

        if (confidence === 'HIGH') {
            misplaced.push(rootClassification);
            classifiedIds.add(root.id);

            // Mark all subtree members as covered
            for (const member of subtree) {
                if (!inRootById.has(member.id) && !classifiedIds.has(member.id)) {
                    coveredByRoot.push({
                        folder: {
                            id: member.id,
                            name: member.name,
                            parentId: member.parentId,
                            path: member.path,
                            normalizedPath: member.path,
                        },
                        confidence: 'COVERED_BY_ROOT',
                        reason: `Descendant of misplaced root '${root.name}' — quarantined together with root`,
                        coveredByRootId: root.id,
                    });
                    classifiedIds.add(member.id);
                }
            }
        } else {
            // AMBIGUOUS root
            ambiguous.push(rootClassification);
            classifiedIds.add(root.id);

            // Subtree members under an ambiguous root are informational AMBIGUOUS
            for (const member of subtree) {
                if (!inRootById.has(member.id) && !classifiedIds.has(member.id)) {
                    ambiguous.push({
                        folder: {
                            id: member.id,
                            name: member.name,
                            parentId: member.parentId,
                            path: member.path,
                            normalizedPath: member.path,
                        },
                        confidence: 'AMBIGUOUS',
                        reason: `Descendant of ambiguous root '${root.name}'`,
                        coveredByRootId: root.id,
                    });
                    classifiedIds.add(member.id);
                }
            }
        }
    }

    // ── Step 5: Any remaining out-of-root tagged folder not yet classified ───
    for (const f of taggedOutOfRoot) {
        if (!classifiedIds.has(f.id)) {
            ambiguous.push({
                folder: {
                    id: f.id,
                    name: f.name,
                    parentId: f.parents[0] || '',
                    path: f.name,
                    normalizedPath: normalizeSegment(f.name, prCode),
                },
                confidence: 'AMBIGUOUS',
                reason: 'Out-of-root tagged folder — not identified as tree root or descendant',
            });
        }
    }

    // ── Step 6: Correct folders (all in-root) ────────────────────────────────
    const correct: FolderClassification[] = inRootRaw.map(f => ({
        folder: {
            id: f.id,
            name: f.name,
            parentId: f.parentId,
            path: f.path,
            normalizedPath: normalizeDrivePath(f.path, prCode),
        },
        confidence: 'CORRECT' as const,
        reason: 'Inside project root',
    }));

    return {
        projectId: project.id,
        projectCode: prCode,
        projectRootId: rootId,
        correct,
        misplaced,
        ambiguous,
        coveredByRoot,
        scanDurationMs: Date.now() - t0,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quarantine — Phase 2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Move HIGH-confidence misplaced tree roots to the quarantine folder.
 *
 * IMPORTANT: Only the ROOT is moved. Its descendants follow automatically
 * because they live inside the root folder in Drive.
 * Do NOT pass descendants here — pass only the misplaced[] entries.
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
                notes: item.descendantCount
                    ? `${item.descendantCount} descendant(s) quarantined automatically by moving this root`
                    : null,
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
 * Batch scan multiple projects.
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
