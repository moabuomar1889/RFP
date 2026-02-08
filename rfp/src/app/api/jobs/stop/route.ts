import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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

        // Use RPC to cancel job (avoids rfp schema access issue)
        const { data, error } = await supabase.rpc('cancel_sync_job', {
            p_job_id: jobId,
        });

        if (error) {
            console.error('Error cancelling job:', error);
            return NextResponse.json(
                { success: false, error: `Failed to cancel job: ${error.message}` },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json({
                success: false,
                error: 'Job not found or not in a cancellable state',
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: 'Job cancelled successfully',
        });
    } catch (error: any) {
        console.error('Error stopping job:', error);
        return NextResponse.json({
            success: false,
            error: `Failed to stop job: ${error.message}`,
        }, { status: 500 });
    }
}
