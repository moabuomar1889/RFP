-- Add safe_test_mode setting to app_settings
-- Run this in Supabase SQL Editor

INSERT INTO rfp.app_settings (key, value, updated_by, updated_at) 
VALUES ('safe_test_mode', 'true', 'system', NOW())
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW();

-- Add test_project_id setting (single project for safe test mode)
INSERT INTO rfp.app_settings (key, value, updated_by, updated_at) 
VALUES ('test_project_id', 'null', 'system', NOW())
ON CONFLICT (key) DO NOTHING;

-- Add bulk_operations_approved setting
INSERT INTO rfp.app_settings (key, value, updated_by, updated_at) 
VALUES ('bulk_operations_approved', 'false', 'system', NOW())
ON CONFLICT (key) DO NOTHING;
