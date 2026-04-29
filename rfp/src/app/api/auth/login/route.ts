import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resolveAccessForEmail, type AccessRole } from '@/server/access-control';

export const dynamic = 'force-dynamic';

function getGoogleConfig() {
    return {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_REDIRECT_URI!,
        scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/admin.directory.user.readonly',
            'https://www.googleapis.com/auth/admin.directory.group.readonly',
            'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
        ],
    };
}

function sanitizeRedirectPath(candidate: string | null | undefined): string | null {
    const value = candidate?.trim();
    if (!value) return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    if (value.startsWith('/api/auth/')) return null;
    return value;
}

function getDefaultTarget(role: AccessRole): string {
    return role === 'approver' ? '/' : '/projects/new';
}

export async function GET(request: NextRequest) {
    const config = getGoogleConfig();
    const forceConsent = request.nextUrl.searchParams.get('forceConsent') === '1';
    const requestedRedirect = sanitizeRedirectPath(request.nextUrl.searchParams.get('redirect'));

    if (!forceConsent) {
        const sessionEmail = request.cookies.get('rfp_session')?.value?.trim().toLowerCase();

        if (sessionEmail) {
            try {
                const supabase = getSupabaseAdmin();
                const { data: tokenData, error } = await supabase.rpc('get_user_token', {
                    p_email: sessionEmail,
                });
                const access = await resolveAccessForEmail(sessionEmail);

                if (!error && tokenData && access.authenticated && access.role) {
                    return NextResponse.redirect(
                        new URL(requestedRedirect || getDefaultTarget(access.role), request.url)
                    );
                }
            } catch (error) {
                console.warn('[Auth Login] Session shortcut failed:', error);
            }
        }
    }

    const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
    );

    const authParams: Parameters<typeof oauth2Client.generateAuthUrl>[0] = {
        access_type: 'offline',
        scope: config.scopes,
        include_granted_scopes: true,
    };

    if (requestedRedirect) {
        authParams.state = requestedRedirect;
    }

    if (forceConsent) {
        authParams.prompt = 'consent';
    }

    const authUrl = oauth2Client.generateAuthUrl(authParams);
    return NextResponse.redirect(authUrl);
}
