-- ═══════════════════════════════════════════════════════════════════════════
-- PROJECT DELETE RPCs 
-- These are PUBLIC SCHEMA wrappers that access RFP schema tables
-- This follows the same pattern as other RPCs (get_project_by_id, get_projects, etc.)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Delete folder_index entries for a project
-- Function is in public schema (so RPC can find it)
-- but operates on rfp.folder_index table
CREATE OR REPLACE FUNCTION public.delete_folder_index_by_project(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rfp.folder_index WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete a project from the database
-- Function is in public schema but operates on rfp.projects table
CREATE OR REPLACE FUNCTION public.delete_project(p_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rfp.projects WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.delete_folder_index_by_project(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_project(UUID) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
