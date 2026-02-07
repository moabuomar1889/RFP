-- ═══════════════════════════════════════════════════════════════════════════
-- CLEAN SLATE - Drops EVERYTHING safely
-- Run this FIRST, then run full_rebuild.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop entire rfp schema (all tables + rfp functions)
DROP SCHEMA IF EXISTS rfp CASCADE;

-- Drop ALL public functions used by the app (handles overloaded names)
DO $$ 
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT p.oid::regprocedure AS func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
      'get_projects', 'get_pending_requests', 'upsert_project', 'approve_request',
      'update_project_folder', 'upsert_user_token', 'upsert_folder_index',
      'update_project_sync', 'clear_folder_index', 'get_folder_index',
      'get_active_template_version', 'create_sync_job', 'update_sync_job_status',
      'log_audit', 'delete_folder_index_by_project', 'delete_project',
      'get_dashboard_stats', 'upsert_user_directory', 'get_users_with_groups',
      'add_user_to_group', 'remove_user_from_group', 'get_user_by_id',
      'get_groups', 'get_settings', 'update_setting', 'save_all_settings',
      'get_active_template', 'save_template', 'get_template_by_version',
      'update_job_progress', 'clear_old_jobs', 'clear_all_jobs',
      'insert_job_log', 'insert_sync_task', 'list_job_logs',
      'list_project_folders', 'get_bidding_folders', 'get_reset_job_progress',
      'backfill_folder_index_from_drive', 'get_folder_sync_status',
      'get_noncompliant_folders', 'create_group', 'update_group',
      'delete_group', 'reject_request'
    )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
  END LOOP;
END $$;

-- Recreate clean rfp schema
CREATE SCHEMA rfp;

SELECT 'Clean slate complete - now run full_rebuild.sql' AS status;
