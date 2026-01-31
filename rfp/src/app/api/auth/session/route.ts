import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const session = request.cookies.get('rfp_session');

    if (!session) {
        return NextResponse.json({ authenticated: false, user: null });
    }

    try {
        // Verify token exists and is valid
        const { data: tokenData } = await getSupabaseAdmin()
            .schema('rfp')
            .from('user_tokens')
            .select('email, token_expiry, updated_at')
            .eq('email', session.value)
            .single();

        if (!tokenData) {
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
