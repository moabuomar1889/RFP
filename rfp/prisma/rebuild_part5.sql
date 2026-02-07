-- Migration: Create folder_templates table and RPCs
-- This enables storing and versioning folder structure templates

-- Table: folder_templates
CREATE TABLE IF NOT EXISTS rfp.folder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INTEGER NOT NULL,
    template_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT,
    is_active BOOLEAN DEFAULT true,
    notes TEXT
);

-- Index for quick active template lookup
CREATE INDEX IF NOT EXISTS idx_folder_templates_active 
ON rfp.folder_templates (is_active, created_at DESC) 
WHERE is_active = true;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.save_template(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.get_active_template();
DROP FUNCTION IF EXISTS public.get_template_by_version(INTEGER);

-- RPC: save_template
-- Saves a new template version and deactivates old ones
CREATE OR REPLACE FUNCTION public.save_template(
    p_template_json JSONB,
    p_created_by TEXT DEFAULT 'admin'
) RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
BEGIN
    -- Deactivate all old templates
    UPDATE rfp.folder_templates SET is_active = false WHERE is_active = true;
    
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO v_version
    FROM rfp.folder_templates;
    
    -- Insert new template
    INSERT INTO rfp.folder_templates (
        version_number, 
        template_json, 
        created_by, 
        is_active
    )
    VALUES (
        v_version, 
        p_template_json, 
        p_created_by, 
        true
    );
    
    RETURN v_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_active_template
-- Returns the currently active template
CREATE OR REPLACE FUNCTION public.get_active_template()
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    template_json JSONB,
    created_at TIMESTAMPTZ,
    created_by TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id, 
        ft.version_number, 
        ft.template_json, 
        ft.created_at,
        ft.created_by
    FROM rfp.folder_templates ft
    WHERE ft.is_active = true
    ORDER BY ft.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_template_by_version
-- Returns a specific template version
CREATE OR REPLACE FUNCTION public.get_template_by_version(p_version INTEGER)
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    template_json JSONB,
    created_at TIMESTAMPTZ,
    created_by TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id, 
        ft.version_number, 
        ft.template_json, 
        ft.created_at,
        ft.created_by,
        ft.is_active
    FROM rfp.folder_templates ft
    WHERE ft.version_number = p_version
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON rfp.folder_templates TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_template(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_template() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_template_by_version(INTEGER) TO anon, authenticated;

-- Migration 033: Rebuild folder_index table
-- Purpose: Add expected vs actual permission tracking for reset-based enforcement
-- Author: Permission System Refactor
-- Date: 2026-02-06

-- Step 1: Drop existing table (will be rebuilt from Drive via backfill RPC)
DROP TABLE IF EXISTS rfp.folder_index CASCADE;

-- Step 2: Create new folder_index with enhanced permission tracking
CREATE TABLE rfp.folder_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core mapping
    project_id UUID NOT NULL REFERENCES rfp.projects(id) ON DELETE CASCADE,
    drive_folder_id TEXT NOT NULL UNIQUE,
    template_path TEXT NOT NULL,
    
    -- Expected state (from template - source of truth)
    expected_limited_access BOOLEAN NOT NULL DEFAULT false,
    expected_groups JSONB DEFAULT '[]'::jsonb,
    expected_users JSONB DEFAULT '[]'::jsonb,
    
    -- Actual state (from Drive API - corrected to match expected)
    actual_limited_access BOOLEAN,
    last_verified_at TIMESTAMPTZ,
    
    -- Compliance tracking (computed)
    is_compliant BOOLEAN GENERATED ALWAYS AS (
        actual_limited_access IS NOT NULL AND 
        actual_limited_access = expected_limited_access
    ) STORED,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_folder_index_project 
    ON rfp.folder_index(project_id);

CREATE INDEX idx_folder_index_drive_folder 
    ON rfp.folder_index(drive_folder_id);

CREATE INDEX idx_folder_index_template_path 
    ON rfp.folder_index(template_path);

CREATE INDEX idx_folder_index_noncompliant 
    ON rfp.folder_index(is_compliant) 
    WHERE is_compliant = false;

CREATE INDEX idx_folder_index_unverified 
    ON rfp.folder_index(last_verified_at NULLS FIRST);

-- Step 4: Create trigger to update updated_at
CREATE OR REPLACE FUNCTION rfp.update_folder_index_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_folder_index_updated_at
    BEFORE UPDATE ON rfp.folder_index
    FOR EACH ROW
    EXECUTE FUNCTION rfp.update_folder_index_updated_at();

-- Step 5: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON rfp.folder_index TO authenticated;
GRANT SELECT ON rfp.folder_index TO anon;

-- Comments for documentation
COMMENT ON TABLE rfp.folder_index IS 'Maps Drive folders to template paths with expected vs actual permission state tracking';
COMMENT ON COLUMN rfp.folder_index.expected_limited_access IS 'From template - whether Limited Access should be enabled';
COMMENT ON COLUMN rfp.folder_index.actual_limited_access IS 'From Drive API - whether inheritedPermissionsDisabled is actually true';
COMMENT ON COLUMN rfp.folder_index.is_compliant IS 'Computed: true when actual matches expected Limited Access state';

-- Migration 034: Create permission_audit table
-- Purpose: Comprehensive audit trail for all permission changes
-- Author: Permission System Refactor
-- Date: 2026-02-06

CREATE TABLE rfp.permission_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    folder_id UUID REFERENCES rfp.folder_index(id) ON DELETE CASCADE,
    job_id UUID,
    
    -- Action details
    action TEXT NOT NULL, 
    -- Valid values: 'add' | 'remove' | 'enable_limited_access' | 'disable_limited_access' | 'skip_inherited'
    
    -- Principal details
    principal_type TEXT, -- 'user' | 'group' | 'domain' | 'anyone'
    principal_email TEXT,
    principal_role TEXT, -- 'reader' | 'writer' | 'fileOrganizer' | 'organizer'
    permission_id TEXT,
    
    -- Inheritance tracking (critical for inherited permission violations)
    is_inherited BOOLEAN DEFAULT false,
    inherited_from TEXT, -- Drive folder ID where permission originates
    
    -- State tracking
    before_state JSONB,
    after_state JSONB,
    
    -- Result
    result TEXT NOT NULL, -- 'success' | 'failed' | 'skipped'
    error_message TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_permission_audit_folder 
    ON rfp.permission_audit(folder_id);

CREATE INDEX idx_permission_audit_job 
    ON rfp.permission_audit(job_id);

CREATE INDEX idx_permission_audit_action 
    ON rfp.permission_audit(action);

CREATE INDEX idx_permission_audit_result 
    ON rfp.permission_audit(result) 
    WHERE result = 'failed';

CREATE INDEX idx_permission_audit_inherited 
    ON rfp.permission_audit(is_inherited) 
    WHERE is_inherited = true;

CREATE INDEX idx_permission_audit_created 
    ON rfp.permission_audit(created_at DESC);

-- Grants
GRANT SELECT, INSERT ON rfp.permission_audit TO authenticated;
GRANT SELECT ON rfp.permission_audit TO anon;

-- Comments
COMMENT ON TABLE rfp.permission_audit IS 'Audit trail for all permission changes and violations';
COMMENT ON COLUMN rfp.permission_audit.action IS 'Type of action: add, remove, enable_limited_access, disable_limited_access, skip_inherited';
COMMENT ON COLUMN rfp.permission_audit.is_inherited IS 'True if this permission is inherited from parent folder and cannot be deleted';
COMMENT ON COLUMN rfp.permission_audit.inherited_from IS 'Drive folder ID where inherited permission originates (for troubleshooting)';

-- Migration 035: Create reset_jobs table
-- Purpose: Track batched reset job execution for large projects (1000+ folders)
-- Author: Permission System Refactor
-- Date: 2026-02-06

CREATE TABLE rfp.reset_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Scope
    project_id UUID REFERENCES rfp.projects(id) ON DELETE CASCADE,
    folder_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Specific folders to reset (if not whole project)
    
    -- Progress tracking
    total_folders INTEGER NOT NULL,
    processed_folders INTEGER DEFAULT 0,
    successful_folders INTEGER DEFAULT 0,
    failed_folders INTEGER DEFAULT 0,
    
    -- Execution state
    status TEXT NOT NULL DEFAULT 'pending', 
    -- Valid values: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Audit
    created_by TEXT,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_progress CHECK (processed_folders <= total_folders),
    CONSTRAINT valid_counts CHECK (
        successful_folders + failed_folders <= processed_folders
    )
);

-- Indexes
CREATE INDEX idx_reset_jobs_project 
    ON rfp.reset_jobs(project_id);

CREATE INDEX idx_reset_jobs_status 
    ON rfp.reset_jobs(status);

CREATE INDEX idx_reset_jobs_created 
    ON rfp.reset_jobs(created_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE ON rfp.reset_jobs TO authenticated;
GRANT SELECT ON rfp.reset_jobs TO anon;

-- RPC: Get reset job progress
CREATE OR REPLACE FUNCTION public.get_reset_job_progress(p_job_id UUID)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    total_folders INTEGER,
    processed_folders INTEGER,
    successful_folders INTEGER,
    failed_folders INTEGER,
    status TEXT,
    progress_percent NUMERIC,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rj.id,
        rj.project_id,
        rj.total_folders,
        rj.processed_folders,
        rj.successful_folders,
        rj.failed_folders,
        rj.status,
        CASE 
            WHEN rj.total_folders > 0 THEN (rj.processed_folders::numeric / rj.total_folders::numeric * 100)
            ELSE 0
        END as progress_percent,
        rj.started_at,
        rj.completed_at,
        CASE 
            WHEN rj.completed_at IS NOT NULL AND rj.started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (rj.completed_at - rj.started_at))::INTEGER
            WHEN rj.started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (now() - rj.started_at))::INTEGER
            ELSE NULL
        END as duration_seconds
    FROM rfp.reset_jobs rj
    WHERE rj.id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_reset_job_progress(UUID) TO authenticated, anon;

