import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/groups
 * Get all groups from database (cached from Google Workspace)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();

        // First try to get from cache
        const { data: groups, error } = await supabase
            .schema('rfp')
            .from('group_directory')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching groups:', error);
            // Return empty array - table might not exist yet
            return NextResponse.json({
                success: true,
                groups: [],
                message: 'No groups found. Run sync to populate.',
            });
        }

        return NextResponse.json({
            success: true,
            groups: groups || [],
            count: groups?.length || 0,
        });
    } catch (error) {
        console.error('Groups API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch groups',
            groups: [],
        }, { status: 500 });
    }
}

/**
 * POST /api/groups
 * Sync groups from Google Workspace to database
 */
export async function POST(request: NextRequest) {
    try {
        // Note: This would use Google Admin SDK to sync groups
        return NextResponse.json({
            success: false,
            error: 'Google Workspace sync requires Admin SDK setup. Please add groups manually.',
        }, { status: 501 });
    } catch (error) {
        console.error('Groups sync error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to sync groups',
        }, { status: 500 });
    }
}
