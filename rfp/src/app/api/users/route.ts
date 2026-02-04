import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * Get all users from database (cached from Google Workspace)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();

        // First try to get from cache
        const { data: users, error } = await supabase
            .schema('rfp')
            .from('user_directory')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching users:', error);
            // Return empty array - table might not exist yet
            return NextResponse.json({
                success: true,
                users: [],
                message: 'No users found. Run sync to populate.',
            });
        }

        return NextResponse.json({
            success: true,
            users: users || [],
            count: users?.length || 0,
        });
    } catch (error) {
        console.error('Users API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch users',
            users: [],
        }, { status: 500 });
    }
}

/**
 * POST /api/users
 * Sync users from Google Workspace to database
 */
export async function POST(request: NextRequest) {
    try {
        // Note: This would use Google Admin SDK to sync users
        // For now, return a message that sync needs to be implemented
        return NextResponse.json({
            success: false,
            error: 'Google Workspace sync requires Admin SDK setup. Please add users manually or configure Admin SDK.',
        }, { status: 501 });
    } catch (error) {
        console.error('Users sync error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to sync users',
        }, { status: 500 });
    }
}
