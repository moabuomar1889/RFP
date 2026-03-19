import { inngest } from '@/lib/inngest';
import { supabaseAdmin, getRawSupabaseAdmin } from '@/lib/supabase';
import {
    normalizeProject,
    isValidProject,
    classifyInheritedPermission,
    buildFolderDebugPayload,
    computeDesiredEffectivePolicy,
    type NormalizedProject,
    type FolderPermissions,
    buildPermissionsMap,
    buildEffectivePermissionsMap,
    buildNodeMap,
    normalizeRole,
} from '@/server/audit-helpers';
import { CANONICAL_RANK } from '@/lib/template-engine/types';
import {
    enforceFolder,
    summarizeEnforceResults,
    type DriveEnforceAPI,
} from '@/server/enforce-engine';
import {
    getAllProjects,
    getAllFoldersRecursive,
    normalizeFolderPath,
    createFolder,
    getFolder,
    renameFolder,
    listPermissions,
    addPermission,
    removePermission,
    isProtectedPermission,
    setLimitedAccess,
    setLimitedAccessFast,
    hardResetPermissions,
} from '@/server/google-drive';
import { JOB_STATUS, TASK_STATUS } from '@/lib/config';

// Rate limiting helper
const RATE_LIMIT_DELAY = 100; // ms between API calls (reduced from 300ms for better performance)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============= JOB LOGGING HELPERS =============

/**
 * Write a log entry for a job
 */
async function writeJobLog(
    jobId: string,
    projectId: string | null,
    projectName: string | null,
    folderPath: string | null,
    action: string,
    status: 'info' | 'success' | 'warning' | 'error',
    details: Record<string, unknown> = {}
): Promise<void> {
    try {
        await supabaseAdmin.rpc('insert_job_log', {
            p_job_id: jobId,
            p_project_id: projectId,
            p_project_name: projectName,
            p_folder_path: folderPath,
            p_action: action,
            p_status: status,
            p_details: details
        });
    } catch (err) {
        console.error('Failed to write job log:', err);
    }
}

/**
 * Update job progress
 */
async function updateJobProgress(
    jobId: string,
    progressPercent: number,
    completedTasks: number,
    totalTasks: number,
    status?: string
): Promise<void> {
    try {
        const client = getRawSupabaseAdmin();
        await client.rpc('update_job_progress', {
            p_job_id: jobId,
            p_progress: progressPercent,
            p_completed_tasks: completedTasks,
            p_total_tasks: totalTasks,
            p_status: status || null
        });
    } catch (err) {
        console.error('Failed to update job progress:', err);
    }
}

/**
 * Sync template to ALL projects
 */
export const syncTemplateAll = inngest.createFunction(
    {
        id: 'sync-template-all',
        name: 'Sync Template to All Projects',
        retries: 3,
        concurrency: { limit: 1 }, // Only one full sync at a time
    },
    { event: 'template/sync.all' },
    async ({ event, step }) => {
        const { jobId, templateVersion, triggeredBy } = event.data;

        // Update job to running
        await step.run('update-job-running', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('sync_jobs')
                .update({
                    status: JOB_STATUS.RUNNING,
                    started_at: new Date().toISOString()
                })
                .eq('id', jobId);
        });

        // Get all projects
        const projects = await step.run('get-projects', async () => {
            const { data } = await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .select('*')
                .order('pr_number');
            return data || [];
        });

        // Get template
        const template = await step.run('get-template', async () => {
            const { data } = await supabaseAdmin
                .schema('rfp')
                .from('template_versions')
                .select('*')
                .eq('version_number', templateVersion)
                .single();
            return data;
        });

        if (!template) {
            await supabaseAdmin
                .schema('rfp')
                .from('sync_jobs')
                .update({
                    status: JOB_STATUS.FAILED,
                    error_summary: 'Template not found',
                    completed_at: new Date().toISOString()
                })
                .eq('id', jobId);
            return { success: false, error: 'Template not found' };
        }

        // Update total tasks
        await supabaseAdmin
            .schema('rfp')
            .from('sync_jobs')
            .update({ total_tasks: projects.length })
            .eq('id', jobId);

        // Process each project
        for (let i = 0; i < projects.length; i++) {
            const project = projects[i];

            await step.run(`sync-project-${project.pr_number}`, async () => {
                try {
                    // Sync project with template
                    await syncProjectWithTemplate(project, template.template_json);

                    // Update project sync status
                    await supabaseAdmin
                        .schema('rfp')
                        .from('projects')
                        .update({
                            synced_version: templateVersion,
                            last_synced_at: new Date().toISOString(),
                        })
                        .eq('id', project.id);

                    // Mark task complete
                    await supabaseAdmin
                        .schema('rfp')
                        .from('sync_tasks')
                        .insert({
                            job_id: jobId,
                            project_id: project.id,
                            task_type: 'full_sync',
                            task_details: { template_version: templateVersion },
                            status: TASK_STATUS.COMPLETED,
                            completed_at: new Date().toISOString(),
                        });
                } catch (error) {
                    await supabaseAdmin
                        .schema('rfp')
                        .from('sync_tasks')
                        .insert({
                            job_id: jobId,
                            project_id: project.id,
                            task_type: 'full_sync',
                            task_details: { template_version: templateVersion },
                            status: TASK_STATUS.FAILED,
                            last_error: error instanceof Error ? error.message : 'Unknown error',
                        });
                }
            });

            // Update progress
            await supabaseAdmin.rpc('rfp.update_job_progress', { p_job_id: jobId });
        }

        // Mark job complete
        await step.run('complete-job', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('sync_jobs')
                .update({
                    status: JOB_STATUS.COMPLETED,
                    completed_at: new Date().toISOString()
                })
                .eq('id', jobId);
        });

        return { success: true, projectsProcessed: projects.length };
    }
);

/**
 * Sync only template changes (diff-based)
 */
export const syncTemplateChanges = inngest.createFunction(
    {
        id: 'sync-template-changes',
        name: 'Sync Template Changes',
        retries: 3,
        concurrency: { limit: 1 },
    },
    { event: 'template/sync.changes' },
    async ({ event, step }) => {
        const { jobId, fromVersion, toVersion, changeIds, triggeredBy } = event.data;

        // Update job to running
        await step.run('update-job-running', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('sync_jobs')
                .update({
                    status: JOB_STATUS.RUNNING,
                    started_at: new Date().toISOString()
                })
                .eq('id', jobId);
        });

        // Get changes
        const changes = await step.run('get-changes', async () => {
            const { data } = await supabaseAdmin
                .schema('rfp')
                .from('template_changes')
                .select('*')
                .in('id', changeIds);
            return data || [];
        });

        // Get all projects
        const projects = await step.run('get-projects', async () => {
            const { data } = await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .select('*')
                .lt('synced_version', toVersion)
                .order('pr_number');
            return data || [];
        });

        // Process each change for each project
        for (const project of projects) {
            for (const change of changes) {
                await step.run(`apply-change-${project.pr_number}-${change.id}`, async () => {
                    await applyChangeToProject(project, change);
                    await sleep(RATE_LIMIT_DELAY);
                });
            }

            // Update project sync status
            await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .update({
                    synced_version: toVersion,
                    last_synced_at: new Date().toISOString(),
                })
                .eq('id', project.id);
        }

        // Mark job complete
        await step.run('complete-job', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('sync_jobs')
                .update({
                    status: JOB_STATUS.COMPLETED,
                    completed_at: new Date().toISOString()
                })
                .eq('id', jobId);
        });

        return { success: true, changesApplied: changes.length * projects.length };
    }
);

/**
 * Enforce permissions on projects (detect and revert unauthorized changes)
 */
