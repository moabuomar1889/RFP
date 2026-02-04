-- ═══════════════════════════════════════════════════════════════════════════
-- PROJECT DELETE RPCs (RFP SCHEMA)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Delete folder_index entries for a project
CREATE OR REPLACE FUNCTION rfp.delete_folder_index_by_project(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rfp.folder_index WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete a project from the database
CREATE OR REPLACE FUNCTION rfp.delete_project(p_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rfp.projects WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION rfp.delete_folder_index_by_project(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.delete_project(UUID) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
