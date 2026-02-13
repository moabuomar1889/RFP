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
    normalizeRole,
} from '@/server/audit-helpers';
import { CANONICAL_RANK } from '@/lib/template-engine/types';
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
    hardResetPermissions,
} from '@/server/google-drive';
import { JOB_STATUS, TASK_STATUS } from '@/lib/config';

// Rate limiting helper
const RATE_LIMIT_DELAY = 300; // ms between API calls
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
        retries: 2,
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

                console.log(`Indexing project ${project.prNumber} with drive_folder_id: ${project.driveFolderId}`);

                if (!project.driveFolderId) {
                    console.error(`Project ${project.prNumber} has no drive_folder_id`);
                    return { foldersIndexed: 0, error: 'No drive_folder_id' };
                }

                // Get all folders from Drive
                let folders: Array<{ id: string; name: string; path: string; parentId: string }> = [];
                try {
                    folders = await getAllFoldersRecursive(project.driveFolderId);
                    console.log(`Found ${folders.length} folders for ${project.prNumber}`);
                } catch (driveError: any) {
                    console.error(`Drive API error for ${project.prNumber} (drive_folder_id: ${project.driveFolderId}):`, driveError.message);
                    return { foldersFound: 0, foldersUpserted: 0, error: driveError.message };
                }

                // Upsert to folder_index using direct table insert
                // (upsert_folder_index RPC references columns that don't exist in the actual table)
                let upsertedCount = 0;
                for (const folder of folders) {
                    const { error } = await client.schema('rfp').from('folder_index')
                        .upsert({
                            project_id: project.id,
                            template_path: folder.path,
                            drive_folder_id: folder.id,
                        }, { onConflict: 'drive_folder_id' });

                    if (error) {
                        console.error(`Failed to upsert folder ${folder.path}:`, error);
                    } else {
                        upsertedCount++;
                    }
                }

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

// NOTE: enforceProjectPermissions (non-logging version) was removed.
// Only enforceProjectPermissionsWithLogging is used by the enforce-permissions job.

/**
 * Enforce permissions with detailed job logging
 */
