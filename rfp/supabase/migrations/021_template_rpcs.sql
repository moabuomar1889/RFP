-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETE TEMPLATE AND PERMISSIONS RPCs
-- Run this ENTIRE script in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create template_versions table if not exists
CREATE TABLE IF NOT EXISTS rfp.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INTEGER UNIQUE NOT NULL,
    template_json JSONB NOT NULL,
    created_by TEXT DEFAULT 'system',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Get active template
DROP FUNCTION IF EXISTS public.get_active_template();
CREATE OR REPLACE FUNCTION public.get_active_template()
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    template_json JSONB,
    created_by TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.version_number,
        t.template_json,
        t.created_by,
        t.created_at
    FROM rfp.template_versions t
    WHERE t.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_active_template() TO anon, authenticated, service_role;

-- 3. Save template (creates new version)
DROP FUNCTION IF EXISTS public.save_template(JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.save_template(
    p_template_json JSONB,
    p_created_by TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version FROM rfp.template_versions;
    
    -- Deactivate all existing templates
    UPDATE rfp.template_versions SET is_active = false WHERE is_active = true;
    
    -- Insert new template
    INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
    VALUES (v_version, p_template_json, p_created_by, true);
    
    RETURN v_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_template(JSONB, TEXT) TO anon, authenticated, service_role;

-- 4. Insert default template if none exists
INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
SELECT 1, 
'{
  "exportDate": "2026-01-31T09:38:24.633Z",
  "exportVersion": "2.5",
  "template": [
    {
      "_expanded": true,
      "limitedAccess": false,
      "groups": [],
      "nodes": [
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Admins", "role": "organizer"},
            {"name": "Technical Team", "role": "writer"},
            {"name": "Projects Managers", "role": "writer"},
            {"name": "Projects Control", "role": "writer"}
          ],
          "text": "SOW",
          "users": []
        },
        {
          "groups": [{"name": "Projects Managers", "role": "writer"}],
          "limitedAccess": true,
          "text": "Technical Proposal",
          "users": []
        },
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Admins", "role": "organizer"},
            {"name": "Projects Managers", "role": "fileOrganizer"}
          ],
          "text": "Vendors Quotations",
          "users": []
        },
        {
          "groups": [{"name": "Projects Managers", "role": "writer"}],
          "limitedAccess": true,
          "text": "Commercial Proposal",
          "users": []
        }
      ],
      "text": "Bidding",
      "users": []
    },
    {
      "_expanded": true,
      "groups": [],
      "limitedAccess": false,
      "nodes": [
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Document Control", "role": "fileOrganizer"},
            {"name": "Projects Managers", "role": "fileOrganizer"},
            {"name": "Admins", "role": "organizer"}
          ],
          "text": "Document Control",
          "users": []
        },
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Quality Control", "role": "fileOrganizer"},
            {"name": "Projects Control", "role": "reader"},
            {"name": "Projects Managers", "role": "writer"}
          ],
          "text": "Quality Control",
          "users": []
        },
        {"limitedAccess": false, "text": "HSE"},
        {
          "groups": [
            {"name": "Projects Control", "role": "fileOrganizer"},
            {"name": "Admins", "role": "organizer"}
          ],
          "limitedAccess": true,
          "text": "Project Control",
          "users": []
        },
        {"limitedAccess": false, "text": "IFC Drawings"},
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Technical Team", "role": "fileOrganizer"},
            {"name": "Projects Managers", "role": "fileOrganizer"}
          ],
          "text": "Engineering (EPC ONLY)",
          "users": []
        },
        {
          "groups": [
            {"name": "Projects Managers", "role": "fileOrganizer"},
            {"name": "Projects Control", "role": "fileOrganizer"}
          ],
          "limitedAccess": true,
          "text": "Quantity Survey",
          "users": []
        },
        {"limitedAccess": false, "text": "Operation"},
        {"limitedAccess": false, "text": "Survey"}
      ],
      "text": "Project Delivery"
    }
  ]
}'::jsonb,
'system',
true
WHERE NOT EXISTS (SELECT 1 FROM rfp.template_versions WHERE is_active = true);

-- ═══════════════════════════════════════════════════════════════════════════
-- END - Run this entire script in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
