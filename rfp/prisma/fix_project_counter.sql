-- Fix the project counter after manual deletion
-- The counter might be stuck because of entries in project_requests table

-- 1. Check what's in project_requests
SELECT pr_number, status, created_at
FROM rfp.project_requests
WHERE pr_number IN ('PRJ-021', 'PRJ-022', 'PRJ-023', 'PRJ-024')
   OR CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER) > 20
ORDER BY pr_number DESC;

-- 2. Check current max in projects table
SELECT MAX(CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER)) as max_project_num
FROM rfp.projects;

-- 3. Delete any project_requests with numbers > 20
DELETE FROM rfp.project_requests
WHERE CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER) > 20;

-- 4. Verify the counter now returns PRJ-021
SELECT rfp.get_next_pr_number() as next_pr_number;

-- 5. Verify PRJ-020 is the last project
SELECT pr_number, name 
FROM rfp.projects
ORDER BY pr_number DESC
LIMIT 5;
