
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing schema permissions (Prisma JS)...');
    try {
        // Check connection
        await prisma.$connect();
        console.log('Connected to DB.');

        // Commands
        const commands = [
            `ALTER ROLE authenticator RESET pgrst.db_schemas;`,
            `NOTIFY pgrst, 'reload config';`,
            `GRANT ALL PRIVILEGES ON SCHEMA rfp TO anon, authenticated, service_role;`,
            `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA rfp TO anon, authenticated, service_role;`,
            `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA rfp TO anon, authenticated, service_role;`,
            `ALTER DEFAULT PRIVILEGES IN SCHEMA rfp GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated, service_role;`,
            `ALTER ROLE authenticator SET search_path TO rfp, public;`,
            `ALTER ROLE anon SET search_path TO rfp, public;`,
            // Service role
            `ALTER ROLE service_role SET search_path TO rfp, public;`
        ];

        for (const cmd of commands) {
            console.log(`Executing: ${cmd}`);
            await prisma.$executeRawUnsafe(cmd);
        }
        console.log('Success.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
