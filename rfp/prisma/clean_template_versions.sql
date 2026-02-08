-- ============================================================================
-- Template Version Management Script
-- ============================================================================
-- This script helps manage folder template versions in the database
-- Choose one of the options below based on your needs

-- ============================================================================
-- OPTION 1: Keep Only Latest Version and Mark as Active
-- ============================================================================
-- This deletes all previous versions except the most recent one

BEGIN;

-- Step 1: Identify the latest version
SELECT 
    id,
    version_number,
    is_active,
    created_at,
    created_by,
    notes
FROM rfp.folder_templates
ORDER BY version_number DESC
LIMIT 1;

-- Step 2: Delete all versions except the latest
-- UNCOMMENT TO EXECUTE:
-- DELETE FROM rfp.folder_templates
-- WHERE version_number < (
--     SELECT MAX(version_number) 
--     FROM rfp.folder_templates
-- );

-- Step 3: Ensure the latest version is marked as active
-- UNCOMMENT TO EXECUTE:
-- UPDATE rfp.folder_templates
-- SET is_active = true
-- WHERE version_number = (
--     SELECT MAX(version_number) 
--     FROM rfp.folder_templates
-- );

-- COMMIT;

-- ============================================================================
-- OPTION 2: Keep Last N Versions (e.g., last 3 versions)
-- ============================================================================
-- This keeps the most recent 3 versions for rollback purposes

-- UNCOMMENT TO EXECUTE:
-- BEGIN;
-- 
-- DELETE FROM rfp.folder_templates
-- WHERE version_number NOT IN (
--     SELECT version_number
--     FROM rfp.folder_templates
--     ORDER BY version_number DESC
--     LIMIT 3  -- Change this number to keep more/fewer versions
-- );
-- 
-- COMMIT;

-- ============================================================================
-- OPTION 3: Archive Old Versions (Soft Delete)
-- ============================================================================
-- This marks old versions as inactive instead of deleting them

-- UNCOMMENT TO EXECUTE:
-- BEGIN;
-- 
-- -- Mark all as inactive first
-- UPDATE rfp.folder_templates
-- SET is_active = false;
-- 
-- -- Mark only the latest as active
-- UPDATE rfp.folder_templates
-- SET is_active = true
-- WHERE version_number = (
--     SELECT MAX(version_number) 
--     FROM rfp.folder_templates
-- );
-- 
-- COMMIT;

-- ============================================================================
-- OPTION 4: Delete Versions Older Than a Specific Version Number
-- ============================================================================
-- Useful when you know which version to keep from

-- UNCOMMENT TO EXECUTE (replace N with the version number to keep from):
-- BEGIN;
-- 
-- DELETE FROM rfp.folder_templates
-- WHERE version_number < 4;  -- Replace 4 with your minimum version to keep
-- 
-- COMMIT;

-- ============================================================================
-- OPTION 5: Complete Clean Slate - Delete All and Insert New Template
-- ============================================================================
-- Use this when you want to completely replace all versions with a new one

-- UNCOMMENT TO EXECUTE:
-- BEGIN;
-- 
-- -- Delete ALL existing templates
-- DELETE FROM rfp.folder_templates;
-- 
-- -- Insert your new template (replace with actual JSON)
-- INSERT INTO rfp.folder_templates (
--     version_number,
--     template_json,
--     is_active,
--     created_by,
--     notes
-- ) VALUES (
--     1,  -- Start fresh at version 1
--     '{"folders": []}'::jsonb,  -- Replace with your actual template JSON
--     true,
--     'admin@example.com',  -- Replace with your email
--     'Fresh template after cleanup'
-- );
-- 
-- COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these AFTER executing one of the options above to verify

-- Check remaining versions
SELECT 
    version_number,
    is_active,
    created_at,
    created_by,
    notes,
    jsonb_array_length(template_json::jsonb) as folder_count
FROM rfp.folder_templates
ORDER BY version_number DESC;

-- Count total versions remaining
SELECT COUNT(*) as total_versions
FROM rfp.folder_templates;

-- Show active version
SELECT 
    version_number,
    created_at,
    created_by
FROM rfp.folder_templates
WHERE is_active = true;

-- ============================================================================
-- ROLLBACK SAFETY
-- ============================================================================
-- If you need to rollback after executing:
-- 
-- ROLLBACK;
-- 
-- (Only works if you wrapped your commands in BEGIN/COMMIT and haven't committed yet)

-- ============================================================================
-- RECOMMENDED APPROACH FOR PRODUCTION
-- ============================================================================
-- 1. Create a backup first:
--    pg_dump -h your-host -U your-user -d your-db -t rfp.folder_templates > template_backup.sql
-- 
-- 2. Use OPTION 3 (soft delete) first to test
-- 
-- 3. Verify the active template works correctly
-- 
-- 4. After confirming everything works, use OPTION 1 to permanently delete old versions
