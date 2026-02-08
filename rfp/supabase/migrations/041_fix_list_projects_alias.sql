-- Safety-net alias: create list_projects as a thin wrapper around
-- the existing get_projects RPC.  This prevents failures from any
-- old Inngest jobs that were queued before the code was updated.
--
-- NOTE: The enforcement code has been updated to call get_projects
-- directly, so this alias exists only as a safety net.
DROP FUNCTION IF EXISTS public.list_projects(INTEGER);
CREATE OR REPLACE FUNCTION public.list_projects(
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id          UUID,
    pr_number   TEXT,
    name        TEXT,
    phase       TEXT,
    status      TEXT,
    drive_folder_id TEXT,
    synced_version INTEGER,
    last_synced_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
    SELECT *
    FROM public.get_projects(NULL, NULL)
    LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.list_projects(INTEGER) TO authenticated;
