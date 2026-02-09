-- Delete the duplicate folders created by the rename bug
-- Keep only folders that start with 'PRJ-019-RFP/' or 'Bidding/'

-- First, preview what will be deleted
SELECT 
    template_path,
    drive_folder_id,
    'WILL DELETE' as action
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
  AND template_path NOT LIKE 'PRJ-019-RFP%'
  AND template_path NOT LIKE 'Bidding%'
ORDER BY template_path;

-- Count what will be deleted vs kept
SELECT 
    CASE 
        WHEN template_path LIKE 'PRJ-019-RFP%' OR template_path LIKE 'Bidding%' THEN 'KEEP'
        ELSE 'DELETE'
    END as action,
    COUNT(*) as count
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
GROUP BY 
    CASE 
        WHEN template_path LIKE 'PRJ-019-RFP%' OR template_path LIKE 'Bidding%' THEN 'KEEP'
        ELSE 'DELETE'
    END;

-- DELETE the duplicates (uncomment to execute)
DELETE FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
  AND template_path NOT LIKE 'PRJ-019-RFP%'
  AND template_path NOT LIKE 'Bidding%';

-- Verify deletion - should show only 13 folders remaining
SELECT COUNT(*) as remaining_folders
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid;

-- List remaining folders to verify they're all original
SELECT template_path
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
ORDER BY template_path;