export const enforcePermissions = inngest.createFunction(
    {
        id: 'enforce-permissions',
        name: 'Enforce Strict Permissions',
        retries: 0,  // DO NOT RETRY — retries restart from scratch, re-resetting all permissions
        concurrency: { limit: 1 },
    },
    { event: 'permissions/enforce' },
    async ({ event, step }) => {
        const { jobId, projectId, projectIds, all, triggeredBy, metadata } = event.data;

        // Convert single projectId to array for uniform handling
        const targetProjectIds = projectId ? [projectId] : (projectIds || []);

        // Update job to running and log start
        await step.run('update-job-running', async () => {
            await supabaseAdmin.rpc('update_job_progress', {
                p_job_id: jobId,
                p_progress: 0,
                p_completed_tasks: 0,
                p_total_tasks: 0,
                p_status: JOB_STATUS.RUNNING
            });
            await writeJobLog(jobId, null, null, null, 'job_started', 'info', { triggeredBy });
        });

        // Get protected principals
        const protectedPrincipals = await step.run('get-protected', async () => {
            const { data } = await supabaseAdmin.rpc('get_setting', { p_key: 'protected_principals' });
            try {
                return data ? JSON.parse(data) : ['mo.abuomar@dtgsa.com'];
            } catch {
                return ['mo.abuomar@dtgsa.com'];
            }
        });

        // Get projects to enforce (using get_projects RPC — list_projects does not exist)
        const projects: NormalizedProject[] = await step.run('get-projects', async () => {
            const client = getRawSupabaseAdmin();
            const { data, error } = await client.rpc('get_projects', { p_status: null, p_phase: null });

            console.log('get_projects result:', { error, count: data?.length });

            if (error) {
                console.error('Error fetching projects:', error);
                throw new Error(`Failed to fetch projects: ${error.message}`);
            }

            // Normalize all projects and filter invalid ones
            const normalized = (data || []).map((p: any) => normalizeProject(p)).filter((p: NormalizedProject) => {
                if (!isValidProject(p)) {
                    console.warn('[ENFORCE] Skipping project with missing data:', JSON.stringify(p));
                    return false;
                }
                return true;
            });

            // Filter to target projects if provided
            if (targetProjectIds.length > 0) {
                return normalized.filter((p: NormalizedProject) => targetProjectIds.includes(p.id));
            }
            return normalized;
        });

        const totalProjects = projects.length;
        await writeJobLog(jobId, null, null, null, 'projects_found', 'info', { count: totalProjects });

        if (totalProjects === 0) {
            await writeJobLog(jobId, null, null, null, 'no_projects', 'warning', {});
            await updateJobProgress(jobId, 100, 0, 0, JOB_STATUS.COMPLETED);
            return { success: true, totalViolations: 0, totalReverted: 0, totalAdded: 0 };
        }

        let totalViolations = 0;
        let totalReverted = 0;
        let totalAdded = 0;
        let totalRemoved = 0;
        let totalErrors = 0;
        let completedProjects = 0;

        // Enforce permissions for each project using RESET-THEN-APPLY approach
        for (let i = 0; i < projects.length; i++) {
            const project = projects[i];

            await step.run(`enforce-project-${project.id}`, async () => {
                await writeJobLog(jobId, project.id, project.name, null, 'enforce_start', 'info', {
                    pr_number: project.prNumber,
                    phase: project.phase
                });

                try {
                    // Use NEW reset-then-apply enforcement function
                    const result = await enforceProjectPermissionsWithReset(project, protectedPrincipals, jobId, metadata);

                    totalRemoved += result.removed;
                    totalAdded += result.added;
                    totalErrors += result.errors;

                    await writeJobLog(jobId, project.id, project.name, null, 'enforce_complete', 'success', {
                        removed: result.removed,
                        added: result.added,
                        errors: result.errors
                    });

                    // Update progress
                    const client = getRawSupabaseAdmin();
                    await client.rpc('update_job_progress', {
                        p_job_id: jobId,
                        p_progress: Math.round(((i + 1) / projects.length) * 100),
                        p_completed_tasks: i + 1,
                        p_total_tasks: projects.length,
                        p_status: JOB_STATUS.RUNNING
                    });
                } catch (err: any) {
                    await writeJobLog(jobId, project.id, project.name, null, 'enforce_failed', 'error', {
                        error: err.message,
                        stack: err.stack
                    });
                }
            });
        }
        // Mark job complete
        await step.run('complete-job', async () => {
            await writeJobLog(jobId, null, null, null, 'job_completed', 'success', {
                totalProjects,
                removed: totalRemoved,
                added: totalAdded,
                errors: totalErrors
            });
            await updateJobProgress(jobId, 100, totalProjects, totalProjects, JOB_STATUS.COMPLETED);
        });

        return { success: true, removed: totalRemoved, added: totalAdded, errors: totalErrors };
    }
);

/**
 * Build/rebuild folder index for projects
 */
export const buildFolderIndex = inngest.createFunction(
    {
        id: 'build-folder-index',
        name: 'Build Folder Index',
        retries: 2,
        concurrency: { limit: 1 },
    },
    { event: 'folder-index/build' },
    async ({ event, step }) => {
        const { jobId, projectIds, triggeredBy } = event.data;



        // Get projects using RPC (using get_projects — list_projects does not exist)
        const projects = await step.run('get-projects', async () => {
            const client = getRawSupabaseAdmin();
            const { data, error } = await client.rpc('get_projects', { p_status: null, p_phase: null });

            console.log('get_projects result:', { error, count: data?.length });

            if (error) {
                console.error('Error fetching projects:', error);
                throw new Error(`Failed to fetch projects: ${error.message}`);
            }

            const normalized = (data || []).map((p: any) => normalizeProject(p)).filter((p: NormalizedProject) => isValidProject(p));

            if (projectIds && projectIds.length > 0) {
                return normalized.filter((p: NormalizedProject) => projectIds.includes(p.id));
            }
            return normalized;
        });

        // Update job to running with total projects count
        const totalProjects = projects.length;
        await step.run('update-job-running', async () => {
            const client = getRawSupabaseAdmin();
            await client.rpc('update_job_progress', {
                p_job_id: jobId,
                p_progress: 0,
                p_completed_tasks: 0,
                p_total_tasks: totalProjects,
                p_status: JOB_STATUS.RUNNING
            });
        });

        // Build index for each project
        let indexedCount = 0;
        let completedProjects = 0;
        for (const project of projects) {
            const stepResult = await step.run(`index-${project.prNumber}`, async () => {
                const client = getRawSupabaseAdmin();

                console.log(`Indexing project ${project.prNumber} (phase: ${project.phase}) with drive_folder_id: ${project.driveFolderId}`);

                if (!project.driveFolderId) {
                    console.error(`Project ${project.prNumber} has no drive_folder_id`);
                    return { foldersFound: 0, foldersUpserted: 0, error: 'No drive_folder_id' };
                }

                // ── Step A: DELETE stale entries before re-indexing ──
                await client.rpc('delete_project_folder_index', { p_project_id: project.id });

                // ── Step B: Load template and build phase-filtered paths ──
                const { data: templateData } = await client.rpc('get_active_template');
                const template = Array.isArray(templateData) ? templateData[0] : templateData;
                const templatePaths = new Set<string>();

                if (template?.template_json) {
                    const templateNodes = Array.isArray(template.template_json)
                        ? template.template_json
                        : template.template_json.template || [];

                    // Phase-aware: collect template paths
                    // - bidding: only Bidding phase
                    // - execution: BOTH Bidding + Project Delivery (PD projects keep RFP folders)
                    const projectPhase = project.phase || 'bidding';
                    const phasesToIndex = projectPhase === 'bidding'
                        ? ['Bidding']
                        : ['Bidding', 'Project Delivery'];

                    function collectPaths(node: any, parentPath = '') {
                        const name = node.name || node.text || '';
                        const current = parentPath ? `${parentPath}/${name}` : name;
                        if (name) templatePaths.add(current);
                        const children = node.children || node.nodes || [];
                        for (const child of children) collectPaths(child, current);
                    }

                    for (const phaseNodeName of phasesToIndex) {
                        const phaseNode = templateNodes.find((n: any) => {
                            const nodeName = (n.name || n.text || '').trim();
                            return nodeName === phaseNodeName;
                        });

                        if (phaseNode?.children) {
                            for (const child of phaseNode.children) collectPaths(child, '');
                        } else {
                            console.warn(`Phase node '${phaseNodeName}' not found for ${project.prNumber}`);
                        }
                    }
                }
                console.log(`Template has ${templatePaths.size} paths for phase '${project.phase}'`);

                // ── Step C: Get all folders from Drive ──
                let folders: Array<{ id: string; name: string; path: string; parentId: string }> = [];
                try {
                    folders = await getAllFoldersRecursive(project.driveFolderId);
                    console.log(`Found ${folders.length} Drive folders for ${project.prNumber}`);
                } catch (driveError: any) {
                    console.error(`Drive API error for ${project.prNumber}:`, driveError.message);
                    return { foldersFound: 0, foldersUpserted: 0, error: driveError.message };
                }

                // ── Step D: Path normalization ──
                const projectCode = project.prNumber || '';
                function normalizeDrivePath(drivePath: string): string {
                    const segments = drivePath.split('/');
                    const remaining = segments.slice(1); // Skip project root
                    const cleaned = remaining.map(seg => {
                        const escaped = projectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const prefixPattern = new RegExp(`^\\d+-${escaped}-(RFP|PD)-`, 'i');
                        let c = seg.replace(prefixPattern, '');
                        if (c === seg) {
                            const alt = new RegExp(`^${escaped}-(RFP|PD)-`, 'i');
                            c = seg.replace(alt, '');
                        }
                        return c;
                    });
                    return cleaned.filter(s => s).join('/');
                }

                // ── Step E: Fuzzy matching helper (Levenshtein distance) ──
                function editDistance(a: string, b: string): number {
                    const la = a.length, lb = b.length;
                    if (la === 0) return lb;
                    if (lb === 0) return la;
                    const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));
                    for (let i = 0; i <= la; i++) dp[i][0] = i;
                    for (let j = 0; j <= lb; j++) dp[0][j] = j;
                    for (let i = 1; i <= la; i++) {
                        for (let j = 1; j <= lb; j++) {
                            dp[i][j] = Math.min(
                                dp[i - 1][j] + 1,
                                dp[i][j - 1] + 1,
                                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                            );
                        }
                    }
                    return dp[la][lb];
                }

                function findClosestTemplatePath(normalized: string): string | null {
                    // Exact match first
                    if (templatePaths.has(normalized)) return normalized;
                    // Case-insensitive match
                    for (const tp of templatePaths) {
                        if (tp.toLowerCase() === normalized.toLowerCase()) return tp;
                    }
                    // Fuzzy match: tolerate small edit distance (typos like Propsal→Proposal)
                    let bestMatch: string | null = null;
                    let bestDist = Infinity;
                    for (const tp of templatePaths) {
                        const dist = editDistance(normalized.toLowerCase(), tp.toLowerCase());
                        if (dist < bestDist && dist <= 2) {
                            bestDist = dist;
                            bestMatch = tp;
                        }
                    }
                    if (bestMatch) {
                        console.log(`Fuzzy match: '${normalized}' → '${bestMatch}' (distance: ${bestDist})`);
                    }
                    return bestMatch;
                }

                // ── Step F: Upsert matched folders (dedup by matched path) ──
                let upsertedCount = 0;
                let skippedCount = 0;
                const seenNormalized = new Set<string>();

                for (const folder of folders) {
                    const normalized = normalizeDrivePath(folder.path);
                    if (!normalized) { skippedCount++; continue; }

                    // Find matching template path (exact, case-insensitive, or fuzzy)
                    const matchedPath = templatePaths.size > 0 ? findClosestTemplatePath(normalized) : normalized;

                    if (!matchedPath) {
                        skippedCount++;
                        continue;
                    }

                    // Dedup by matched template path
                    if (seenNormalized.has(matchedPath)) {
                        console.log(`Dedup skip: ${folder.path} → ${matchedPath}`);
                        skippedCount++;
                        continue;
                    }

                    seenNormalized.add(matchedPath);

                    const { error } = await client.rpc('upsert_folder_index', {
                        p_project_id: project.id,
                        p_template_path: folder.path,
                        p_drive_folder_id: folder.id,
                        p_normalized_template_path: matchedPath,
                    });

                    if (error) {
                        console.error(`Failed to upsert folder ${folder.path}:`, error);
                    } else {
                        upsertedCount++;
                    }
                }

                console.log(`Indexed ${upsertedCount}, skipped ${skippedCount} for ${project.prNumber} (phase: ${project.phase})`);
                await sleep(RATE_LIMIT_DELAY);
                return { foldersFound: folders.length, foldersUpserted: upsertedCount };
            });

            indexedCount += (stepResult as any)?.foldersUpserted || 0;
            completedProjects++;

            // Update progress after each project
            await step.run(`progress-${project.prNumber}`, async () => {
                const client = getRawSupabaseAdmin();
                const progress = Math.round((completedProjects / totalProjects) * 100);
                const result = stepResult as any;
                const foldersFound = result?.foldersFound || 0;
                const foldersUpserted = result?.foldersUpserted || 0;

                await client.rpc('update_job_progress', {
                    p_job_id: jobId,
                    p_progress: progress,
                    p_completed_tasks: completedProjects,
                    p_total_tasks: totalProjects,
                    p_status: JOB_STATUS.RUNNING
                });

                // Insert detailed log
                await client.rpc('insert_sync_task', {
                    p_job_id: jobId,
                    p_project_id: project.id,
                    p_task_type: 'folder_index',
                    p_task_details: {
                        pr_number: project.prNumber,
                        foldersFound,
                        foldersUpserted,
                        message: `Indexed ${foldersUpserted} of ${foldersFound} folders`
                    },
                    p_status: 'completed'
                });
            });
        }

        // Mark job complete
        await step.run('complete-job', async () => {
            const client = getRawSupabaseAdmin();
            await client.rpc('update_job_progress', {
                p_job_id: jobId,
                p_progress: 100,
                p_completed_tasks: totalProjects,
                p_total_tasks: totalProjects,
                p_status: JOB_STATUS.COMPLETED
            });
        });

        return { success: true, projectsIndexed: totalProjects, foldersIndexed: indexedCount };
    }
);

