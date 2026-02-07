-- Get PRJ-020 folder IDs for manual fixing
-- First, list ALL folders to find the exact template_path names

-- Specific query (commented out until we know exact path names):
/*
SELECT 
    p.pr_number as project,
    fi.template_path as folder_path,
    fi.drive_folder_id,
    fi.expected_limited_access as limited_access,
    'https://drive.google.com/drive/folders/' || fi.drive_folder_id as direct_link
FROM rfp.folder_index fi
JOIN rfp.projects p ON fi.project_id = p.id
WHERE p.pr_number = 'PRJ-020'
  AND fi.template_path IN ('Bidding', 'Vendors Quotations')
ORDER BY fi.template_path;
*/

-- List ALL folders to find exact path names:
SELECT 
    p.pr_number, 
    fi.template_path, 
    fi.drive_folder_id,
    fi.expected_limited_access,
    'https://drive.google.com/drive/folders/' || fi.drive_folder_id as direct_link
FROM rfp.folder_index fi 
JOIN rfp.projects p ON fi.project_id = p.id 
WHERE p.pr_number = 'PRJ-020' 
ORDER BY fi.template_path;

