import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/sync
 * Trigger project sync job
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { projectId, triggeredBy = 'admin' } = body;

        const supabase = getSupabaseAdmin();
        const jobId = uuidv4();

        // Get active template version using RPC
        const { data: templateVersionData } = await supabase.rpc('get_active_template_version');
        const templateVersion = templateVersionData || 1;

        // Create job record using RPC
        const { error: jobError } = await supabase.rpc('create_sync_job', {
            p_id: jobId,
            p_job_type: projectId ? 'project_sync' : 'template_sync_all',
            p_status: 'pending',
            p_triggered_by: triggeredBy,
            p_job_details: {
                projectId: projectId || 'all',
                templateVersion,
            },
        });

        if (jobError) {
            console.error('Error creating job:', jobError);
            return NextResponse.json(
                { success: false, error: 'Failed to create job' },
                { status: 500 }
            );
        }

        // Trigger appropriate Inngest job
        if (projectId) {
            await inngest.send({
                name: 'project/sync',
                data: {
                    jobId,
                    projectId,
                    templateVersion,
                    triggeredBy,
                },
            });
        } else {
            await inngest.send({
                name: 'template/sync.all',
                data: {
                    jobId,
                    templateVersion,
                    triggeredBy,
                },
            });
        }

        // Log audit using RPC
        await supabase.rpc('log_audit', {
            p_action: projectId ? 'project_sync_triggered' : 'template_sync_all_triggered',
            p_entity_type: projectId ? 'project' : 'system',
            p_entity_id: projectId || jobId,
            p_performed_by: triggeredBy,
            p_details: { templateVersion },
        });

        return NextResponse.json({
            success: true,
            jobId,
            message: projectId ? 'Project sync started' : 'Full template sync started',
        });
    } catch (error) {
        console.error('Error triggering sync:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to trigger sync' },
            { status: 500 }
        );
    }
}
