-- Check actual template structure
-- Run in Supabase SQL Editor

SELECT 
    jsonb_pretty(template_json) 
FROM rfp.folder_templates 
WHERE is_active = true 
LIMIT 1;
