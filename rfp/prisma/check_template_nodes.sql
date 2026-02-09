-- Check what the template nodes actually look like
-- This will show us if the node names match "Bidding" and "Project Delivery"

SELECT 
    version_number,
    is_active,
    template_json::text
FROM rfp.template_versions
WHERE is_active = true
LIMIT 1;

-- Or get just the top-level node names
SELECT 
    version_number,
    jsonb_array_elements(template_json) -> 'text' as node_text,
    jsonb_array_elements(template_json) -> 'name' as node_name
FROM rfp.template_versions
WHERE is_active = true;
