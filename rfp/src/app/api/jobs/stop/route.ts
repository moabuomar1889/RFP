import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { inngest } from '@/lib/inngest';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/stop
 * Stop a running job and update its status to cancelled
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId } = body;

        if (!jobId) {
            return NextResponse.json(
                { success: false, error: 'Job ID is required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Update job status to cancelled
        const { error: updateError } = await supabase
            .from('sync_jobs')
            .update({
                status: 'cancelled',
                completed_at: new Date().toISOString()
            })
            .eq('id', jobId)
            .eq('status', 'running'); // Only cancel if currently running

        if (updateError) {
            console.error('Error updating job status:', updateError);
            return NextResponse.json(
                { success: false, error: 'Failed to update job status' },
                { status: 500 }
            );
        }

        // TODO: Actually cancel the Inngest job
        // Inngest doesn't have a direct "cancel" API in the SDK yet
        // The job will see the database status change and should stop gracefully
        // For now, we just update the database status

        return NextResponse.json({
            success: true,
            message: 'Job cancelled successfully'
        });
    } catch (error: any) {
        console.error('Error stopping job:', error);
        return NextResponse.json({
            success: false,
            error: `Failed to stop job: ${error.message}`
        }, { status: 500 });
    }
}
