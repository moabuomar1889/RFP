-- Fix PRJ-020 Permissions to Match Template
-- Template is the single source of truth
-- PRJ-019 is correct, PRJ-020 needs fixing

-- STEP 1: Get folder IDs for PRJ-020
SELECT 
    'PRJ-020 Folder IDs:',
    fi.folder_name,
    fi.folder_drive_id,
    fi.limited_access
FROM rfp.folder_instances fi
WHERE fi.project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
  AND fi.folder_name IN ('Bidding', 'Vendors Quotations')
ORDER BY fi.folder_name;

-- STEP 2: Manual Fix Instructions
-- Copy these folder IDs and use them in Google Drive to:

-- FIX 1: Bidding Folder
-- Drive ID: [FROM STEP 1]
-- Action: Find "HSE-Team@dtgsa.com" permission
--         Change role from "writer" to "reader"
--         (Or remove if it should only inherit from parent)

-- FIX 2: Vendors Quotations Folder  
-- Drive ID: [FROM STEP 1]
-- Action: Remove these permissions if they exist:
--         - Technical-Team@dtgsa.com (reader)
--         - Projects-Control@dtgsa.com (reader)

-- STEP 3: Verify Expected Permissions Match Template
-- Check that expected permissions in DB match the template
SELECT 
    'Expected Permissions for Bidding:',
    LOWER(ep.email_or_domain) as email,
    ep.permission_role as role
FROM rfp.expected_permissions ep
WHERE ep.folder_instance_id = (
    SELECT id FROM rfp.folder_instances 
    WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
      AND folder_name = 'Bidding'
)
ORDER BY email;

SELECT 
    'Expected Permissions for Vendors Quotations:',
    LOWER(ep.email_or_domain) as email,
    ep.permission_role as role
FROM rfp.expected_permissions ep
WHERE ep.folder_instance_id = (
    SELECT id FROM rfp.folder_instances 
    WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
      AND folder_name = 'Vendors Quotations'
)
ORDER BY email;

-- STEP 4: After manual fixes, re-run Permission Audit
-- Verify that PRJ-020 now matches PRJ-019 results
