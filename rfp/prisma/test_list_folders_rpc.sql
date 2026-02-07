-- Verify list_project_folders RPC returns data
-- Run in Supabase SQL Editor

-- Get PRJ-020's UUID
SELECT id, pr_number, name 
FROM rfp.projects 
WHERE pr_number = 'PRJ-020';

-- Test the RPC directly (replace UUID below with the one from above query)
SELECT * FROM rfp.list_project_folders('PASTE-UUID-HERE'::uuid);

-- Alternative: Check folder_index directly
SELECT 
    fi.id,
    fi.drive_folder_id,
    fi.folder_name,
    fi.normalized_template_path,
    p.pr_number
FROM rfp.folder_index fi
JOIN rfp.projects p ON fi.project_id = p.id
WHERE p.pr_number = 'PRJ-020'
ORDER BY fi.normalized_template_path;
