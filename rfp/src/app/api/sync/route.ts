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

        // Get active template version
        const { data: template } = await supabase
            .schema('rfp')
            .from('template_versions')
            .select('version_number')
            .eq('is_active', true)
            .single();

        const templateVersion = template?.version_number || 1;

        // Create job record
        const { error: jobError } = await supabase
            .schema('rfp')
            .from('sync_jobs')
            .insert({
                id: jobId,
                job_type: projectId ? 'project_sync' : 'template_sync_all',
                status: 'pending',
                triggered_by: triggeredBy,
                job_details: {
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

        // Log audit
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
