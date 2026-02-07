import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

// Lazy-load Google config to avoid build-time errors
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

export async function GET(request: NextRequest) {
    const config = getGoogleConfig();

    const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Request refresh token
        scope: config.scopes,
        prompt: 'consent', // Force consent to get new refresh token
        include_granted_scopes: true, // Include any previously granted scopes
    });

    return NextResponse.redirect(authUrl);
}
