import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/next-pr-number
 * Returns the next project number that will be assigned
 */
export async function GET() {
    try {
        // Call public.get_next_pr_number() wrapper
        const { data, error } = await supabaseAdmin.rpc('get_next_pr_number');

        if (error) {
            console.error('Error getting next PR number:', error);
            return NextResponse.json({
                success: true,
                nextNumber: 'PRJ-XXX' // Fallback
            });
        }

        // Convert PR-XXX to PRJ-XXX format for display
        const prNumber = data || 'PR-001';
        const prjNumber = prNumber.startsWith('PR-')
            ? prNumber.replace('PR-', 'PRJ-')
            : prNumber;

        return NextResponse.json({
            success: true,
            nextNumber: prjNumber
        });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({
            success: true,
            nextNumber: 'PRJ-XXX' // Fallback
        });
    }
}
