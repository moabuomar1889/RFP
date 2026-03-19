import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '@/server/admin-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/map-folder
 * ADMIN ONLY — requires valid admin Bearer token.
 *
 * Body: { drive_folder_id: string, template_node_id: string | null }
 *
 * Manually binds a Drive folder to a template node using stable UUIDs.
 * The binding survives re-index runs (COALESCE logic in upsert_folder_index).
 *
 * Set template_node_id to null to remove a binding (unmap).
 */
export async function POST(request: NextRequest) {
    const auth = await requireAdminAuth(request);
    if (!auth.authorized) return auth.response!;

    try {
        const body = await request.json();
        const { drive_folder_id, template_node_id } = body;

        if (!drive_folder_id) {
            return NextResponse.json({ error: 'drive_folder_id is required' }, { status: 400 });
        }

        // If setting a node_id, validate it exists in the active template
        if (template_node_id) {
            const { data: templateData } = await supabaseAdmin.rpc('get_active_template');
            const template = Array.isArray(templateData) ? templateData[0] : templateData;

            if (template?.template_json) {
                const rawNodes = Array.isArray(template.template_json)
                    ? template.template_json
                    : template.template_json.template || [];

                const allNodeIds = new Set<string>();

                function collectIds(nodes: any[]) {
                    for (const node of nodes) {
                        if (node.node_id) allNodeIds.add(node.node_id);
                        const children = node.children || node.nodes || [];
                        if (children.length > 0) collectIds(children);
                    }
                }
                collectIds(rawNodes);

                if (!allNodeIds.has(template_node_id)) {
                    return NextResponse.json({
                        error: 'template_node_id not found in active template. Run stamp-node-ids first.',
                        provided: template_node_id,
                    }, { status: 400 });
                }
            }
        }

        // Update by drive_folder_id — may affect multiple rows if same folder appears in multiple projects
        // (normally shouldn't, but safe to update all matching rows)
        const { data, error } = await supabaseAdmin
            .schema('rfp')
            .from('folder_index')
            .update({
                template_node_id: template_node_id ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('drive_folder_id', drive_folder_id)
            .select('id, drive_folder_id, template_path, template_node_id, project_id');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            updated: data,
            action: template_node_id ? 'mapped' : 'unmapped',
            performed_by: auth.user?.email,
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