/**
 * Reconcile folder index (detect drift)
 */
export const reconcileFolderIndex = inngest.createFunction(
    {
        id: 'reconcile-folder-index',
        name: 'Reconcile Folder Index',
        retries: 2,
        concurrency: { limit: 1 },
    },
    { event: 'folder-index/reconcile' },
    async ({ event, step }) => {
        const { jobId, projectIds, triggeredBy } = event.data;

        // Update job to running
        await step.run('update-job-running', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('sync_jobs')
                .update({
                    status: JOB_STATUS.RUNNING,
                    started_at: new Date().toISOString()
                })
                .eq('id', jobId);
        });

        // Get projects
        let projectsQuery = supabaseAdmin
            .schema('rfp')
            .from('projects')
            .select('*');

        if (projectIds && projectIds.length > 0) {
            projectsQuery = projectsQuery.in('id', projectIds);
        }

        const projects = await step.run('get-projects', async () => {
            const { data } = await projectsQuery.order('pr_number');
            return data || [];
        });

        let totalIssues = 0;

        for (const project of projects) {
            await step.run(`reconcile-${project.pr_number}`, async () => {
                const issues = await reconcileProjectIndex(project);
                totalIssues += issues;
            });
        }

        // Mark job complete
        await step.run('complete-job', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('sync_jobs')
                .update({
                    status: JOB_STATUS.COMPLETED,
                    completed_at: new Date().toISOString(),
                    metadata: { totalIssues }
                })
                .eq('id', jobId);
        });

        return { success: true, totalIssues };
    }
);

// Helper functions

async function syncProjectWithTemplate(project: any, templateJson: any): Promise<void> {
    // Implementation: Create/update folders based on template
    // This would iterate through the template structure and ensure
    // each folder exists with correct permissions
    console.log(`Syncing project ${project.pr_number} with template`);
}

async function applyChangeToProject(project: any, change: any): Promise<void> {
    // Get folder from index
    const { data: folderIndex } = await supabaseAdmin
        .schema('rfp')
        .from('folder_index')
        .select('*')
        .eq('project_id', project.id)
        .eq('template_path', change.affected_path)
        .single();

    if (!folderIndex && change.change_type !== 'create_folder') {
        console.log(`Folder not found for path ${change.affected_path}`);
        return;
    }

    switch (change.change_type) {
        case 'create_folder':
            // Create folder
            break;
        case 'rename_folder':
            if (folderIndex) {
                await renameFolder(folderIndex.drive_folder_id, change.change_details.new_name);
            }
            break;
        case 'add_permission':
            if (folderIndex) {
                await addPermission(
                    folderIndex.drive_folder_id,
                    change.change_details.type,
                    change.change_details.role,
                    change.change_details.email
                );
            }
            break;
        case 'remove_permission':
            // Remove permission
            break;
    }
}

// NOTE: enforceProjectPermissionsWithLogging was removed (dead code).
// The enforce-permissions job uses enforceProjectPermissionsWithReset exclusively.

/**
 * Rebuild folder index for a single project.
 * Extracted as a reusable helper so both buildFolderIndex and enforce can use it.
 *
 * KEY BEHAVIOUR (node_id identity system):
 * - Before deleting stale entries, snapshot existing drive_folder_id → template_node_id bindings.
 * - After re-indexing from Drive, restore the binding for any already-known drive_folder_id.
 * - On FIRST index (no prior binding): attempt path match → store template_node_id.
 * - Folders with no path match → upserted with template_node_id = NULL (surfaced as unmapped).
 * - The upsert_folder_index RPC uses COALESCE so existing bindings are NEVER overwritten.
 */
