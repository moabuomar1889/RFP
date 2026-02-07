# Prisma Database Setup Instructions

## Getting Your Supabase Connection Strings

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your RFP project
3. Click **Settings** → **Database**
4. Scroll to **Connection Pooling** section

### Required URLs:

**DATABASE_URL** (Connection Pooling - for Prisma Client):
- Mode: **Transaction**
- Copy the connection string
- Format: `postgresql://postgres.PROJECT_REF:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

**DIRECT_URL** (Direct Connection - for migrations):
- Scroll to **Connection String** section
- Mode: **URI**
- Copy the connection string
- Format: `postgresql://postgres:[PASSWORD]@db.PROJECT_REF.supabase.co:5432/postgres`

## Update .env File

Replace `[YOUR-PASSWORD]` and `PROJECT_REF` in `.env` file with actual values from Supabase.

## Next Steps

After updating URLs:
1. Drop rfp schema: `DROP SCHEMA IF EXISTS rfp CASCADE;`
2. Run Prisma migration: `npx prisma migrate dev --name init`
3. Generate Prisma Client: `npx prisma generate`
