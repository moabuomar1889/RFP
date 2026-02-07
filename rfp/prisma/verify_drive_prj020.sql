-- Verification Script: Get PRJ-020 folder IDs for Drive API testing
-- Purpose: Export folder_drive_id values to test actual Drive API responses

-- Step 1: Get Project Info
SELECT 
    id,
    pr_number,
    name,
    root_drive_folder_id
FROM rfp.projects 
WHERE pr_number = 'PRJ-020';

-- Step 2: Get Key Folders (Bidding, Vendors Quotations, SOW)
SELECT 
    fi.id,
    fi.folder_name,
    fi.folder_path,
    fi.folder_drive_id,
    fi.limited_access,
    fi.parent_folder_id
FROM rfp.folder_instances fi
WHERE fi.project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
  AND fi.folder_name IN ('Bidding', 'Vendors Quotations', 'SOW')
ORDER BY fi.folder_path;

-- Step 3: Get ALL folders for PRJ-020 (with hierarchy)
SELECT 
    fi.id,
    fi.folder_name,
    fi.folder_path,
    fi.folder_drive_id,
    fi.limited_access,
    fi.parent_folder_id,
    CASE 
        WHEN fi.parent_folder_id IS NULL THEN 'ROOT'
        ELSE (SELECT folder_name FROM rfp.folder_instances WHERE id = fi.parent_folder_id)
    END as parent_name
FROM rfp.folder_instances fi
WHERE fi.project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
ORDER BY fi.folder_path;
