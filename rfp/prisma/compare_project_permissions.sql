-- Compare Expected Permissions Between Two Projects
-- Purpose: Find why same template produces different enforcement results

-- STEP 1: List all projects (pick two to compare)
SELECT 
    pr_number,
    name,
    template_id,
    created_at
FROM rfp.projects
ORDER BY created_at DESC
LIMIT 10;

-- STEP 2: Compare Bidding folder expected permissions
-- Replace 'PRJ-XXX' and 'PRJ-YYY' with your project numbers

WITH project_ids AS (
    SELECT 
        pr_number,
        id
    FROM rfp.projects
    WHERE pr_number IN ('PRJ-020', 'PRJ-021')  -- CHANGE THESE
),
bidding_folders AS (
    SELECT 
        p.pr_number,
        fi.id AS folder_id,
        fi.folder_name,
        fi.limited_access
    FROM rfp.folder_instances fi
    JOIN project_ids p ON fi.project_id = p.id
    WHERE fi.folder_name = 'Bidding'
),
expected_perms AS (
    SELECT 
        bf.pr_number,
        bf.folder_name,
        bf.limited_access,
        LOWER(ep.email_or_domain) AS email,
        ep.permission_role AS role
    FROM bidding_folders bf
    JOIN rfp.expected_permissions ep ON ep.folder_instance_id = bf.folder_id
    ORDER BY bf.pr_number, email
)
SELECT 
    pr_number,
    folder_name,
    limited_access,
    STRING_AGG(email || ' (' || role || ')', '; ' ORDER BY email) AS expected_permissions
FROM expected_perms
GROUP BY pr_number, folder_name, limited_access;

-- STEP 3: Side-by-side comparison
WITH project_ids AS (
    SELECT 
        pr_number,
        id
    FROM rfp.projects
    WHERE pr_number IN ('PRJ-020', 'PRJ-021')  -- CHANGE THESE
),
bidding_folders AS (
    SELECT 
        p.pr_number,
        fi.id AS folder_id
    FROM rfp.folder_instances fi
    JOIN project_ids p ON fi.project_id = p.id
    WHERE fi.folder_name = 'Bidding'
),
perms_p1 AS (
    SELECT 
        LOWER(ep.email_or_domain) AS email,
        ep.permission_role
    FROM bidding_folders bf
    JOIN rfp.expected_permissions ep ON ep.folder_instance_id = bf.folder_id
    WHERE bf.pr_number = 'PRJ-020'  -- Project 1
),
perms_p2 AS (
    SELECT 
        LOWER(ep.email_or_domain) AS email,
        ep.permission_role
    FROM bidding_folders bf
    JOIN rfp.expected_permissions ep ON ep.folder_instance_id = bf.folder_id
    WHERE bf.pr_number = 'PRJ-021'  -- Project 2
)
SELECT 
    COALESCE(p1.email, p2.email) AS email,
    p1.permission_role AS proj1_role,
    p2.permission_role AS proj2_role,
    CASE 
        WHEN p1.permission_role = p2.permission_role THEN '✓ MATCH'
        WHEN p1.permission_role IS NULL THEN '⚠ MISSING IN PROJ1'
        WHEN p2.permission_role IS NULL THEN '⚠ MISSING IN PROJ2'
        ELSE '❌ DIFFERENT'
    END AS status
FROM perms_p1 p1
FULL OUTER JOIN perms_p2 p2 ON p1.email = p2.email
ORDER BY status DESC, email;
