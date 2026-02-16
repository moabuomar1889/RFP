// Quick DB query tool - uses DATABASE_URL from .env
// Usage: node db-query.mjs "SELECT * FROM rfp.projects LIMIT 5"

import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const query = process.argv[2];
if (!query) {
    console.error('Usage: node db-query.mjs "SELECT ..."');
    process.exit(1);
}

const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
});

try {
    await client.connect();
    const result = await client.query(query);

    if (result.rows.length === 0) {
        console.log('No rows returned.');
    } else {
        console.log(JSON.stringify(result.rows, null, 2));
        console.log(`\n--- ${result.rows.length} row(s) ---`);
    }
} catch (err) {
    console.error('❌ Error:', err.message);
} finally {
    await client.end();
}
