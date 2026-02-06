"use server";

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/next-pr-number
 * Returns the next project number that will be assigned
 */
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin.rpc('get_next_pr_number');

        if (error) {
            console.error('Error getting next PR number:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
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
        return NextResponse.json({ error: 'Failed to get next PR number' }, { status: 500 });
    }
}
