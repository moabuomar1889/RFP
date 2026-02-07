-- Normalize folder_index paths to match template structure
-- Run this in Supabase SQL Editor

-- Update normalized_template_path by stripping project codes and phase prefixes
UPDATE rfp.folder_index fi
SET normalized_template_path = (
    SELECT string_agg(
        -- Remove project prefix (PRJ-XXX-PHASE-) and numbering (1-, 2-, etc.)
        regexp_replace(
            regexp_replace(part, '^\d+-', ''),  -- Remove leading numbers
            '^PRJ-\d+-[A-Z]+-', ''  -- Remove PRJ-XXX-PHASE- prefix
        ),
        '/'
    )
    FROM unnest(string_to_array(fi.template_path, '/')) AS part
)
WHERE normalized_template_path IS NOT NULL;

-- Fix root-level phase names: PD → Project Delivery, RFP → Bidding
UPDATE rfp.folder_index
SET normalized_template_path = CASE
    WHEN normalized_template_path = 'PD' THEN 'Project Delivery'
    WHEN normalized_template_path = 'RFP' THEN 'Bidding'
    WHEN normalized_template_path LIKE 'PD/%' THEN 'Project Delivery' || substring(normalized_template_path from 3)
    WHEN normalized_template_path LIKE 'RFP/%' THEN 'Bidding' || substring(normalized_template_path from 4)
    ELSE normalized_template_path
END
WHERE normalized_template_path ~ '^(PD|RFP)(/|$)';

-- Verify the results
SELECT 
    template_path,
    normalized_template_path
FROM rfp.folder_index
WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
ORDER BY template_path
LIMIT 10;
