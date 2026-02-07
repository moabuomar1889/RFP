-- Drop existing rfp schema (CODE-FIRST REBUILD)
-- This allows Prisma to create the schema from scratch based on schema.prisma
-- Template data is backed up externally and will be re-imported via seed script

DROP SCHEMA IF EXISTS rfp CASCADE;
DROP SCHEMA IF EXISTS rfp_shadow CASCADE;

-- Recreate empty rfp schema for Prisma
CREATE SCHEMA IF NOT EXISTS rfp;
