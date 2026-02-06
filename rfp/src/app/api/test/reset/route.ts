import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resetPermissionsForProject } from '@/server/jobs';

/**
 * UNPROTECTED TEST ENDPOINT
 * POST /api/test/reset
 * Same as /api/permissions/reset but without auth for testing
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId } = body;

        if (!projectId) {
            return NextResponse.json(
                { error: 'projectId required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Count folders
        const { count } = await supabase
            .from('folder_index')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId);

        // Create job
        const { data: job, error: jobError } = await supabase
            .from('reset_jobs')
            .insert({
                project_id: projectId,
                total_folders: count || 0,
                created_by: 'test',
                status: 'pending'
            })
            .select()
            .single();

        if (jobError) {
            return NextResponse.json(
                { error: 'Failed to create job', details: jobError.message },
                { status: 500 }
            );
        }

        // Start async
        resetPermissionsForProject(projectId, job.id).catch(error => {
            console.error(`Job ${job.id} failed:`, error);
        });

        return NextResponse.json({
            success: true,
            jobId: job.id,
            totalFolders: count || 0
        });

    } catch (error: any) {
        console.error('Test reset error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET /api/test/reset?jobId=xxx
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: 'jobId required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .rpc('get_reset_job_progress', { p_job_id: jobId })
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data || { error: 'Job not found' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
