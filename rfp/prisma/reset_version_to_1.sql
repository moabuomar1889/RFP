-- ============================================================================
-- Reset Template Version from 8 to 1 (Fresh Start)
-- ============================================================================

BEGIN;

-- Update version 8 to version 1
UPDATE rfp.folder_templates
SET version_number = 1
WHERE version_number = 8;

COMMIT;

-- Verify
SELECT 
    version_number,
    is_active,
    created_at,
    created_by,
    notes
FROM rfp.folder_templates
ORDER BY version_number;
