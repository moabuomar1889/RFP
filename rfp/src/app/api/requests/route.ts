import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/requests
 * List project requests - returns both pending and history
 */
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // Get pending requests
        const { data: pending, error: pendingError } = await supabase.rpc('get_pending_requests');

        if (pendingError) {
            console.error('Error fetching pending requests:', pendingError);
        }

        // Get history (approved/rejected)
        const { data: history, error: historyError } = await supabase.rpc('get_request_history', {
            p_limit: 50,
        });

        if (historyError) {
            console.error('Error fetching request history:', historyError);
        }

        return NextResponse.json({
            success: true,
            pending: pending || [],
            history: history || [],
        });
    } catch (error) {
        console.error('Error fetching requests:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch requests',
            pending: [],
            history: [],
        }, { status: 500 });
    }
}

/**
 * POST /api/requests
 * Create a new project request
 * Body: { requestType: 'new_project' | 'upgrade_to_pd', projectName: string, projectId?: string }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { requestType, projectName, projectId } = body;

        // Get session from cookie
        const session = request.cookies.get('rfp_session');
        const requestedBy = session?.value || 'anonymous';

        const supabase = getSupabaseAdmin();

        // Validate request type
        if (!['new_project', 'upgrade_to_pd'].includes(requestType)) {
            return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
        }

        if (!projectName) {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
        }

        // Create the request using RPC
        const { data, error } = await supabase.rpc('create_project_request', {
            p_request_type: requestType,
            p_project_name: projectName,
            p_requested_by: requestedBy,
            p_project_id: projectId || null,
        });

        if (error) {
            console.error('Error creating request:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const result = data?.[0] || data;

        return NextResponse.json({
            success: true,
            request: result,
            message: `Request submitted. PR Number: ${result?.pr_number || 'N/A'}`
        });
    } catch (error) {
        console.error('Create request error:', error);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
}
