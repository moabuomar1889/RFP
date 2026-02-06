import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface Job {
    id: string;
    job_type: string;
    status: string;
    progress_percent: number;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    created_at: string;
    completed_at: string | null;
    started_by: string;
    error_summary: string | null;
}

/**
 * GET /api/jobs
 * Get all sync jobs from database using public wrapper
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || null;
        const limit = parseInt(searchParams.get('limit') || '50');

        // Use public.list_sync_jobs() wrapper
        const { data: jobs, error } = await supabaseAdmin.rpc('list_sync_jobs', {
            p_status: status === 'all' ? null : status,
            p_limit: limit
        });

        if (error) {
            console.error('Error fetching jobs:', error);
            return NextResponse.json({
                success: true,
                jobs: [],
                stats: { running: 0, completedToday: 0, failedThisWeek: 0 },
                message: 'No jobs found.',
            });
        }

        const jobList = (jobs || []) as Job[];

        // Calculate stats
        const stats = {
            running: jobList.filter(j => j.status === 'running').length,
            completedToday: jobList.filter(j => {
                const createdAt = new Date(j.created_at);
                const today = new Date();
                return j.status === 'completed' &&
                    createdAt.toDateString() === today.toDateString();
            }).length,
            failedThisWeek: jobList.filter(j => {
                const createdAt = new Date(j.created_at);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return j.status === 'failed' && createdAt > weekAgo;
            }).length,
        };

        // Map to frontend expected format
        const mappedJobs = jobList.map(j => ({
            id: j.id,
            job_type: j.job_type,
            status: j.status,
            progress: j.progress_percent,
            total_tasks: j.total_tasks,
            completed_tasks: j.completed_tasks,
            failed_count: j.failed_tasks,
            created_at: j.created_at,
            completed_at: j.completed_at,
            triggered_by: j.started_by,
            error_message: j.error_summary,
        }));

        return NextResponse.json({
            success: true,
            jobs: mappedJobs,
            stats,
            count: mappedJobs.length,
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
