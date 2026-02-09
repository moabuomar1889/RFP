-- Debug: Check if sync is finding PRJ-019 folders after normalization
-- This diagnoses why "Sync Project" shows "0 folders"

-- 1. Check what the sync endpoint sees
SELECT 
    id,
    template_path,
    normalized_template_path,
    drive_folder_id,
    last_verified_at
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
ORDER BY normalized_template_path;

-- 2. Check if there's a filter/condition blocking the folders
-- Look for phase-specific filtering
SELECT 
    p.pr_number,
    p.phase,
    COUNT(fi.id) as total_folders,
    COUNT(CASE WHEN fi.normalized_template_path LIKE 'Bidding%' THEN 1 END) as bidding_folders,
    COUNT(CASE WHEN fi.normalized_template_path LIKE 'Project Delivery%' THEN 1 END) as execution_folders
FROM rfp.projects p
LEFT JOIN rfp.folder_index fi ON fi.project_id = p.id
WHERE p.pr_number = 'PRJ-019'
GROUP BY p.pr_number, p.phase;
