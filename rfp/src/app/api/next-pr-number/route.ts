import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/next-pr-number
 * Returns the next project number that will be assigned
 */
export async function GET() {
    try {
        // Get highest project number from rfp.projects
        const { data, error } = await supabaseAdmin
            .schema('rfp')
            .from('projects')
            .select('pr_number')
            .order('pr_number', { ascending: false })
            .limit(1);

        let nextNumber = 'PRJ-001';

        if (!error && data && data.length > 0) {
            const lastPrNumber = data[0].pr_number;
            // Extract number from PR-XXX or PRJ-XXX format
            const numMatch = lastPrNumber.match(/\d+/);
            if (numMatch) {
                const nextNum = parseInt(numMatch[0], 10) + 1;
                nextNumber = `PRJ-${String(nextNum).padStart(3, '0')}`;
            }
        }

        return NextResponse.json({
            success: true,
            nextNumber: nextNumber
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({
            success: true,
            nextNumber: 'PRJ-XXX' // Fallback
        });
    }
}
