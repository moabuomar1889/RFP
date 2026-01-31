import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const response = NextResponse.json({ success: true });

    response.cookies.delete('rfp_session');

    return response;
}

export async function GET(request: NextRequest) {
    const response = NextResponse.redirect(new URL('/', request.url));

    response.cookies.delete('rfp_session');

    return response;
}
