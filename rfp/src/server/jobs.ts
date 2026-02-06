import { inngest } from '@/lib/inngest';
import { supabaseAdmin, getRawSupabaseAdmin } from '@/lib/supabase';
import {
    getAllProjects,
    getAllFoldersRecursive,
    normalizeFolderPath,
    createFolder,
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
        const { jobId, projectIds, triggeredBy } = event.data;

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

        // Get projects to enforce
        const projects = await step.run('get-projects', async () => {
            // Use getRawSupabaseAdmin to ensure proper client in Inngest context
            const client = getRawSupabaseAdmin();
            const { data, error } = await client.rpc('list_projects', { p_limit: 100 });

            console.log('list_projects result:', { data, error, count: data?.length });

            if (error) {
                console.error('Error fetching projects:', error);
                throw new Error(`Failed to fetch projects: ${error.message}`);
            }

            if (projectIds && projectIds.length > 0) {
                return (data || []).filter((p: any) => projectIds.includes(p.id));
            }
            return data || [];
        });

        const totalProjects = projects.length;
        await writeJobLog(jobId, null, null, null, 'projects_found', 'info', { count: totalProjects });
        await updateJobProgress(jobId, 0, 0, totalProjects);

        let totalViolations = 0;
        let totalReverted = 0;
        let totalAdded = 0;
        let completedProjects = 0;

        // Process each project
        for (const project of projects) {
            await step.run(`enforce-${project.pr_number}`, async () => {
                // Log project start
                await writeJobLog(jobId, project.id, project.name, null, 'start_project', 'info', {
                    pr_number: project.pr_number,
                    phase: project.phase
                });

                const result = await enforceProjectPermissionsWithLogging(
                    project,
                    protectedPrincipals,
                    jobId
                );

                totalViolations += result.violations;
                totalReverted += result.reverted;
                totalAdded += result.added;

                // Log project complete
                await writeJobLog(jobId, project.id, project.name, null, 'complete_project', 'success', {
                    violations: result.violations,
                    reverted: result.reverted,
                    added: result.added
                });

                completedProjects++;
                const progress = Math.round((completedProjects / totalProjects) * 100);
                await updateJobProgress(jobId, progress, completedProjects, totalProjects);
            });
        }

        // Mark job complete
        await step.run('complete-job', async () => {
            await writeJobLog(jobId, null, null, null, 'job_completed', 'success', {
                totalProjects,
                totalViolations,
                totalReverted,
                totalAdded
            });
            await updateJobProgress(jobId, 100, totalProjects, totalProjects, JOB_STATUS.COMPLETED);
        });

        return { success: true, totalViolations, totalReverted, totalAdded };
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



        // Get projects using RPC
        const projects = await step.run('get-projects', async () => {
            const client = getRawSupabaseAdmin();
            const { data, error } = await client.rpc('list_projects', { p_limit: 100 });

            console.log('list_projects result:', { data, error, count: data?.length });

            if (error) {
                console.error('Error fetching projects:', error);
                throw new Error(`Failed to fetch projects: ${error.message}`);
            }

            if (projectIds && projectIds.length > 0) {
                return (data || []).filter((p: any) => projectIds.includes(p.id));
            }
            return data || [];
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
            const stepResult = await step.run(`index-${project.pr_number}`, async () => {
                const client = getRawSupabaseAdmin();

                console.log(`Indexing project ${project.pr_number} with drive_folder_id: ${project.drive_folder_id}`);

                if (!project.drive_folder_id) {
                    console.error(`Project ${project.pr_number} has no drive_folder_id`);
                    return { foldersIndexed: 0, error: 'No drive_folder_id' };
                }

                // Get all folders from Drive
                const folders = await getAllFoldersRecursive(project.drive_folder_id);
                console.log(`Found ${folders.length} folders for ${project.pr_number}`);

                // Upsert to folder_index using RPC
                let upsertedCount = 0;
                for (const folder of folders) {
                    // Calculate normalized template path for matching
                    const normalizedPath = normalizeFolderPath(folder.path);

                    const { error } = await client.rpc('upsert_folder_index', {
                        p_project_id: project.id,
                        p_template_path: folder.path,
                        p_drive_folder_id: folder.id,
                        p_drive_folder_name: folder.name,
                        p_normalized_path: normalizedPath,
                    });

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
            await step.run(`progress-${project.pr_number}`, async () => {
                const client = getRawSupabaseAdmin();
                const progress = Math.round((completedProjects / totalProjects) * 100);
                await client.rpc('update_job_progress', {
                    p_job_id: jobId,
                    p_progress: progress,
                    p_completed_tasks: completedProjects,
                    p_total_tasks: totalProjects,
                    p_status: JOB_STATUS.RUNNING
                });

                // Insert detailed log
                const result = stepResult as any;
                await client.rpc('insert_sync_task', {
                    p_job_id: jobId,
                    p_project_id: project.id,
                    p_task_type: 'folder_index',
                    p_task_details: {
                        pr_number: project.pr_number,
                        foldersFound: result?.foldersFound || 0,
                        foldersUpserted: result?.foldersUpserted || 0,
                        message: `Indexed ${result?.foldersUpserted || 0} of ${result?.foldersFound || 0} folders`
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

async function enforceProjectPermissions(
    project: any,
    protectedPrincipals: string[]
): Promise<{ violations: number; reverted: number; added: number }> {
    let violations = 0;
    let reverted = 0;
    let added = 0;

    console.log(`\n========== ENFORCING PERMISSIONS FOR ${project.pr_number} ==========`);

    // Step 1: Get the active template
    const { data: templateData } = await supabaseAdmin.rpc('get_active_template');
    const template = Array.isArray(templateData) ? templateData[0] : templateData;

    if (!template?.template_json) {
        console.error('No active template found!');
        return { violations: 0, reverted: 0, added: 0 };
    }

    // Parse template and build path-to-permissions map
    const templateNodes = Array.isArray(template.template_json)
        ? template.template_json
        : template.template_json.template || [];

    const permissionsMap = buildPermissionsMap(templateNodes);
    console.log(`Template has ${Object.keys(permissionsMap).length} paths with permissions`);

    // Step 2: Get all indexed folders for this project
    const { data: folders } = await supabaseAdmin
        .schema('rfp')
        .from('folder_index')
        .select('*')
        .eq('project_id', project.id);

    if (!folders || folders.length === 0) {
        console.log('No folders indexed for this project');
        return { violations: 0, reverted: 0, added: 0 };
    }

    console.log(`Processing ${folders.length} folders...`);

    // Step 3: Process each folder
    for (const folder of folders) {
        const templatePath = folder.template_path;
        const expectedPerms = permissionsMap[templatePath];

        if (!expectedPerms) {
            console.log(`No template match for path: ${templatePath}`);
            continue;
        }

        console.log(`\n--- Processing: ${folder.drive_folder_name} (${templatePath}) ---`);
        console.log(`Expected: ${expectedPerms.groups.length} groups, ${expectedPerms.users.length} users, limitedAccess=${expectedPerms.limitedAccess}`);

        // Get actual permissions from Drive
        let actualPerms;
        try {
            actualPerms = await listPermissions(folder.drive_folder_id);
        } catch (err: any) {
            console.error(`Failed to get permissions for ${folder.drive_folder_name}:`, err.message);
            continue;
        }

        // Build set of expected emails (lowercase for comparison)
        const expectedEmails = new Set<string>();
        for (const g of expectedPerms.groups) {
            if (g.email) expectedEmails.add(g.email.toLowerCase());
        }
        for (const u of expectedPerms.users) {
            if (u.email) expectedEmails.add(u.email.toLowerCase());
        }

        // Build map of actual emails
        const actualEmailsMap = new Map<string, any>();
        for (const perm of actualPerms) {
            if (perm.emailAddress) {
                actualEmailsMap.set(perm.emailAddress.toLowerCase(), perm);
            }
        }

        // Step 3a: ADD missing permissions
        for (const group of expectedPerms.groups) {
            if (!group.email) continue;
            const emailLower = group.email.toLowerCase();
            if (!actualEmailsMap.has(emailLower)) {
                console.log(`[ADD] Missing group: ${group.email} (${group.role})`);
                try {
                    await addPermission(folder.drive_folder_id, 'group', group.role || 'reader', group.email);
                    added++;
                    console.log(`[SUCCESS] Added ${group.email}`);
                } catch (err: any) {
                    console.error(`[FAILED] Could not add ${group.email}:`, err.message);
                }
                await sleep(RATE_LIMIT_DELAY);
            }
        }

        for (const user of expectedPerms.users) {
            if (!user.email) continue;
            const emailLower = user.email.toLowerCase();
            if (!actualEmailsMap.has(emailLower)) {
                console.log(`[ADD] Missing user: ${user.email} (${user.role})`);
                try {
                    await addPermission(folder.drive_folder_id, 'user', user.role || 'reader', user.email);
                    added++;
                    console.log(`[SUCCESS] Added ${user.email}`);
                } catch (err: any) {
                    console.error(`[FAILED] Could not add ${user.email}:`, err.message);
                }
                await sleep(RATE_LIMIT_DELAY);
            }
        }

        // Step 3b: REMOVE unauthorized permissions
        for (const actual of actualPerms) {
            if (!actual.emailAddress) continue;
            const emailLower = actual.emailAddress.toLowerCase();

            // Skip protected principals
            if (protectedPrincipals.some(p => p.toLowerCase() === emailLower)) {
                continue;
            }

            // Skip domain permissions (like dtgsa.com)
            if (actual.type === 'domain') continue;

            // Check if this permission is expected
            if (!expectedEmails.has(emailLower)) {
                violations++;
                console.log(`[REMOVE] Unauthorized: ${actual.emailAddress} (${actual.role})`);
                try {
                    await removePermission(folder.drive_folder_id, actual.id!);
                    reverted++;
                    console.log(`[SUCCESS] Removed ${actual.emailAddress}`);
                } catch (err: any) {
                    console.error(`[FAILED] Could not remove ${actual.emailAddress}:`, err.message);
                }
                await sleep(RATE_LIMIT_DELAY);
            }
        }

        // Step 3c: Enable Limited Access if needed
        if (expectedPerms.limitedAccess) {
            console.log(`[LIMITED ACCESS] Ensuring limited access is enabled...`);
            try {
                await setLimitedAccess(folder.drive_folder_id, true);
            } catch (err: any) {
                console.error(`[FAILED] Could not enable limited access:`, err.message);
            }
        }

        await sleep(RATE_LIMIT_DELAY);
    }

    console.log(`\n========== ENFORCEMENT COMPLETE ==========`);
    console.log(`Added: ${added}, Violations: ${violations}, Reverted: ${reverted}`);

    return { violations, reverted, added };
}

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

    console.log(`\n========== ENFORCING PERMISSIONS FOR ${project.pr_number} ==========`);

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

    const permissionsMap = buildPermissionsMap(templateNodes);

    // Debug: Log permissions map keys
    await writeJobLog(jobId, project.id, project.name, null, 'debug_map', 'info', {
        message: 'Built permissions map',
        totalPaths: Object.keys(permissionsMap).length,
        samplePaths: Object.keys(permissionsMap).slice(0, 5)
    });

    // Step 2: Get all indexed folders for this project
    const { data: folders } = await supabaseAdmin.rpc('list_project_folders', { p_project_id: project.id });

    if (!folders || folders.length === 0) {
        await writeJobLog(jobId, project.id, project.name, null, 'warning', 'warning', { message: 'No folders indexed' });
        return { violations: 0, reverted: 0, added: 0 };
    }

    await writeJobLog(jobId, project.id, project.name, null, 'folders_found', 'info', { count: folders.length });

    // Step 3: Process each folder
    for (const folder of folders) {
        // Use normalized path for matching against template
        const templatePath = folder.normalized_template_path || folder.template_path;
        const expectedPerms = permissionsMap[templatePath];

        if (!expectedPerms) {
            // Debug: Log skipped folder
            await writeJobLog(jobId, project.id, project.name, templatePath, 'skipped_no_match', 'info', {
                normalizedPath: folder.normalized_template_path,
                originalPath: folder.template_path
            });
            continue;
        }

        // Debug: Log matched folder
        await writeJobLog(jobId, project.id, project.name, templatePath, 'matched_folder', 'info', {
            groupCount: expectedPerms.groups?.length || 0,
            userCount: expectedPerms.users?.length || 0,
            limitedAccess: expectedPerms.limitedAccess
        });

        // Get actual permissions from Drive
        let actualPerms;
        try {
            actualPerms = await listPermissions(folder.drive_folder_id);
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

        // Build map of actual ACTIVE emails (exclude deleted permissions from Limited Access)
        const actualEmailsMap = new Map<string, any>();
        for (const perm of actualPerms) {
            // Skip permissions that were removed due to Limited Access
            // These have "deleted" set to true
            if (perm.deleted === true) continue;
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

            // Check if permission already exists with correct role
            const existingPerm = actualEmailsMap.get(groupEmailLower);
            if (existingPerm && existingPerm.role === expectedRole) {
                // Already has correct permission - skip silently or log as info
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
            if (!actualEmailsMap.has(emailLower)) {
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
        }

        // Step 3b: REMOVE unauthorized permissions
        for (const actual of actualPerms) {
            if (!actual.emailAddress) continue;
            const emailLower = actual.emailAddress.toLowerCase();

            // Skip protected principals
            if (protectedPrincipals.some(p => p.toLowerCase() === emailLower)) {
                continue;
            }

            // Skip domain permissions
            if (actual.type === 'domain') continue;

            // Check if this permission is expected
            if (!expectedEmails.has(emailLower)) {
                violations++;

                // RULE: Block delete for inherited permissions
                const isInherited = actual.permissionDetails?.[0]?.inherited || false;
                const inheritedFrom = actual.permissionDetails?.[0]?.inheritedFrom;

                if (isInherited) {
                    // LOG: DRIVE_INHERITED_PERMISSION - Cannot delete, show source
                    await writeJobLog(jobId, project.id, project.name, templatePath, 'inherited_permission_skipped', 'warning', {
                        action: 'BLOCKED',
                        reason: 'DRIVE_INHERITED_PERMISSION',
                        email: actual.emailAddress,
                        role: actual.role,
                        type: actual.type,
                        permissionId: actual.id,
                        sourceFolderId: inheritedFrom,
                        sourceLink: inheritedFrom ? `https://drive.google.com/drive/folders/${inheritedFrom}` : null,
                        message: 'Permission is inherited. Must be removed from source folder.'
                    });
                    await sleep(RATE_LIMIT_DELAY);
                    continue; // Skip to next permission
                }

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

        await sleep(RATE_LIMIT_DELAY);
    }

    return { violations, reverted, added };
}

// Helper: Build a map of template paths to their expected permissions
function buildPermissionsMap(nodes: any[], parentPath: string = ''): Record<string, { groups: any[]; users: any[]; limitedAccess: boolean }> {
    const map: Record<string, { groups: any[]; users: any[]; limitedAccess: boolean }> = {};

    for (const node of nodes) {
        const nodeName = node.text || node.name;
        if (!nodeName) continue;

        const path = parentPath ? `${parentPath}/${nodeName}` : nodeName;

        map[path] = {
            groups: node.groups || [],
            users: node.users || [],
            limitedAccess: node.limitedAccess || false,
        };

        // Recurse into children
        const children = node.nodes || node.children || [];
        if (children.length > 0) {
            const childMap = buildPermissionsMap(children, path);
            Object.assign(map, childMap);
        }
    }

    return map;
}

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
 * Write a permission audit log entry
 */
async function writePermissionAudit(
    jobId: string,
    folderId: string | null,
    action: string,
    details: {
        principalType?: string;
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
        await supabaseAdmin.from('permission_audit').insert({
            job_id: jobId,
            folder_id: folderId,
            action,
            principal_type: details.principalType,
            principal_email: details.principalEmail,
            principal_role: details.principalRole,
            permission_id: details.permissionId,
            is_inherited: details.isInherited ?? false,
            inherited_from: details.inheritedFrom,
            before_state: details.beforeState,
            after_state: details.afterState,
            result: details.result,
            error_message: details.errorMessage
        });
    } catch (err) {
        console.error('Failed to write permission audit:', err);
    }
}

/**
 * Reset a single folder's permissions to match template (AC-2, AC-3)
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
                    beforeState: { limitedAccess: folder.actual_limited_access },
                    afterState: { limitedAccess: actualLimitedAccess },
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

    // Step 3: Update folder_index (AC-3)
    await supabaseAdmin
        .from('folder_index')
        .update({
            actual_limited_access: actualLimitedAccess,
            last_verified_at: new Date().toISOString()
        })
        .eq('id', folder.id);

    console.log(`✓ Folder reset complete`);
}

/**
 * Reset permissions for all folders in a project (AC-5: batched)
 * MANUAL ONLY - triggered via POST /api/permissions/reset
 */
export async function resetPermissionsForProject(
    projectId: string,
    jobId: string
): Promise<void> {
    console.log(`\n========== RESET PROJECT PERMISSIONS ==========`);
    console.log(`Project ID: ${projectId}`);
    console.log(`Job ID: ${jobId}`);

    try {
        // Update job status to running
        await supabaseAdmin
            .from('reset_jobs')
            .update({
                status: 'running',
                started_at: new Date().toISOString()
            })
            .eq('id', jobId);

        // Step 1: Load active template
        const { data: templateData, error: templateError } = await supabaseAdmin
            .rpc('get_active_template')
            .single();

        if (templateError || !templateData) {
            throw new Error(`Failed to load template: ${templateError?.message}`);
        }

        const template = (templateData as any).template_json;
        const permissionsMap = buildPermissionsMap(template);
        console.log(`Template loaded: ${Object.keys(permissionsMap).length} folder definitions`);

        // Step 2: Load folders for project
        const { data: folders, error: foldersError } = await supabaseAdmin
            .from('folder_index')
            .select('*')
            .eq('project_id', projectId);

        if (foldersError || !folders) {
            throw new Error(`Failed to load folders: ${foldersError?.message}`);
        }

        const totalFolders = folders.length;
        console.log(`Folders to reset: ${totalFolders}`);

        let processed = 0;
        let successful = 0;
        let failed = 0;

        // Step 3: Process in batches (AC-5)
        const BATCH_SIZE = 10;
        for (let i = 0; i < totalFolders; i += BATCH_SIZE) {
            const batch = folders.slice(i, i + BATCH_SIZE);
            console.log(`\n--- Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(totalFolders / BATCH_SIZE)} ---`);

            const results = await Promise.allSettled(
                batch.map(folder => resetSingleFolder(folder, permissionsMap, jobId))
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    successful++;
                } else {
                    failed++;
                    console.error(`Reset failed:`, result.reason);
                }
                processed++;
            }

            // Update progress
            await supabaseAdmin
                .from('reset_jobs')
                .update({
                    processed_folders: processed,
                    successful_folders: successful,
                    failed_folders: failed
                })
                .eq('id', jobId);

            console.log(`Progress: ${processed}/${totalFolders} (${successful} success, ${failed} failed)`);

            // Rate limiting
            if (i + BATCH_SIZE < totalFolders) {
                await sleep(RATE_LIMIT_DELAY);
            }
        }

        // Final status
        const finalStatus = failed > 0 ? 'completed' : 'completed'; // Still 'completed' even with some failures
        await supabaseAdmin
            .from('reset_jobs')
            .update({
                status: finalStatus,
                completed_at: new Date().toISOString()
            })
            .eq('id', jobId);

        console.log(`\n========== RESET COMPLETE ==========`);
        console.log(`Total: ${totalFolders}, Success: ${successful}, Failed: ${failed}`);

    } catch (error: any) {
        console.error(`Reset job ${jobId} failed with fatal error:`, error);

        // Mark job as failed
        await supabaseAdmin
            .from('reset_jobs')
            .update({
                status: 'failed',
                completed_at: new Date().toISOString()
            })
            .eq('id', jobId);

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
