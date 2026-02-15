-- Check phases for ALL projects
SELECT pr_number, name, phase, drive_folder_id IS NOT NULL as has_drive
FROM rfp.projects 
ORDER BY pr_number;
