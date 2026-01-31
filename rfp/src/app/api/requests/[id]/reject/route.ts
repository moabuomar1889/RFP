import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/requests/[id]/reject
 * Reject a project request (admin only)
 * Body: { reason: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const body = await request.json();
        const { reason } = body;

        // Get session from cookie
        const session = request.cookies.get('rfp_session');
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const reviewedBy = session.value;

        const supabase = getSupabaseAdmin();

        // Get the request
        const { data: projectRequest, error: fetchError } = await supabase
            .schema('rfp')
            .from('project_requests')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !projectRequest) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (projectRequest.status !== 'pending') {
            return NextResponse.json({ error: 'Request is not pending' }, { status: 400 });
        }

        // Update request status
        const { error: updateError } = await supabase
            .schema('rfp')
            .from('project_requests')
            .update({
                status: 'rejected',
                reviewed_by: reviewedBy,
                reviewed_at: new Date().toISOString(),
                rejection_reason: reason || 'No reason provided',
            })
            .eq('id', id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Log audit
        await supabase
            .schema('rfp')
            .from('audit_log')
            .insert({
                action: projectRequest.request_type === 'new_project'
                    ? 'project_request_rejected'
                    : 'upgrade_request_rejected',
                entity_type: 'project_request',
                entity_id: id,
                details: {
                    reason,
                    projectName: projectRequest.project_name,
                    prNumber: projectRequest.pr_number,
                },
                performed_by: reviewedBy,
            });

        return NextResponse.json({
            success: true,
            message: 'Request rejected'
        });
    } catch (error) {
        console.error('Reject request error:', error);
        return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
    }
}
