import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireApproverAccess } from '@/server/access-control';

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
        const auth = await requireApproverAccess(request);
        if (!auth.authorized) return auth.response;
        const body = await request.json();
        const { reason } = body;

        if (!reason?.trim()) {
            return NextResponse.json({ success: false, error: 'Rejection reason is required' }, { status: 400 });
        }

        const reviewedBy = auth.access.email!;

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
