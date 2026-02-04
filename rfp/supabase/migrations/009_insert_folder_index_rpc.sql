-- ═══════════════════════════════════════════════════════════════════════════
-- INSERT FOLDER INDEX RPC
-- Run this in Supabase SQL Editor  
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.insert_folder_index(UUID, TEXT, TEXT, TEXT, BOOLEAN);

-- Insert folder index entry
CREATE OR REPLACE FUNCTION public.insert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_drive_folder_name TEXT,
    p_limited_access_enabled BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.folder_index (
        project_id,
        template_path,
        drive_folder_id,
        drive_folder_name,
        limited_access_enabled
    )
    VALUES (
        p_project_id,
        p_template_path,
        p_drive_folder_id,
        p_drive_folder_name,
        p_limited_access_enabled
    )
    ON CONFLICT (drive_folder_id) DO UPDATE SET
        template_path = EXCLUDED.template_path,
        drive_folder_name = EXCLUDED.drive_folder_name,
        limited_access_enabled = EXCLUDED.limited_access_enabled
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.insert_folder_index(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
