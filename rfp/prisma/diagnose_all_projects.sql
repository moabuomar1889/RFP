-- URGENT: Check if ALL projects have this issue
-- This diagnoses if it's a systemic problem with the phase filtering

-- Count projects and their folder counts
SELECT 
    p.pr_number,
    p.name,
    p.phase,
    COUNT(fi.id) as total_folders,
    COUNT(CASE WHEN fi.normalized_template_path LIKE 'Bidding%' THEN 1 END) as bidding_folders,
    COUNT(CASE WHEN fi.normalized_template_path LIKE 'Project Delivery%' THEN 1 END) as execution_folders,
    COUNT(CASE WHEN fi.normalized_template_path NOT LIKE 'Bidding%' 
               AND fi.normalized_template_path NOT LIKE 'Project Delivery%' THEN 1 END) as other_folders
FROM rfp.projects p
LEFT JOIN rfp.folder_index fi ON fi.project_id = p.id
WHERE p.status = 'active'
GROUP BY p.pr_number, p.name, p.phase
ORDER BY p.pr_number DESC;

-- Check if there are folders without matching phase
-- Bidding projects should have Bidding folders
-- Execution projects should have Project Delivery folders
SELECT 
    p.pr_number,
    p.phase,
    CASE 
        WHEN p.phase = 'bidding' AND COUNT(CASE WHEN fi.normalized_template_path LIKE 'Bidding%' THEN 1 END) = 0 THEN 'NO BIDDING FOLDERS!'
        WHEN p.phase = 'execution' AND COUNT(CASE WHEN fi.normalized_template_path LIKE 'Project Delivery%' THEN 1 END) = 0 THEN 'NO EXECUTION FOLDERS!'
        ELSE 'OK'
    END as phase_match_status,
    COUNT(fi.id) as total_folders
FROM rfp.projects p
LEFT JOIN rfp.folder_index fi ON fi.project_id = p.id
WHERE p.status = 'active'
GROUP BY p.pr_number, p.phase
ORDER BY p.pr_number DESC;
