import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';

export const dynamic = 'force-dynamic';

/**
 * POST /api/requests/[id]/approve
 * Approve a project request (admin only)
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
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
                status: 'approved',
                reviewed_by: reviewedBy,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Trigger the appropriate job based on request type
        if (projectRequest.request_type === 'new_project') {
            // Create new project
            const { data: newProject, error: projectError } = await supabase
                .schema('rfp')
                .from('projects')
                .insert({
                    pr_number: projectRequest.pr_number,
                    name: projectRequest.project_name,
                    phase: 'bidding',
                    status: 'pending_creation',
                })
                .select()
                .single();

            if (projectError) {
                return NextResponse.json({ error: projectError.message }, { status: 500 });
            }

            // Trigger folder creation job
            await inngest.send({
                name: 'project/create',
                data: {
                    projectId: newProject.id,
                    prNumber: projectRequest.pr_number,
                    projectName: projectRequest.project_name,
                    phase: 'bidding',
                },
            });

            // Log audit
            await supabase
                .schema('rfp')
                .from('audit_log')
                .insert({
                    action: 'project_request_approved',
                    entity_type: 'project_request',
                    entity_id: id,
                    details: {
                        projectId: newProject.id,
                        prNumber: projectRequest.pr_number,
                        projectName: projectRequest.project_name
                    },
                    performed_by: reviewedBy,
                });

        } else if (projectRequest.request_type === 'upgrade_to_pd') {
            // Trigger PD upgrade job
            await inngest.send({
                name: 'project/upgrade-to-pd',
                data: {
                    projectId: projectRequest.project_id,
                    prNumber: projectRequest.pr_number,
                },
            });

            // Log audit
            await supabase
                .schema('rfp')
                .from('audit_log')
                .insert({
                    action: 'upgrade_request_approved',
                    entity_type: 'project_request',
                    entity_id: id,
                    details: { projectId: projectRequest.project_id },
                    performed_by: reviewedBy,
                });
        }

        return NextResponse.json({
            success: true,
            message: 'Request approved successfully'
        });
    } catch (error) {
        console.error('Approve request error:', error);
        return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 });
    }
}
