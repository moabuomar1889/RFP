import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest';
import { getRawSupabaseAdmin } from '@/lib/supabase';
import { JOB_STATUS } from '@/lib/config';

export async function POST(request: NextRequest) {
    try {
        const supabase = getRawSupabaseAdmin();

        // Create a job record for tracking
        const { data: job, error: jobError } = await supabase
            .schema('rfp')
            .from('sync_jobs')
            .insert({
                job_type: 'build_folder_index',
                status: JOB_STATUS.PENDING,
                triggered_by: 'admin',
                metadata: { action: 'rebuild_all' }
            })
            .select()
            .single();

        if (jobError) {
            console.error('Failed to create job:', jobError);
            return NextResponse.json({ success: false, error: 'Failed to create job' }, { status: 500 });
        }

        // Trigger the Inngest function
        await inngest.send({
            name: 'folder-index/build',
            data: {
                jobId: job.id,
                triggeredBy: 'admin',
                rebuildAll: true,
            },
        });

        return NextResponse.json({
            success: true,
            jobId: job.id,
            message: 'Folder index rebuild job started'
        });
    } catch (error) {
        console.error('Error starting rebuild job:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to start rebuild job'
        }, { status: 500 });
    }
}
