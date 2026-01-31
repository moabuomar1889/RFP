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
                // Parse project info from folder name (PRJ-XXX-ProjectName)
                // Example: PRJ-005-Construction of Site Occupied Buildings
                const match = folder.name?.match(/^PRJ-(\d+)-(.+)$/);
                if (!match) {
                    console.log(`Skipping folder (no match): ${folder.name}`);
                    results.skipped++;
                    continue;
                }

                const projectNumber = match[1]; // e.g., "005"
                const projectName = match[2];   // e.g., "Construction of Site Occupied Buildings"

                // Phase is determined by subfolders (PRJ-XXX-PD or PRJ-XXX-RFP)
                // For now, set as 'bidding' - user can update later
                const phase = 'bidding';

                // Upsert project using RPC
                const { data: result, error } = await supabase.rpc('upsert_project', {
                    p_name: projectName,
                    p_pr_number: `PRJ-${projectNumber}`,
                    p_drive_folder_id: folder.id,
                    p_phase: phase,
                    p_status: 'active',
                    p_created_at: folder.createdTime || new Date().toISOString(),
                });

                if (error) {
                    throw error;
                }

                if (result?.action === 'created') {
                    results.created++;
                } else if (result?.action === 'updated') {
                    results.updated++;
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push(`${folder.name}: ${errorMsg}`);
            }
        }

        // Log audit using RPC
        await supabase.rpc('log_audit', {
            p_action: 'drive_scan_completed',
            p_entity_type: 'system',
            p_entity_id: 'scan',
            p_details: results,
            p_performed_by: session.value,
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

        const supabase = getSupabaseAdmin();

        // Get last scan from audit log using RPC
        const { data: lastScan } = await supabase.rpc('get_last_scan');

        // Get project count using RPC
        const { data: countResult } = await supabase.rpc('get_project_count');

        return NextResponse.json({
            lastScan: lastScan ? {
                date: lastScan.created_at,
                results: lastScan.details,
                performedBy: lastScan.performed_by,
            } : null,
            projectCount: countResult?.count || 0,
        });
    } catch (error) {
        console.error('Get scan status error:', error);
        return NextResponse.json({ error: 'Failed to get scan status' }, { status: 500 });
    }
}
