-- Drop and recreate rfp schema for Prisma code-first migration
-- This will delete ALL existing data in rfp schema
-- BACKUP template_output.json before running this!

DROP SCHEMA IF EXISTS rfp CASCADE;
CREATE SCHEMA rfp;

-- Grant permissions
GRANT USAGE ON SCHEMA rfp TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA rfp TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rfp TO authenticated;

-- Note: After running this, execute: npx prisma migrate dev --name init
