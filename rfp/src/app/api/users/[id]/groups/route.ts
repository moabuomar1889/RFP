import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper to safely try Google sync (optional)
async function tryGoogleSync(action: 'add' | 'remove', groupEmail: string, userEmail: string) {
    try {
        // Only try if Google Admin SDK is configured
        const { addGroupMember, removeGroupMember } = await import('@/server/google-admin');
        if (action === 'add') {
            return await addGroupMember(groupEmail, userEmail);
        } else {
            return await removeGroupMember(groupEmail, userEmail);
        }
    } catch (error) {
        console.log('Google Admin SDK not configured, skipping Google sync');
        return { success: false, error: 'Google Admin SDK not configured' };
    }
}

/**
 * POST /api/users/[id]/groups
 * Add user to a group - saves to database, optionally syncs with Google
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { groupEmail, groupEmails } = body;

        // Support both single and multiple groups
        const emails = groupEmails || [groupEmail];

        if (!emails || emails.length === 0 || !emails[0]) {
            return NextResponse.json(
                { success: false, error: 'At least one group email is required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Get user email using RPC
        const { data: user, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id
        });

        if (userError || !user || (Array.isArray(user) && user.length === 0)) {
            console.error('User lookup error:', userError);
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        const userEmail = (Array.isArray(user) ? user[0]?.email : user?.email)?.toLowerCase();
        if (!userEmail) {
            return NextResponse.json(
                { success: false, error: 'User email not found' },
                { status: 404 }
            );
        }

        console.log(`Adding ${userEmail} to groups:`, emails);

        const results = [];
        for (const email of emails) {
            // Try Google sync (optional - won't fail if not configured)
            const googleResult = await tryGoogleSync('add', email, userEmail);

            // Add to local database
            console.log(`[DB] Calling add_user_to_group with:`, {
                p_user_email: userEmail,
                p_group_email: email.toLowerCase(),
                p_added_by: 'admin',
            });

            const { data: dbData, error: dbError } = await supabase.rpc('add_user_to_group', {
                p_user_email: userEmail,
                p_group_email: email.toLowerCase(),
                p_added_by: 'admin',
            });

            console.log(`[DB] Result for ${email}:`, { dbData, dbError });

            results.push({
                groupEmail: email,
                dbSuccess: !dbError,
                dbData,
                googleSynced: googleResult.success,
                error: dbError?.message,
            });
        }

        const allSuccess = results.every(r => r.dbSuccess);

        console.log(`[DB] Final results:`, results);

        return NextResponse.json({
            success: allSuccess,
            message: `Updated ${results.filter(r => r.dbSuccess).length} group memberships`,
            results,
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
            return NextResponse.json(
                { success: false, error: 'Group email is required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Get user email using RPC
        const { data: user, error: userError } = await supabase.rpc('get_user_by_id', {
            p_id: id
        });

        if (userError || !user || (Array.isArray(user) && user.length === 0)) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        const userEmail = (Array.isArray(user) ? user[0]?.email : user?.email)?.toLowerCase();
        if (!userEmail) {
            return NextResponse.json(
                { success: false, error: 'User email not found' },
                { status: 404 }
            );
        }

        console.log(`Removing ${userEmail} from group ${groupEmail}`);

        // Try Google sync (optional)
        const googleResult = await tryGoogleSync('remove', groupEmail, userEmail);

        // Remove from local database
        const { error: dbError } = await supabase.rpc('remove_user_from_group', {
            p_user_email: userEmail,
            p_group_email: groupEmail.toLowerCase(),
        });

        if (dbError) {
            console.error('Database error:', dbError);
        }

        return NextResponse.json({
            success: !dbError,
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
