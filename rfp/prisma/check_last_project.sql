-- Check the last project number in the database
SELECT pr_number, name, phase, status, created_at
FROM rfp.projects
ORDER BY created_at DESC
LIMIT 10;

-- Also check what get_next_pr_number returns
SELECT rfp.get_next_pr_number() as next_pr_number;

-- Check all project numbers to see the sequence
SELECT pr_number, name, created_at
FROM rfp.projects
ORDER BY pr_number DESC;
