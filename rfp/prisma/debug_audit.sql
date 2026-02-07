-- Debug: Compare folder_index paths vs template paths
-- Run in Supabase SQL Editor

-- 1. Show sample folder_index paths for PRJ-017
SELECT fi.template_path, fi.drive_folder_id
FROM rfp.folder_index fi
JOIN rfp.projects p ON fi.project_id = p.id
WHERE p.pr_number = 'PRJ-017'
LIMIT 10;

-- 2. Show the template structure (top-level folder names)
SELECT 
    jsonb_array_elements(ft.template_json)->>'name' as template_folder_name
FROM rfp.folder_templates ft
WHERE ft.is_active = true;

-- 3. Count folders per project
SELECT p.pr_number, COUNT(fi.id) as folder_count
FROM rfp.folder_index fi
JOIN rfp.projects p ON fi.project_id = p.id
GROUP BY p.pr_number
ORDER BY folder_count DESC
LIMIT 10;