async function rebuildFolderIndexForProject(
    project: any
): Promise<{ foldersFound: number; foldersUpserted: number; unmappedCount: number }> {
    const client = getRawSupabaseAdmin();
    const prNumber = project.prNumber || project.pr_number;
    const driveFolderId = project.driveFolderId || project.drive_folder_id;
    const projectPhase = project.phase || 'bidding';
    const projectId = project.id;

    if (!driveFolderId) {
        return { foldersFound: 0, foldersUpserted: 0, unmappedCount: 0 };
    }

    // ── Step A: Snapshot existing template_node_id bindings ──
    // Save drive_folder_id → template_node_id for all currently indexed folders
    // BEFORE we delete them. This preserves bindings set manually (Option B) or
    // from a previous run, even after re-index.
    const { data: existingRows } = await client
        .schema('rfp')
        .from('folder_index')
        .select('drive_folder_id, template_node_id')
        .eq('project_id', projectId);

    const existingNodeIdMap = new Map<string, string | null>(); // drive_folder_id → template_node_id
    for (const row of (existingRows || [])) {
        if (row.template_node_id) {
            existingNodeIdMap.set(row.drive_folder_id, row.template_node_id);
        }
    }
    console.log(`[rebuildFolderIndex] Preserved ${existingNodeIdMap.size} existing template_node_id bindings for ${prNumber}`);

    // ── Step B: Delete stale entries ──
    await client.rpc('delete_project_folder_index', { p_project_id: projectId });

    // ── Step C: Load template — build path→node_id map for initial binding ──
    const { data: templateData } = await client.rpc('get_active_template');
    const template = Array.isArray(templateData) ? templateData[0] : templateData;
    const templatePaths = new Set<string>();
    const pathToNodeId = new Map<string, string>(); // normalized_path → node_id

    if (template?.template_json) {
        const templateNodes = Array.isArray(template.template_json)
            ? template.template_json
            : template.template_json.template || [];

        const phasesToIndex = projectPhase === 'bidding'
            ? ['Bidding']
            : ['Bidding', 'Project Delivery'];

        function collectPathsAndIds(node: any, parentPath = '') {
            const name = node.name || node.text || '';
            const current = parentPath ? `${parentPath}/${name}` : name;
            if (name) {
                templatePaths.add(current);
                if (node.node_id) {
                    pathToNodeId.set(current, node.node_id);
                }
            }
            const children = node.children || node.nodes || [];
            for (const child of children) collectPathsAndIds(child, current);
        }

        for (const phaseNodeName of phasesToIndex) {
            const phaseNode = templateNodes.find((n: any) => {
                const nodeName = (n.name || n.text || '').trim();
                return nodeName === phaseNodeName;
            });

            if (phaseNode?.children) {
                for (const child of phaseNode.children) collectPathsAndIds(child, '');
            } else {
                console.warn(`[rebuildFolderIndex] Phase '${phaseNodeName}' not found for ${prNumber}`);
            }
        }
    }
    console.log(`[rebuildFolderIndex] Template has ${templatePaths.size} paths, ${pathToNodeId.size} with node_ids for ${prNumber}`);

    // ── Step D: Get all folders from Drive ──
    const folders = await getAllFoldersRecursive(driveFolderId);

    // ── Step E: Path normalization ──
    const projectCode = prNumber || '';
    function normalizeDrivePath(drivePath: string): string {
        const segments = drivePath.split('/');
        const cleaned = segments.map(seg => {
            const escaped = projectCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const prefixPattern = new RegExp(`^\\d+-${escaped}-(RFP|PD)-`, 'i');
            let c = seg.replace(prefixPattern, '');
            if (c === seg) {
                const alt = new RegExp(`^${escaped}-(RFP|PD)-`, 'i');
                c = seg.replace(alt, '');
            }
            return c;
        });
        return cleaned.filter(s => s).join('/');
    }

    // ── Step F: Exact path match (no fuzzy) ──
    function findTemplateMatch(normalized: string): { path: string; nodeId: string | null } | null {
        if (templatePaths.has(normalized)) {
            return { path: normalized, nodeId: pathToNodeId.get(normalized) ?? null };
        }
        for (const tp of templatePaths) {
            if (tp.toLowerCase() === normalized.toLowerCase()) {
                return { path: tp, nodeId: pathToNodeId.get(tp) ?? null };
            }
        }
        return null; // No match — folder is NOT a template folder (user-created or unmapped)
    }

    // ── Step G: Upsert matched folders ──
    let upsertedCount = 0;
    let unmappedCount = 0;
    const seenNormalized = new Set<string>();

    for (const folder of folders) {
        const normalized = normalizeDrivePath(folder.path);
        if (!normalized) continue;

        const match = templatePaths.size > 0 ? findTemplateMatch(normalized) : null;

        if (!match) {
            // User-created folder or not a template folder — skip silently
            console.log(`[rebuildFolderIndex] UNMATCHED (user folder?): '${folder.path}' → '${normalized}'`);
            continue;
        }

        if (seenNormalized.has(match.path)) continue;
        seenNormalized.add(match.path);

        // Determine template_node_id:
        // 1. Use previously saved binding (Option B manual mapping or prior run)
        // 2. Fall back to path-derived node_id (first-time index)
        // 3. NULL if path match found but template has no node_id (not yet stamped)
        const resolvedNodeId =
            existingNodeIdMap.get(folder.id) ?? // Preserved from before delete
            match.nodeId ??                       // Derived from path→node_id map
            null;

        if (!resolvedNodeId) {
            unmappedCount++;
            console.log(`[rebuildFolderIndex] NEEDS MAPPING: '${match.path}' — run stamp-node-ids or use /folder-mapping`);
        }

        const { error } = await client.rpc('upsert_folder_index', {
            p_project_id: projectId,
            p_template_path: folder.path,
            p_drive_folder_id: folder.id,
            p_normalized_template_path: match.path,
            p_template_node_id: resolvedNodeId,
        });

        if (!error) upsertedCount++;
    }

    console.log(`[rebuildFolderIndex] ${prNumber}: indexed ${upsertedCount}/${folders.length} folders, ${unmappedCount} unmapped`);
    return { foldersFound: folders.length, foldersUpserted: upsertedCount, unmappedCount };
}

/**
 * Auto-create missing folders from template (respects project phase)
 * - Bidding project → Creates Bidding folders only
 * - Project Delivery → Creates BOTH Bidding + Project Delivery folders
 */
async function createMissingFoldersFromTemplate(
    project: any,
    templateJson: any,
    projectPhase: string,
    jobId: string
): Promise<{ created: number; errors: number }> {
    let created = 0;
    let errors = 0;

    // Get phase nodes from template based on project phase
    const templateNodes = Array.isArray(templateJson) ? templateJson : templateJson.template || [];

    // If project is in "project delivery" → create folders for BOTH phases
    // If project is in "bidding" → create folders for Bidding only
    const phaseNamesToProcess = projectPhase === 'bidding'
        ? ['Bidding']
        : ['Bidding', 'Project Delivery'];

    const phaseNodes = templateNodes.filter((n: any) =>
        phaseNamesToProcess.includes((n.name || n.text || '').trim())
    );

    if (phaseNodes.length === 0) {
        return { created: 0, errors: 0 };
    }

    // Build list of ALL expected folders from template
    const expectedFolders = new Map<string, any>(); // path -> templateNode

    function collectTemplateFolders(node: any, parentPath = '') {
        const nodeName = node.name || node.text || '';
        const currentPath = parentPath ? `${parentPath}/${nodeName}` : nodeName;
        expectedFolders.set(currentPath, node);

        const children = node.children || node.nodes || [];
        for (const child of children) {
            collectTemplateFolders(child, currentPath);
        }
    }

    // Collect all folders from the selected phase(s)
    for (const phaseNode of phaseNodes) {
        for (const child of phaseNode.children || []) {
            collectTemplateFolders(child, '');
        }
    }

    // Get existing folders from Drive (via folder_index)
    const { data: existingFolders } = await supabaseAdmin.rpc('list_project_folders', {
        p_project_id: project.id
    });

    const existingPaths = new Set(
        (existingFolders || []).map((f: any) => f.normalized_template_path || f.template_path)
    );
    console.log(`[createMissing] existingPaths (${existingPaths.size}): [${[...existingPaths].slice(0, 15).join(', ')}...]`);

    // Find missing folders
    const missingFolders: Array<{ path: string; node: any }> = [];
    for (const [path, node] of expectedFolders.entries()) {
        if (!existingPaths.has(path)) {
            missingFolders.push({ path, node });
        }
    }

    if (missingFolders.length === 0) {
        return { created: 0, errors: 0 };
    }

    // Sort by depth (create parent folders first)
    missingFolders.sort((a, b) => {
        const depthA = a.path.split('/').length;
        const depthB = b.path.split('/').length;
        return depthA - depthB;
    });

    // Create each missing folder with project naming convention
    // e.g. "PRJ-017-PD-Construction" not bare "Construction"
    const prCode = project.prNumber || project.pr_number || project.project_code || '';
    const phaseSuffix = projectPhase === 'bidding' ? 'RFP' : 'PD';

    for (const { path, node } of missingFolders) {
        try {
            // Find parent folder ID
            const pathParts = path.split('/');
            const templateName = pathParts[pathParts.length - 1];
            // Apply project naming convention: PRJ-017-PD-{TemplateName}
            const folderName = prCode ? `${prCode}-${phaseSuffix}-${templateName}` : templateName;
            let parentId = project.google_folder_id; // Default to project root

            if (pathParts.length > 1) {
                // Find parent in existing folders
                const parentPath = pathParts.slice(0, -1).join('/');
                const parentFolder = (existingFolders || []).find(
                    (f: any) => (f.normalized_template_path || f.template_path) === parentPath
                );
                parentId = parentFolder?.drive_folder_id || parentFolder?.google_folder_id || parentId;
            }

            // Create folder in Google Drive with project-prefixed name
            const newFolder = await createFolder(folderName, parentId);
            await sleep(RATE_LIMIT_DELAY);

            // Immediately index the new folder (avoids needing a full rebuild later)
            const prNum = project.prNumber || project.pr_number || '';
            const client = getRawSupabaseAdmin();
            await client.rpc('upsert_folder_index', {
                p_project_id: project.id,
                p_template_path: `${prNum}/${path}`,
                p_drive_folder_id: newFolder.id,
                p_normalized_template_path: path,
            });

            // Also add to existingFolders so child folders can find their parent
            (existingFolders as any[]).push({
                drive_folder_id: newFolder.id,
                google_folder_id: newFolder.id,
                normalized_template_path: path,
                template_path: `${prNum}/${path}`,
            });

            await writeJobLog(jobId, project.id, project.name, path, 'folder_created', 'success', {
                folder_id: newFolder.id,
                parent_id: parentId
            });

            created++;

        } catch (err: any) {
            await writeJobLog(jobId, project.id, project.name, path, 'folder_create_failed', 'error', {
                error: err.message
            });
            errors++;
        }
    }

    return { created, errors };
}

