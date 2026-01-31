import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects
 * Get all projects with optional phase filter
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const phase = searchParams.get('phase'); // 'bidding' or 'execution' or null for all

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('get_projects', {
            p_status: null,
            p_phase: phase,
        });

        if (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }

        return NextResponse.json({
            success: true,
            projects: data || [],
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch projects', projects: [] },
            { status: 500 }
        );
    }
}
