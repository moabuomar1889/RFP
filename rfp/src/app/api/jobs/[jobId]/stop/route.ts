import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/[jobId]/stop
 * Stop a running job
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const supabase = getSupabaseAdmin();
        const { jobId } = await params;

        // Update job status to failed
        const { error } = await supabase
            .from('rfp.sync_jobs')
            .update({
                status: 'failed',
                error_message: 'Job manually stopped by user',
                completed_at: new Date().toISOString(),
            })
            .eq('id', jobId)
            .eq('status', 'running'); // Only stop if currently running

        if (error) {
            console.error('Error stopping job:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to stop job' },
                { status: 500 }
            );
        }

        // Log the job stop
        await supabase.rpc('insert_job_log', {
            p_job_id: jobId,
            p_action: 'job_stopped',
            p_status: 'error',
            p_details: { message: 'Job manually stopped by user' }
        });

        return NextResponse.json({
            success: true,
            message: 'Job stopped successfully'
        });
    } catch (error) {
        console.error('Error stopping job:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to stop job'
        }, { status: 500 });
    }
}
