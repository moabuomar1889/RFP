import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { inngest } from '@/lib/inngest';
import { getRawSupabaseAdmin } from '@/lib/supabase';
import { requireAdminAuth } from '@/server/admin-auth';
import {
    batchScanProjects,
    getOrCreateQuarantineFolder,
    quarantineMisplacedFolders,
} from '@/server/folder-repair-helpers';
import { getFolder } from '@/server/google-drive';

async function loadProjects(projectCodes?: string[]) {
    const client = getRawSupabaseAdmin();
    let query = client
        .schema('rfp')
        .from('projects')
        .select('id, pr_number, name, drive_folder_id, phase')
        .order('pr_number');

    if (projectCodes && projectCodes.length > 0) {
        query = query.in('pr_number', projectCodes);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
}

async function resolveQuarantineParentId(project: { drive_folder_id: string | null; pr_number: string }) {
    if (!project.drive_folder_id) {
        throw new Error(`Project ${project.pr_number} has no drive folder root`);
    }

    const rootFolder = await getFolder(project.drive_folder_id);
    const parentId = rootFolder?.parents?.[0];

    if (!parentId) {
        throw new Error(`Could not resolve a quarantine parent for ${project.pr_number}`);
    }

    return parentId;
}

export async function GET(request: NextRequest) {
    const auth = await requireAdminAuth(request);
    if (!auth.authorized) return auth.response!;

    const { searchParams } = new URL(request.url);
    const projectFilter = searchParams.get('projects');
    const projectCodes = projectFilter
        ? projectFilter.split(',').map(segment => segment.trim()).filter(Boolean)
        : undefined;

    try {
        const projects = await loadProjects(projectCodes);

        if (projects.length === 0) {
            return NextResponse.json({
                success: true,
                results: [],
                message: 'No projects matched the filter.',
            });
        }

        const results = await batchScanProjects(projects);

        return NextResponse.json({
            success: true,
            results: results.map(result => ({
                projectId: result.projectId,
                projectCode: result.projectCode,
                projectRootId: result.projectRootId,
                correctCount: result.correct.length,
                misplacedCount: result.misplaced.length,
                ambiguousCount: result.ambiguous.length,
                coveredByRootCount: result.coveredByRoot.length,
                scanDurationMs: result.scanDurationMs,
                misplaced: result.misplaced.map(item => ({
                    folderId: item.folder.id,
                    folderName: item.folder.name,
                    normalizedPath: item.folder.normalizedPath,
                    reason: item.reason,
                    confidence: item.confidence,
                    descendantCount: item.descendantCount ?? 0,
                    matchedCorrectFolderId: item.matchedCorrectFolderId,
                    matchedCorrectPath: item.matchedCorrectPath,
                })),
                ambiguous: result.ambiguous.map(item => ({
                    folderId: item.folder.id,
                    folderName: item.folder.name,
                    normalizedPath: item.folder.normalizedPath,
                    reason: item.reason,
                    coveredByRootId: item.coveredByRootId,
                })),
                coveredByRoot: result.coveredByRoot.map(item => ({
                    folderId: item.folder.id,
                    folderName: item.folder.name,
                    coveredByRootId: item.coveredByRootId,
                    reason: item.reason,
                })),
            })),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

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

        if (action === 'quarantine') {
            const scanResults = await batchScanProjects(projects);
            const quarantineResults = [];

            for (const scan of scanResults) {
                const project = projects.find(item => item.id === scan.projectId)!;

                if (scan.misplaced.length === 0) {
                    quarantineResults.push({
                        projectCode: scan.projectCode,
                        moved: 0,
                        skipped: 0,
                        errors: [],
                        message: 'No high-confidence misplaced roots found',
                    });
                    continue;
                }

                const quarantineParentId = await resolveQuarantineParentId(project);
                const quarantineFolderId = await getOrCreateQuarantineFolder(quarantineParentId);
                const result = await quarantineMisplacedFolders(
                    project,
                    scan.misplaced,
                    quarantineFolderId,
                    auth.user?.email || 'admin'
                );

                quarantineResults.push({
                    projectCode: scan.projectCode,
                    quarantineFolderId,
                    moved: result.moved,
                    skipped: result.skipped,
                    errors: result.errors,
                    logEntries: result.logEntries,
                });
            }

            return NextResponse.json({
                success: true,
                action: 'quarantine',
                results: quarantineResults,
            });
        }

        const client = getRawSupabaseAdmin();
        const recoveryResults = [];

        for (const project of projects) {
            const jobId = uuidv4();
            const { error: jobError } = await client.rpc('create_sync_job', {
                p_id: jobId,
                p_job_type: 'enforce_permissions',
                p_status: 'pending',
                p_triggered_by: auth.user?.email || 'admin',
                p_job_details: {
                    action: 'folder_repair_recovery',
                    projectId: project.id,
                    initiatedFrom: 'folder-repair',
                },
            });

            if (jobError) {
                recoveryResults.push({
                    projectCode: project.pr_number,
                    status: 'error',
                    error: jobError.message,
                });
                continue;
            }

            await inngest.send({
                name: 'permissions/enforce',
                data: {
                    jobId,
                    projectId: project.id,
                    metadata: {
                        scope: 'full',
                        initiatedFrom: 'folder-repair',
                    },
                    triggeredBy: auth.user?.email || 'admin',
                },
            });

            recoveryResults.push({
                projectCode: project.pr_number,
                status: 'job_queued',
                jobId,
            });
        }

        return NextResponse.json({
            success: true,
            action: 'recover',
            results: recoveryResults,
            note: 'Enforce jobs queued. The current enforce flow performs its own index rebuild before applying permissions.',
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
