import { NextRequest, NextResponse } from 'next/server';
import { prisma, ResetJobStatus } from '@/lib/prisma';
import { resetPermissionsForProject } from '@/server/jobs';

/**
 * POST /api/permissions/reset
 * Manual reset tool for permission system (AC-5: batched execution)
 * CODE-FIRST: Uses Prisma Client for type-safe database access
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

        let totalFolders = 0;

        // Count folders using Prisma
        if (projectId) {
            totalFolders = await prisma.folderIndex.count({
                where: { project_id: projectId }
            });
        } else if (folderIds && folderIds.length > 0) {
            totalFolders = folderIds.length;
        }

        // Create reset job using Prisma
        const job = await prisma.resetJob.create({
            data: {
                project_id: projectId || null,
                total_folders: totalFolders,
                status: ResetJobStatus.pending,
                created_by: 'admin'
            }
        });

        // If folder IDs provided, create join table entries
        if (folderIds && folderIds.length > 0) {
            await prisma.resetJobFolder.createMany({
                data: folderIds.map((folderId: string) => ({
                    job_id: job.id,
                    folder_id: folderId
                }))
            });
        }

        // Start reset asynchronously (don't await - return immediately)
        resetPermissionsForProject(projectId, job.id).catch(error => {
            console.error(`Reset job ${job.id} failed:`, error);
            prisma.resetJob.update({
                where: { id: job.id },
                data: { status: ResetJobStatus.failed }
            }).then(() => console.log(`Marked job ${job.id} as failed`));
        });

        return NextResponse.json({
            success: true,
            jobId: job.id,
            totalFolders: totalFolders,
            message: `Reset job ${job.id} started for ${totalFolders} folders`
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
 * CODE-FIRST: Uses Prisma Client
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

        // Get job with progress using Prisma
        const job = await prisma.resetJob.findUnique({
            where: { id: jobId },
            include: {
                project: {
                    select: {
                        name: true,
                        pr_number: true
                    }
                }
            }
        });

        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Calculate progress percentage
        const progressPercent = job.total_folders > 0
            ? Math.round((job.processed_folders / job.total_folders) * 100)
            : 0;

        return NextResponse.json({
            id: job.id,
            project_id: job.project_id,
            project_name: job.project?.name,
            pr_number: job.project?.pr_number,
            total_folders: job.total_folders,
            processed_folders: job.processed_folders,
            successful_folders: job.successful_folders,
            failed_folders: job.failed_folders,
            status: job.status,
            progress_percent: progressPercent,
            started_at: job.started_at,
            completed_at: job.completed_at,
            created_at: job.created_at
        });

    } catch (error: any) {
        console.error('Reset status API error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
