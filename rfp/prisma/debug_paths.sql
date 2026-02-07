-- Compare folder_index paths vs template paths
-- Run in Supabase SQL Editor

-- 1. Sample folder_index paths for PRJ-017
SELECT template_path FROM rfp.folder_index fi
JOIN rfp.projects p ON fi.project_id = p.id
WHERE p.pr_number = 'PRJ-017'
ORDER BY template_path
LIMIT 15;