/**
 * NEW: Enforce permissions using RESET-THEN-APPLY approach
 * This eliminates conflicts with Limited Access and role modifications
 * 
 * PHASE 0: Auto-rebuild folder index (ensures fresh data)
 * PHASE 1: Remove all permissions (except protected)
 * PHASE 2: Clear Limited Access  
 * PHASE 3: Apply template from scratch
 */
async function enforceProjectPermissionsWithReset(
    project: any,
    protectedPrincipals: string[],
    jobId: string,
    eventMetadata?: { scope?: string; targetPath?: string } | null
): Promise<{ removed: number; added: number; errors: number }> {
    let removed = 0;
    let added = 0;
    let errors = 0;


    console.log(`\n========== RESET-THEN-APPLY ENFORCEMENT FOR ${project.prNumber || project.pr_number} ==========`);

    // Step 0: Only rebuild folder index if the project has no indexed folders
    const { data: existingIndex } = await supabaseAdmin.rpc('list_project_folders', { p_project_id: project.id });
    if (!existingIndex || existingIndex.length === 0) {
        console.log(`[ENFORCE] Step 0: No index found, building for ${project.prNumber || project.pr_number}...`);
        try {
            const indexResult = await rebuildFolderIndexForProject(project);
            console.log(`[ENFORCE] Index built: ${indexResult.foldersUpserted} folders indexed`);
        } catch (indexErr: any) {
            console.error(`[ENFORCE] Index rebuild failed (continuing):`, indexErr.message);
            await writeJobLog(jobId, project.id, project.name, null, 'index_rebuild_warning', 'warning', {
                message: 'Folder index rebuild failed, using existing data',
                error: indexErr.message
            });
        }
    } else {
        console.log(`[ENFORCE] Step 0: Using existing index (${existingIndex.length} folders) for ${project.prNumber || project.pr_number}`);
    }

    // Step 1: Get the active template
    const { data: templateData } = await supabaseAdmin.rpc('get_active_template');
    const template = Array.isArray(templateData) ? templateData[0] : templateData;

    if (!template?.template_json) {
        await writeJobLog(jobId, project.id, project.name, null, 'error', 'error', { message: 'No active template found' });
        return { removed: 0, added: 0, errors: 1 };
    }

    // Parse template into nodes array
    const templateNodes = Array.isArray(template.template_json)
        ? template.template_json
        : template.template_json.template || [];

     // Phase-filtered permissions by node_id (PRIMARY) and by path (FALLBACK)
    // Bidding projects → Bidding only; Execution/PD → BOTH
    const projectPhase = project.phase || 'bidding';
    const phaseNamesToProcess = projectPhase === 'bidding'
        ? ['Bidding']
        : ['Bidding', 'Project Delivery'];

    // ── Build nodeMap (PRIMARY — keyed by stable node_id UUID) ──
    // This is immune to renames, typos, and path normalization drift.
    const nodeMap = new Map<string, any>();
    let phasesFound = 0;
    for (const phaseNodeName of phaseNamesToProcess) {
        const phaseNode = templateNodes.find((n: any) => {
            const nodeName = (n.name || n.text || '').trim();
            return nodeName === phaseNodeName;
        });
        if (phaseNode?.children) {
            const phaseNodeMap = buildNodeMap(phaseNode.children);
            for (const [nid, perms] of phaseNodeMap) {
                nodeMap.set(nid, perms);
            }
            phasesFound++;
            console.log(`[ENFORCE] nodeMap phase '${phaseNodeName}': ${phaseNode.children.length} root folders`);
        } else {
            console.warn(`[ENFORCE] Template phase '${phaseNodeName}' not found`);
        }
    }
    // Fallback: if no phase nodes found, collect from all top-level nodes
    if (phasesFound === 0) {
        console.warn(`[ENFORCE] No phase nodes found, using all template nodes`);
        for (const topNode of templateNodes) {
            const fallbackMap = buildNodeMap(topNode.children || topNode.nodes || []);
            for (const [nid, perms] of fallbackMap) {
                nodeMap.set(nid, perms);
            }
        }
    }

    // ── Build effectivePermissionsMap (FALLBACK — keyed by path for unmapped rows) ──
    const effectivePermissionsMap: Record<string, any> = {};
    for (const phaseNodeName of phaseNamesToProcess) {
        const phaseNode = templateNodes.find((n: any) =>
            (n.name || n.text || '').trim() === phaseNodeName
        );
        if (phaseNode?.children) {
            const phasePerms = buildEffectivePermissionsMap(phaseNode.children);
            Object.assign(effectivePermissionsMap, phasePerms);
        }
    }

    console.log(`[ENFORCE] nodeMap: ${nodeMap.size} nodes. Path fallback map: ${Object.keys(effectivePermissionsMap).length} paths`);

    // Step 2: Get scope from event metadata directly
    const scope = eventMetadata?.scope || 'full';
    const targetPath = eventMetadata?.targetPath;

    await writeJobLog(jobId, project.id, project.name, null, 'scope_parsed', 'info', {
        scope,
        targetPath,
        source: eventMetadata ? 'event_data' : 'default'
    });

    // Step 2.5: Rebuild folder index from Drive (sync DB with reality)
    console.log(`[ENFORCE] Rebuilding folder index from Drive...`);
    await writeJobLog(jobId, project.id, project.name, null, 'rebuild_index_start', 'info', {
        message: 'Rebuilding folder index from Drive before enforcement'
    });
    const rebuildResult = await rebuildFolderIndexForProject(project);
    await writeJobLog(jobId, project.id, project.name, null, 'rebuild_index_complete', 'success', {
        foldersFound: rebuildResult.foldersFound,
        foldersUpserted: rebuildResult.foldersUpserted,
        unmappedCount: rebuildResult.unmappedCount,
    });

    // Step 3: Get folders from DB index
    let { data: rawFolders } = await supabaseAdmin.rpc('list_project_folders', { p_project_id: project.id });
    if (!rawFolders) rawFolders = [];

    if (rawFolders.length === 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'warning', 'warning', {
            message: 'No folders found in index (Drive may be empty)'
        });
    }

    // Step 3.5: Auto-create missing folders from template
    console.log(`[ENFORCE] Checking for missing folders from template...`);
    const { created, errors: createErrors } = await createMissingFoldersFromTemplate(
        project, template.template_json, projectPhase, jobId
    );

    if (created > 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'folders_created', 'success', {
            count: created, phase: projectPhase
        });
        const { data: updatedFolders } = await supabaseAdmin.rpc('list_project_folders', {
            p_project_id: project.id
        });
        rawFolders = updatedFolders || rawFolders;
    }

    if (createErrors > 0) errors += createErrors;

    // ── Build index lookup maps ──
    // Primary: template_node_id → folder_index row
    // Fallback: normalized_path → folder_index row
    const nodeIdToFolder = new Map<string, any>();
    const pathToFolder = new Map<string, any>();
    for (const folder of rawFolders) {
        if (folder.template_node_id) {
            nodeIdToFolder.set(folder.template_node_id, folder);
        }
        const normPath = folder.normalized_template_path || folder.template_path;
        if (normPath) pathToFolder.set(normPath, folder);
    }

    // ── Scope resolution by node identity ──
    // If UI sent a targetPath, resolve it to a template_node_id for scope filtering.
    let targetNodeId: string | null = null;
    if ((scope === 'single' || scope === 'branch') && targetPath) {
        const scopeSeed = rawFolders.find((f: any) =>
            f.normalized_template_path === targetPath || f.template_path === targetPath
        );
        targetNodeId = scopeSeed?.template_node_id ?? null;
        if (!targetNodeId) {
            console.warn(`[ENFORCE] Scope target '${targetPath}' has no template_node_id — scope filtering will be imprecise`);
        }
    }

    await writeJobLog(jobId, project.id, project.name, null, 'scope_info', 'info', {
        scope, targetPath, targetNodeId,
        totalFoldersInDrive: rawFolders.length,
        nodeMapSize: nodeMap.size,
        mappedIndexedFolders: nodeIdToFolder.size,
        unmappedIndexedFolders: rawFolders.length - nodeIdToFolder.size,
    });

    // ── Surface unmapped indexed folders ──
    const unmappedFolders = rawFolders.filter((f: any) => !f.template_node_id);
    if (unmappedFolders.length > 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'unmapped_folders', 'warning', {
            message: `${unmappedFolders.length} indexed folders have no template_node_id binding (unmanaged)`,
            folders: unmappedFolders.map((f: any) => ({
                drive_folder_id: f.drive_folder_id,
                path: f.normalized_template_path || f.template_path,
            })),
            hint: 'Use /folder-mapping UI or run POST /api/admin/stamp-node-ids + rebuild index',
        });
    }

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  Build list of folder entries to process (nodeMap → Drive)    ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const foldersToProcess: Array<{ templatePath: string; expectedPerms: any; folder: any }> = [];

    for (const [nodeId, expectedPerms] of nodeMap.entries()) {
        // ── Scope filtering by node identity ──
        if (scope === 'single' && targetNodeId && nodeId !== targetNodeId) continue;
        if (scope === 'branch' && targetNodeId) {
            const folder = nodeIdToFolder.get(nodeId);
            if (!folder) continue;
            const normPath = folder.normalized_template_path || '';
            const targetFolder = nodeIdToFolder.get(targetNodeId);
            const targetNorm = targetFolder?.normalized_template_path || targetPath || '';
            if (normPath !== targetNorm && !normPath.startsWith(`${targetNorm}/`)) continue;
        }

        // ── Primary lookup: by node_id ──
        let folder = nodeIdToFolder.get(nodeId);

        // ── Fallback: by path for rows not yet stamped ──
        if (!folder) {
            // Find the path entry corresponding to this node via effectivePermissionsMap
            // The path was computed from the same phaseNode children so it should align
            const matchingPath = Object.keys(effectivePermissionsMap).find(
                p => effectivePermissionsMap[p] === expectedPerms
            );
            if (matchingPath) {
                folder = pathToFolder.get(matchingPath);
                if (folder) {
                    console.log(`[ENFORCE] PATH FALLBACK: node_id=${nodeId} matched via path='${matchingPath}'`);
                }
            }
        }

        if (!folder) {
            await writeJobLog(jobId, project.id, project.name, null, 'folder_missing_in_drive', 'warning', {
                message: 'Template node not matched to any Drive folder in index',
                template_node_id: nodeId,
            });
            continue;
        }

        // ── Orphaned mapping detection ──
        if (folder.template_node_id && !nodeMap.has(folder.template_node_id)) {
            await writeJobLog(jobId, project.id, project.name, folder.template_path, 'orphaned_mapping', 'warning', {
                message: 'folder_index.template_node_id references a node not in the active template',
                drive_folder_id: folder.drive_folder_id,
                template_node_id: folder.template_node_id,
            });
        }

        const displayPath = folder.normalized_template_path || folder.template_path;
        foldersToProcess.push({ templatePath: displayPath, expectedPerms, folder });
    }

    await writeJobLog(jobId, project.id, project.name, null, 'folders_to_process', 'info', {
        count: foldersToProcess.length,
        scope
    });


    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  PASS 1: GLOBAL RESET — Clean ALL folders first               ║
    // ║  1a. Disable Limited Access on ALL folders                     ║
    // ║  1b. Remove ALL direct permissions (keep Drive Members only)   ║
    // ╚══════════════════════════════════════════════════════════════════╝

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  PASS 1 + 2 + 3: strict reset → apply → verify (per folder)  ║
    // ╚══════════════════════════════════════════════════════════════════╝

    await writeJobLog(jobId, project.id, project.name, null, 'pass1_start', 'info', {
        message: 'PASS 1: GLOBAL RESET — Disabling Limited Access and removing all direct permissions',
        folderCount: foldersToProcess.length
    });

    // Build the Drive API adapter (wraps the existing functions and protectedPrincipals)
    const driveApi: DriveEnforceAPI = {
        listPermissions: (folderId) => listPermissions(folderId),
        addPermission: async (folderId, type, role, email) => {
            await addPermission(folderId, type as any, role as any, email);
        },

        removePermission: async (folderId, permId) => {
            await removePermission(folderId, permId);
        },

        setLimitedAccess: async (folderId, enabled) => {
            await setLimitedAccessFast(folderId, enabled);
        },
        getLimitedAccessState: async (folderId) => {
            // Verify Limited Access state via the correct Drive field: inheritedPermissionsDisabled
            // (getFolder now includes this field in its fields query)
            const file = await getFolder(folderId);
            return (file as any)?.inheritedPermissionsDisabled === true;
        },

        isProtectedPrincipal: (email) =>
            protectedPrincipals.some(p => p.toLowerCase() === email.toLowerCase()),
    };


    // Resolve driveId for accurate NON_REMOVABLE classification
    let sharedDriveId: string | undefined;
    try {
        const rootFile = await getFolder(project.drive_folder_id);
        sharedDriveId = rootFile?.driveId ?? undefined;
    } catch {
        // continue without driveId — classification falls back to heuristic
    }

    const BATCH_SIZE = 3;
    const enforceResults: import('@/server/enforce-engine').FolderEnforceResult[] = [];

    for (let i = 0; i < foldersToProcess.length; i += BATCH_SIZE) {
        const batch = foldersToProcess.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async ({ templatePath, expectedPerms, folder }) => {
            // inheritedRoles is per-folder — reset each call
            const inheritedRoles = new Map<string, number>();
            const result = await enforceFolder(
                folder.drive_folder_id,
                templatePath,
                expectedPerms,
                inheritedRoles,
                sharedDriveId,
                driveApi,
            );

            // Log reset summary
            await writeJobLog(jobId, project.id, project.name, templatePath, 'folder_reset_summary', 'success', {
                laDisabled: result.reset.laDisabled,
                removed: result.reset.removed,
                nonRemovable: result.reset.nonRemovable,
                removeErrors: result.reset.removeErrors.length,
            });

            // Log any reset errors
            for (const err of result.reset.removeErrors) {
                await writeJobLog(jobId, project.id, project.name, templatePath,
                    err.persistent ? 'remove_persistent_failure' : 'remove_failed', 'error', {
                        email: err.email,
                        error: err.error,
                        attempts: err.attempts,
                    });
            }

            // Log apply summary
            await writeJobLog(jobId, project.id, project.name, templatePath, 'folder_apply_summary', 'success', {
                laEnabled: result.apply.laEnabled,
                laVerified: result.apply.laVerified,
                added: result.apply.added,
                skipped: result.apply.skipped,
                addErrors: result.apply.addErrors.length,
            });

            if (result.apply.laEnableError) {
                await writeJobLog(jobId, project.id, project.name, templatePath, 'limited_access_failed', 'error', {
                    error: result.apply.laEnableError,
                });
            }

            // Log any apply errors
            for (const err of result.apply.addErrors) {
                await writeJobLog(jobId, project.id, project.name, templatePath,
                    err.persistent ? 'add_persistent_failure' : 'add_failed', 'error', {
                        email: err.email,
                        role: err.role,
                        error: err.error,
                        attempts: err.attempts,
                    });
            }

            // Log Phase 3 verify summary
            const nonCompliantComparisons = result.verify.comparisons.filter(c =>
                c.status !== 'EXACT_MATCH' && c.status !== 'NON_REMOVABLE_MEMBERSHIP'
            );
            await writeJobLog(jobId, project.id, project.name, templatePath, 'folder_verify_summary',
                result.verify.compliant ? 'success' : 'warning', {
                    compliant: result.verify.compliant,
                    limitedAccessMatch: result.verify.limitedAccessMatch,
                    totalComparisons: result.verify.comparisons.length,
                    mismatches: nonCompliantComparisons,
                }
            );

            return result;
        }));

        for (const r of batchResults) {
            enforceResults.push(r);
            added += r.apply.added;
            removed += r.reset.removed;
            errors += r.reset.removeErrors.length + r.apply.addErrors.length;
        }

        const progress = Math.round(((i + batch.length) / foldersToProcess.length) * 100);
        await updateJobProgress(jobId, progress, i + batch.length, foldersToProcess.length, JOB_STATUS.RUNNING);
    }

    await writeJobLog(jobId, project.id, project.name, null, 'pass1_complete', 'success', {
        message: 'PASS 1 COMPLETE — All folders reset'
    });
    await writeJobLog(jobId, project.id, project.name, null, 'pass2_complete', 'success', {
        message: 'PASS 2 COMPLETE — All folders enforced'
    });

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  PHASE 3 REPORT — Structured final compliance report           ║
    // ╚══════════════════════════════════════════════════════════════════╝
    const summary = summarizeEnforceResults(enforceResults);
    await writeJobLog(jobId, project.id, project.name, null, 'enforce_report', 'info', {
        totalFolders: summary.totalFolders,
        compliant: summary.compliant,
        nonCompliant: summary.nonCompliant,
        totalAdded: summary.totalAdded,
        totalRemoved: summary.totalRemoved,
        totalErrors: summary.totalErrors,
        persistentFailures: summary.persistentFailures,
        nonComplianceReasons: summary.nonComplianceReasons,
    });

    if (summary.nonCompliant > 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'enforce_non_compliant_folders', 'warning', {
            count: summary.nonCompliant,
            folders: summary.nonComplianceReasons.map(r => ({
                folder: r.folder,
                issues: r.comparisons.map(c => ({
                    principal: c.principal,
                    status: c.status,
                    expected: c.expectedRole,
                    actual: c.actualRole,
                    reason: c.reason,
                })),
            })),
        });
    }

    if (summary.persistentFailures.length > 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'enforce_persistent_failures', 'error', {
            count: summary.persistentFailures.length,
            failures: summary.persistentFailures,
        });
    }

    return { removed, added, errors };
}

