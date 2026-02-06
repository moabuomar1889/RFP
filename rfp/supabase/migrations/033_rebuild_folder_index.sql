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
