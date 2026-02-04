import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/[id]/groups
 * Get groups for a specific user
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabaseAdmin();

        // First get the user's email
        const { data: users, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id
        });

        if (userError || !users || users.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'User not found',
            }, { status: 404 });
        }

        const userEmail = users[0].email;

        // Get groups for this user
        const { data: groups, error } = await supabase.rpc('get_user_groups', {
            p_user_email: userEmail
        });

        if (error) {
            console.error('Error fetching user groups:', error);
            return NextResponse.json({
                success: false,
                groups: [],
                error: error.message,
            });
        }

        return NextResponse.json({
            success: true,
            groups: groups || [],
        });
    } catch (error: any) {
        console.error('User groups API error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch user groups',
            groups: [],
        }, { status: 500 });
    }
}

/**
 * POST /api/users/[id]/groups
 * Add user to a group
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { groupEmail } = body;

        if (!groupEmail) {
            return NextResponse.json({
                success: false,
                error: 'Group email is required',
            }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // First get the user's email
        const { data: users, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id
        });

        if (userError || !users || users.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'User not found',
            }, { status: 404 });
        }

        const userEmail = users[0].email;

        // Get session for added_by
        const session = request.cookies.get('rfp_session');
        const addedBy = session?.value || 'admin';

        // Add user to group
        const { data, error } = await supabase.rpc('add_user_to_group', {
            p_user_email: userEmail,
            p_group_email: groupEmail,
            p_added_by: addedBy,
        });

        if (error) {
            console.error('Error adding user to group:', error);
            return NextResponse.json({
                success: false,
                error: error.message,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'User added to group',
        });
    } catch (error: any) {
        console.error('Add user to group error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to add user to group',
        }, { status: 500 });
    }
}

/**
 * DELETE /api/users/[id]/groups
 * Remove user from a group
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const groupEmail = searchParams.get('groupEmail');

        if (!groupEmail) {
            return NextResponse.json({
                success: false,
                error: 'Group email is required',
            }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // First get the user's email
        const { data: users, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id
        });

        if (userError || !users || users.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'User not found',
            }, { status: 404 });
        }

        const userEmail = users[0].email;

        // Remove user from group
        const { data, error } = await supabase.rpc('remove_user_from_group', {
            p_user_email: userEmail,
            p_group_email: groupEmail,
        });

        if (error) {
            console.error('Error removing user from group:', error);
            return NextResponse.json({
                success: false,
                error: error.message,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'User removed from group',
        });
    } catch (error: any) {
        console.error('Remove user from group error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to remove user from group',
        }, { status: 500 });
    }
}
