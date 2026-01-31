import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const session = request.cookies.get('rfp_session');

    if (!session) {
        return NextResponse.json({ authenticated: false, user: null });
    }

    try {
        // Verify token exists and is valid via RPC
        const { data: tokenData, error } = await getSupabaseAdmin()
            .rpc('get_user_token', { p_email: session.value });

        if (error || !tokenData) {
            return NextResponse.json({ authenticated: false, user: null });
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                email: tokenData.email,
                tokenExpiry: tokenData.token_expiry,
                lastLogin: tokenData.updated_at,
            },
        });
    } catch (error) {
        return NextResponse.json({ authenticated: false, user: null });
    }
}

