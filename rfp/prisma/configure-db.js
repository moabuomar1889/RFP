#!/usr/bin/env node

/**
 * Helper script to configure Prisma with Supabase connection strings
 * Reads from NEXT_PUBLIC_SUPABASE_URL in .env.local
 */

const fs = require('fs');
const path = require('path');

// Read .env.local to get Supabase URL
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envLocalPath)) {
    console.error('❌ .env.local not found');
    process.exit(1);
}

const envLocal = fs.readFileSync(envLocalPath, 'utf-8');

// Extract Supabase project reference from URL
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=https:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
    console.error('❌ Could not find NEXT_PUBLIC_SUPABASE_URL in .env.local');
    process.exit(1);
}

const projectRef = urlMatch[1];

console.log(`✅ Found Supabase project: ${projectRef}`);
console.log('\n📝 You need to manually update .env with your database password:\n');

console.log('1. Go to: https://supabase.com/dashboard');
console.log(`2. Open project: ${projectRef}`);
console.log('3. Settings → Database → Database Settings');
console.log('4. Copy your database password');
console.log('5. Update .env file with:\n');

const poolingUrl = `DATABASE_URL="postgresql://postgres.${projectRef}:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&schema=rfp"`;
const directUrl = `DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres?schema=rfp"`;

console.log(poolingUrl);
console.log(directUrl);

console.log('\n⚠️  Replace [YOUR-PASSWORD] with your actual database password');
console.log('\nOnce updated, run: npx prisma migrate dev --name init');
