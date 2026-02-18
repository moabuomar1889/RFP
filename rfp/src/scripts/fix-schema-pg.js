
const { Client } = require('pg');
require('dotenv').config();

// Parse DATABASE_URL for connection details
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase in many environments
});

async function main() {
    console.log('Connecting to database...');
    try {
        await client.connect();
        console.log('Connected.');

        // SQL commands
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

        for (const cmd of commands) {
            console.log(`Executing: ${cmd}`);
            await client.query(cmd);
        }

        console.log('All commands executed successfully.');
    } catch (err) {
        console.error('Error executing commands:', err);
    } finally {
        await client.end();
    }
}

main();
