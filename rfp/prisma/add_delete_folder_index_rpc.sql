-- Delete RPC for cleaning stale folder_index entries
-- Also fix audit phase filtering by adding helper

CREATE OR REPLACE FUNCTION public.delete_project_folder_index(
    p_project_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    DELETE FROM rfp.folder_index WHERE project_id = p_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project_folder_index(UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.delete_project_folder_index IS 'Deletes all folder_index entries for a project before re-indexing';
