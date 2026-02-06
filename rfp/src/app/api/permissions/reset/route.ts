import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resetPermissionsForProject } from '@/server/jobs';

/**
 * POST /api/permissions/reset
 * Manual reset tool for permission system (AC-5: batched execution)
 * 
 * Body:
 * - projectId: UUID (optional - if provided, reset all folders in project)
 * - folderIds: UUID[] (optional - if provided, reset specific folders)
 * - resetAll: boolean (optional - if true, reset all projects)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, folderIds, resetAll } = body;

        const supabase = getSupabaseAdmin();

        // Validation
        if (!projectId && !folderIds && !resetAll) {
            return NextResponse.json(
                { error: 'Must provide projectId, folderIds, or resetAll' },
                { status: 400 }
            );
        }

        if (resetAll) {
            return NextResponse.json(
                { error: 'resetAll not implemented yet - use projectId for safety' },
                { status: 400 }
            );
        }

        // Create reset job record
        const jobData: any = {
            created_by: 'admin',
            status: 'pending'
        };

        if (projectId) {
            // Count folders in project
            const { count } = await supabase
                .from('folder_index')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', projectId);

            jobData.project_id = projectId;
            jobData.total_folders = count || 0;
        } else if (folderIds && folderIds.length > 0) {
            jobData.folder_ids = folderIds;
            jobData.total_folders = folderIds.length;
        }

        const { data: job, error: jobError } = await supabase
            .from('reset_jobs')
            .insert(jobData)
            .select()
            .single();

        if (jobError) {
            console.error('Failed to create reset job:', jobError);
            return NextResponse.json(
                { error: 'Failed to create reset job', details: jobError.message },
                { status: 500 }
            );
        }

        // Start reset asynchronously (don't await - return immediately)
        if (projectId) {
            // Fire and forget
            resetPermissionsForProject(projectId, job.id).catch(error => {
                console.error(`Reset job ${job.id} failed:`, error);
                supabase
                    .from('reset_jobs')
                    .update({ status: 'failed' })
                    .eq('id', job.id)
                    .then(() => console.log(`Marked job ${job.id} as failed`));
            });
        } else if (folderIds && folderIds.length > 0) {
            // TODO: Implement folder-specific reset
            return NextResponse.json(
                { error: 'folderIds reset not implemented yet - use projectId' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            jobId: job.id,
            totalFolders: jobData.total_folders,
            message: `Reset job ${job.id} started for ${jobData.total_folders} folders`
        });

    } catch (error: any) {
        console.error('Reset API error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET /api/permissions/reset?jobId=xxx
 * Get reset job progress
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json(
                { error: 'jobId parameter required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .rpc('get_reset_job_progress', { p_job_id: jobId })
            .single();

        if (error) {
            console.error('Failed to get job progress:', error);
            return NextResponse.json(
                { error: 'Failed to get job progress', details: error.message },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Reset status API error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
