-- Check recent reset jobs for PRJ-019 to see enforcement logs
SELECT 
    id,
    status,
    progress,
    result,
    created_at,
    completed_at
FROM rfp.reset_jobs
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
ORDER BY created_at DESC
LIMIT 5;

-- Check if there's a logs column with JSON details
SELECT 
    id,
    status,
    result::text as result_preview,
    created_at
FROM rfp.reset_jobs
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
