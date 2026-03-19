import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
 * Use at the top of every admin API route.
 *
 * Usage:
 *   const auth = await requireAdminAuth(request);
 *   if (!auth.authorized) return auth.response!;
 */
export async function requireAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
        return {
            authorized: false,
            response: NextResponse.json({ error: 'Unauthorized: missing auth token' }, { status: 401 }),
        };
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        return {
            authorized: false,
            response: NextResponse.json({ error: 'Unauthorized: invalid or expired token' }, { status: 401 }),
        };
    }

    // Check by auth_user_id first, fall back to email
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
            response: NextResponse.json({
                error: 'Forbidden: admin role required',
                user_email: user.email,
                user_role: role,
            }, { status: 403 }),
        };
    }

    return {
        authorized: true,
        user: { id: user.id, email: user.email!, role },
    };
}
