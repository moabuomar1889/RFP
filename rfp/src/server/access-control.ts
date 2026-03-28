import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export type AccessRole = 'approver' | 'requester';

export interface AccessContext {
    authenticated: boolean;
    email: string | null;
    role: AccessRole | null;
}

const DEFAULT_ALLOWED_DOMAIN = 'dtgsa.com';

function normalizeEmail(email: string | null | undefined): string {
    return (email || '').trim().toLowerCase();
}

function parseSettingObject(raw: unknown): Record<string, unknown> | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

function parseEmailList(raw: unknown, fallback: string[]): string[] {
    if (!raw) return fallback;

    let emails: unknown = raw;
    if (typeof raw === 'string') {
        try {
            emails = JSON.parse(raw);
        } catch {
            emails = raw.split(',').map((part) => part.trim()).filter(Boolean);
        }
    }

    if (Array.isArray(emails)) {
        const normalized = emails
            .map((value) => normalizeEmail(String(value)))
            .filter(Boolean);
        return normalized.length > 0 ? normalized : fallback;
    }

    const asObject = parseSettingObject(emails);
    const objectEmails = asObject?.emails;
    if (Array.isArray(objectEmails)) {
        const normalized = objectEmails
            .map((value) => normalizeEmail(String(value)))
            .filter(Boolean);
        return normalized.length > 0 ? normalized : fallback;
    }

    return fallback;
}

async function getSetting(key: string): Promise<unknown> {
    const { data } = await getSupabaseAdmin().rpc('get_setting', { p_key: key });
    return data;
}

export async function getAllowedLoginDomain(): Promise<string> {
    const raw = await getSetting('allowed_login_domain');
    const parsed = parseSettingObject(raw);
    const candidate = typeof parsed?.domain === 'string'
        ? parsed.domain
        : typeof raw === 'string'
            ? raw
            : null;
    return (candidate || DEFAULT_ALLOWED_DOMAIN).replace(/^@/, '').trim().toLowerCase();
}

export async function getApproverEmails(): Promise<string[]> {
    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || 'mo.abuomar@dtgsa.com');
    const raw = await getSetting('request_approvers');
    return parseEmailList(raw, [adminEmail]);
}

export async function resolveAccessForEmail(email: string): Promise<AccessContext> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return { authenticated: false, email: null, role: null };
    }

    const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || 'mo.abuomar@dtgsa.com');
    const allowedDomain = await getAllowedLoginDomain();

    if (!normalizedEmail.endsWith(`@${allowedDomain}`)) {
        return { authenticated: false, email: normalizedEmail, role: null };
    }

    const approvers = await getApproverEmails();
    const role: AccessRole =
        normalizedEmail === adminEmail || approvers.includes(normalizedEmail)
            ? 'approver'
            : 'requester';

    return {
        authenticated: true,
        email: normalizedEmail,
        role,
    };
}

export async function getAuthenticatedAccess(request: NextRequest): Promise<AccessContext> {
    const session = request.cookies.get('rfp_session');
    const email = normalizeEmail(session?.value);

    if (!email) {
        return { authenticated: false, email: null, role: null };
    }

    const { data: tokenData, error } = await getSupabaseAdmin().rpc('get_user_token', { p_email: email });
    if (error || !tokenData) {
        return { authenticated: false, email: email || null, role: null };
    }

    return resolveAccessForEmail(email);
}

export async function requireAuthenticatedAccess(request: NextRequest): Promise<
    | { authorized: true; access: AccessContext }
    | { authorized: false; response: NextResponse }
> {
    const access = await getAuthenticatedAccess(request);
    if (!access.authenticated || !access.email || !access.role) {
        return {
            authorized: false,
            response: NextResponse.json(
                { error: 'Unauthorized: no valid session. Please sign in.' },
                { status: 401 }
            ),
        };
    }

    return { authorized: true, access };
}

export async function requireApproverAccess(request: NextRequest): Promise<
    | { authorized: true; access: AccessContext }
    | { authorized: false; response: NextResponse }
> {
    const auth = await requireAuthenticatedAccess(request);
    if (!auth.authorized) return auth;

    if (auth.access.role !== 'approver') {
        return {
            authorized: false,
            response: NextResponse.json(
                { error: 'Forbidden: approver access required.' },
                { status: 403 }
            ),
        };
    }

    return auth;
}
