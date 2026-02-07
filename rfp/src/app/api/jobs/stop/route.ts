import { NextRequest, NextResponse } from 'next/server';
import { getRawSupabaseAdmin } from '@/lib/supabase';

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

        const supabase = getRawSupabaseAdmin();

        // Update job status to cancelled in rfp schema
        const { error: updateError } = await supabase
            .schema('rfp')
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
                { success: false, error: `Failed to update job status: ${updateError.message}` },
                { status: 500 }
            );
        }

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
