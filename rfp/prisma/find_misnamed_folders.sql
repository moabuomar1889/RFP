-- Find ALL child folders across ALL projects
-- that are named "Technical Proposal" but should be "Technical Submittal"
-- (child of parent folder "Technical Proposal" or "Technical Propsal")

-- Q11: Find all misnamed "Technical Proposal" CHILD folders
SELECT 
    p.pr_number,
    p.name as project_name,
    fi.id as folder_index_id,
    fi.drive_folder_id,
    fi.template_path,
    fi.normalized_template_path
FROM rfp.folder_index fi
JOIN rfp.projects p ON p.id = fi.project_id
WHERE fi.template_path LIKE '%Technical Prop%/%Technical Proposal%'
   OR fi.template_path LIKE '%Technical Prop%/%Technical Proposal'
ORDER BY p.pr_number;

-- Q12: Also check - are there folders that ALREADY have the correct name?
SELECT 
    p.pr_number,
    fi.template_path,
    fi.normalized_template_path,
    fi.drive_folder_id
FROM rfp.folder_index fi
JOIN rfp.projects p ON p.id = fi.project_id
WHERE fi.template_path LIKE '%Technical Submittal%'
ORDER BY p.pr_number;
