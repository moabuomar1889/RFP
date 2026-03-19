import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/template-nodes
 *
 * Returns a flat list of all template nodes with their node_id and display path.
 * Used by the /folder-mapping UI to let users pick the correct template node
 * when manually mapping an unmapped Drive folder.
 */
export async function GET(request: NextRequest) {
    try {
        const { data: templateData, error: templateErr } = await supabaseAdmin.rpc('get_active_template');
        if (templateErr || !templateData) {
            return NextResponse.json({ error: 'Failed to load template' }, { status: 500 });
        }

        const template = Array.isArray(templateData) ? templateData[0] : templateData;
        if (!template?.template_json) {
            return NextResponse.json({ error: 'No active template found' }, { status: 404 });
        }

        const rawNodes = Array.isArray(template.template_json)
            ? template.template_json
            : template.template_json.template || [];

        // Flatten all nodes into a list with their display paths and node_ids
        const flatList: { node_id: string; path: string; name: string; phase: string; limitedAccess: boolean }[] = [];

        function collectNodes(nodes: any[], parentPath = '', phase = '') {
            for (const node of nodes) {
                const name = node.name || node.text || '';
                if (!name) continue;

                const path = parentPath ? `${parentPath}/${name}` : name;
                const nodePhase = phase || name; // top-level nodes define the phase

                // Skip nodes without node_id (not yet stamped — run stamp-node-ids first)
                if (node.node_id) {
                    flatList.push({
                        node_id: node.node_id,
                        path,
                        name,
                        phase: nodePhase,
                        limitedAccess: node.limitedAccess || false,
                    });
                }

                const children = node.children || node.nodes || [];
                if (children.length > 0) {
                    collectNodes(children, path, nodePhase);
                }
            }
        }

        collectNodes(rawNodes);
        flatList.sort((a, b) => a.path.localeCompare(b.path));

        return NextResponse.json({
            success: true,
            nodes: flatList,
            total: flatList.length,
            template_version: template.version_number,
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
