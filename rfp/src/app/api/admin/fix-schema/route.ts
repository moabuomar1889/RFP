
import { NextResponse } from 'next/server';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('API: Fixing schema permissions via raw SQL (pg driver)...');

    // Use DIRECT_URL to bypass potential transaction pooler issues for admin commands
    // Fallback to DATABASE_URL if DIRECT_URL is not set (will likely fail for ALTER ROLE if pooled)
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        return NextResponse.json({ success: false, error: 'Missing Database Connection URL' }, { status: 500 });
    }

    // Force non-SSL if strictly needed, or let pg handle it. Vercel/Supabase usually needs ssl: true or rejectUnauthorized: false
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false } // Required for Supabase/Vercel
    });

    try {
        await client.connect();

        const commands = [
            `ALTER ROLE authenticator RESET pgrst.db_schemas;`,
            `NOTIFY pgrst, 'reload config';`,
            `GRANT ALL PRIVILEGES ON SCHEMA rfp TO anon, authenticated, service_role;`,
            `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA rfp TO anon, authenticated, service_role;`,
            `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA rfp TO anon, authenticated, service_role;`,
            `ALTER DEFAULT PRIVILEGES IN SCHEMA rfp GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated, service_role;`,
            `ALTER ROLE authenticator SET search_path TO rfp, public;`,
            `ALTER ROLE anon SET search_path TO rfp, public;`,
            `ALTER ROLE service_role SET search_path TO rfp, public;`
        ];

        const results = [];
        for (const cmd of commands) {
            try {
                await client.query(cmd);
                results.push({ cmd, status: 'success' });
            } catch (e: any) {
                console.error(`Error executing ${cmd}:`, e);
                results.push({ cmd, status: 'error', error: e.message });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('Database connection error:', error);
        return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
    } finally {
        await client.end().catch(() => { }); // Ensure disconnect
    }
}
