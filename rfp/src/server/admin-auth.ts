import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_ROLES = ['admin', 'superadmin', 'manager'];

export interface AdminAuthResult {
    authorized: boolean;
    user?: { email: string; role: string };
    response?: NextResponse;
}

/**
 * Verifies the caller is an authenticated admin using the app's native session.
 *
 * The app uses an `rfp_session` cookie (value = email) verified through the
 * `get_user_token` RPC — the same mechanism as /api/auth/session.
 *
 * Falls back to Bearer token (Authorization header) for API/CLI callers.
 *
 * Usage:
 *   const auth = await requireAdminAuth(request);
 *   if (!auth.authorized) return auth.response!;
 */
export async function requireAdminAuth(request: NextRequest): Promise<AdminAuthResult> {

    // ── 1. Try rfp_session cookie (dashboard UI callers) ──
    let emailFromCookie: string | null = null;
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('rfp_session');
        if (sessionCookie?.value) {
            emailFromCookie = sessionCookie.value;
        }
    } catch {
        // cookies() may fail outside request context
    }

    if (emailFromCookie) {
        // Verify session is still valid via the same RPC the app uses
        const { data: tokenData, error } = await supabaseAdmin
            .rpc('get_user_token', { p_email: emailFromCookie });

        if (!error && tokenData) {
            // Check admin role in rfp.users
            const role = await getAdminRole(emailFromCookie);
            if (role && ADMIN_ROLES.includes(role)) {
                return { authorized: true, user: { email: emailFromCookie, role } };
            }
            return {
                authorized: false,
                response: NextResponse.json(
                    { error: 'Forbidden: admin role required', user_email: emailFromCookie, user_role: role },
                    { status: 403 }
                ),
            };
        }
    }

    // ── 2. Fall back to Bearer token (API / CLI callers) ──
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (token) {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (!error && user?.email) {
            const role = await getAdminRole(user.email, user.id);
            if (role && ADMIN_ROLES.includes(role)) {
                return { authorized: true, user: { email: user.email, role } };
            }
            return {
                authorized: false,
                response: NextResponse.json(
                    { error: 'Forbidden: admin role required', user_email: user.email, user_role: role },
                    { status: 403 }
                ),
            };
        }
    }

    // ── Nothing worked ──
    return {
        authorized: false,
        response: NextResponse.json(
            { error: 'Unauthorized: no valid session found. Sign in first.' },
            { status: 401 }
        ),
    };
}

/** Look up the user's role in rfp.users by email (primary) or auth_user_id (fallback). */
async function getAdminRole(email: string, authUserId?: string): Promise<string | null> {
    if (authUserId) {
        const { data } = await supabaseAdmin
            .schema('rfp').from('users').select('role').eq('auth_user_id', authUserId).single();
        if (data?.role) return data.role;
    }
    const { data } = await supabaseAdmin
        .schema('rfp').from('users').select('role').eq('email', email).single();
    return data?.role ?? null;
}
