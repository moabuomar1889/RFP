-- Check the active template in the database
-- Run this in Supabase SQL Editor

-- 1. Get the active template structure
SELECT 
    id,
    version_number,
    is_active,
    created_at,
    template_json::text as template_raw
FROM rfp.template_versions
WHERE is_active = true
ORDER BY version_number DESC
LIMIT 1;

-- 2. Check if template has groups defined
SELECT 
    version_number,
    template_json::text LIKE '%"groups":%' as has_groups,
    template_json::text LIKE '%"limitedAccess":true%' as has_limited_access,
    template_json::text LIKE '%"limitedAccess": true%' as has_limited_access_spaced
FROM rfp.template_versions
WHERE is_active = true;

-- 3. Look for Admin Only folder specifically
SELECT 
    version_number,
    template_json::text LIKE '%Admin Only%' as has_admin_only_folder
FROM rfp.template_versions
WHERE is_active = true;
