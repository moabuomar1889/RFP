import { NextRequest, NextResponse } from 'next/server';
import { getRawSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/clear
 * Clear all completed/failed/cancelled jobs
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = getRawSupabaseAdmin();

        // First try to delete sync_tasks
        await supabase
            .from('rfp.sync_tasks')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        // Then delete sync_jobs with non-running status
        const { data, error, count } = await supabase
            .from('rfp.sync_jobs')
            .delete()
            .in('status', ['completed', 'failed', 'cancelled', 'pending'])
            .select('id');

        if (error) {
            console.error('Error clearing jobs:', error);
            // Try using RPC as fallback
            const { data: rpcData, error: rpcError } = await supabase.rpc('clear_all_jobs');
            if (rpcError) {
                return NextResponse.json(
                    { success: false, error: `Failed to clear jobs: ${rpcError.message}` },
                    { status: 500 }
                );
            }
            return NextResponse.json({
                success: true,
                deleted: rpcData || 0,
                message: 'Jobs cleared via RPC'
            });
        }

        return NextResponse.json({
            success: true,
            deleted: data?.length || 0,
            message: 'Jobs cleared successfully'
        });
    } catch (error: any) {
        console.error('Error clearing jobs:', error);
        return NextResponse.json({
            success: false,
            error: `Failed to clear jobs: ${error.message}`
        }, { status: 500 });
    }
}
