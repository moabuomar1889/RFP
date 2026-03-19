import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildEffectivePermissionsMap } from '@/server/audit-helpers';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/unmapped-folders?projectId=...
 *
 * Returns folder_index entries where template_node_id IS NULL
 * (folders that are indexed but not bound to a template node).
 * Used by the /folder-mapping UI for Option B manual mapping.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        let query = supabaseAdmin
            .schema('rfp')
            .from('folder_index')
            .select('id, project_id, drive_folder_id, template_path, normalized_template_path, created_at, updated_at')
            .is('template_node_id', null)
            .order('template_path');

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Enrich with project info
        const { data: projects } = await supabaseAdmin
            .schema('rfp')
            .from('projects')
            .select('id, name, pr_number');

        const projectMap = new Map((projects || []).map((p: any) => [p.id, p]));

        const enriched = (data || []).map((row: any) => ({
            ...row,
            project_name: projectMap.get(row.project_id)?.name ?? 'Unknown',
            project_code: projectMap.get(row.project_id)?.pr_number ?? '',
        }));

        return NextResponse.json({ success: true, folders: enriched, total: enriched.length });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
