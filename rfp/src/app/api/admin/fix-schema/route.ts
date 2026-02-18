
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('API: Fixing schema permissions via raw SQL...');
    const prisma = new PrismaClient(); // Instantiate here to ensure fresh connection in Vercel function

    try {
        await prisma.$connect();

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
                await prisma.$executeRawUnsafe(cmd);
                results.push({ cmd, status: 'success' });
            } catch (e: any) {
                results.push({ cmd, status: 'error', error: e.message });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        await prisma.$disconnect();
    }
}
