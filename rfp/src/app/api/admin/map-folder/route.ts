import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/map-folder
 * Body: { folder_index_id: string, template_node_id: string }
 *
 * Manually binds a Drive folder (by folder_index.id) to a template node (by node_id).
 * The binding is stable: subsequent re-index runs will NOT overwrite it.
 *
 * Also supports clearing a mapping:
 * Body: { folder_index_id: string, template_node_id: null }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { folder_index_id, template_node_id } = body;

        if (!folder_index_id) {
            return NextResponse.json({ error: 'folder_index_id is required' }, { status: 400 });
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

        // Update the binding
        const { data, error } = await supabaseAdmin
            .schema('rfp')
            .from('folder_index')
            .update({ template_node_id: template_node_id ?? null, updated_at: new Date().toISOString() })
            .eq('id', folder_index_id)
            .select('id, drive_folder_id, template_path, template_node_id')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            folder: data,
            action: template_node_id ? 'mapped' : 'unmapped',
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
