import { NextResponse } from 'next/server';
import { listFolders, renameFolder } from '@/server/google-drive';
import { getSupabaseAdmin } from '@/lib/supabase';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Bulk strip number prefixes from Drive folder names
 * 
 * POST /api/admin/strip-prefix
 * Body: { 
 *   dryRun?: boolean,     — defaults to true (safe preview)
 *   prNumber?: string      — e.g. "PRJ-020" to process one project (recommended)
 *                            omit to process ALL projects
 * }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;
        const filterPrNumber = body.prNumber || null; // e.g. "PRJ-020"

        const supabase = getSupabaseAdmin();

        const { data: projects, error } = await supabase.rpc('get_projects', {
            p_status: null,
            p_phase: null
        });

        if (error || !projects) {
            return NextResponse.json({ error: 'Failed to fetch projects', details: error?.message }, { status: 500 });
        }

        // Filter to specific project if requested
        const targetProjects = filterPrNumber
            ? projects.filter((p: any) => (p.pr_number || p.prNumber) === filterPrNumber)
            : projects;

        console.log(`[STRIP PREFIX] Scanning ${targetProjects.length} projects (dryRun: ${dryRun}, filter: ${filterPrNumber || 'ALL'})`);

        const results: any[] = [];
        // Pattern: starts with one or more digits followed by a dash, then PRJ-
        const numberPrefixPattern = /^\d+-(?=PRJ-)/;

        for (const project of targetProjects) {
            const prNumber = project.pr_number || project.prNumber;
            const rootFolderId = project.drive_folder_id || project.driveFolderId;

            if (!rootFolderId) continue;

            try {
                // Get phase folders (PRJ-XXX-RFP, PRJ-XXX-PD)
                const phaseChildren = await listFolders(rootFolderId);
                await sleep(100);

                for (const phaseFolder of phaseChildren) {
                    // Scan 2 levels deep (children + grandchildren)
                    await scanAndRename(phaseFolder.id!, prNumber, phaseFolder.name!, results, numberPrefixPattern, dryRun, 0, 2);
                }
            } catch (err: any) {
                results.push({ prNumber, status: 'error', error: err.message });
            }
        }

        let totalRenamed = 0, totalWouldRename = 0, totalClean = 0;
        for (const r of results) {
            if (r.status === 'renamed') totalRenamed++;
            if (r.status === 'would_rename') totalWouldRename++;
            if (r.status === 'already_clean') totalClean++;
        }

        return NextResponse.json({
            success: true,
            dryRun,
            filter: filterPrNumber || 'ALL',
            summary: {
                projectsScanned: targetProjects.length,
                foldersRenamed: totalRenamed,
                foldersWouldRename: totalWouldRename,
                foldersAlreadyClean: totalClean,
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
 * Scan folders and rename those with number prefixes (depth-limited)
 */
async function scanAndRename(
    folderId: string,
    prNumber: string,
    currentName: string,
    results: any[],
    pattern: RegExp,
    dryRun: boolean,
    depth: number,
    maxDepth: number
) {
    if (pattern.test(currentName)) {
        const newName = currentName.replace(pattern, '');

        if (dryRun) {
            results.push({ prNumber, folderId, currentName, newName, status: 'would_rename' });
        } else {
            console.log(`[STRIP PREFIX] ${prNumber}: "${currentName}" → "${newName}"`);
            await renameFolder(folderId, newName);
            await sleep(150);
            results.push({ prNumber, folderId, currentName, newName, status: 'renamed' });
        }
    } else {
        results.push({ prNumber, folderId, currentName, status: 'already_clean' });
    }

    // Recurse into children (depth-limited)
    if (depth < maxDepth) {
        const children = await listFolders(folderId);
        await sleep(100);
        for (const child of children) {
            await scanAndRename(child.id!, prNumber, child.name!, results, pattern, dryRun, depth + 1, maxDepth);
        }
    }
}
