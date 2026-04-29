import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';
import { resolveAccessForEmail, type AccessRole } from '@/server/access-control';

export const dynamic = 'force-dynamic';

function getGoogleConfig() {
    return {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_REDIRECT_URI!,
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
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const requestedRedirect = sanitizeRedirectPath(searchParams.get('state'));

    console.log('[Auth Callback] Starting OAuth callback...');

    if (error) {
        console.error('[Auth Callback] OAuth error:', error);
        return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
    }

    if (!code) {
        console.error('[Auth Callback] No code received');
        return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    try {
        const config = getGoogleConfig();
        console.log('[Auth Callback] Config loaded, redirect URI:', config.redirectUri);

        const oauth2Client = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUri
        );

        console.log('[Auth Callback] Exchanging code for tokens...');
        const { tokens } = await oauth2Client.getToken(code);
        console.log('[Auth Callback] Tokens received, has refresh:', !!tokens.refresh_token);

        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();
        const email = userInfo.email!;
        console.log('[Auth Callback] User email:', email);

        const access = await resolveAccessForEmail(email);
        if (!access.authenticated || !access.role) {
            console.error('[Auth Callback] Unauthorized user:', email);
            return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
        }

        const supabase = getSupabaseAdmin();

        console.log('[Auth Callback] Storing tokens via RPC...');
        const { data: tokenResult, error: rpcError } = await supabase.rpc('upsert_user_token', {
            p_email: email,
            p_access_token: encrypt(tokens.access_token!),
            p_refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            p_token_expiry: tokens.expiry_date
                ? new Date(tokens.expiry_date).toISOString()
                : null,
        });

        if (rpcError) {
            console.error('[Auth Callback] Token storage error:', JSON.stringify(rpcError));
            const errorMsg = encodeURIComponent(rpcError.message || 'unknown');
            return NextResponse.redirect(new URL(`/login?error=storage_failed&detail=${errorMsg}`, request.url));
        }

        if (tokenResult && tokenResult.success === false) {
            console.error('[Auth Callback] Token storage rejected:', JSON.stringify(tokenResult));
            const errorMsg = encodeURIComponent(tokenResult.error || 'token_rejected');
            return NextResponse.redirect(new URL(`/login?error=storage_failed&detail=${errorMsg}`, request.url));
        }

        console.log('[Auth Callback] Tokens stored successfully');

        await supabase.rpc('log_audit', {
            p_action: 'user_login',
            p_entity_type: 'user',
            p_entity_id: email,
            p_details: { ip: request.headers.get('x-forwarded-for') },
            p_performed_by: email,
        });

        const targetPath = requestedRedirect || getDefaultTarget(access.role);
        const response = NextResponse.redirect(new URL(targetPath, request.url));
        response.cookies.set('rfp_session', email, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
        });
        response.cookies.set('rfp_access', access.role, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
        });

        console.log('[Auth Callback] Login complete, redirecting to', targetPath);
        return response;
    } catch (error) {
        console.error('[Auth Callback] OAuth callback error:', error);
        return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
}
