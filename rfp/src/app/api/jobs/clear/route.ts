import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/clear
 * Clear all completed/failed/cancelled jobs
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();

        // Call the RPC to clear all jobs
        const { data, error } = await supabase.rpc('clear_all_jobs');

        if (error) {
            console.error('Error clearing jobs:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to clear jobs' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            deleted: data || 0,
            message: 'Jobs cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing jobs:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to clear jobs'
        }, { status: 500 });
    }
}
