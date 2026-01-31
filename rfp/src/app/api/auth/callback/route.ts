import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getSupabaseAdmin } from '@/lib/supabase';
import { encrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// Lazy-load Google config to avoid build-time errors
function getGoogleConfig() {
    return {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

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

        // Exchange code for tokens
        console.log('[Auth Callback] Exchanging code for tokens...');
        const { tokens } = await oauth2Client.getToken(code);
        console.log('[Auth Callback] Tokens received, has refresh:', !!tokens.refresh_token);

        oauth2Client.setCredentials(tokens);

        // Get user email
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();
        const email = userInfo.email!;
        console.log('[Auth Callback] User email:', email);

        // Verify user is the admin
        const adminEmail = process.env.ADMIN_EMAIL || 'mo.abuomar@dtgsa.com';
        if (email.toLowerCase() !== adminEmail.toLowerCase()) {
            console.error('[Auth Callback] Unauthorized user:', email);
            return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
        }

        const supabase = getSupabaseAdmin();

        // Use RPC function to store tokens (bypasses schema issue)
        console.log('[Auth Callback] Storing tokens via RPC...');
        const { error: rpcError } = await supabase.rpc('upsert_user_token', {
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
        console.log('[Auth Callback] Tokens stored successfully');

        // Log audit via RPC
        await supabase.rpc('log_audit', {
            p_action: 'user_login',
            p_entity_type: 'user',
            p_entity_id: email,
            p_details: { ip: request.headers.get('x-forwarded-for') },
            p_performed_by: email,
        });

        // Set session cookie and redirect to dashboard
        const response = NextResponse.redirect(new URL('/dashboard', request.url));
        response.cookies.set('rfp_session', email, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        console.log('[Auth Callback] Login complete, redirecting to dashboard');
        return response;
    } catch (error) {
        console.error('[Auth Callback] OAuth callback error:', error);
        return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
}