-- Comments
COMMENT ON TABLE rfp.reset_jobs IS 'Tracks batched permission reset jobs for resumability and progress monitoring';
COMMENT ON COLUMN rfp.reset_jobs.folder_ids IS 'Specific folder UUIDs to reset (empty array means entire project)';
COMMENT ON COLUMN rfp.reset_jobs.status IS 'Execution status: pending, running, completed, failed, cancelled';

-- Migration 036: Backfill folder_index from Drive
-- Purpose: RPC to rebuild folder_index mapping from Drive + template after schema rebuild
-- Author: Permission System Refactor
-- Date: 2026-02-06

-- Drop existing if any
DROP FUNCTION IF EXISTS public.backfill_folder_index_from_drive(UUID);

-- RPC: Backfill folder_index for a project
-- This will be called from application layer after Drive folders are created
CREATE OR REPLACE FUNCTION public.backfill_folder_index_from_drive(
    p_project_id UUID
) RETURNS TABLE (
    folders_added INTEGER,
    folders_updated INTEGER,
    errors TEXT[]
) AS $$
DECLARE
    v_folders_added INTEGER := 0;
    v_folders_updated INTEGER := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- This is a placeholder RPC
    -- Actual backfill logic will be implemented in application layer (jobs.ts)
    -- because it requires Drive API calls which cannot be done in SQL
    
    -- This RPC exists for:
    -- 1. Documentation of backfill requirement
    -- 2. Future enhancement if Drive API integration moves to database layer
    
    RAISE NOTICE 'Backfill must be triggered from application layer (POST /api/sync)';
    
    RETURN QUERY SELECT 
        v_folders_added,
        v_folders_updated,
        v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.backfill_folder_index_from_drive(UUID) TO authenticated;

