-- URGENT: Check what folders were created for PRJ-019
-- This will show if there are duplicate folders

SELECT 
    template_path,
    normalized_template_path,
    drive_folder_id,
    last_verified_at
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
ORDER BY template_path;

-- Count duplicates
SELECT 
    COUNT(*) as total_folders,
    COUNT(DISTINCT template_path) as unique_paths
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid;
