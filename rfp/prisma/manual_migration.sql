-- PRISMA CODE-FIRST MANUAL MIGRATION
-- Run this in Supabase SQL Editor if `npm run db:push` fails
-- This creates all tables from prisma/schema.prisma

-- Drop and recreate schema
DROP SCHEMA IF EXISTS rfp CASCADE;
CREATE SCHEMA rfp;

-- Create enums
CREATE TYPE rfp."ResetJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE rfp."PermissionAction" AS ENUM ('add', 'remove', 'enable_limited_access', 'disable_limited_access', 'skip_inherited');
CREATE TYPE rfp."PermissionResult" AS ENUM ('success', 'failed', 'skipped');
CREATE TYPE rfp."PrincipalType" AS ENUM ('user', 'group', 'domain', 'anyone');

-- Create tables
CREATE TABLE rfp.folder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INTEGER UNIQUE NOT NULL,
    template_json JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

CREATE TABLE rfp.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pr_number TEXT UNIQUE NOT NULL,
    drive_folder_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rfp.folder_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES rfp.projects(id) ON DELETE CASCADE,
    drive_folder_id TEXT UNIQUE NOT NULL,
    template_path TEXT NOT NULL,
    expected_limited_access BOOLEAN NOT NULL DEFAULT false,
    expected_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
    expected_users JSONB NOT NULL DEFAULT '[]'::jsonb,
    actual_limited_access BOOLEAN,
    last_verified_at TIMESTAMPTZ,
    is_compliant BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rfp.reset_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES rfp.projects(id) ON DELETE CASCADE,
    total_folders INTEGER NOT NULL,
    processed_folders INTEGER NOT NULL DEFAULT 0,
    successful_folders INTEGER NOT NULL DEFAULT 0,
    failed_folders INTEGER NOT NULL DEFAULT 0,
    status rfp."ResetJobStatus" NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT
);

CREATE TABLE rfp.permission_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES rfp.folder_index(id) ON DELETE CASCADE,
    job_id UUID REFERENCES rfp.reset_jobs(id),
    action rfp."PermissionAction" NOT NULL,
    principal_type rfp."PrincipalType",
    principal_email TEXT,
    principal_role TEXT,
    permission_id TEXT,
    is_inherited BOOLEAN NOT NULL DEFAULT false,
    inherited_from TEXT,
    before_state JSONB,
    after_state JSONB,
    result rfp."PermissionResult" NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rfp.reset_job_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES rfp.reset_jobs(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(job_id, folder_id)
);

-- Create indexes
CREATE INDEX idx_folder_index_project ON rfp.folder_index(project_id);
CREATE INDEX idx_folder_index_template_path ON rfp.folder_index(template_path);
CREATE INDEX idx_folder_index_is_compliant ON rfp.folder_index(is_compliant);
CREATE INDEX idx_folder_index_last_verified_at ON rfp.folder_index(last_verified_at);

CREATE INDEX idx_permission_audit_folder ON rfp.permission_audit(folder_id);
CREATE INDEX idx_permission_audit_job ON rfp.permission_audit(job_id);
CREATE INDEX idx_permission_audit_action ON rfp.permission_audit(action);
CREATE INDEX idx_permission_audit_result ON rfp.permission_audit(result);
CREATE INDEX idx_permission_audit_created_at ON rfp.permission_audit(created_at);

CREATE INDEX idx_reset_jobs_project ON rfp.reset_jobs(project_id);
CREATE INDEX idx_reset_jobs_status ON rfp.reset_jobs(status);
CREATE INDEX idx_reset_jobs_created_at ON rfp.reset_jobs(created_at);

CREATE INDEX idx_reset_job_folders_job ON rfp.reset_job_folders(job_id);
CREATE INDEX idx_reset_job_folders_folder ON rfp.reset_job_folders(folder_id);

-- Grant permissions (if RLS is enabled)
-- GRANT ALL ON ALL TABLES IN SCHEMA rfp TO service_role;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA rfp TO service_role;
-- GRANT USAGE ON SCHEMA rfp TO service_role;

COMMENT ON SCHEMA rfp IS 'RFP system schema - CODE-FIRST via Prisma';
