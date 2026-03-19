import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/stamp-node-ids
 *
 * One-time migration: traverse the active template JSON and assign a stable
 * UUID (node_id) to every node that doesn't already have one.
 * Nodes that already have a node_id are left untouched.
 *
 * SECURITY: Requires authenticated admin session.
 * Checks the caller's identity from their Supabase auth session and verifies
 * they are listed in the rfp.users table with an admin role.
 *
 * After this runs, serializeTemplate() will preserve the UUIDs on every save.
 */
export async function POST(request: NextRequest) {
    try {
        // ── Auth: verify caller is an authenticated admin ──
        const cookieStore = await cookies();
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '') || '';

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: no auth token provided' }, { status: 401 });
        }

        // Verify the token and get the user
        const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
        }

        // Check that user is admin in rfp.users (or platform users table)
        const { data: userRecord, error: userErr } = await supabaseAdmin
            .schema('rfp')
            .from('users')
            .select('role, email')
            .eq('auth_user_id', user.id)
            .single();

        if (userErr || !userRecord) {
            // Try by email as fallback
            const { data: userByEmail } = await supabaseAdmin
                .schema('rfp')
                .from('users')
                .select('role, email')
                .eq('email', user.email ?? '')
                .single();

            if (!userByEmail || !['admin', 'superadmin', 'manager'].includes(userByEmail.role)) {
                return NextResponse.json({
                    error: 'Forbidden: only admin users can stamp node IDs',
                    user_email: user.email,
                }, { status: 403 });
            }
        } else if (!['admin', 'superadmin', 'manager'].includes(userRecord.role)) {
            return NextResponse.json({
                error: 'Forbidden: only admin users can stamp node IDs',
                user_role: userRecord.role,
            }, { status: 403 });
        }

        // ── Load active template ──
        const { data: templateData, error: templateErr } = await supabaseAdmin.rpc('get_active_template');
        if (templateErr || !templateData) {
            return NextResponse.json({ error: 'Failed to load active template', details: templateErr?.message }, { status: 500 });
        }

        const template = Array.isArray(templateData) ? templateData[0] : templateData;
        if (!template?.template_json) {
            return NextResponse.json({ error: 'No active template found' }, { status: 404 });
        }

        let stamped = 0;
        let existing = 0;

        /** Recursively stamp node_id on every node that lacks one. Preserves existing IDs. */
        function stampNodeIds(nodes: any[]): any[] {
            return nodes.map(node => {
                const hasId = typeof node.node_id === 'string' && node.node_id.length > 8;
                if (!hasId) {
                    node = { ...node, node_id: crypto.randomUUID() };
                    stamped++;
                } else {
                    existing++;
                }

                if (node.children && node.children.length > 0) {
                    node = { ...node, children: stampNodeIds(node.children) };
                }

                return node;
            });
        }

        // Parse template JSON
        const rawNodes = Array.isArray(template.template_json)
            ? template.template_json
            : template.template_json.template || [];

        const stampedNodes = stampNodeIds(rawNodes);

        // Build updated template_json (preserving wrapper if present)
        const updatedJson = Array.isArray(template.template_json)
            ? stampedNodes
            : { ...template.template_json, template: stampedNodes };

        // Save back to DB
        const { error: saveErr } = await supabaseAdmin
            .schema('rfp')
            .from('folder_templates')
            .update({ template_json: updatedJson })
            .eq('is_active', true);

        if (saveErr) {
            return NextResponse.json({ error: 'Failed to save updated template', details: saveErr.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            stamped,
            already_had_node_id: existing,
            total: stamped + existing,
            performed_by: user.email,
            message: `Stamped ${stamped} new UUIDs. ${existing} nodes already had node_id.`,
        });

    } catch (err: any) {
        console.error('[stamp-node-ids] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
