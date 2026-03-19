import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '@/server/admin-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/unmapped-folders?projectId=...
 * ADMIN ONLY — accepts Bearer token OR Supabase session cookie.
 *
 * Returns:
 *   - folders[]: rows from folder_index WHERE template_node_id IS NULL
 *   - stats: { total, bound, unbound } across ALL folder_index rows
 */
export async function GET(request: NextRequest) {
    const auth = await requireAdminAuth(request);
    if (!auth.authorized) return auth.response!;

    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        // ── Fetch unmapped folders ──
        let query = supabaseAdmin
            .schema('rfp')
            .from('folder_index')
            .select('id, project_id, drive_folder_id, template_path, normalized_template_path, template_node_id, created_at, updated_at')
            .is('template_node_id', null)
            .order('template_path');

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data: unmappedRows, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ── Fetch global stats (total / bound / unbound) ──
        const { data: statsRows, error: statsErr } = await supabaseAdmin
            .schema('rfp')
            .from('folder_index')
            .select('template_node_id');

        if (statsErr) {
            return NextResponse.json({ error: statsErr.message }, { status: 500 });
        }

        const total = statsRows?.length ?? 0;
        const bound = statsRows?.filter((r: any) => r.template_node_id !== null).length ?? 0;
        const unbound = total - bound;

        // ── Enrich with project info ──
        const { data: projects } = await supabaseAdmin
            .schema('rfp')
            .from('projects')
            .select('id, name, pr_number');

        const projectMap = new Map((projects || []).map((p: any) => [p.id, p]));

        const enriched = (unmappedRows || []).map((row: any) => ({
            ...row,
            project_name: projectMap.get(row.project_id)?.name ?? 'Unknown',
            project_code: projectMap.get(row.project_id)?.pr_number ?? '',
        }));

        return NextResponse.json({
            success: true,
            folders: enriched,
            stats: { total, bound, unbound },
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
