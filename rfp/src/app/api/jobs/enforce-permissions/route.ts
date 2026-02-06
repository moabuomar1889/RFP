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
        const jobId = uuidv4();

        // Create job record using RPC
        const { error: jobError } = await supabase.rpc('create_sync_job', {
            p_id: jobId,
            p_job_type: 'enforce_permissions',
            p_status: 'pending',
            p_triggered_by: 'admin',
            p_job_details: { action: 'enforce_all' },
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
                triggeredBy: 'admin',
            },
        });

        return NextResponse.json({
            success: true,
            jobId,
            message: 'Enforce permissions job started'
        });
    } catch (error) {
        console.error('Error starting enforce permissions job:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to start enforce permissions job'
        }, { status: 500 });
    }
}
