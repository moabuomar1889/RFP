-- Delete projects PRJ-021, PRJ-022, PRJ-023, PRJ-024
-- This will make PRJ-020 the last project and the next created will be PRJ-021
-- CASCADE deletes will automatically remove related records (folder_index, sync_tasks, reset_jobs)

-- First, check what will be deleted
SELECT pr_number, name, phase, status, created_at
FROM rfp.projects
WHERE pr_number IN ('PRJ-021', 'PRJ-022', 'PRJ-023', 'PRJ-024')
ORDER BY pr_number;

-- Count related records that will be cascade-deleted
SELECT 
    p.pr_number,
    COUNT(DISTINCT fi.id) as folder_index_count,
    COUNT(DISTINCT st.id) as sync_tasks_count,
    COUNT(DISTINCT rj.id) as reset_jobs_count
FROM rfp.projects p
LEFT JOIN rfp.folder_index fi ON fi.project_id = p.id
LEFT JOIN rfp.sync_tasks st ON st.project_id = p.id
LEFT JOIN rfp.reset_jobs rj ON rj.project_id = p.id
WHERE p.pr_number IN ('PRJ-021', 'PRJ-022', 'PRJ-023', 'PRJ-024')
GROUP BY p.pr_number
ORDER BY p.pr_number;

-- DELETE (uncomment to execute)
-- DELETE FROM rfp.projects
-- WHERE pr_number IN ('PRJ-021', 'PRJ-022', 'PRJ-023', 'PRJ-024');

-- Verify deletion and check next PR number
-- SELECT rfp.get_next_pr_number() as next_pr_number;

-- Verify PRJ-020 is now the last project
-- SELECT pr_number, name, created_at
-- FROM rfp.projects
-- ORDER BY pr_number DESC
-- LIMIT 5;
