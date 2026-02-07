-- Fix root folder phase mapping
-- Run this in Supabase SQL Editor

-- Fix root folders: PRJ-XXX-PD → Project Delivery, PRJ-XXX-RFP → Bidding
UPDATE rfp.folder_index
SET normalized_template_path = CASE
    WHEN normalized_template_path ~ '^PRJ-\d+-PD$' THEN 'Project Delivery'
    WHEN normalized_template_path ~ '^PRJ-\d+-RFP$' THEN 'Bidding'
    WHEN normalized_template_path ~ '^PRJ-\d+-PD/' THEN regexp_replace(normalized_template_path, '^PRJ-\d+-PD/', 'Project Delivery/')
    WHEN normalized_template_path ~ '^PRJ-\d+-RFP/' THEN regexp_replace(normalized_template_path, '^PRJ-\d+-RFP/', 'Bidding/')
    ELSE normalized_template_path
END
WHERE normalized_template_path ~ '^PRJ-\d+-(PD|RFP)';

-- Verify
SELECT 
    template_path,
    normalized_template_path
FROM rfp.folder_index
WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
ORDER BY template_path
LIMIT 10;
