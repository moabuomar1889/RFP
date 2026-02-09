-- Force clean all records with project number > 20 from BOTH tables

-- Step 1: Check what's actually in the database
SELECT 'projects' as source, pr_number, name FROM rfp.projects
WHERE CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER) > 20
UNION ALL
SELECT 'project_requests' as source, pr_number, '' as name FROM rfp.project_requests
WHERE CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER) > 20
ORDER BY source, pr_number;

-- Step 2: DELETE from projects table
DELETE FROM rfp.projects
WHERE CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER) > 20;

-- Step 3: DELETE from project_requests table
DELETE FROM rfp.project_requests
WHERE CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER) > 20;

-- Step 4: Verify both tables now max at 20
SELECT 
    MAX(CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER)) as max_projects
FROM rfp.projects
UNION ALL
SELECT 
    MAX(CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER)) as max_project_requests
FROM rfp.project_requests;

-- Step 5: Check the counter (should return PRJ-021)
SELECT rfp.get_next_pr_number() as next_pr_number;
