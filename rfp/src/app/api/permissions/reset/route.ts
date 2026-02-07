import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering (Prisma requires runtime)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/permissions/reset
 * Start a permission reset job for a project or specific folders
 * CODE-FIRST: Uses Prisma Client for type-safe database access
 * 
 * Body:
 *   - projectId: Reset all folders for this project
 *   - folderIds: Reset specific folders (array)
 *   - resetAll: Reset everything (boolean)
 */
export async function POST(request: NextRequest) {
    try {
        // Dynamic import to avoid build-time issues
        const { prisma, ResetJobStatus } = await import('@/lib/prisma');
        const { resetPermissionsForProject } = await import('@/server/jobs');

        const body = await request.json();
        const { projectId, folderIds, resetAll } = body;

        // Validation
        if (!projectId && !folderIds && !resetAll) {
            return NextResponse.json(
                { error: 'Must provide projectId, folderIds, or resetAll' },
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
 * Check status of reset job
 */
export async function GET(request: NextRequest) {
    try {
        // Dynamic import to avoid build-time issues
        const { prisma } = await import('@/lib/prisma');

        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json(
                { error: 'jobId query parameter required' },
                { status: 400 }
            );
        }

        // Get job with related project info using Prisma
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
            projectId: job.project_id,
            projectName: job.project?.name,
            prNumber: job.project?.pr_number,
            status: job.status,
            totalFolders: job.total_folders,
            processedFolders: job.processed_folders,
            successfulFolders: job.successful_folders,
            failedFolders: job.failed_folders,
            progressPercent,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            createdAt: job.created_at,
            createdBy: job.created_by
        });

    } catch (error: any) {
        console.error('Reset status API error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
