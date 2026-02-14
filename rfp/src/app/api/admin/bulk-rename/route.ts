import { NextResponse } from 'next/server';
import { getDriveClient, listFolders, renameFolder } from '@/server/google-drive';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * ONE-TIME Bulk Rename: Fix misnamed "Technical Proposal" child folders
 * 
 * Scans all projects in Drive, finds child folders inside "Technical Proposal/Propsal"
 * parent that are named "*-Technical Proposal" and renames them to "*-Technical Submittal"
 * 
 * POST /api/admin/bulk-rename
 * Body: { dryRun?: boolean }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const dryRun = body.dryRun !== false; // Default to dry run for safety

        const supabase = getSupabaseAdmin();

        // Step 1: Get ALL projects from DB
        const { data: projects, error } = await supabase.rpc('get_projects', {
            p_status: null,
            p_phase: null
        });

        if (error || !projects) {
            return NextResponse.json({ error: 'Failed to fetch projects', details: error?.message }, { status: 500 });
        }

        console.log(`[BULK RENAME] Scanning ${projects.length} projects (dryRun: ${dryRun})`);

        const results: any[] = [];
        let totalRenamed = 0;
        let totalSkipped = 0;

        for (const project of projects) {
            const prNumber = project.pr_number || project.prNumber;
            const rootFolderId = project.drive_folder_id || project.driveFolderId;

            if (!rootFolderId) {
                results.push({ prNumber, status: 'skipped', reason: 'No drive_folder_id' });
                totalSkipped++;
                continue;
            }

            try {
                // Step 2: List root children to find the phase folder (PRJ-XXX-RFP or PRJ-XXX-PD)
                const rootChildren = await listFolders(rootFolderId);

                for (const phaseFolder of rootChildren) {
                    // Step 3: List phase folder children to find "Technical Proposal/Propsal" parent
                    const phaseChildren = await listFolders(phaseFolder.id!);

                    const technicalParent = phaseChildren.find(f => {
                        const name = f.name || '';
                        // Match: "*-Technical Propsal" or "*-Technical Proposal"
                        return /Technical Prop/i.test(name);
                    });

                    if (!technicalParent) continue;

                    // Step 4: List children of Technical Proposal parent
                    const techChildren = await listFolders(technicalParent.id!);

                    for (const child of techChildren) {
                        const childName = child.name || '';

                        // Find children named "*-Technical Proposal" (should be "*-Technical Submittal")
                        // Skip if already named correctly
                        if (/Technical Submittal/i.test(childName)) {
                            results.push({
                                prNumber,
                                folderId: child.id,
                                currentName: childName,
                                status: 'already_correct'
                            });
                            continue;
                        }

                        if (/Technical Proposal/i.test(childName)) {
                            // This is the misnamed folder! Rename it
                            const newName = childName.replace(/Technical Proposal/i, 'Technical Submittal');

                            if (dryRun) {
                                results.push({
                                    prNumber,
                                    folderId: child.id,
                                    currentName: childName,
                                    newName,
                                    parentFolder: technicalParent.name,
                                    status: 'would_rename'
                                });
                            } else {
                                console.log(`[BULK RENAME] ${prNumber}: "${childName}" → "${newName}"`);
                                await renameFolder(child.id!, newName);
                                results.push({
                                    prNumber,
                                    folderId: child.id,
                                    currentName: childName,
                                    newName,
                                    parentFolder: technicalParent.name,
                                    status: 'renamed'
                                });
                                totalRenamed++;
                            }
                        }
                    }
                }
            } catch (err: any) {
                results.push({
                    prNumber,
                    status: 'error',
                    error: err.message
                });
            }
        }

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                projectsScanned: projects.length,
                foldersRenamed: totalRenamed,
                foldersSkipped: totalSkipped,
                totalResults: results.length
            },
            results
        });

    } catch (error: any) {
        console.error('[BULK RENAME] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
