-- Analyze actual Drive folder structure to answer open questions
-- This will show us if "Bidding"/"Project Delivery" are actual folders

-- Check PRJ-019 (bidding) folder structure
SELECT 
    template_path,
    normalized_template_path,
    drive_folder_id
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
ORDER BY template_path;

-- Check PRJ-017 (execution) folder structure
SELECT 
    template_path,
    normalized_template_path,
    drive_folder_id
FROM rfp.folder_index
WHERE project_id = '82f1c25f-6096-48c4-8a6a-58d5e7770851'::uuid
ORDER BY normalized_template_path
LIMIT 20;

-- Check if any projects have "Bidding" or "Project Delivery" as actual indexed folders
SELECT DISTINCT
    normalized_template_path
FROM rfp.folder_index
WHERE normalized_template_path IN ('Bidding', 'Project Delivery')
   OR normalized_template_path LIKE 'Bidding'
   OR normalized_template_path LIKE 'Project Delivery';
