import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs/[id]/logs
 * Get detailed logs for a specific job
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: jobId } = await params;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '200');

        // Get logs using public wrapper
        const { data: logs, error } = await supabaseAdmin.rpc('list_job_logs', {
            p_job_id: jobId,
            p_limit: limit
        });

        if (error) {
            console.error('Error fetching job logs:', error);
            return NextResponse.json({
                success: false,
                error: error.message,
                logs: []
            });
        }

        return NextResponse.json({
            success: true,
            logs: logs || [],
            count: logs?.length || 0
        });
    } catch (error) {
        console.error('Job logs API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch job logs',
            logs: []
        }, { status: 500 });
    }
}