// NOTE: buildPermissionsMap has been moved to @/server/audit-helpers (shared module).

async function reconcileProjectIndex(project: any): Promise<number> {
    let issues = 0;

    // Get indexed folders
    const { data: indexedFolders } = await supabaseAdmin
        .schema('rfp')
        .from('folder_index')
        .select('*')
        .eq('project_id', project.id);

    if (!indexedFolders) return 0;

    // Get actual folders from Drive
    const actualFolders = await getAllFoldersRecursive(project.drive_folder_id);
    const actualMap = new Map(actualFolders.map(f => [f.id, f]));

    for (const indexed of indexedFolders) {
        const actual = actualMap.get(indexed.drive_folder_id);

        if (!actual) {
            // Folder was deleted
            issues++;
            await supabaseAdmin
                .schema('rfp')
                .from('reconciliation_log')
                .insert({
                    folder_index_id: indexed.id,
                    project_id: project.id,
                    issue_type: 'deleted',
                    expected_path: indexed.template_path,
                    expected_name: indexed.drive_folder_name,
                });
        } else if (actual.name !== indexed.drive_folder_name) {
            // Folder was renamed
            issues++;
            await supabaseAdmin
                .schema('rfp')
                .from('reconciliation_log')
                .insert({
                    folder_index_id: indexed.id,
                    project_id: project.id,
                    issue_type: 'renamed',
                    expected_path: indexed.template_path,
                    expected_name: indexed.drive_folder_name,
                    actual_name: actual.name,
                });
        }
    }

    return issues;
}

