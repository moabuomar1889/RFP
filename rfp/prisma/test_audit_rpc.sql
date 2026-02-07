-- Test the exact RPCs the audit uses
-- Run each query separately in Supabase SQL Editor

-- 1. Test list_project_folders for PRJ-017
SELECT * FROM public.list_project_folders(
    (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-017')
) LIMIT 5;
