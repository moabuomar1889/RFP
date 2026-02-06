-- Fix list_job_logs to extract nested details properly
-- The details are stored as task_details->'details' but UI expects flat structure

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
                st.id,
                st.job_id,
                st.project_id,
                p.pr_number as project_name,
                st.task_details->>'message' as folder_path,
                st.task_type as action,
                COALESCE(st.task_details->>'log_status', st.status) as status,
                -- Extract the nested 'details' object directly for the UI
                st.task_details->'details' as details,
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