/**
 * Create a new project (after approval)
 */
export const createProject = inngest.createFunction(
    {
        id: 'create-project',
        name: 'Create Project Folders',
        retries: 3,
    },
    { event: 'project/create' },
    async ({ event, step }) => {
        const { projectId, prNumber, projectName, phase } = event.data;

        // Update project status to in_progress
        await step.run('update-project-status', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .update({ status: 'creating' })
                .eq('id', projectId);
        });

        // Get current template
        const template = await step.run('get-template', async () => {
            const { data } = await supabaseAdmin
                .schema('rfp')
                .from('template_versions')
                .select('*')
                .eq('is_active', true)
                .order('version_number', { ascending: false })
                .limit(1)
                .single();
            return data;
        });

        if (!template) {
            await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .update({ status: 'failed', error: 'No active template found' })
                .eq('id', projectId);
            return { success: false, error: 'No active template found' };
        }

        // Get shared drive ID
        const sharedDriveId = process.env.GOOGLE_SHARED_DRIVE_ID;
        if (!sharedDriveId) {
            await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .update({ status: 'failed', error: 'Shared Drive ID not configured' })
                .eq('id', projectId);
            return { success: false, error: 'Shared Drive ID not configured' };
        }

        // Create main project folder
        const projectFolderName = `PRJ-${prNumber}-${projectName.replace(/\s+/g, '-')}`;

        const projectFolder = await step.run('create-project-folder', async () => {
            const folder = await createFolder(projectFolderName, sharedDriveId, sharedDriveId);
            return folder;
        });

        if (!projectFolder || !projectFolder.id) {
            await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .update({ status: 'failed', error: 'Failed to create project folder' })
                .eq('id', projectId);
            return { success: false, error: 'Failed to create project folder' };
        }

        // Update project with folder ID
        await step.run('update-project-folder', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .update({ drive_folder_id: projectFolder.id })
                .eq('id', projectId);
        });

        // Create RFP/Bidding subfolders from template
        const templateJson = template.template_json;
        const biddingTemplate = templateJson.phases?.bidding || templateJson[0]; // Support both formats

        if (biddingTemplate) {
            await step.run('create-bidding-folders', async () => {
                await createSubfoldersFromTemplate(
                    projectFolder.id!,
                    biddingTemplate.folders || biddingTemplate.nodes || [],
                    prNumber,
                    'RFP'
                );
            });
        }

        // Update project status to active
        await step.run('finalize-project', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .update({
                    status: 'active',
                    phase: 'bidding',
                    synced_version: template.version_number,
                    last_synced_at: new Date().toISOString(),
                })
                .eq('id', projectId);

            // Log audit
            await supabaseAdmin
                .schema('rfp')
                .from('audit_log')
                .insert({
                    action: 'project_created',
                    entity_type: 'project',
                    entity_id: projectId,
                    details: { prNumber, projectName, folderId: projectFolder.id },
                    performed_by: 'system',
                });
        });

        return { success: true, projectId, folderId: projectFolder.id };
    }
);

/**
 * Upgrade project to Project Delivery phase
 */
export const upgradeToProjectDelivery = inngest.createFunction(
    {
        id: 'upgrade-to-pd',
        name: 'Upgrade to Project Delivery',
        retries: 3,
    },
    { event: 'project/upgrade-to-pd' },
    async ({ event, step }) => {
        const { projectId, prNumber } = event.data;

        // Get project
        const project = await step.run('get-project', async () => {
            const { data } = await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();
            return data;
        });

        if (!project) {
            return { success: false, error: 'Project not found' };
        }

        if (project.phase === 'execution') {
            return { success: false, error: 'Project already in execution phase' };
        }

        // Get template
        const template = await step.run('get-template', async () => {
            const { data } = await supabaseAdmin
                .schema('rfp')
                .from('template_versions')
                .select('*')
                .eq('is_active', true)
                .order('version_number', { ascending: false })
                .limit(1)
                .single();
            return data;
        });

        if (!template) {
            return { success: false, error: 'No active template found' };
        }

        // Create Project Delivery subfolder
        const pdFolderName = `PRJ-${project.pr_number}-Project Delivery`;

        const pdFolder = await step.run('create-pd-folder', async () => {
            const folder = await createFolder(pdFolderName, project.drive_folder_id);
            return folder;
        });

        if (!pdFolder || !pdFolder.id) {
            return { success: false, error: 'Failed to create PD folder' };
        }

        // Create PD subfolders from template
        const templateJson = template.template_json;
        const pdTemplate = templateJson.phases?.project_delivery || templateJson[1]; // Support both formats

        if (pdTemplate) {
            await step.run('create-pd-subfolders', async () => {
                await createSubfoldersFromTemplate(
                    pdFolder.id!,
                    pdTemplate.folders || pdTemplate.nodes || [],
                    project.pr_number,
                    'PD'
                );
            });
        }

        // Update project phase
        await step.run('update-project-phase', async () => {
            await supabaseAdmin
                .schema('rfp')
                .from('projects')
                .update({
                    phase: 'execution',
                    last_synced_at: new Date().toISOString(),
                })
                .eq('id', projectId);

            // Log audit
            await supabaseAdmin
                .schema('rfp')
                .from('audit_log')
                .insert({
                    action: 'project_upgraded_to_pd',
                    entity_type: 'project',
                    entity_id: projectId,
                    details: { prNumber: project.pr_number, pdFolderId: pdFolder.id },
                    performed_by: 'system',
                });
        });

        return { success: true, projectId, pdFolderId: pdFolder.id };
    }
);

/**
 * Helper: Create subfolders from template recursively
 */
