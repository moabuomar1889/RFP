import { NextRequest, NextResponse } from 'next/server';
import { getRawSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/clear
 * Clear all completed/failed/cancelled jobs using RPC
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = getRawSupabaseAdmin();

        // Use RPC to clear jobs
        const { data, error } = await supabase.rpc('clear_all_jobs');

        if (error) {
            console.error('Error clearing jobs:', error);
            return NextResponse.json(
                { success: false, error: `Failed to clear jobs: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            deleted: data || 0,
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
