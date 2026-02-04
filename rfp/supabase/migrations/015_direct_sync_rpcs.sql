-- ═══════════════════════════════════════════════════════════════════════════
-- DIRECT SYNC RPCs
-- Functions for direct project sync without Inngest
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Upsert folder index entry
CREATE OR REPLACE FUNCTION public.upsert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_drive_folder_name TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO rfp.folder_index (project_id, template_path, drive_folder_id, drive_folder_name, last_verified_at)
    VALUES (p_project_id, p_template_path, p_drive_folder_id, p_drive_folder_name, NOW())
    ON CONFLICT (project_id, template_path) 
    DO UPDATE SET 
        drive_folder_id = EXCLUDED.drive_folder_id,
        drive_folder_name = EXCLUDED.drive_folder_name,
        last_verified_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update project sync timestamp
CREATE OR REPLACE FUNCTION public.update_project_sync(p_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE rfp.projects
    SET last_synced_at = NOW()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear and rebuild folder index for a project
CREATE OR REPLACE FUNCTION public.clear_folder_index(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rfp.folder_index WHERE project_id = p_project_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get folder index for project
CREATE OR REPLACE FUNCTION public.get_folder_index(p_project_id UUID)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    template_path TEXT,
    drive_folder_id TEXT,
    drive_folder_name TEXT,
    limited_access_enabled BOOLEAN,
    permission_status TEXT,
    last_verified_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT fi.id, fi.project_id, fi.template_path, fi.drive_folder_id, 
           fi.drive_folder_name, fi.limited_access_enabled, fi.permission_status,
           fi.last_verified_at
    FROM rfp.folder_index fi
    WHERE fi.project_id = p_project_id
    ORDER BY fi.template_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.upsert_folder_index(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_project_sync(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_folder_index(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_folder_index(UUID) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
