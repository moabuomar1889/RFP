import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/enforce
 * Trigger permission enforcement job
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { projectIds, triggeredBy = 'admin' } = body;

        const supabase = getSupabaseAdmin();
        const jobId = uuidv4();

        // Create job record
        const { error: jobError } = await supabase
            .schema('rfp')
            .from('sync_jobs')
            .insert({
                id: jobId,
                job_type: 'permission_enforcement',
                status: 'pending',
                triggered_by: triggeredBy,
                job_details: { projectIds: projectIds || 'all' },
            });

        if (jobError) {
            console.error('Error creating job:', jobError);
            return NextResponse.json(
                { success: false, error: 'Failed to create job' },
                { status: 500 }
            );
        }

        // Trigger Inngest job
        await inngest.send({
            name: 'permissions/enforce',
            data: {
                jobId,
                projectIds: projectIds || undefined,
                triggeredBy,
            },
        });

        // Log audit
        await supabase.rpc('log_audit', {
            p_action: 'permission_enforcement_triggered',
            p_entity_type: 'system',
            p_entity_id: jobId,
            p_performed_by: triggeredBy,
            p_details: { projectIds: projectIds || 'all' },
        });

        return NextResponse.json({
            success: true,
            jobId,
            message: 'Permission enforcement started',
        });
    } catch (error) {
        console.error('Error triggering enforcement:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to trigger enforcement' },
            { status: 500 }
        );
    }
}