async function createSubfoldersFromTemplate(
    parentId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    folders: any[],
    prNumber: string,
    phasePrefix: string,
    depth: number = 0
): Promise<void> {
    for (const folderDef of folders) {
        const folderName = depth === 0
            ? `PRJ-${prNumber}-${phasePrefix}-${folderDef.name || folderDef.text}`
            : folderDef.name || folderDef.text;

        try {
            const newFolder = await createFolder(folderName, parentId);

            await sleep(RATE_LIMIT_DELAY);

            // Recursively create children
            const children = folderDef.folders || folderDef.nodes || [];
            if (children.length > 0 && newFolder.id) {
                await createSubfoldersFromTemplate(newFolder.id, children, prNumber, phasePrefix, depth + 1);
            }

            // Apply group permissions from template
            if (folderDef.groups && folderDef.groups.length > 0) {
                for (const group of folderDef.groups) {
                    if (group.email) {
                        try {
                            await addPermission(
                                newFolder.id!,
                                'group',
                                group.role || 'reader',
                                group.email
                            );
                            console.log(`Applied group permission: ${group.email} (${group.role || 'reader'}) to ${folderName}`);
                            await sleep(RATE_LIMIT_DELAY);
                        } catch (err) {
                            console.error(`Failed to add group ${group.email} to ${folderName}:`, err);
                        }
                    }
                }
            }

            // Apply user permissions from template
            if (folderDef.users && folderDef.users.length > 0) {
                for (const user of folderDef.users) {
                    if (user.email) {
                        try {
                            await addPermission(
                                newFolder.id!,
                                'user',
                                user.role || 'reader',
                                user.email
                            );
                            console.log(`Applied user permission: ${user.email} (${user.role || 'reader'}) to ${folderName}`);
                            await sleep(RATE_LIMIT_DELAY);
                        } catch (err) {
                            console.error(`Failed to add user ${user.email} to ${folderName}:`, err);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to create folder ${folderName}:`, error);
        }
    }
}

// ============= PERMISSION RESET SYSTEM =============

/**
 * Write permission audit log using Prisma Client (CODE-FIRST)
 */
async function writePermissionAudit(
    jobId: string,
    folderId: string,
    action: 'add' | 'remove' | 'enable_limited_access' | 'disable_limited_access' | 'skip_inherited' | 'hard_reset',
    details: {
        principalType?: 'user' | 'group' | 'domain' | 'anyone';
        principalEmail?: string;
        principalRole?: string;
        permissionId?: string;
        isInherited?: boolean;
        inheritedFrom?: string;
        beforeState?: any;
        afterState?: any;
        result: 'success' | 'failed' | 'skipped';
        errorMessage?: string;
    }
): Promise<void> {
    try {
        const { prisma, PermissionAction, PermissionResult, PrincipalType } = await import('@/lib/prisma');

        // Map action string to enum
        const actionEnum = action === 'hard_reset' ? PermissionAction.remove :
            PermissionAction[action as keyof typeof PermissionAction];

        await prisma.permissionAudit.create({
            data: {
                job_id: jobId,
                folder_id: folderId,
                action: actionEnum,
                principal_type: details.principalType ? PrincipalType[details.principalType] : null,
                principal_email: details.principalEmail ?? null,
                principal_role: details.principalRole ?? null,
                permission_id: details.permissionId ?? null,
                is_inherited: details.isInherited ?? false,
                inherited_from: details.inheritedFrom ?? null,
                before_state: details.beforeState ?? null,
                after_state: details.afterState ?? null,
                result: PermissionResult[details.result],
                error_message: details.errorMessage ?? null
            }
        });
    } catch (err) {
        console.error('Failed to write permission audit:', err);
    }
}

/**
 * Reset a single folder's permissions to match template (AC-2, AC-3)
 * CODE-FIRST: Uses Prisma Client
 */
async function resetSingleFolder(
    folder: any,
    permissionsMap: Record<string, { groups: any[]; users: any[]; limitedAccess: boolean }>,
    jobId: string
): Promise<void> {
    const expected = permissionsMap[folder.template_path];
    if (!expected) {
        throw new Error(`No template found for path: ${folder.template_path}`);
    }

    console.log(`\n--- Resetting folder: ${folder.template_path} (${folder.drive_folder_id}) ---`);

    const { prisma } = await import('@/lib/prisma');

    // Step 1: Limited Access (AC-1 + AC-3)
    let actualLimitedAccess = folder.actual_limited_access;

    if (expected.limitedAccess !== actualLimitedAccess) {
        console.log(`Limited Access mismatch: expected=${expected.limitedAccess}, actual=${actualLimitedAccess}`);

        try {
            actualLimitedAccess = await setLimitedAccess(
                folder.drive_folder_id,
                expected.limitedAccess
            );

            await writePermissionAudit(jobId, folder.id,
                expected.limitedAccess ? 'enable_limited_access' : 'disable_limited_access',
                {
                    beforeState: { limited_access: folder.actual_limited_access },
                    afterState: { limited_access: actualLimitedAccess },
                    result: 'success'
                }
            );
        } catch (error: any) {
            await writePermissionAudit(jobId, folder.id, 'enable_limited_access', {
                result: 'failed',
                errorMessage: error.message
            });
            throw error;
        }
    } else {
        console.log(`✓ Limited Access correct: ${actualLimitedAccess}`);
    }

    // Step 2: Hard reset permissions (AC-2)
    console.log(`Applying hard reset...`);
    const stats = await hardResetPermissions(
        folder.drive_folder_id,
        expected.groups || [],
        expected.users || []
    );

    // Log stats
    await writePermissionAudit(jobId, folder.id, 'hard_reset', {
        result: 'success',
        beforeState: { message: 'See individual add/remove logs' },
        afterState: stats
    });

    // Step 3: Update folder_index using Prisma (AC-3)
    await prisma.folderIndex.update({
        where: { id: folder.id },
        data: {
            actual_limited_access: actualLimitedAccess,
            last_verified_at: new Date(),
            is_compliant: actualLimitedAccess === expected.limitedAccess
        }
    });

    console.log(`✓ Folder reset complete`);
}

/**
 * Reset permissions for all folders in a project (AC-5: batched)
 * MANUAL ONLY - triggered via POST /api/permissions/reset
 * CODE-FIRST: Uses Prisma Client
 */
export async function resetPermissionsForProject(
    projectId: string,
    jobId: string
): Promise<void> {
    console.log(`\n========== RESET PROJECT PERMISSIONS ==========`);
    console.log(`Project ID: ${projectId}`);
    console.log(`Job ID: ${jobId}`);

    try {
        const { prisma, ResetJobStatus } = await import('@/lib/prisma');

        // Update job status to running
        await prisma.resetJob.update({
            where: { id: jobId },
            data: {
                status: ResetJobStatus.running,
                started_at: new Date()
            }
        });

        // Step 1: Load active template
        const templateData = await prisma.folderTemplate.findFirst({
            where: { is_active: true },
            orderBy: { version_number: 'desc' }
        });

        if (!templateData) {
            throw new Error('No active template found');
        }

        const template = templateData.template_json;
        const permissionsMap = buildPermissionsMap(template as any);

        // Step 2: Load folders for this project
        const folders = await prisma.folderIndex.findMany({
            where: { project_id: projectId }
        });

        const totalFolders = folders.length;
        let processed = 0;
        let successful = 0;
        let failed = 0;

        console.log(`Found ${totalFolders} folders to reset`);

        // Step 3: Process in batches
        const BATCH_SIZE = 10;
        for (let i = 0; i < totalFolders; i += BATCH_SIZE) {
            const batch = folders.slice(i, i + BATCH_SIZE);

            await Promise.allSettled(
                batch.map(async (folder) => {
                    try {
                        await resetSingleFolder(folder, permissionsMap, jobId);
                        successful++;
                    } catch (error) {
                        failed++;
                        console.error(`Reset failed for ${folder.template_path}:`, error);
                    } finally {
                        processed++;
                    }
                })
            );

            // Update progress using Prisma
            await prisma.resetJob.update({
                where: { id: jobId },
                data: {
                    processed_folders: processed,
                    successful_folders: successful,
                    failed_folders: failed
                }
            });

            console.log(`Progress: ${processed}/${totalFolders} (${successful} success, ${failed} failed)`);

            // Rate limiting
            if (i + BATCH_SIZE < totalFolders) {
                await sleep(RATE_LIMIT_DELAY);
            }
        }

        // Final status
        const finalStatus = failed > 0 ? ResetJobStatus.completed : ResetJobStatus.completed;
        await prisma.resetJob.update({
            where: { id: jobId },
            data: {
                status: finalStatus,
                completed_at: new Date()
            }
        });

        console.log(`\n========== RESET COMPLETE ==========`);
        console.log(`Total: ${totalFolders}, Success: ${successful}, Failed: ${failed}`);

    } catch (error: any) {
        console.error(`Reset job ${jobId} failed with fatal error:`, error);

        const { prisma, ResetJobStatus } = await import('@/lib/prisma');

        // Mark job as failed
        await prisma.resetJob.update({
            where: { id: jobId },
            data: {
                status: ResetJobStatus.failed,
                completed_at: new Date()
            }
        });

        throw error;
    }
}


// Export all functions for the Inngest serve handler
export const functions = [
    syncTemplateAll,
    syncTemplateChanges,
    enforcePermissions,
    buildFolderIndex,
    reconcileFolderIndex,
    createProject,
    upgradeToProjectDelivery,
];
