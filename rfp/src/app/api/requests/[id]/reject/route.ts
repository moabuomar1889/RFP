import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/requests/[id]/reject
 * Reject a project request
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { reason } = body;

        if (!reason?.trim()) {
            return NextResponse.json({ success: false, error: 'Rejection reason is required' }, { status: 400 });
        }

        // Get session from cookie
        const session = request.cookies.get('rfp_session');
        const reviewedBy = session?.value || 'admin';

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('reject_request', {
            p_request_id: id,
            p_reviewed_by: reviewedBy,
            p_reason: reason,
        });

        if (error) {
            console.error('Error rejecting request:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (data?.success === false) {
            return NextResponse.json({ success: false, error: data.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Request rejected',
        });
    } catch (error) {
        console.error('Reject request error:', error);
        return NextResponse.json({ success: false, error: 'Failed to reject request' }, { status: 500 });
    }
}
