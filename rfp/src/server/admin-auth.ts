import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AdminAuthResult {
    authorized: boolean;
    user?: { email: string };
    response?: NextResponse;
}

/**
 * Verifies the caller has a valid app session.
 *
 * Uses the same `rfp_session` cookie + `get_user_token` RPC as /api/auth/session.
 * No additional role check is needed — the dashboard itself is behind Google OAuth.
 *
 * Usage:
 *   const auth = await requireAdminAuth(request);
 *   if (!auth.authorized) return auth.response!;
 */
export async function requireAdminAuth(request: NextRequest): Promise<AdminAuthResult> {

    // ── Read rfp_session cookie (set during Google OAuth login) ──
    let email: string | null = null;
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('rfp_session');
        if (sessionCookie?.value) {
            email = sessionCookie.value;
        }
    } catch {
        // cookies() may fail outside request context
    }

    if (email) {
        // Verify session is still valid — same RPC used by /api/auth/session
        const { data: tokenData, error } = await supabaseAdmin
            .rpc('get_user_token', { p_email: email });

        if (!error && tokenData) {
            return { authorized: true, user: { email } };
        }
    }

    return {
        authorized: false,
        response: NextResponse.json(
            { error: 'Unauthorized: no valid session. Please sign in.' },
            { status: 401 }
        ),
    };
}
