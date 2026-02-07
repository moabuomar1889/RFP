-- Check folder_index table structure and data
-- Run in Supabase SQL Editor

-- 1. Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'rfp' AND table_name = 'folder_index'
ORDER BY ordinal_position;

-- 2. Check row count
SELECT COUNT(*) as total_rows FROM rfp.folder_index;

-- 3. Check if list_project_folders RPC exists
SELECT routine_name, data_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'list_project_folders';
