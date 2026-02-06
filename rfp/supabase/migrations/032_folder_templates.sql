-- Migration: Create folder_templates table and RPCs
-- This enables storing and versioning folder structure templates

-- Table: folder_templates
CREATE TABLE IF NOT EXISTS rfp.folder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INTEGER NOT NULL,
    template_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT,
    is_active BOOLEAN DEFAULT true,
    notes TEXT
);

-- Index for quick active template lookup
CREATE INDEX IF NOT EXISTS idx_folder_templates_active 
ON rfp.folder_templates (is_active, created_at DESC) 
WHERE is_active = true;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.save_template(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.get_active_template();
DROP FUNCTION IF EXISTS public.get_template_by_version(INTEGER);

-- RPC: save_template
-- Saves a new template version and deactivates old ones
CREATE OR REPLACE FUNCTION public.save_template(
    p_template_json JSONB,
    p_created_by TEXT DEFAULT 'admin'
) RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
BEGIN
    -- Deactivate all old templates
    UPDATE rfp.folder_templates SET is_active = false WHERE is_active = true;
    
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO v_version
    FROM rfp.folder_templates;
    
    -- Insert new template
    INSERT INTO rfp.folder_templates (
        version_number, 
        template_json, 
        created_by, 
        is_active
    )
    VALUES (
        v_version, 
        p_template_json, 
        p_created_by, 
        true
    );
    
    RETURN v_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_active_template
-- Returns the currently active template
CREATE OR REPLACE FUNCTION public.get_active_template()
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    template_json JSONB,
    created_at TIMESTAMPTZ,
    created_by TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id, 
        ft.version_number, 
        ft.template_json, 
        ft.created_at,
        ft.created_by
    FROM rfp.folder_templates ft
    WHERE ft.is_active = true
    ORDER BY ft.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_template_by_version
-- Returns a specific template version
CREATE OR REPLACE FUNCTION public.get_template_by_version(p_version INTEGER)
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    template_json JSONB,
    created_at TIMESTAMPTZ,
    created_by TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id, 
        ft.version_number, 
        ft.template_json, 
        ft.created_at,
        ft.created_by,
        ft.is_active
    FROM rfp.folder_templates ft
    WHERE ft.version_number = p_version
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON rfp.folder_templates TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_template(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_template() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_template_by_version(INTEGER) TO anon, authenticated;
