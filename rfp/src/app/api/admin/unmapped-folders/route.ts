import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '@/server/admin-auth';
import { normalizeIndexedDrivePath } from '@/server/project-phase-paths';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ProjectRow = {
    id: string;
    name: string | null;
    pr_number: string | null;
};

type FolderIndexRow = {
    id: string;
    project_id: string;
    drive_folder_id: string;
    template_path: string | null;
    normalized_template_path: string | null;
    template_node_id: string | null;
    created_at: string;
    updated_at: string;
};

function stripPhasePrefix(templatePath: string | null | undefined): string | null {
    if (!templatePath) return null;
    if (templatePath === 'Bidding' || templatePath === 'Project Delivery') return null;
    if (templatePath.startsWith('Bidding/')) return templatePath.substring('Bidding/'.length);
    if (templatePath.startsWith('Project Delivery/')) return templatePath.substring('Project Delivery/'.length);
    return templatePath;
}

function buildTemplateNodeMap(rawNodes: any[]): Map<string, string> {
    const pathToNodeId = new Map<string, string>();

    function collect(nodes: any[], parentPath = '') {
        for (const node of nodes || []) {
            const name = node?.name || node?.text || '';
            if (!name) continue;

            const currentPath = parentPath ? `${parentPath}/${name}` : name;
            if (node.node_id) {
                pathToNodeId.set(currentPath, node.node_id);
            }

            collect(node.children || node.nodes || [], currentPath);
        }
    }

    collect(rawNodes);
    return pathToNodeId;
}

function resolveTemplateCandidatePath(
    row: any,
    project: ProjectRow | undefined,
    pathToNodeId: Map<string, string>
): string | null {
    const explicitTemplatePath = typeof row.template_path === 'string' ? row.template_path : '';
    if (explicitTemplatePath && pathToNodeId.has(explicitTemplatePath)) {
        return explicitTemplatePath;
    }

    const normalizedTemplatePath = typeof row.normalized_template_path === 'string' ? row.normalized_template_path : '';
    if (normalizedTemplatePath) {
        const phaseCandidates = [
            `Bidding/${normalizedTemplatePath}`,
            `Project Delivery/${normalizedTemplatePath}`,
            normalizedTemplatePath,
        ];

        for (const candidate of phaseCandidates) {
            if (pathToNodeId.has(candidate)) {
                return candidate;
            }
        }
    }

    const projectCode = project?.pr_number || '';
    if (projectCode && explicitTemplatePath) {
        const normalizedFromDrive = normalizeIndexedDrivePath(explicitTemplatePath, projectCode);
        if (normalizedFromDrive && pathToNodeId.has(normalizedFromDrive)) {
            return normalizedFromDrive;
        }
    }

    return null;
}

/**
 * GET /api/admin/unmapped-folders?projectId=...
 *
 * This page is now a recovery/debugging tool only.
 * Before returning any rows, the API automatically binds any system-created
 * folder that can be matched back to a template node by path.
 *
 * The UI should therefore only show folders that were not created by the
 * system template flow, or folders that genuinely cannot be matched safely.
 */
export async function GET(request: NextRequest) {
    const auth = await requireAdminAuth(request);
    if (!auth.authorized) return auth.response!;

    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        const { data: projects } = await supabaseAdmin
            .schema('rfp')
            .from('projects')
            .select('id, name, pr_number');

        const projectMap = new Map<string, ProjectRow>(
            ((projects || []) as ProjectRow[]).map((project) => [project.id, project])
        );

        const { data: templateData, error: templateError } = await supabaseAdmin.rpc('get_active_template');
        if (templateError || !templateData) {
            return NextResponse.json({ error: 'Failed to load active template' }, { status: 500 });
        }

        const template = Array.isArray(templateData) ? templateData[0] : templateData;
        const rawNodes = Array.isArray(template?.template_json)
            ? template.template_json
            : template?.template_json?.template || [];
        const pathToNodeId = buildTemplateNodeMap(rawNodes);

        const fetchUnmappedRows = async () => {
            let query = supabaseAdmin
                .schema('rfp')
                .from('folder_index')
                .select(
                    'id, project_id, drive_folder_id, template_path, normalized_template_path, template_node_id, created_at, updated_at'
                )
                .is('template_node_id', null)
                .order('template_path');

            if (projectId) {
                query = query.eq('project_id', projectId);
            }

            return query;
        };

        const { data: initialRows, error: initialError } = await fetchUnmappedRows();
        if (initialError) {
            return NextResponse.json({ error: initialError.message }, { status: 500 });
        }

        for (const row of (initialRows || []) as FolderIndexRow[]) {
            const project = projectMap.get(row.project_id);
            const candidatePath = resolveTemplateCandidatePath(row, project, pathToNodeId);
            const candidateNodeId = candidatePath ? pathToNodeId.get(candidatePath) || null : null;

            if (!candidatePath || !candidateNodeId) continue;

            const { error: bindError } = await supabaseAdmin.rpc('upsert_folder_index', {
                p_project_id: row.project_id,
                p_template_path: candidatePath,
                p_drive_folder_id: row.drive_folder_id,
                p_normalized_template_path:
                    stripPhasePrefix(candidatePath) ?? row.normalized_template_path,
                p_template_node_id: candidateNodeId,
            });

            if (bindError) {
                console.error('[unmapped-folders] Auto-bind failed:', {
                    drive_folder_id: row.drive_folder_id,
                    candidatePath,
                    error: bindError,
                });
            }
        }

        const { data: refreshedRows, error: refreshedError } = await fetchUnmappedRows();
        if (refreshedError) {
            return NextResponse.json({ error: refreshedError.message }, { status: 500 });
        }

        const visibleRows = ((refreshedRows || []) as FolderIndexRow[]).filter((row) => {
            const project = projectMap.get(row.project_id);
            return !resolveTemplateCandidatePath(row, project, pathToNodeId);
        });

        const { data: statsRows, error: statsError } = await supabaseAdmin
            .schema('rfp')
            .from('folder_index')
            .select('template_node_id');

        if (statsError) {
            return NextResponse.json({ error: statsError.message }, { status: 500 });
        }

        const total = statsRows?.length ?? 0;
        const enriched = visibleRows.map((row) => ({
            ...row,
            project_name: projectMap.get(row.project_id)?.name ?? 'Unknown',
            project_code: projectMap.get(row.project_id)?.pr_number ?? '',
        }));

        return NextResponse.json({
            success: true,
            folders: enriched,
            stats: {
                total,
                bound: total - enriched.length,
                unbound: enriched.length,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
