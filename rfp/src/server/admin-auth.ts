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
    user?: { id: string; email: string; role: string };
    response?: NextResponse; // set when unauthorized — return this immediately
}

/**
 * Verifies that the caller is an authenticated admin.
 *
 * Accepts auth in two ways (checked in order):
 *   1. Bearer token in `Authorization` header  (for API / CLI callers)
 *   2. Supabase session cookie                 (for dashboard UI pages)
 *
 * Usage:
 *   const auth = await requireAdminAuth(request);
 *   if (!auth.authorized) return auth.response!;
 */
export async function requireAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
    let token: string | null = null;

    // ── 1. Try Bearer token from Authorization header ──
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim() || null;
    }

    // ── 2. Fall back to Supabase session cookie ──
    if (!token) {
        try {
            const cookieStore = await cookies();
            // Supabase JS v2 stores the session in sb-<project>-auth-token (or sb-access-token)
            // Walk all cookies to find the Supabase access token
            const allCookies = cookieStore.getAll();
            for (const c of allCookies) {
                if (c.name.includes('auth-token') || c.name === 'sb-access-token') {
                    try {
                        // Cookie value may be JSON: {"access_token":"...","refresh_token":"..."}
                        const parsed = JSON.parse(c.value);
                        if (parsed?.access_token) {
                            token = parsed.access_token;
                            break;
                        }
                        // Or it might be a raw JWT directly
                        if (typeof parsed === 'string') {
                            token = parsed;
                            break;
                        }
                    } catch {
                        // Raw JWT value (not JSON)
                        if (c.value.split('.').length === 3) {
                            token = c.value;
                            break;
                        }
                    }
                }
            }
        } catch {
            // cookies() may throw outside a request context — safe to ignore
        }
    }

    if (!token) {
        return {
            authorized: false,
            response: NextResponse.json(
                { error: 'Unauthorized: no auth token found (Bearer header or session cookie required)' },
                { status: 401 }
            ),
        };
    }

    // ── Verify the token and get the Supabase user ──
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        return {
            authorized: false,
            response: NextResponse.json(
                { error: 'Unauthorized: invalid or expired token' },
                { status: 401 }
            ),
        };
    }

    // ── Check the user's role in rfp.users ──
    let role: string | null = null;

    const { data: byId } = await supabaseAdmin
        .schema('rfp')
        .from('users')
        .select('role')
        .eq('auth_user_id', user.id)
        .single();

    if (byId) {
        role = byId.role;
    } else {
        const { data: byEmail } = await supabaseAdmin
            .schema('rfp')
            .from('users')
            .select('role')
            .eq('email', user.email ?? '')
            .single();
        if (byEmail) role = byEmail.role;
    }

    if (!role || !ADMIN_ROLES.includes(role)) {
        return {
            authorized: false,
            response: NextResponse.json(
                {
                    error: 'Forbidden: admin role required',
                    user_email: user.email,
                    user_role: role,
                },
                { status: 403 }
            ),
        };
    }

    return {
        authorized: true,
        user: { id: user.id, email: user.email!, role },
    };
}
