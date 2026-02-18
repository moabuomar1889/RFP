import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/clear
 * Clear all completed/failed/cancelled jobs using RPC
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();

        // User request: Clear ONLY completed/failed/cancelled jobs. Preserve running/pending.
        const { count, error } = await supabase
            .from('jobs')
            .delete({ count: 'exact' })
            .in('status', ['success', 'failed', 'cancelled', 'error']);

        if (error) {
            console.error('Error clearing jobs:', error);
            return NextResponse.json(
                { success: false, error: `Failed to clear jobs: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            deleted: count || 0,
            message: 'Completed jobs cleared successfully'
        });
    } catch (error: any) {
        console.error('Error clearing jobs:', error);
        return NextResponse.json({
            success: false,
            error: `Failed to clear jobs: ${error.message}`
        }, { status: 500 });
    }
}