-- Helper RPC: Get folder sync status for a project
CREATE OR REPLACE FUNCTION public.get_folder_sync_status(p_project_id UUID)
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    total_folders INTEGER,
    folders_with_expected_config INTEGER,
    folders_with_actual_state INTEGER,
    compliant_folders INTEGER,
    noncompliant_folders INTEGER,
    unverified_folders INTEGER,
    last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as project_id,
        p.name as project_name,
        COUNT(fi.id)::INTEGER as total_folders,
        COUNT(fi.id) FILTER (WHERE fi.expected_limited_access IS NOT NULL)::INTEGER as folders_with_expected_config,
        COUNT(fi.id) FILTER (WHERE fi.actual_limited_access IS NOT NULL)::INTEGER as folders_with_actual_state,
        COUNT(fi.id) FILTER (WHERE fi.is_compliant = true)::INTEGER as compliant_folders,
        COUNT(fi.id) FILTER (WHERE fi.is_compliant = false)::INTEGER as noncompliant_folders,
        COUNT(fi.id) FILTER (WHERE fi.last_verified_at IS NULL)::INTEGER as unverified_folders,
        MAX(fi.last_verified_at) as last_sync_at
    FROM rfp.projects p
    LEFT JOIN rfp.folder_index fi ON fi.project_id = p.id
    WHERE p.id = p_project_id
    GROUP BY p.id, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_folder_sync_status(UUID) TO authenticated, anon;

