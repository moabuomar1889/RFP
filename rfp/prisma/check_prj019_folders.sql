-- Check if PRJ-019 exists and its details
SELECT id, pr_number, name, phase, drive_folder_id, status, created_at
FROM rfp.projects 
WHERE pr_number = 'PRJ-019';

-- Check if there are any indexed folders for PRJ-019
SELECT fi.*, p.pr_number
FROM rfp.folder_index fi
JOIN rfp.projects p ON p.id = fi.project_id
WHERE p.pr_number = 'PRJ-019'
ORDER BY fi.template_path;

-- Check total folder_index count
SELECT COUNT(*) as total_indexed_folders FROM rfp.folder_index;

-- Check if there are folders for ANY project
SELECT p.pr_number, COUNT(fi.id) as folder_count
FROM rfp.projects p
LEFT JOIN rfp.folder_index fi ON fi.project_id = p.id
GROUP BY p.id, p.pr_number
ORDER BY p.pr_number;
