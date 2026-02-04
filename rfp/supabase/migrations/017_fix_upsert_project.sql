-- ═══════════════════════════════════════════════════════════════════════════
-- FIX UPSERT PROJECT RPC
-- The original used ON CONFLICT (drive_folder_id) but pr_number is the unique key
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Fix upsert_project to conflict on pr_number (the actual unique constraint)
CREATE OR REPLACE FUNCTION public.upsert_project(
    p_pr_number TEXT,
    p_name TEXT,
    p_drive_folder_id TEXT,
    p_phase TEXT DEFAULT 'bidding'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.projects (pr_number, name, drive_folder_id, phase, status)
    VALUES (p_pr_number, p_name, p_drive_folder_id, p_phase, 'active')
    ON CONFLICT (pr_number) DO UPDATE SET
        name = EXCLUDED.name,
        drive_folder_id = EXCLUDED.drive_folder_id,
        phase = EXCLUDED.phase
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.upsert_project(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
