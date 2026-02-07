-- Create missing list_project_folders RPC
-- Run in Supabase SQL Editor

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

-- Verify it works
SELECT * FROM public.list_project_folders('5d60e037-58d9-4dc7-aaa9-d9601a5b9c92'::uuid);
