import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { addGroupMember, removeGroupMember } from '@/server/google-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/users/[id]/groups
 * Add user to a group - syncs with Google Workspace
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
            return NextResponse.json(
                { success: false, error: 'Group email is required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Get user email
        const { data: user, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id,
        });

        if (userError || !user || user.length === 0) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        const userEmail = Array.isArray(user) ? user[0].email : user.email;
        console.log(`Adding ${userEmail} to group ${groupEmail}`);

        // Add to Google Workspace
        const googleResult = await addGroupMember(groupEmail, userEmail);

        if (!googleResult.success) {
            console.error('Google add member failed:', googleResult.error);
            // Continue to add locally even if Google fails
        }

        // Add to local database
        const { error: dbError } = await supabase.rpc('add_user_to_group', {
            p_user_email: userEmail.toLowerCase(),
            p_group_email: groupEmail.toLowerCase(),
            p_added_by: 'admin',
        });

        if (dbError) {
            console.error('Database error:', dbError);
            return NextResponse.json(
                { success: false, error: 'Failed to save to database' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Added ${userEmail} to ${groupEmail}`,
            googleSynced: googleResult.success,
        });
    } catch (error: any) {
        console.error('Add to group error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to add to group' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/users/[id]/groups
 * Remove user from a group - syncs with Google Workspace
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
            return NextResponse.json(
                { success: false, error: 'Group email is required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Get user email
        const { data: user, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id,
        });

        if (userError || !user || user.length === 0) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        const userEmail = Array.isArray(user) ? user[0].email : user.email;
        console.log(`Removing ${userEmail} from group ${groupEmail}`);

        // Remove from Google Workspace
        const googleResult = await removeGroupMember(groupEmail, userEmail);

        if (!googleResult.success) {
            console.error('Google remove member failed:', googleResult.error);
        }

        // Remove from local database
        const { error: dbError } = await supabase.rpc('remove_user_from_group', {
            p_user_email: userEmail.toLowerCase(),
            p_group_email: groupEmail.toLowerCase(),
        });

        if (dbError) {
            console.error('Database error:', dbError);
        }

        return NextResponse.json({
            success: true,
            message: `Removed ${userEmail} from ${groupEmail}`,
            googleSynced: googleResult.success,
        });
    } catch (error: any) {
        console.error('Remove from group error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to remove from group' },
            { status: 500 }
        );
    }
}
