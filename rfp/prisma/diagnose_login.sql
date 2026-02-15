-- Check if upsert_user_token RPC exists
SELECT routine_name, routine_schema
FROM information_schema.routines 
WHERE routine_name = 'upsert_user_token';

-- Check user_tokens table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'rfp' AND table_name = 'user_tokens'
ORDER BY ordinal_position;

-- Check grants on user_tokens
SELECT grantee, privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'rfp' AND table_name = 'user_tokens';