async function enforceProjectPermissionsWithLogging(
    project: any,
    protectedPrincipals: string[],
    jobId: string
): Promise<{ violations: number; reverted: number; added: number }> {
    let violations = 0;
    let reverted = 0;
    let added = 0;

    console.log(`\n========== ENFORCING PERMISSIONS FOR ${project.prNumber || project.pr_number} ==========`);

    // Step 1: Get the active template
    const { data: templateData } = await supabaseAdmin.rpc('get_active_template');
    const template = Array.isArray(templateData) ? templateData[0] : templateData;

    if (!template?.template_json) {
        await writeJobLog(jobId, project.id, project.name, null, 'error', 'error', { message: 'No active template found' });
        return { violations: 0, reverted: 0, added: 0 };
    }

    // Parse template and build path-to-permissions map
    const templateNodes = Array.isArray(template.template_json)
        ? template.template_json
        : template.template_json.template || [];

    // PHASE-AWARE FILTERING: Only process folders matching the project's current phase
    // Template has 2 top-level nodes: "Bidding" and "Project Delivery"
    // - bidding phase → use "Bidding" node's children
    // - execution phase → use "Project Delivery" node's children
    const projectPhase = project.phase || 'bidding';
    const phaseNode = templateNodes.find((n: any) => {
        const nodeName = (n.text || n.name || '').trim();
        if (projectPhase === 'execution') {
            return nodeName === 'Project Delivery';
        } else {
            return nodeName === 'Bidding';
        }
    });

    if (!phaseNode) {
        await writeJobLog(jobId, project.id, project.name, null, 'error', 'error', {
            message: `No template node found for phase: ${projectPhase}`,
            availableNodes: templateNodes.map((n: any) => n.text || n.name)
        });
        return { violations: 0, reverted: 0, added: 0 };
    }

    // Build permissions map from ONLY the phase-matching node's children
    const phaseTemplateNodes = phaseNode.children || phaseNode.nodes || [];
    const permissionsMap = buildPermissionsMap(phaseTemplateNodes);

    // Debug: Log permissions map keys
    await writeJobLog(jobId, project.id, project.name, null, 'debug_map', 'info', {
        message: 'Built permissions map',
        totalPaths: Object.keys(permissionsMap).length,
        samplePaths: Object.keys(permissionsMap).slice(0, 5)
    });

    // Step 2: Get all indexed folders for this project
    let { data: folders } = await supabaseAdmin.rpc('list_project_folders', { p_project_id: project.id });

    if (!folders || folders.length === 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'warning', 'warning', { message: 'No folders indexed' });
        return { violations: 0, reverted: 0, added: 0 };
    }

    await writeJobLog(jobId, project.id, project.name, null, 'folders_found', 'info', { count: folders.length });

    // Step 2a: Apply scope filtering if specified in job metadata
    // Fetch job metadata from database
    const { data: jobData } = await supabaseAdmin
        .from('jobs')
        .select('metadata')
        .eq('id', jobId)
        .single();

    const scope = jobData?.metadata?.scope || 'full';
    const targetPath = jobData?.metadata?.targetPath;

    if (scope === 'single' && targetPath) {
        // Only process the specific folder
        folders = folders.filter((f: any) =>
            (f.normalized_template_path || f.template_path) === targetPath
        );
        await writeJobLog(jobId, project.id, project.name, null, 'scope_applied', 'info', {
            scope: 'single',
            targetPath,
            filteredCount: folders.length
        });
    } else if (scope === 'branch' && targetPath) {
        // Process folder and all children
        folders = folders.filter((f: any) => {
            const path = f.normalized_template_path || f.template_path;
            return path === targetPath || path.startsWith(targetPath + '/');
        });
        await writeJobLog(jobId, project.id, project.name, null, 'scope_applied', 'info', {
            scope: 'branch',
            targetPath,
            filteredCount: folders.length
        });
    }
    // else: full enforcement (default - no filtering)

    if (folders.length === 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'warning', 'warning', {
            message: scope !== 'full'
                ? `No folders matched scope filter (${scope}: ${targetPath})`
                : 'No folders indexed'
        });
        return { violations: 0, reverted: 0, added: 0 };
    }


    // Step 2b: Auto-create missing folders that exist in template but not in Drive
    const indexedTemplatePaths = new Set(
        folders.map((f: any) => f.normalized_template_path || f.template_path)
    );
    // Build a map of template paths → Drive folder IDs for parent lookup
    const pathToDriveId = new Map<string, string>();
    for (const f of folders) {
        const tp = f.normalized_template_path || f.template_path;
        pathToDriveId.set(tp, f.drive_folder_id);
    }

    // Also store the project's root Drive folder ID for top-level children
    const projectDriveFolderId = project.drive_folder_id || project.driveFolderId;


    // Helper: Get Drive folder name based on phase and folder type
    function getDriveFolderName(templatePath: string, folderBaseName: string): string {
        const projectCode = project.prNumber || project.pr_number;

        // Special case: Phase containers themselves
        if (templatePath === 'Bidding') {
            return `${projectCode}-RFP`;
        }
        if (templatePath === 'Project Delivery') {
            return `${projectCode}-PD`;
        }

        // Regular folders: check which phase they belong to
        const isInBiddingPhase = templatePath.startsWith('Bidding/');
        return isInBiddingPhase
            ? `${projectCode}-RFP-${folderBaseName}`
            : `${projectCode}-${folderBaseName}`;
    }


    // Step 2: Create missing folders
    // Sort template paths by depth so parents are created before children
    const allTemplatePaths = Object.keys(permissionsMap).sort(
        (a, b) => a.split('/').length - b.split('/').length
    );

    for (const templatePath of allTemplatePaths) {
        if (indexedTemplatePaths.has(templatePath)) continue;

        // Determine parent path and folder name
        const parts = templatePath.split('/');
        const folderName = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');

        // Find parent's Drive folder ID from indexed folders
        let parentDriveId: string | undefined;
        if (parentPath) {
            // Look up parent in indexed folders
            const parentFolder = folders.find((f: any) =>
                (f.normalized_template_path || f.template_path) === parentPath
            );
            parentDriveId = parentFolder?.drive_folder_id;
        } else {
            // Top-level folder (e.g., "SOW" in "Bidding/SOW" becomes top-level after stripping)
            // Parent is the project root folder
            parentDriveId = projectDriveFolderId;
        }

        if (!parentDriveId) {
            await writeJobLog(jobId, project.id, project.name, templatePath, 'create_folder_skipped', 'warning', {
                reason: 'PARENT_NOT_FOUND',
                parentPath,
                message: `Cannot create folder "${folderName}" — parent folder not found in index.`
            });
            continue;
        }

        try {
            // Get correct Drive folder name based on phase
            const driveFolderName = getDriveFolderName(templatePath, folderName);
            const newFolder = await createFolder(driveFolderName, parentDriveId);
            const newFolderId = newFolder.id!;

            await writeJobLog(jobId, project.id, project.name, templatePath, 'create_folder', 'success', {
                folderName: driveFolderName,
                driveFolderId: newFolderId,
                parentDriveId,
            });

            // Register in DB via upsert_folder_index
            const client = getRawSupabaseAdmin();
            const expectedPerms = permissionsMap[templatePath];
            await client.rpc('upsert_folder_index', {
                p_project_id: project.id,
                p_template_path: templatePath,
                p_drive_folder_id: newFolderId,
                p_expected_limited_access: expectedPerms?.limitedAccess || false,
                p_expected_groups: expectedPerms?.groups || [],
                p_expected_users: expectedPerms?.users || [],
            });

            // Add to processing arrays so permissions get applied
            const newFolderEntry = {
                drive_folder_id: newFolderId,
                template_path: templatePath,
                normalized_template_path: templatePath,
            };
            folders.push(newFolderEntry);
            indexedTemplatePaths.add(templatePath);
            pathToDriveId.set(templatePath, newFolderId);

            await sleep(RATE_LIMIT_DELAY);
        } catch (err: any) {
            await writeJobLog(jobId, project.id, project.name, templatePath, 'create_folder_failed', 'error', {
                folderName,
                parentDriveId,
                error: err.message,
            });
        }
    }


    // Step 3: Process each folder
    for (const folder of folders) {
        // Use normalized path for matching against template
        const templatePath = folder.normalized_template_path || folder.template_path;
        const expectedPerms = permissionsMap[templatePath];

        if (!expectedPerms) {
            await writeJobLog(jobId, project.id, project.name, templatePath, 'template_not_found', 'warning', {
                message: `No template found for path: ${templatePath}`
            });
            continue;
        }

        // DISABLED: Folder rename feature - was creating duplicates
        // TODO: Fix rename logic to properly rename in-place instead of creating duplicates
        /*
        // Check if Drive folder name matches expected name and rename if needed
        try {
            const actualFolder = await getFolder(folder.drive_folder_id);
            const actualFolderName = actualFolder?.name;

            if (actualFolderName) {
                // Calculate expected Drive folder name based on template path and phase
                const pathParts = templatePath.split('/');
                const expectedBaseName = pathParts[pathParts.length - 1];
                const phasePrefix = pathParts[0]; // "Bidding" or "Project Delivery"

                // Different naming convention per phase:
                // Bidding: PRJ-XXX-RFP-{basename}
                // Project Delivery: PRJ-XXX-{basename}
                const projectCode = project.prNumber || project.pr_number;
                const expectedDriveName = phasePrefix === 'Bidding'
                    ? `${projectCode}-RFP-${expectedBaseName}`
                    : `${projectCode}-${expectedBaseName}`;

                if (actualFolderName !== expectedDriveName) {
                    try {
                        await renameFolder(folder.drive_folder_id, expectedDriveName);
                        await writeJobLog(jobId, project.id, project.name, templatePath, 'folder_renamed', 'success', {
                            oldName: actualFolderName,
                            newName: expectedDriveName
                        });
                        await sleep(RATE_LIMIT_DELAY);
                    } catch (err: any) {
                        await writeJobLog(jobId, project.id, project.name, templatePath, 'folder_rename_failed', 'warning', {
                            actualName: actualFolderName,
                            expectedName: expectedDriveName,
                            error: err.message
                        });
                    }
                }
            }
        } catch (err: any) {
            // Continue even if rename check fails - not critical
            await writeJobLog(jobId, project.id, project.name, templatePath, 'folder_check_failed', 'warning', {
                error: err.message
            });
        }
        */


        // Debug: Log matched folder with counts
        await writeJobLog(jobId, project.id, project.name, templatePath, 'matched_folder', 'info', {
            groupCount: expectedPerms.groups?.length || 0,
            userCount: expectedPerms.users?.length || 0,
            limitedAccess: expectedPerms.limitedAccess
        });

        // Get actual permissions from Drive
        let actualPerms;
        let driveId: string | undefined;
        try {
            actualPerms = await listPermissions(folder.drive_folder_id);

            // Fetch driveId for accurate inherited permission classification
            const { getDriveClient } = await import('@/server/google-drive');
            const drive = await getDriveClient();
            const folderMeta = await drive.files.get({
                fileId: folder.drive_folder_id,
                supportsAllDrives: true,
                fields: 'id,driveId',
            });
            driveId = (folderMeta.data as any).driveId;
        } catch (err: any) {
            await writeJobLog(jobId, project.id, project.name, templatePath, 'error', 'error', {
                message: `Failed to get permissions: ${err.message}`
            });
            continue;
        }

        // Build set of expected emails
        const expectedEmails = new Set<string>();
        for (const g of expectedPerms.groups) {
            if (g.email) expectedEmails.add(g.email.toLowerCase());
        }
        for (const u of expectedPerms.users) {
            if (u.email) expectedEmails.add(u.email.toLowerCase());
        }

        // Compute desired effective policy with overrides
        const desiredPrincipals = computeDesiredEffectivePolicy(expectedPerms);
        const overrideRemoveSet = new Set(
            desiredPrincipals.filter(p => p.overrideAction === 'removed').map(p => p.identifier)
        );
        const overrideDowngradeMap = new Map(
            desiredPrincipals.filter(p => p.overrideAction === 'downgraded').map(p => [p.identifier, p.role])
        );

        // Remove overridden principals from expectedEmails so they get caught by removal logic
        for (const email of overrideRemoveSet) {
            expectedEmails.delete(email);
        }

        // Build map of actual ACTIVE emails (exclude deleted and "Access removed" permissions)
        const actualEmailsMap = new Map<string, any>();
        for (const perm of actualPerms) {
            // Skip permissions that were removed due to Limited Access
            // These have "deleted" set to true
            if (perm.deleted === true) continue;
            // Skip "Access removed" permissions (view=metadata) — phantom perms on limited-access folders
            if (perm.view === 'metadata') continue;
            if (perm.emailAddress) {
                actualEmailsMap.set(perm.emailAddress.toLowerCase(), perm);
            }
        }

        // Debug: Log RAW permissions from Google API to understand structure
        await writeJobLog(jobId, project.id, project.name, templatePath, 'debug_raw_perms', 'info', {
            rawPermsSample: actualPerms.slice(0, 3).map((p: any) => ({
                email: p.emailAddress,
                type: p.type,
                role: p.role,
                deleted: p.deleted,
                pendingOwner: p.pendingOwner,
                inherited: p.inherited,
                allFields: Object.keys(p)
            }))
        });

        // Debug: Log expected vs actual permissions
        await writeJobLog(jobId, project.id, project.name, templatePath, 'debug_permissions', 'info', {
            expectedGroupCount: expectedPerms.groups.length,
            expectedGroups: expectedPerms.groups.map((g: any) => g.email),
            actualEmails: Array.from(actualEmailsMap.keys())
        });

        // Step 3a: ADD group permissions (with pre-check)
        for (const group of expectedPerms.groups) {
            if (!group.email) continue;
            const groupEmailLower = group.email.toLowerCase();
            const expectedRole = group.role || 'reader';

            // Check if permission already exists with correct or lower role
            const existingPerm = actualEmailsMap.get(groupEmailLower);
            if (existingPerm) {
                const actualRank = CANONICAL_RANK[normalizeRole(existingPerm.role)] ?? 0;
                const expectedRank = CANONICAL_RANK[normalizeRole(expectedRole)] ?? 0;
                if (actualRank <= expectedRank) {
                    // No-escalation guard: actual is same or lower privilege — do nothing
                    continue;
                }
                // actualRank > expectedRank: over-privileged, will be handled by downgrade logic
                continue;
            }

            try {
                await addPermission(folder.drive_folder_id, 'group', expectedRole, group.email);
                added++;
                await writeJobLog(jobId, project.id, project.name, templatePath, 'add_permission', 'success', {
                    email: group.email,
                    type: 'group',
                    role: expectedRole,
                    action: existingPerm ? 'UPDATED' : 'ADDED'
                });
            } catch (err: any) {
                // Ignore "already has access" errors
                if (err.message?.includes('already')) {
                    // Log as info, not success
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'permission_already_exists', 'info', {
                        email: group.email,
                        type: 'group',
                        role: expectedRole
                    });
                } else {
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'add_permission_failed', 'error', {
                        email: group.email,
                        error: err.message
                    });
                }
            }
            await sleep(RATE_LIMIT_DELAY);
        }

        for (const user of expectedPerms.users) {
            if (!user.email) continue;
            const emailLower = user.email.toLowerCase();
            const existingPerm = actualEmailsMap.get(emailLower);
            if (existingPerm) {
                const actualRank = CANONICAL_RANK[normalizeRole(existingPerm.role)] ?? 0;
                const expectedRank = CANONICAL_RANK[normalizeRole(user.role || 'reader')] ?? 0;
                if (actualRank <= expectedRank) {
                    // No-escalation guard: actual is same or lower privilege — do nothing
                    continue;
                }
                // actualRank > expectedRank: over-privileged, will be handled by downgrade logic
                continue;
            }
            // Missing — add permission
            try {
                await addPermission(folder.drive_folder_id, 'user', user.role || 'reader', user.email);
                added++;
                await writeJobLog(jobId, project.id, project.name, templatePath, 'add_permission', 'success', {
                    email: user.email,
                    type: 'user',
                    role: user.role
                });
            } catch (err: any) {
                await writeJobLog(jobId, project.id, project.name, templatePath, 'add_permission_failed', 'error', {
                    email: user.email,
                    error: err.message
                });
            }
            await sleep(RATE_LIMIT_DELAY);
        }

        // Step 3b: REMOVE unauthorized permissions
        for (const actual of actualPerms) {
            if (!actual.emailAddress) continue;
            const emailLower = actual.emailAddress.toLowerCase();

            // Skip protected principals
            if (protectedPrincipals.some(p => p.toLowerCase() === emailLower)) {
                continue;
            }

            // Check if this permission is expected
            if (!expectedEmails.has(emailLower)) {
                // Classify inherited permissions BEFORE counting as violation
                const inheritedClassification = classifyInheritedPermission(actual, driveId);
                const isInherited = inheritedClassification !== 'NOT_INHERITED';
                const inheritedFrom = actual.inheritedFrom ?? actual.permissionDetails?.[0]?.inheritedFrom;

                // RULE 0: NON-REMOVABLE Shared Drive membership — NEVER count as violation, NEVER attempt delete
                if (inheritedClassification === 'NON_REMOVABLE_DRIVE_MEMBERSHIP') {
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'drive_membership_skipped', 'info', {
                        action: 'SKIPPED',
                        reason: 'NON_REMOVABLE_DRIVE_MEMBERSHIP',
                        classification: 'non-removable-drive',
                        email: actual.emailAddress,
                        role: actual.role,
                        type: actual.type,
                        inheritedFrom,
                        message: 'Shared Drive membership permission — cannot be removed via file API.'
                    });
                    continue;
                }

                // RULE 1: Skip inherited permissions when limitedAccess=false (inheritance allowed)
                if (!expectedPerms.limitedAccess && isInherited) {
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'inherited_permission_allowed', 'info', {
                        action: 'SKIPPED',
                        reason: 'INHERITANCE_ALLOWED',
                        classification: 'removable',
                        email: actual.emailAddress,
                        role: actual.role,
                        type: actual.type,
                        inheritedFrom,
                        message: 'Permission is inherited and inheritance is allowed for this folder (limitedAccess=false).'
                    });
                    continue;
                }

                // RULE 2: Skip domain/anyone when limitedAccess=false (no hard reset)
                if (!expectedPerms.limitedAccess && (actual.type === 'domain' || actual.type === 'anyone')) {
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'domain_permission_allowed', 'info', {
                        action: 'SKIPPED',
                        reason: 'NO_HARD_RESET_ON_NON_LIMITED',
                        type: actual.type,
                        domain: actual.domain,
                        message: 'Domain/anyone permission allowed on non-limited folder (no hard reset).'
                    });
                    continue;
                }

                // If limitedAccess=true and isInherited from parent folder: these should already be removed
                if (isInherited) {
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'inherited_permission_violation', 'warning', {
                        action: 'BLOCKED',
                        reason: 'INHERITED_ON_LIMITED_FOLDER',
                        classification: 'removable',
                        email: actual.emailAddress,
                        role: actual.role,
                        type: actual.type,
                        permissionId: actual.id,
                        inheritedFrom,
                        sourceLink: inheritedFrom ? `https://drive.google.com/drive/folders/${inheritedFrom}` : null,
                        message: 'Permission is inherited from parent folder on a Limited Access folder.'
                    });
                    continue;
                }

                // This is a REAL unauthorized direct permission — count as violation
                violations++;

                try {
                    await removePermission(folder.drive_folder_id, actual.id!);
                    reverted++;
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'remove_permission', 'warning', {
                        email: actual.emailAddress,
                        role: actual.role
                    });
                } catch (err: any) {
                    // "Permission not found" means it was already removed (e.g., by Limited Access)
                    if (err.message?.includes('Permission not found') || err.message?.includes('not found')) {
                        reverted++; // Count as success since the goal was achieved
                        await writeJobLog(jobId, project.id, project.name, templatePath, 'remove_permission', 'success', {
                            email: actual.emailAddress,
                            role: actual.role,
                            note: 'Already removed (Limited Access)'
                        });
                    } else {
                        // Check if this is an inherited permission issue
                        const isInherited = actual.permissionDetails?.[0]?.inherited;
                        const inheritedFrom = actual.permissionDetails?.[0]?.inheritedFrom;

                        if (isInherited || err.message?.includes('required access to delete')) {
                            await writeJobLog(jobId, project.id, project.name, templatePath, 'permission_delete_blocked', 'error', {
                                reason: 'INHERITED_PERMISSION',
                                email: actual.emailAddress,
                                role: actual.role,
                                type: actual.type,
                                permissionId: actual.id,
                                sourceFolderId: inheritedFrom || 'unknown',
                                message: 'Cannot delete inherited permission. Must be removed from source folder.',
                                sourceLink: inheritedFrom ? `https://drive.google.com/drive/folders/${inheritedFrom}` : null
                            });
                        } else {
                            await writeJobLog(jobId, project.id, project.name, templatePath, 'remove_permission_failed', 'error', {
                                email: actual.emailAddress,
                                role: actual.role,
                                type: actual.type,
                                permissionId: actual.id,
                                inherited: isInherited,
                                error: err.message
                            });
                        }
                    }
                }
                await sleep(RATE_LIMIT_DELAY);
            }
        }

        // Step 3c: Enable Limited Access if needed
        if (expectedPerms.limitedAccess) {
            try {
                await setLimitedAccess(folder.drive_folder_id, true);
                await writeJobLog(jobId, project.id, project.name, templatePath, 'limited_access', 'success', {});
            } catch (err: any) {
                await writeJobLog(jobId, project.id, project.name, templatePath, 'limited_access_failed', 'error', {
                    error: err.message
                });
            }
        }

        // Step 3d: Override enforcement — downgrade roles for principals targeted by override.downgrade
        for (const [email, desiredRole] of overrideDowngradeMap) {
            const existingPerm = actualEmailsMap.get(email);
            if (!existingPerm) continue;

            const actualRole = normalizeRole(existingPerm.role);
            const targetRole = normalizeRole(desiredRole);
            if (actualRole === targetRole) continue; // Already at correct role

            // Classify: drive memberships cannot be role-changed at folder level
            const cls = classifyInheritedPermission(existingPerm, driveId);
            if (cls === 'NON_REMOVABLE_DRIVE_MEMBERSHIP') {
                await writeJobLog(jobId, project.id, project.name, templatePath, 'override_downgrade_blocked', 'warning', {
                    action: 'BLOCKED',
                    reason: 'NON_REMOVABLE_DRIVE_MEMBERSHIP',
                    email,
                    actualRole,
                    desiredRole: targetRole,
                    message: 'Cannot downgrade Shared Drive membership role at folder level.'
                });
                continue;
            }

            // For direct permissions: delete and re-add with lower role
            if (cls === 'NOT_INHERITED') {
                try {
                    await removePermission(folder.drive_folder_id, existingPerm.id!);
                    await sleep(RATE_LIMIT_DELAY);
                    await addPermission(folder.drive_folder_id, existingPerm.type, targetRole as any, existingPerm.emailAddress);
                    reverted++;
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'override_downgrade', 'success', {
                        email,
                        fromRole: actualRole,
                        toRole: targetRole,
                        action: 'DOWNGRADED'
                    });
                } catch (err: any) {
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'override_downgrade_failed', 'error', {
                        email,
                        fromRole: actualRole,
                        toRole: targetRole,
                        error: err.message
                    });
                }
                await sleep(RATE_LIMIT_DELAY);
            } else {
                // Inherited from parent folder — log that it needs attention
                await writeJobLog(jobId, project.id, project.name, templatePath, 'override_downgrade_inherited', 'warning', {
                    action: 'BLOCKED',
                    reason: 'INHERITED_PERMISSION',
                    email,
                    actualRole,
                    desiredRole: targetRole,
                    message: 'Cannot downgrade inherited permission. Must be changed at source folder.'
                });
            }
        }

        // Step 4: POST-ENFORCEMENT RE-READ — verify final Drive state
        try {
            await sleep(RATE_LIMIT_DELAY);
            const finalPerms = await listPermissions(folder.drive_folder_id);
            const debugPayload = buildFolderDebugPayload(
                templatePath,
                expectedPerms.limitedAccess,
                null,
                finalPerms,
                driveId
            );
            await writeJobLog(jobId, project.id, project.name, templatePath, 'post_enforcement_state', 'info', {
                ...debugPayload,
                total_permissions: finalPerms.length,
                emails: finalPerms
                    .filter((p: any) => p.emailAddress)
                    .map((p: any) => `${p.emailAddress} (${p.role}${p.inherited ? ' inherited' : ''})`),
            });
        } catch (err: any) {
            await writeJobLog(jobId, project.id, project.name, templatePath, 'post_enforcement_read_failed', 'warning', {
                error: err.message
            });
        }

        await sleep(RATE_LIMIT_DELAY);
    }

    return { violations, reverted, added };
}

