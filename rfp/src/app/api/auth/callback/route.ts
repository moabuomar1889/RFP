import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { APP_CONFIG } from '@/lib/config';
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

    if (error) {
        return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL('/?error=no_code', request.url));
    }

    try {
        const config = getGoogleConfig();
        const oauth2Client = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret,
            config.redirectUri
        );

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);

        oauth2Client.setCredentials(tokens);

        // Get user email
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();
        const email = userInfo.email!;

        // Verify user is the admin
        const adminEmail = process.env.ADMIN_EMAIL || 'mo.abuomar@dtgsa.com';
        if (email.toLowerCase() !== adminEmail.toLowerCase()) {
            return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
        }

        // Store encrypted tokens
        await getSupabaseAdmin()
            .schema('rfp')
            .from('user_tokens')
            .upsert(
                {
                    email,
                    access_token_encrypted: encrypt(tokens.access_token!),
                    refresh_token_encrypted: encrypt(tokens.refresh_token!),
                    token_expiry: tokens.expiry_date
                        ? new Date(tokens.expiry_date).toISOString()
                        : null,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'email' }
            );

        // Log audit
        await getSupabaseAdmin()
            .schema('rfp')
            .from('audit_log')
            .insert({
                action: 'user_login',
                entity_type: 'user',
                entity_id: email,
                details: { ip: request.headers.get('x-forwarded-for') },
                performed_by: email,
            });

        // Set session cookie
        const response = NextResponse.redirect(new URL('/?success=login', request.url));
        response.cookies.set('rfp_session', email, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;
    } catch (error) {
        console.error('OAuth callback error:', error);
        return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
    }
}
