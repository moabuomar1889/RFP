-- Clean up Project Delivery folders from PRJ-019 (bidding-only project)
-- Delete all Project Delivery folder index entries for PRJ-019

DELETE FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'
AND template_path LIKE 'Project Delivery%';

-- Verify cleanup - should show 0 Project Delivery folders
SELECT COUNT(*) as deleted_count
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'
AND template_path LIKE 'Project Delivery%';

-- Check remaining folders for PRJ-019
SELECT COUNT(*) as remaining_folders
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c';

-- List remaining folders to verify they're all Bidding
SELECT template_path
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'
ORDER BY template_path;
