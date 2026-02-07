import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/enforce-permissions
 * Trigger permissions enforcement job
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        const body = await request.json();
        const { projectId, all } = body;

        const jobId = uuidv4();

        // Determine action and details based on request
        const action = all ? 'enforce_all' : 'enforce_single';
        const jobDetails = all
            ? { action: 'enforce_all' }
            : { action: 'enforce_single', projectId };

        // Create job record using RPC
        const { error: jobError } = await supabase.rpc('create_sync_job', {
            p_id: jobId,
            p_job_type: 'enforce_permissions',
            p_status: 'pending',
            p_triggered_by: 'admin',
            p_job_details: jobDetails,
        });

        if (jobError) {
            console.error('Error creating job:', jobError);
            return NextResponse.json(
                { success: false, error: 'Failed to create job' },
                { status: 500 }
            );
        }

        // Trigger Inngest job with appropriate data
        await inngest.send({
            name: 'permissions/enforce',
            data: {
                jobId,
                projectId: all ? undefined : projectId,
                all: !!all,
                triggeredBy: 'admin',
            },
        });

        return NextResponse.json({
            success: true,
            jobId,
            message: all ? 'Enforce all projects job started' : 'Enforce project job started'
        });
    } catch (error) {
        console.error('Error starting enforce permissions job:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to start enforce permissions job'
        }, { status: 500 });
    }
}
