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
