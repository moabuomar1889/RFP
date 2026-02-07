-- Fix missing column and RPCs from Part 4 failure
-- Run this in Supabase SQL Editor

-- 1. Add missing column to folder_index
ALTER TABLE rfp.folder_index ADD COLUMN IF NOT EXISTS normalized_template_path TEXT;

-- 2. Backfill: set normalized_template_path = template_path where null
UPDATE rfp.folder_index SET normalized_template_path = template_path WHERE normalized_template_path IS NULL;

-- 3. Recreate upsert_folder_index with the new column
DROP FUNCTION IF EXISTS public.upsert_folder_index(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.upsert_folder_index(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_drive_folder_name TEXT,
    p_normalized_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.folder_index (project_id, template_path, drive_folder_id, drive_folder_name, normalized_template_path, last_verified_at)
    VALUES (p_project_id, p_template_path, p_drive_folder_id, p_drive_folder_name, COALESCE(p_normalized_path, p_template_path), NOW())
    ON CONFLICT (project_id, template_path) 
    DO UPDATE SET 
        drive_folder_id = p_drive_folder_id,
        drive_folder_name = p_drive_folder_name,
        normalized_template_path = COALESCE(p_normalized_path, rfp.folder_index.normalized_template_path),
        last_verified_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_folder_index(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. Create insert_job_log
CREATE OR REPLACE FUNCTION public.insert_job_log(
    p_job_id UUID,
    p_project_id UUID DEFAULT NULL,
    p_project_name TEXT DEFAULT NULL,
    p_folder_path TEXT DEFAULT NULL,
    p_action TEXT DEFAULT 'info',
    p_status TEXT DEFAULT 'info',
    p_details JSONB DEFAULT '{}'
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
        job_id, project_id, task_type, task_details, status, completed_at
    )
    VALUES (
        p_job_id, p_project_id, p_action, 
        jsonb_build_object(
            'message', COALESCE(p_folder_path, ''),
            'project_name', COALESCE(p_project_name, ''),
            'details', p_details,
            'log_status', p_status
        ),
        CASE WHEN p_status = 'error' THEN 'failed' ELSE 'completed' END,
        NOW()
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_job_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- 5. Create insert_sync_task
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
        job_id, project_id, task_type, task_details, status, completed_at
    )
    VALUES (
        p_job_id, p_project_id, p_task_type, p_task_details, p_status,
        CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_sync_task(UUID, UUID, TEXT, JSONB, TEXT) TO anon, authenticated, service_role;

-- 6. Create list_job_logs
CREATE OR REPLACE FUNCTION public.list_job_logs(
    p_job_id UUID,
    p_limit INT DEFAULT 200
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    RETURN (
        SELECT json_agg(row_to_json(t)) FROM (
            SELECT 
                st.id, st.job_id, st.project_id,
                p.pr_number as project_name,
                st.task_details->>'message' as folder_path,
                st.task_type as action,
                st.status,
                st.task_details as details,
                st.created_at
            FROM rfp.sync_tasks st
            LEFT JOIN rfp.projects p ON st.project_id = p.id
            WHERE st.job_id = p_job_id
            ORDER BY st.created_at DESC
            LIMIT p_limit
        ) t
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_job_logs(UUID, INT) TO anon, authenticated, service_role;

-- 7. Create list_project_folders (THE MISSING ONE!)
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
    ORDER BY template_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_project_folders(UUID) TO anon, authenticated, service_role;

SELECT 'All missing RPCs created successfully' AS status;
