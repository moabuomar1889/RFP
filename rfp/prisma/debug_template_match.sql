-- Debug: Check template structure vs normalized paths
-- Run in Supabase SQL Editor

-- 1. Show template structure
SELECT 
    jsonb_path_query(
        template_json,
        '$.folders[*].name'
    ) AS template_folder_name
FROM rfp.folder_templates
WHERE is_active = true
LIMIT 10;

-- 2. Show normalized paths from folder_index
SELECT normalized_template_path
FROM rfp.folder_index
WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
ORDER BY normalized_template_path
LIMIT 10;

-- 3. Check if they match
SELECT 
    fi.normalized_template_path,
    EXISTS (
        SELECT 1 
        FROM rfp.folder_templates ft,
        LATERAL jsonb_array_elements(ft.template_json->'folders') AS folder
        WHERE ft.is_active = true
        AND folder->>'name' = fi.normalized_template_path
    ) AS has_template_match
FROM rfp.folder_index fi
WHERE fi.project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
ORDER BY fi.normalized_template_path
LIMIT 10;
