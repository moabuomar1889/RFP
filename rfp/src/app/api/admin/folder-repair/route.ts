import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/server/admin-auth';
import { supabaseAdmin, getRawSupabaseAdmin } from '@/lib/supabase';
import {
    batchScanProjects,
    quarantineMisplacedFolders,
    getOrCreateQuarantineFolder,
} from '@/server/folder-repair-helpers';

// Helper — load projects by optional filter
async function loadProjects(projectIds?: string[]) {
    const client = getRawSupabaseAdmin();
    let query = client
        .schema('rfp')
        .from('projects')
        .select('id, pr_number, name, drive_folder_id, phase')
        .order('pr_number');

    if (projectIds && projectIds.length > 0) {
        query = query.in('pr_number', projectIds);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/folder-repair?mode=scan&projects=PRJ-021,PRJ-022
// Dry-run scan: classify all folders, return structured report. No changes.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    const auth = await requireAdminAuth(request);
    if (!auth.authorized) return auth.response!;

    const { searchParams } = new URL(request.url);
    const projectFilter = searchParams.get('projects');
    const projectIds = projectFilter ? projectFilter.split(',').map(s => s.trim()) : undefined;

    try {
        const projects = await loadProjects(projectIds);

        if (projects.length === 0) {
            return NextResponse.json({ success: true, results: [], message: 'No projects matched the filter.' });
        }

        const results = await batchScanProjects(projects);

        const summary = results.map(r => ({
            projectId: r.projectId,
            projectCode: r.projectCode,
            projectRootId: r.projectRootId,
            correctCount: r.correct.length,
            misplacedCount: r.misplaced.length,
            ambiguousCount: r.ambiguous.length,
            scanDurationMs: r.scanDurationMs,
            misplaced: r.misplaced.map(m => ({
                folderId: m.folder.id,
                folderName: m.folder.name,
                normalizedPath: m.folder.normalizedPath,
                reason: m.reason,
                confidence: m.confidence,
                matchedCorrectFolderId: m.matchedCorrectFolderId,
                matchedCorrectPath: m.matchedCorrectPath,
            })),
            ambiguous: r.ambiguous.map(a => ({
                folderId: a.folder.id,
                folderName: a.folder.name,
                normalizedPath: a.folder.normalizedPath,
                reason: a.reason,
            })),
        }));

        return NextResponse.json({ success: true, results: summary });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/folder-repair
// Body: { action: 'quarantine' | 'recover', projectIds: string[] }
//
// quarantine: move HIGH-confidence misplaced folders → _REPAIR_QUARANTINE
// recover:    rebuild index + trigger enforce for each project
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    const auth = await requireAdminAuth(request);
    if (!auth.authorized) return auth.response!;

    const body = await request.json();
    const { action, projectIds } = body as { action: string; projectIds: string[] };

    if (!action || !['quarantine', 'recover'].includes(action)) {
        return NextResponse.json({ error: 'action must be quarantine or recover' }, { status: 400 });
    }
    if (!projectIds || projectIds.length === 0) {
        return NextResponse.json({ error: 'projectIds is required' }, { status: 400 });
    }

    try {
        const projects = await loadProjects(projectIds);

        // ── QUARANTINE ──────────────────────────────────────────────────────
        if (action === 'quarantine') {
            // Get or create the quarantine folder once
            const quarantineFolderId = await getOrCreateQuarantineFolder();

            // Scan to get current misplaced list
            const scanResults = await batchScanProjects(projects);
            const quarantineResults = [];

            for (const scan of scanResults) {
                if (scan.misplaced.length === 0) {
                    quarantineResults.push({
                        projectCode: scan.projectCode,
                        moved: 0,
                        skipped: 0,
                        errors: [],
                        message: 'No misplaced folders found',
                    });
                    continue;
                }

                const project = projects.find(p => p.id === scan.projectId)!;
                const result = await quarantineMisplacedFolders(
                    project,
                    scan.misplaced,
                    quarantineFolderId,
                    auth.user?.email || 'admin'
                );

                quarantineResults.push({
                    projectCode: scan.projectCode,
                    moved: result.moved,
                    skipped: result.skipped,
                    errors: result.errors,
                    logEntries: result.logEntries,
                });
            }

            return NextResponse.json({
                success: true,
                action: 'quarantine',
                quarantineFolderId,
                results: quarantineResults,
            });
        }

        // ── RECOVER ─────────────────────────────────────────────────────────
        if (action === 'recover') {
            const client = getRawSupabaseAdmin();
            const recoveryResults = [];

            for (const project of projects) {
                try {
                    // Trigger an Enforce job for this project — reuses the existing job system
                    const { data: jobData, error: jobErr } = await supabaseAdmin.rpc('create_job', {
                        p_type: 'enforce_permissions',
                        p_metadata: JSON.stringify({
                            projectIds: [project.id],
                            scope: 'full',
                            triggeredBy: 'folder-repair-recovery',
                        }),
                    });

                    recoveryResults.push({
                        projectCode: project.pr_number,
                        status: jobErr ? 'error' : 'job_queued',
                        jobId: jobData ?? null,
                        error: jobErr?.message ?? null,
                    });
                } catch (err: any) {
                    recoveryResults.push({
                        projectCode: project.pr_number,
                        status: 'error',
                        error: err.message,
                    });
                }
            }

            return NextResponse.json({
                success: true,
                action: 'recover',
                results: recoveryResults,
                note: 'Enforce jobs queued. Monitor progress via Jobs page.',
            });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