-- Helper RPC: Get noncompliant folders for a project (for reset prioritization)
CREATE OR REPLACE FUNCTION public.get_noncompliant_folders(p_project_id UUID)
RETURNS TABLE (
    folder_id UUID,
    drive_folder_id TEXT,
    template_path TEXT,
    expected_limited_access BOOLEAN,
    actual_limited_access BOOLEAN,
    last_verified_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fi.id as folder_id,
        fi.drive_folder_id,
        fi.template_path,
        fi.expected_limited_access,
        fi.actual_limited_access,
        fi.last_verified_at
    FROM rfp.folder_index fi
    WHERE fi.project_id = p_project_id
      AND fi.is_compliant = false
    ORDER BY fi.template_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_noncompliant_folders(UUID) TO authenticated;

-- Comments
COMMENT ON FUNCTION public.backfill_folder_index_from_drive(UUID) IS 'Placeholder for backfill - actual implementation in application layer via POST /api/sync';
COMMENT ON FUNCTION public.get_folder_sync_status(UUID) IS 'Returns folder compliance statistics for a project';
COMMENT ON FUNCTION public.get_noncompliant_folders(UUID) IS 'Returns list of folders where actual Limited Access state does not match expected';

-- Migration 037: Update upsert_folder_index RPC for new schema
-- Purpose: Fix sync to work with rebuilt folder_index table from migration 033
-- Author: Permission System Refactor
-- Date: 2026-02-06

-- Drop old RPC
DROP FUNCTION IF EXISTS public.upsert_folder_index(UUID, TEXT, TEXT, TEXT, TEXT);

-- Create new RPC compatible with new folder_index schema
CREATE OR REPLACE FUNCTION public.upsert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_expected_limited_access BOOLEAN DEFAULT false,
    p_expected_groups JSONB DEFAULT '[]'::jsonb,
    p_expected_users JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Insert or update folder_index with new schema
    INSERT INTO rfp.folder_index (
        project_id, 
        drive_folder_id, 
        template_path,
        expected_limited_access,
        expected_groups,
        expected_users,
        actual_limited_access,
        last_verified_at
    )
    VALUES (
        p_project_id, 
        p_drive_folder_id, 
        p_template_path,
        p_expected_limited_access,
        p_expected_groups,
        p_expected_users,
        NULL, -- Will be populated by reset tool
        NOW()
    )
    ON CONFLICT (drive_folder_id) 
    DO UPDATE SET 
        template_path = p_template_path,
        expected_limited_access = p_expected_limited_access,
        expected_groups = p_expected_groups,
        expected_users = p_expected_users,
        last_verified_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.upsert_folder_index(UUID, TEXT, TEXT, BOOLEAN, JSONB, JSONB) TO anon, authenticated, service_role;

-- Comments
COMMENT ON FUNCTION public.upsert_folder_index IS 'Upserts folder to folder_index with expected permissions from template';

