-- Test if list_project_folders RPC is working
-- Run this for a specific project to see if RPC returns data

-- Test PRJ-019 (should return 13 folders)
SELECT * FROM public.list_project_folders('d5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid);

-- Test PRJ-017 (should return 110 folders)
SELECT COUNT(*) as rpc_folder_count 
FROM public.list_project_folders('82f1c25f-6096-48c4-8a6a-58d5e7770851'::uuid);

-- Check if function exists
SELECT routine_name, routine_schema
FROM information_schema.routines
WHERE routine_name = 'list_project_folders';
