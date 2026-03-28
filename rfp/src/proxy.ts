import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require authentication
const publicPaths = [
    '/login',
    '/api/auth/login',
    '/api/auth/callback',
    '/api/auth/logout',
    '/api/auth/session',
    '/api/inngest',
];

const approverPagePrefixes = [
    '/approvals',
    '/users',
    '/groups',
    '/roles',
    '/jobs',
    '/audit',
    '/permission-audit',
    '/folder-mapping',
    '/admin',
    '/settings',
    '/template',
    '/cleanup',
];

const approverApiPrefixes = [
    '/api/admin',
    '/api/enforce',
    '/api/jobs',
    '/api/settings',
    '/api/scan/projects',
    '/api/template',
    '/api/users',
    '/api/groups',
    '/api/roles',
    '/api/permissions/reset',
];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths
    if (publicPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    // Check for session cookie
    const session = request.cookies.get('rfp_session');
    const accessCookie = request.cookies.get('rfp_access')?.value;
    const adminEmail = (process.env.ADMIN_EMAIL || 'mo.abuomar@dtgsa.com').toLowerCase();
    const sessionEmail = session?.value?.toLowerCase() || '';
    const accessRole = accessCookie || (sessionEmail === adminEmail ? 'approver' : 'requester');

    if (!session) {
        // Redirect to login page
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (accessRole !== 'approver') {
        if (pathname === '/') {
            return NextResponse.redirect(new URL('/projects/new', request.url));
        }

        if (approverPagePrefixes.some((path) => pathname.startsWith(path))) {
            return NextResponse.redirect(new URL('/projects/new', request.url));
        }

        const isApproveRejectApi =
            pathname.startsWith('/api/requests/') &&
            (pathname.endsWith('/approve') || pathname.endsWith('/reject'));

        const isProjectMutationApi =
            pathname.startsWith('/api/projects/') &&
            request.method !== 'GET';

        if (
            approverApiPrefixes.some((path) => pathname.startsWith(path)) ||
            isApproveRejectApi ||
            isProjectMutationApi
        ) {
            return NextResponse.json(
                { error: 'Forbidden: approver access required.' },
                { status: 403 }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Match all paths except static files and _next
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
