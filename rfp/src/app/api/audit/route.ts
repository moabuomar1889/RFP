import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/audit
 * Get audit log entries
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '100');

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase.rpc('get_audit_log', {
            p_limit: limit,
        });

        if (error) {
            console.error('Error fetching audit log:', error);
            return NextResponse.json({
                success: true,
                logs: [],
            });
        }

        return NextResponse.json({
            success: true,
            logs: data || [],
        });
    } catch (error) {
        console.error('Error fetching audit log:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch audit log',
            logs: [],
        }, { status: 500 });
    }
}
