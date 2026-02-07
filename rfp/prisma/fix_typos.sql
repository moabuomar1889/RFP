-- Fix typos in normalized folder paths to match template
-- Run in Supabase SQL Editor

UPDATE rfp.folder_index
SET normalized_template_path = REPLACE(normalized_template_path, 'Commercial Propsal', 'Commercial Proposal')
WHERE normalized_template_path LIKE '%Commercial Propsal%';

UPDATE rfp.folder_index
SET normalized_template_path = REPLACE(normalized_template_path, 'Technical Propsal', 'Technical Proposal')
WHERE normalized_template_path LIKE '%Technical Propsal%';

-- Verify the fixes
SELECT 
    template_path,
    normalized_template_path
FROM rfp.folder_index
WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
ORDER BY normalized_template_path;
