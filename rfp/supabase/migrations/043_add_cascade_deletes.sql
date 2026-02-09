-- Add ON DELETE CASCADE to all project-related foreign keys
-- Applied manually on 2026-02-09 01:58 UTC, creating migration file for tracking

-- For sync_tasks table
ALTER TABLE rfp.sync_tasks 
DROP CONSTRAINT IF EXISTS sync_tasks_project_id_fkey;

ALTER TABLE rfp.sync_tasks 
ADD CONSTRAINT sync_tasks_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES rfp.projects(id) 
ON DELETE CASCADE;

-- For folder_index table
ALTER TABLE rfp.folder_index 
DROP CONSTRAINT IF EXISTS folder_index_project_id_fkey;

ALTER TABLE rfp.folder_index 
ADD CONSTRAINT folder_index_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES rfp.projects(id) 
ON DELETE CASCADE;

-- For reset_jobs table
ALTER TABLE rfp.reset_jobs 
DROP CONSTRAINT IF EXISTS reset_jobs_project_id_fkey;

ALTER TABLE rfp.reset_jobs 
ADD CONSTRAINT reset_jobs_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES rfp.projects(id) 
ON DELETE CASCADE;

-- For project_requests table
ALTER TABLE rfp.project_requests 
DROP CONSTRAINT IF EXISTS project_requests_project_id_fkey;

ALTER TABLE rfp.project_requests 
ADD CONSTRAINT project_requests_project_id_fkey 
FOREIGN KEY (project_id) 
REFERENCES rfp.projects(id) 
ON DELETE CASCADE;
