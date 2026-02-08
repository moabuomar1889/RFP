-- ============================================================================
-- QUICK CLEANUP: Delete All Old Versions, Keep Latest Only
-- ============================================================================
-- This is the simplest script - just keep the most recent template version

BEGIN;

-- Show what will be deleted (safety check)
SELECT 
    version_number,
    created_at,
    created_by,
    CASE 
        WHEN version_number = (SELECT MAX(version_number) FROM rfp.folder_templates)
        THEN '⬅️ WILL KEEP'
        ELSE '❌ WILL DELETE'
    END as action
FROM rfp.folder_templates
ORDER BY version_number DESC;

-- Uncomment the lines below to execute the cleanup:

-- Delete all old versions
-- DELETE FROM rfp.folder_templates
-- WHERE version_number < (SELECT MAX(version_number) FROM rfp.folder_templates);

-- Ensure latest is active
-- UPDATE rfp.folder_templates
-- SET is_active = true
-- WHERE version_number = (SELECT MAX(version_number) FROM rfp.folder_templates);

-- COMMIT;

-- After executing, verify with:
-- SELECT version_number, is_active, created_at FROM rfp.folder_templates;
