-- ═══════════════════════════════════════════════════════════════════════════
-- Public RPC for updating job progress
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing function if exists with wrong signature
DROP FUNCTION IF EXISTS public.update_job_progress(uuid, int, int, int, text);

-- Create public wrapper for updating job progress
CREATE OR REPLACE FUNCTION public.update_job_progress(
    p_job_id UUID,
    p_progress INT DEFAULT 0,
    p_completed_tasks INT DEFAULT 0,
    p_total_tasks INT DEFAULT 0,
    p_status TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    UPDATE rfp.sync_jobs
    SET 
        progress_percent = p_progress,
        completed_tasks = p_completed_tasks,
        total_tasks = p_total_tasks,
        status = COALESCE(p_status, status),
        started_at = CASE 
            WHEN p_status = 'running' AND started_at IS NULL THEN NOW()
            ELSE started_at
        END,
        completed_at = CASE 
            WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW()
            ELSE completed_at
        END
    WHERE id = p_job_id;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.update_job_progress(UUID, INT, INT, INT, TEXT) TO anon, authenticated, service_role;

-- Also create a clear_jobs function
CREATE OR REPLACE FUNCTION public.clear_old_jobs(
    p_keep_recent_hours INT DEFAULT 24
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM rfp.sync_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < NOW() - (p_keep_recent_hours || ' hours')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_old_jobs(INT) TO anon, authenticated, service_role;

-- Create clear_all_jobs function
CREATE OR REPLACE FUNCTION public.clear_all_jobs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM rfp.sync_jobs
    WHERE status IN ('completed', 'failed', 'cancelled');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_all_jobs() TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Upsert folder index entry
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.upsert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_drive_folder_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.folder_index (project_id, template_path, drive_folder_id, drive_folder_name, last_verified_at)
    VALUES (p_project_id, p_template_path, p_drive_folder_id, p_drive_folder_name, NOW())
    ON CONFLICT (project_id, template_path) 
    DO UPDATE SET 
        drive_folder_id = p_drive_folder_id,
        drive_folder_name = p_drive_folder_name,
        last_verified_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_folder_index(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Insert sync task (for detailed job logs)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.insert_sync_task(
    p_job_id UUID,
    p_project_id UUID DEFAULT NULL,
    p_task_type TEXT DEFAULT 'info',
    p_task_details JSONB DEFAULT '{}',
    p_status TEXT DEFAULT 'completed'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.sync_tasks (
        job_id, 
        project_id, 
        task_type, 
        task_details, 
        status,
        completed_at
    )
    VALUES (
        p_job_id, 
        p_project_id, 
        p_task_type, 
        p_task_details, 
        p_status,
        CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_sync_task(UUID, UUID, TEXT, JSONB, TEXT) TO anon, authenticated, service_role;

