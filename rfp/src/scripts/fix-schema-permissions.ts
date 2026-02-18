import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing schema permissions...');

    try {
        // A. Reset PostgREST config
        await prisma.$executeRawUnsafe(`ALTER ROLE authenticator RESET pgrst.db_schemas;`);
        await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload config';`);
        console.log('Reset PostgREST config.');

        // B. Grant full access
        await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON SCHEMA rfp TO anon, authenticated, service_role;`);
        await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA rfp TO anon, authenticated, service_role;`);
        await prisma.$executeRawUnsafe(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA rfp TO anon, authenticated, service_role;`);
        console.log('Granted privileges.');

        // C. Set default privileges
        await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA rfp GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated, service_role;`);
        console.log('Set default privileges.');

        // D. Update Search Path
        await prisma.$executeRawUnsafe(`ALTER ROLE authenticator SET search_path TO rfp, public;`);
        await prisma.$executeRawUnsafe(`ALTER ROLE anon SET search_path TO rfp, public;`);
        // Also service_role ideally
        await prisma.$executeRawUnsafe(`ALTER ROLE service_role SET search_path TO rfp, public;`);

        console.log('Updated search paths.');
        console.log('Schema permissions fixed successfully.');
    } catch (error) {
        console.error('Error fixing schema permissions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
