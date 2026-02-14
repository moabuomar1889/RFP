import { NextResponse } from 'next/server';
import { listFolders, renameFolder } from '@/server/google-drive';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Bulk strip number prefixes from Drive folder names
 * 
 * Scans all projects recursively, finds folders matching "N-PRJ-..." pattern
 * and renames them by removing the leading "N-" prefix.
 * 
 * Example: "4-PRJ-020-RFP-Commercial Propsal" → "PRJ-020-RFP-Commercial Propsal"
 * 
 * POST /api/admin/strip-prefix
 * Body: { dryRun?: boolean }  — defaults to true (safe preview)
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const dryRun = body.dryRun !== false; // Default to dry run

        const supabase = getSupabaseAdmin();

        // Get all projects
        const { data: projects, error } = await supabase.rpc('get_projects', {
            p_status: null,
            p_phase: null
        });

        if (error || !projects) {
            return NextResponse.json({ error: 'Failed to fetch projects', details: error?.message }, { status: 500 });
        }

        console.log(`[STRIP PREFIX] Scanning ${projects.length} projects (dryRun: ${dryRun})`);

        const results: any[] = [];
        let totalRenamed = 0;
        let totalAlreadyClean = 0;

        // Pattern: starts with one or more digits followed by a dash, then PRJ-
        const numberPrefixPattern = /^\d+-(?=PRJ-)/;

        for (const project of projects) {
            const prNumber = project.pr_number || project.prNumber;
            const rootFolderId = project.drive_folder_id || project.driveFolderId;

            if (!rootFolderId) continue;

            try {
                // Get phase folders (PRJ-XXX-RFP, PRJ-XXX-PD)
                const phaseChildren = await listFolders(rootFolderId);

                for (const phaseFolder of phaseChildren) {
                    // Recursively scan all children of this phase folder
                    await scanAndRename(phaseFolder.id!, prNumber, phaseFolder.name!, results, numberPrefixPattern, dryRun);
                }
            } catch (err: any) {
                results.push({
                    prNumber,
                    status: 'error',
                    error: err.message
                });
            }
        }

        // Count results
        for (const r of results) {
            if (r.status === 'renamed') totalRenamed++;
            if (r.status === 'already_clean') totalAlreadyClean++;
        }

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                projectsScanned: projects.length,
                foldersRenamed: totalRenamed,
                foldersAlreadyClean: totalAlreadyClean,
                totalResults: results.length
            },
            results
        });

    } catch (error: any) {
        console.error('[STRIP PREFIX] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * Recursively scan folders and rename those with number prefixes
 */
async function scanAndRename(
    folderId: string,
    prNumber: string,
    currentName: string,
    results: any[],
    pattern: RegExp,
    dryRun: boolean
) {
    // Check if THIS folder has a number prefix
    if (pattern.test(currentName)) {
        const newName = currentName.replace(pattern, '');

        if (dryRun) {
            results.push({
                prNumber,
                folderId,
                currentName,
                newName,
                status: 'would_rename'
            });
        } else {
            console.log(`[STRIP PREFIX] ${prNumber}: "${currentName}" → "${newName}"`);
            await renameFolder(folderId, newName);
            results.push({
                prNumber,
                folderId,
                currentName,
                newName,
                status: 'renamed'
            });
        }
    } else {
        results.push({
            prNumber,
            folderId,
            currentName,
            status: 'already_clean'
        });
    }

    // Recurse into children
    const children = await listFolders(folderId);
    for (const child of children) {
        await scanAndRename(child.id!, prNumber, child.name!, results, pattern, dryRun);
    }
}
