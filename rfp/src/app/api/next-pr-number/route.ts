import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
    extractProjectNumber,
    findNextAvailableProjectNumber,
    formatProjectNumber,
} from '@/server/project-numbering';

export const dynamic = 'force-dynamic';

/**
 * GET /api/next-pr-number
 * Returns the next project number that will be assigned
 */
export async function GET() {
    try {
        const [{ data: projects, error: projectsError }, { data: requests, error: requestsError }] = await Promise.all([
            supabaseAdmin
                .schema('rfp')
                .from('projects')
                .select('pr_number'),
            supabaseAdmin
                .schema('rfp')
                .from('project_requests')
                .select('pr_number')
                .eq('status', 'pending'),
        ]);

        if (projectsError) throw projectsError;
        if (requestsError) throw requestsError;

        const usedNumbers = [...(projects ?? []), ...(requests ?? [])]
            .map((row: any) => extractProjectNumber(row.pr_number))
            .filter((num): num is number => num !== null);

        const prjNumber = formatProjectNumber(findNextAvailableProjectNumber(usedNumbers));

        return NextResponse.json({
            success: true,
            nextNumber: prjNumber
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({
            success: true,
            nextNumber: 'PRJ-XXX'
        });
    }
}
