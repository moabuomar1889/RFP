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
