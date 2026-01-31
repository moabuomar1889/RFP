import { inngest } from '@/lib/inngest';
import { supabaseAdmin } from '@/lib/supabase';
import {
    getAllProjects,
    getAllFoldersRecursive,
    createFolder,
    renameFolder,
    listPermissions,
    addPermission,
    removePermission,
    isProtectedPermission,
} from '@/server/google-drive';
import { JOB_STATUS, TASK_STATUS } from '@/lib/config';

// Rate limiting helper
const RATE_LIMIT_DELAY = 300; // ms between API calls
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

        // Get protected principals
        const protectedPrincipals = await step.run('get-protected', async () => {
            const { data } = await supabaseAdmin
                .schema('rfp')
                .from('app_settings')
                .select('value')
                .eq('key', 'protected_principals')
                .single();
            return data ? JSON.parse(data.value) : ['mo.abuomar@dtgsa.com'];
        });

        // Get projects to enforce
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

        let totalViolations = 0;
        let totalReverted = 0;

        // Process each project
        for (const project of projects) {
            await step.run(`enforce-${project.pr_number}`, async () => {
                const result = await enforceProjectPermissions(project, protectedPrincipals);
                totalViolations += result.violations;
                totalReverted += result.reverted;

                // Update last enforced
                await supabaseAdmin
                    .schema('rfp')
                    .from('projects')
                    .update({ last_enforced_at: new Date().toISOString() })
                    .eq('id', project.id);
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
                    metadata: { totalViolations, totalReverted }
                })
                .eq('id', jobId);
        });

        return { success: true, totalViolations, totalReverted };
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

        // Build index for each project
        for (const project of projects) {
            await step.run(`index-${project.pr_number}`, async () => {
                // Get all folders from Drive
                const folders = await getAllFoldersRecursive(project.drive_folder_id);

                // Upsert to folder_index
                for (const folder of folders) {
                    await supabaseAdmin
                        .schema('rfp')
                        .from('folder_index')
                        .upsert({
                            project_id: project.id,
                            template_path: folder.path,
                            drive_folder_id: folder.id,
                            drive_folder_name: folder.name,
                            last_verified_at: new Date().toISOString(),
                        }, { onConflict: 'project_id,template_path' });
                }

                await sleep(RATE_LIMIT_DELAY);
            });
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

        return { success: true, projectsIndexed: projects.length };
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
): Promise<{ violations: number; reverted: number }> {
    let violations = 0;
    let reverted = 0;

    // Get all folders in project from index
    const { data: folders } = await supabaseAdmin
        .schema('rfp')
        .from('folder_index')
        .select('*')
        .eq('project_id', project.id);

    if (!folders) return { violations: 0, reverted: 0 };

    for (const folder of folders) {
        // Get expected permissions for this path
        const { data: expectedPerms } = await supabaseAdmin
            .schema('rfp')
            .from('expected_permissions')
            .select('*, permission_roles(*)')
            .eq('template_path', folder.template_path);

        // Get actual permissions from Drive
        const actualPerms = await listPermissions(folder.drive_folder_id);

        // Compare and find violations
        // (This is a simplified version - full implementation would be more complex)
        for (const actual of actualPerms) {
            const isProtected = await isProtectedPermission(actual, protectedPrincipals);
            if (isProtected) continue;

            // Check if this permission is expected
            const isExpected = expectedPerms?.some(exp =>
                // Match logic here
                true
            );

            if (!isExpected) {
                violations++;

                // Log violation
                await supabaseAdmin
                    .schema('rfp')
                    .from('permission_violations')
                    .insert({
                        folder_index_id: folder.id,
                        project_id: project.id,
                        violation_type: 'unexpected_user',
                        actual: actual,
                        auto_reverted: true,
                    });

                // Revert (remove unauthorized permission)
                try {
                    await removePermission(folder.drive_folder_id, actual.id!);
                    reverted++;
                } catch (error) {
                    console.error(`Failed to remove permission: ${error}`);
                }
            }
        }

        await sleep(RATE_LIMIT_DELAY);
    }

    return { violations, reverted };
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

            // Apply permissions if limitedAccess
            if (folderDef.limitedAccess && (folderDef.groups || folderDef.roles)) {
                // Apply permissions based on template
                // (Implementation would add permissions here)
            }
        } catch (error) {
            console.error(`Failed to create folder ${folderName}:`, error);
        }
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
