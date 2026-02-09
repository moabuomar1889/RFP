-- Check if project PRJ-020 has folders in folder_index
SELECT *
FROM rfp.folder_index fi
JOIN rfp.projects p ON fi.project_id = p.id
WHERE p.pr_number = 'PRJ-020'
ORDER BY fi.template_path
LIMIT 20;

-- Also check total folders per project
SELECT 
  p.pr_number,
  p.name,
  COUNT(fi.id) as folder_count
FROM rfp.projects p
LEFT JOIN rfp.folder_index fi ON fi.project_id = p.id
GROUP BY p.pr_number, p.name
ORDER BY p.pr_number;
