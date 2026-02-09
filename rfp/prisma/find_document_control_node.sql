-- First check the template structure to find Document Control node
SELECT 
    version_number,
    jsonb_array_length(template_json) as node_count,
    jsonb_array_elements(template_json) -> 'name' as phase_names
FROM rfp.template_versions
WHERE is_active = true;

-- Check if Document Control exists
SELECT 
    version_number,
    jsonb_path_query(
        template_json,
        '$.** ? (@.name == "Document Control")'
    ) as document_control_node
FROM rfp.template_versions
WHERE is_active = true;
