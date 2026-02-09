-- Check job logs for PRJ-019 enforcement to see if rename is happening
SELECT 
    event_type,
    severity,
    template_path,
    details,
    created_at
FROM rfp.job_logs
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 50;

-- Look specifically for rename events
SELECT 
    event_type,
    severity,
    template_path,
    details,
    created_at
FROM rfp.job_logs
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
  AND event_type IN ('folder_renamed', 'folder_rename_failed', 'folder_check_failed')
ORDER BY created_at DESC;
