import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/server/google-drive';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scan/projects
 * Scans the Shared Drive and imports existing projects to the database
 */
export async function POST(request: NextRequest) {
    try {
        // Get session
        const session = request.cookies.get('rfp_session');
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('Starting Drive scan for existing projects...');

        // Get all project folders from Drive
        const driveProjects = await getAllProjects();
        console.log(`Found ${driveProjects.length} project folders in Drive`);

        const results = {
            found: driveProjects.length,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [] as string[],
        };

        const supabase = getSupabaseAdmin();

        for (const folder of driveProjects) {
            try {
                // Parse project info from folder name (PRJ-PR-XXX-Name)
                const match = folder.name?.match(/^PRJ-PR-(\d+)-(.+)$/);
                if (!match) {
                    results.skipped++;
                    continue;
                }

                const prNumber = `PR-${match[1]}`;
                const projectName = match[2];

                // Check if project already exists in database
                const { data: existing } = await supabase
                    .schema('rfp')
                    .from('projects')
                    .select('id')
                    .eq('drive_folder_id', folder.id)
                    .single();

                if (existing) {
                    // Update existing project
                    await supabase
                        .schema('rfp')
                        .from('projects')
                        .update({
                            name: projectName,
                            pr_number: prNumber,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existing.id);
                    results.updated++;
                } else {
                    // Determine phase based on folder name or contents
                    // If folder name contains "Project Delivery" or "PD", it's execution phase
                    const hasPD = folder.name?.includes('Project Delivery') || folder.name?.includes('-PD-');
                    const phase = hasPD ? 'execution' : 'bidding';

                    // Create new project
                    await supabase
                        .schema('rfp')
                        .from('projects')
                        .insert({
                            name: projectName,
                            pr_number: prNumber,
                            drive_folder_id: folder.id,
                            phase,
                            status: 'active',
                            created_at: folder.createdTime || new Date().toISOString(),
                        });
                    results.created++;
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push(`${folder.name}: ${errorMsg}`);
            }
        }

        // Log audit
        await supabase
            .schema('rfp')
            .from('audit_log')
            .insert({
                action: 'drive_scan_completed',
                entity_type: 'system',
                entity_id: 'scan',
                details: results,
                performed_by: session.value,
            });

        console.log('Drive scan completed:', results);

        return NextResponse.json({
            success: true,
            message: `Scan completed. Found ${results.found} projects, created ${results.created}, updated ${results.updated}, skipped ${results.skipped}`,
            results,
        });
    } catch (error) {
        console.error('Drive scan error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Scan failed',
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/scan/projects
 * Returns current scan status and last scan results
 */
export async function GET(request: NextRequest) {
    try {
        const session = request.cookies.get('rfp_session');
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get last scan from audit log
        const { data: lastScan } = await getSupabaseAdmin()
            .schema('rfp')
            .from('audit_log')
            .select('*')
            .eq('action', 'drive_scan_completed')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Get project count
        const { count: projectCount } = await getSupabaseAdmin()
            .schema('rfp')
            .from('projects')
            .select('*', { count: 'exact', head: true });

        return NextResponse.json({
            lastScan: lastScan ? {
                date: lastScan.created_at,
                results: lastScan.details,
                performedBy: lastScan.performed_by,
            } : null,
            projectCount,
        });
    } catch (error) {
        console.error('Get scan status error:', error);
        return NextResponse.json({ error: 'Failed to get scan status' }, { status: 500 });
    }
}
