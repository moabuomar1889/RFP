import { NextRequest, NextResponse } from 'next/server';
import { requireApproverAccess } from '@/server/access-control';

export interface AdminAuthResult {
    authorized: boolean;
    user?: { email: string };
    response?: NextResponse;
}

/**
 * Verifies the caller is an authenticated approver/admin.
 *
 * Usage:
 *   const auth = await requireAdminAuth(request);
 *   if (!auth.authorized) return auth.response!;
 */
export async function requireAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
    const auth = await requireApproverAccess(request);
    if (!auth.authorized) {
        return {
            authorized: false,
            response: auth.response,
        };
    }

    return {
        authorized: true,
        user: { email: auth.access.email! },
    };
}
