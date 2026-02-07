-- Check Root Folder Drive IDs for PRJ-019 and PRJ-020
-- Purpose: Get the folder IDs to check permissions via Drive API

SELECT 
    pr_number,
    name,
    root_drive_folder_id AS root_folder_id,
    (SELECT folder_drive_id 
     FROM rfp.folder_instances 
     WHERE project_id = p.id 
       AND folder_name = 'Bidding' 
     LIMIT 1) AS bidding_folder_id
FROM rfp.projects p
WHERE pr_number IN ('PRJ-019', 'PRJ-020')
ORDER BY pr_number;

-- Next step: Use these Drive IDs to manually check permissions:
-- 1. Go to: https://developers.google.com/drive/api/v3/reference/permissions/list
-- 2. Try the API with each folder ID
-- 3. Look for HSE-Team in the results
-- 4. Compare the role (reader vs writer)
