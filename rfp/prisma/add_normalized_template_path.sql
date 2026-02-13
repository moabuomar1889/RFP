-- Migration: Add normalized_template_path to folder_index
-- Purpose: Store cleaned template-style path for reliable matching
-- Date: 2026-02-13

-- Step 1: Add column
ALTER TABLE rfp.folder_index 
ADD COLUMN IF NOT EXISTS normalized_template_path TEXT;

-- Step 2: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_folder_index_normalized_path 
ON rfp.folder_index(normalized_template_path);

-- Step 3: Update upsert_folder_index RPC to accept normalized path
DROP FUNCTION IF EXISTS public.upsert_folder_index(UUID, TEXT, TEXT, BOOLEAN, JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.upsert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_expected_limited_access BOOLEAN DEFAULT false,
    p_expected_groups JSONB DEFAULT '[]'::jsonb,
    p_expected_users JSONB DEFAULT '[]'::jsonb,
    p_normalized_template_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.folder_index (
        project_id, 
        drive_folder_id, 
        template_path,
        normalized_template_path,
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
        p_normalized_template_path,
        p_expected_limited_access,
        p_expected_groups,
        p_expected_users,
        NULL,
        NOW()
    )
    ON CONFLICT (drive_folder_id) 
    DO UPDATE SET 
        template_path = p_template_path,
        normalized_template_path = COALESCE(p_normalized_template_path, rfp.folder_index.normalized_template_path),
        expected_limited_access = p_expected_limited_access,
        expected_groups = p_expected_groups,
        expected_users = p_expected_users,
        last_verified_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_folder_index(UUID, TEXT, TEXT, BOOLEAN, JSONB, JSONB, TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.upsert_folder_index IS 'Upserts folder to folder_index with expected permissions and normalized template path';

-- Step 4: Update list_project_folders to include normalized_template_path
DROP FUNCTION IF EXISTS public.list_project_folders(UUID);

CREATE OR REPLACE FUNCTION public.list_project_folders(
    p_project_id UUID
)
RETURNS SETOF rfp.folder_index
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM rfp.folder_index
    WHERE project_id = p_project_id
    ORDER BY COALESCE(normalized_template_path, template_path);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_project_folders(UUID) TO anon, authenticated, service_role;
