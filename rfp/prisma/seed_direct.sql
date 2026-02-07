-- Direct seed via SQL (bypasses tsx/Prisma Client issues)
-- Insert the real template from template_output.json

-- First, read the template JSON file and insert it
-- This script should be run AFTER template-backup.json is in place

INSERT INTO rfp.folder_templates (
    version_number,
    template_json,
    is_active,
    created_by,
    notes
)
SELECT 
    1 as version_number,
    template_data::jsonb as template_json,
    true as is_active,
    'system_seed' as created_by,
    'Initial template imported from template_output.json' as notes
FROM (
    SELECT pg_read_file('C:/Users/Mo.abuomar/Desktop/RFP3/rfp/template_output.json')::text as template_data
) t
ON CONFLICT (version_number) DO UPDATE
SET 
    template_json = EXCLUDED.template_json,
    is_active = EXCLUDED.is_active;

-- Verify insertion
SELECT id, version_number, is_active, created_by, created_at
FROM rfp.folder_templates
ORDER BY version_number DESC
LIMIT 1;
