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
        const body = await request.json();
        const { projectId, metadata } = body; // Extract metadata from request

        // Validate projectId if provided
        if (projectId && typeof projectId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Invalid projectId' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();
        const jobId = uuidv4();

        // Create job record using RPC with metadata in job_details
        const jobDetails = projectId
            ? { action: 'enforce_single', projectId, ...metadata } // Spread metadata into job_details
            : { action: 'enforce_all' };

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

        // Trigger Inngest job with projectId
        await inngest.send({
            name: 'permissions/enforce',
            data: {
                jobId,
                projectId: projectId || null,
                metadata: metadata || {}, // Pass metadata to worker
                triggeredBy: 'admin',
            },
        });

        return NextResponse.json({
            success: true,
            jobId,
            message: projectId
                ? `Enforce permissions job started for project ${projectId}`
                : 'Enforce permissions job started for all projects'
        });
    } catch (error) {
        console.error('Error starting enforce permissions job:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to start enforce permissions job'
        }, { status: 500 });
    }
}
