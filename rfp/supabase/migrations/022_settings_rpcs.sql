-- ═══════════════════════════════════════════════════════════════════════════
-- SETTINGS TABLE AND RPCs
-- Run this ENTIRE script in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create settings table
CREATE TABLE IF NOT EXISTS rfp.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'system'
);

-- 2. Insert default settings if not exist
INSERT INTO rfp.system_settings (setting_key, setting_value, description) VALUES
('safe_test_mode', '{"enabled": true}'::jsonb, 'Safe test mode restricts bulk operations'),
('strict_mode', '{"enabled": true}'::jsonb, 'Strict mode enables permission enforcement'),
('bulk_approved', '{"approved": false}'::jsonb, 'Whether bulk operations have been approved'),
('protected_principals', '{"emails": ["mo.abuomar@dtgsa.com", "admins@dtgsa.com"]}'::jsonb, 'Protected email addresses that cannot be removed')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Get all settings
DROP FUNCTION IF EXISTS public.get_settings();
CREATE OR REPLACE FUNCTION public.get_settings()
RETURNS TABLE (
    setting_key TEXT,
    setting_value JSONB,
    description TEXT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.setting_key,
        s.setting_value,
        s.description,
        s.updated_at
    FROM rfp.system_settings s
    ORDER BY s.setting_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_settings() TO anon, authenticated, service_role;

-- 4. Update a setting
DROP FUNCTION IF EXISTS public.update_setting(TEXT, JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.update_setting(
    p_key TEXT,
    p_value JSONB,
    p_updated_by TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE rfp.system_settings 
    SET 
        setting_value = p_value,
        updated_at = NOW(),
        updated_by = p_updated_by
    WHERE setting_key = p_key;
    
    IF NOT FOUND THEN
        INSERT INTO rfp.system_settings (setting_key, setting_value, updated_by)
        VALUES (p_key, p_value, p_updated_by);
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_setting(TEXT, JSONB, TEXT) TO anon, authenticated, service_role;

-- 5. Bulk update settings (for Save Settings button)
DROP FUNCTION IF EXISTS public.save_all_settings(JSONB);
CREATE OR REPLACE FUNCTION public.save_all_settings(
    p_settings JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_key TEXT;
    v_value JSONB;
BEGIN
    -- Loop through each key in the settings object
    FOR v_key, v_value IN SELECT * FROM jsonb_each(p_settings)
    LOOP
        UPDATE rfp.system_settings 
        SET 
            setting_value = v_value,
            updated_at = NOW(),
            updated_by = 'admin'
        WHERE setting_key = v_key;
        
        IF NOT FOUND THEN
            INSERT INTO rfp.system_settings (setting_key, setting_value, updated_by)
            VALUES (v_key, v_value, 'admin');
        END IF;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_all_settings(JSONB) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END - Run this entire script in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
