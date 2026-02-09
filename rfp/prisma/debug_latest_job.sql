-- Debug latest enforcement job logs
SELECT 
  id,
  job_type,
  status,
  job_details,
  created_at
FROM rfp.sync_jobs
WHERE job_type = 'enforce_permissions'
ORDER BY created_at DESC
LIMIT 3;

-- Get logs for latest job
SELECT 
  log_type,
  log_level,
  log_data,
  created_at
FROM rfp.sync_task_logs
WHERE job_id = (
  SELECT id FROM rfp.sync_jobs 
  WHERE job_type = 'enforce_permissions' 
  ORDER BY created_at DESC 
  LIMIT 1
)
ORDER BY created_at ASC;
