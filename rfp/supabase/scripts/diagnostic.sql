-- ============================================================
-- RFP System Database Diagnostic Script
-- Run this in Supabase SQL Editor to get current state
-- ============================================================

-- 1. Check Tables Exist
SELECT '=== TABLES ===' as section;
SELECT 
    schemaname, 
    tablename,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = n.schemaname AND table_name = n.tablename) as column_count
FROM pg_tables n 
WHERE schemaname = 'rfp'
ORDER BY tablename;

-- 2. Check RPC Functions
SELECT '=== RPC FUNCTIONS ===' as section;
SELECT 
    routine_name,
    STRING_AGG(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position) as parameters
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE r.routine_schema = 'public' 
  AND r.routine_type = 'FUNCTION'
  AND r.routine_name NOT LIKE 'pg_%'
  AND r.routine_name NOT LIKE '_pg_%'
GROUP BY routine_name
ORDER BY routine_name;

-- 3. Check user_tokens table columns
SELECT '=== USER_TOKENS COLUMNS ===' as section;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'rfp' AND table_name = 'user_tokens'
ORDER BY ordinal_position;

-- 4. Check projects table columns
SELECT '=== PROJECTS COLUMNS ===' as section;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'rfp' AND table_name = 'projects'
ORDER BY ordinal_position;

-- 5. Check project_requests table
SELECT '=== PROJECT_REQUESTS COLUMNS ===' as section;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'rfp' AND table_name = 'project_requests'
ORDER BY ordinal_position;

-- 6. Check template_versions table
SELECT '=== TEMPLATE_VERSIONS COLUMNS ===' as section;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'rfp' AND table_name = 'template_versions'
ORDER BY ordinal_position;

-- 7. Count records in key tables
SELECT '=== RECORD COUNTS ===' as section;
SELECT 'projects' as table_name, COUNT(*) as count FROM rfp.projects
UNION ALL
SELECT 'project_requests', COUNT(*) FROM rfp.project_requests
UNION ALL
SELECT 'template_versions', COUNT(*) FROM rfp.template_versions
UNION ALL
SELECT 'user_tokens', COUNT(*) FROM rfp.user_tokens
UNION ALL
SELECT 'audit_log', COUNT(*) FROM rfp.audit_log;

-- 8. Check if specific required functions exist
SELECT '=== REQUIRED FUNCTIONS CHECK ===' as section;
SELECT routine_name, 
       CASE WHEN routine_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'upsert_user_token',
    'get_projects',
    'get_pending_requests',
    'create_project_request',
    'approve_request',
    'reject_request',
    'update_project_folder',
    'get_active_template',
    'save_template',
    'get_dashboard_stats',
    'get_audit_log',
    'log_audit'
  )
ORDER BY routine_name;

-- 9. Check existing user tokens
SELECT '=== USER TOKENS (masked) ===' as section;
SELECT email, 
       SUBSTRING(access_token_encrypted, 1, 20) || '...' as access_token_preview,
       CASE WHEN refresh_token_encrypted IS NOT NULL THEN 'HAS_TOKEN' ELSE 'NULL' END as refresh_status,
       token_expiry,
       updated_at
FROM rfp.user_tokens;

-- 10. Check pending project requests
SELECT '=== PENDING REQUESTS ===' as section;
SELECT id, request_type, project_name, pr_number, status, requested_by, requested_at
FROM rfp.project_requests
WHERE status = 'pending'
ORDER BY requested_at DESC
LIMIT 10;

-- 11. Check projects with pending_creation status
SELECT '=== PROJECTS PENDING CREATION ===' as section;
SELECT id, pr_number, name, status, phase, drive_folder_id, created_at
FROM rfp.projects
WHERE status = 'pending_creation'
ORDER BY created_at DESC
LIMIT 10;

-- 12. Check active template
SELECT '=== ACTIVE TEMPLATE ===' as section;
SELECT version_number, created_by, is_active, created_at,
       SUBSTRING(template_json::TEXT, 1, 200) || '...' as template_preview
FROM rfp.template_versions
WHERE is_active = true;
