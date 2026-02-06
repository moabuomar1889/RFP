import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs
 * Get all sync jobs from database
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabaseAdmin
            .schema('rfp')
            .from('sync_jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data: jobs, error } = await query;

        if (error) {
            console.error('Error fetching jobs:', error);
            return NextResponse.json({
                success: true,
                jobs: [],
                message: 'No jobs found.',
            });
        }

        // Calculate stats
        const stats = {
            running: jobs?.filter(j => j.status === 'running').length || 0,
            completedToday: jobs?.filter(j => {
                const createdAt = new Date(j.created_at);
                const today = new Date();
                return j.status === 'completed' &&
                    createdAt.toDateString() === today.toDateString();
            }).length || 0,
            failedThisWeek: jobs?.filter(j => {
                const createdAt = new Date(j.created_at);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return j.status === 'failed' && createdAt > weekAgo;
            }).length || 0,
        };

        return NextResponse.json({
            success: true,
            jobs: jobs || [],
            stats,
            count: jobs?.length || 0,
        });
    } catch (error) {
        console.error('Jobs API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch jobs',
            jobs: [],
        }, { status: 500 });
    }
}