/**
 * NEW: Enforce permissions using RESET-THEN-APPLY approach
 * This eliminates conflicts with Limited Access and role modifications
 * 
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

    // Step 1: Get the active template
    const { data: templateData } = await supabaseAdmin.rpc('get_active_template');
    const template = Array.isArray(templateData) ? templateData[0] : templateData;

    if (!template?.template_json) {
        await writeJobLog(jobId, project.id, project.name, null, 'error', 'error', { message: 'No active template found' });
        return { removed: 0, added: 0, errors: 1 };
    }

    // Parse template
    const templateNodes = Array.isArray(template.template_json)
        ? template.template_json
        : template.template_json.template || [];

    // Phase-aware filtering (bidding vs execution)
    const projectPhase = project.phase || 'bidding';
    const phaseNode = templateNodes.find((n: any) => {
        const nodeName = (n.text || n.name || '').trim();
        if (projectPhase === 'bidding') return nodeName === 'Bidding';
        return nodeName === 'Project Delivery';
    });

    if (!phaseNode?.children) {
        await writeJobLog(jobId, project.id, project.name, null, 'error', 'error', {
            message: `No ${projectPhase} phase node in template`
        });
        return { removed: 0, added: 0, errors: 1 };
    }

    // Build template map
    const templateMap = new Map<string, any>();
    function buildTemplateMap(node: any, parentPath = '') {
        const nodeName = node.text || node.name || '';
        const currentPath = parentPath ? `${parentPath}/${nodeName}` : nodeName;
        templateMap.set(currentPath, node);
        if (node.children) {
            for (const child of node.children) {
                buildTemplateMap(child, currentPath);
            }
        }
    }
    for (const child of phaseNode.children) {
        buildTemplateMap(child, '');
    }

    // Step 2: Get scope from event metadata directly (no DB query needed)
    const scope = eventMetadata?.scope || 'full';
    const targetPath = eventMetadata?.targetPath;

    await writeJobLog(jobId, project.id, project.name, null, 'scope_parsed', 'info', {
        scope,
        targetPath,
        source: eventMetadata ? 'event_data' : 'default'
    });

    // Step 3: Get folders to process using RPC (includes normalized_template_path)
    const { data: rawFolders } = await supabaseAdmin.rpc('list_project_folders', { p_project_id: project.id });

    if (!rawFolders || rawFolders.length === 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'warning', 'warning', {
            message: 'No folders found in index'
        });
        return { removed: 0, added: 0, errors: 0 };
    }

    // Apply scope filtering using normalized_template_path
    let folders = rawFolders;
    if (scope === 'single' && targetPath) {
        folders = rawFolders.filter((f: any) => {
            const path = f.normalized_template_path || f.template_path;
            return path === targetPath;
        });
    } else if (scope === 'branch' && targetPath) {
        folders = rawFolders.filter((f: any) => {
            const path = f.normalized_template_path || f.template_path;
            return path === targetPath || path.startsWith(`${targetPath}/`);
        });
    }

    await writeJobLog(jobId, project.id, project.name, null, 'scope_info', 'info', {
        scope,
        targetPath,
        totalFolders: folders.length,
        rawFolderCount: rawFolders.length
    });

    // Helper: Normalize a Drive folder path to a template-matching path
    // Drive paths: "PRJ-017-RFP/3-PRJ-017-RFP-Vendors Quotations/3-PRJ-017-RFP-E&I"
    // Template paths: "Vendors Quotations/E&I"
    // Strip: project root prefix, number prefix, and project code prefix from each segment
    const projectCode = project.prNumber || project.pr_number || '';
    function normalizeDrivePathToTemplate(drivePath: string): string {
        const segments = drivePath.split('/');

        // First segment is typically the project root (e.g., "PRJ-017-RFP" or "PRJ-017-PD")
        // Skip it and process remaining segments
        const remaining = segments.slice(1);

        const cleaned = remaining.map(seg => {
            // Strip patterns like "3-PRJ-017-RFP-" or "1-PRJ-017-PD-" from start
            // Pattern: {number}-{project_code}-{suffix}-{template_name}
            const prefixPattern = new RegExp(`^\\d+-${projectCode.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}-(RFP|PD)-`, 'i');
            let cleaned = seg.replace(prefixPattern, '');

            // Also try without the number prefix: "{project_code}-RFP-{name}"
            if (cleaned === seg) {
                const altPattern = new RegExp(`^${projectCode.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}-(RFP|PD)-`, 'i');
                cleaned = seg.replace(altPattern, '');
            }

            return cleaned;
        });

        return cleaned.filter(s => s).join('/');
    }

    // Debug: Log template map keys and first few folder paths for comparison
    const mapKeys = Array.from(templateMap.keys()).slice(0, 5);
    const samplePaths = folders.slice(0, 3).map((f: any) => ({
        raw: f.template_path,
        normalized: normalizeDrivePathToTemplate(f.template_path)
    }));
    await writeJobLog(jobId, project.id, project.name, null, 'debug_paths', 'info', {
        templateMapKeys: mapKeys,
        sampleFolderPaths: samplePaths,
        projectCode
    });

    // Step 4: Process each folder with RESET-THEN-APPLY
    for (const folder of folders) {
        // Normalize Drive path to template-matching path
        const rawPath = folder.template_path;
        const templatePath = normalizeDrivePathToTemplate(rawPath);
        if (!templatePath) continue;

        const expectedPerms = templateMap.get(templatePath);
        if (!expectedPerms) {
            await writeJobLog(jobId, project.id, project.name, rawPath, 'no_template', 'warning', {
                message: 'Folder not in template',
                normalizedPath: templatePath
            });
            continue;
        }

        await writeJobLog(jobId, project.id, project.name, templatePath, 'start_reset_apply', 'info', {
            folderId: folder.drive_folder_id
        });

        // === PHASE 1: RESET - Remove all non-protected permissions ===
        try {
            const currentPerms = await listPermissions(folder.drive_folder_id);

            for (const perm of currentPerms) {
                if (!perm.emailAddress) continue;

                // Skip protected principals
                if (protectedPrincipals.some(p => p.toLowerCase() === perm.emailAddress?.toLowerCase())) {
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'skip_protected', 'info', {
                        email: perm.emailAddress
                    });
                    continue;
                }

                // Skip inherited permissions (cannot be removed at folder level)
                if (perm.inherited || perm.permissionDetails?.[0]?.inherited) {
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'skip_inherited', 'info', {
                        email: perm.emailAddress,
                        role: perm.role
                    });
                    continue;
                }

                // Remove permission
                try {
                    await removePermission(folder.drive_folder_id, perm.id!);
                    removed++;
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'removed_permission', 'success', {
                        email: perm.emailAddress,
                        role: perm.role
                    });
                    await sleep(RATE_LIMIT_DELAY);
                } catch (err: any) {
                    // Permission not found = already removed (success)
                    if (err.message?.includes('Permission not found') || err.message?.includes('not found')) {
                        removed++;
                        await writeJobLog(jobId, project.id, project.name, templatePath, 'already_removed', 'info', {
                            email: perm.emailAddress
                        });
                    } else {
                        errors++;
                        await writeJobLog(jobId, project.id, project.name, templatePath, 'remove_failed', 'error', {
                            email: perm.emailAddress,
                            error: err.message
                        });
                    }
                }
            }

            // === PHASE 2: Clear Limited Access ===
            try {
                const wasLimited = await setLimitedAccess(folder.drive_folder_id, false);
                await writeJobLog(jobId, project.id, project.name, templatePath, 'cleared_limited_access', 'success', {
                    previousState: wasLimited
                });
                await sleep(RATE_LIMIT_DELAY);
            } catch (err: any) {
                await writeJobLog(jobId, project.id, project.name, templatePath, 'clear_limited_failed', 'warning', {
                    error: err.message
                });
            }

        } catch (err: any) {
            errors++;
            await writeJobLog(jobId, project.id, project.name, templatePath, 'reset_phase_failed', 'error', {
                error: err.message
            });
            continue; // Skip to next folder
        }

        // === PHASE 3: APPLY TEMPLATE ===
        try {
            // 3a. Set Limited Access if required
            if (expectedPerms.limitedAccess) {
                try {
                    await setLimitedAccess(folder.drive_folder_id, true);
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'set_limited_access', 'success', {
                        enabled: true
                    });
                    await sleep(RATE_LIMIT_DELAY);
                } catch (err: any) {
                    errors++;
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'set_limited_failed', 'error', {
                        error: err.message
                    });
                }
            }

            // 3b. Add groups from template
            const groups = expectedPerms.groups || [];
            for (const group of groups) {
                if (!group.email) continue;

                try {
                    await addPermission(folder.drive_folder_id, 'group', group.role || 'reader', group.email);
                    added++;
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'added_group', 'success', {
                        email: group.email,
                        role: group.role
                    });
                    await sleep(RATE_LIMIT_DELAY);
                } catch (err: any) {
                    errors++;
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'add_group_failed', 'error', {
                        email: group.email,
                        error: err.message
                    });
                }
            }

            // 3c. Add users from template
            const users = expectedPerms.users || [];
            for (const user of users) {
                if (!user.email) continue;

                try {
                    await addPermission(folder.drive_folder_id, 'user', user.role || 'reader', user.email);
                    added++;
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'added_user', 'success', {
                        email: user.email,
                        role: user.role
                    });
                    await sleep(RATE_LIMIT_DELAY);
                } catch (err: any) {
                    errors++;
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'add_user_failed', 'error', {
                        email: user.email,
                        error: err.message
                    });
                }
            }

            await writeJobLog(jobId, project.id, project.name, templatePath, 'folder_complete', 'success', {
                groupsAdded: groups.length,
                usersAdded: users.length,
                limitedAccess: !!expectedPerms.limitedAccess
            });

        } catch (err: any) {
            errors++;
            await writeJobLog(jobId, project.id, project.name, templatePath, 'apply_phase_failed', 'error', {
                error: err.message
            });
        }

        await sleep(RATE_LIMIT_DELAY);
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
