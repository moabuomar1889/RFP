import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/requests/[id]/approve
 * Approve a project request
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get session from cookie
        const session = request.cookies.get('rfp_session');
        const reviewedBy = session?.value || 'admin';

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('approve_request', {
            p_request_id: id,
            p_reviewed_by: reviewedBy,
        });

        if (error) {
            console.error('Error approving request:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data?.success === false) {
            return NextResponse.json({ success: false, error: data.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Request approved',
            project_id: data?.project_id,
        });
    } catch (error) {
        console.error('Approve request error:', error);
        return NextResponse.json({ success: false, error: 'Failed to approve request' }, { status: 500 });
    }
}
