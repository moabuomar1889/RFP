-- Add dc-team@dtgsa.com and DC@dtgsa.com as content contributors
-- to Document Control folder and all subfolders in the template

-- First, let's view the current template structure for Document Control
SELECT 
    version_number,
    is_active,
    jsonb_pretty(template_json) as template_structure
FROM rfp.template_versions
WHERE is_active = true;

-- Script to recursively add groups to Document Control and all children
-- This will need to be customized based on the actual template structure

-- Helper function to add groups to a node and its children
CREATE OR REPLACE FUNCTION rfp.add_groups_to_document_control()
RETURNS void AS $$
DECLARE
    active_template jsonb;
    template_id uuid;
BEGIN
    -- Get the active template
    SELECT id, template_json INTO template_id, active_template
    FROM rfp.template_versions
    WHERE is_active = true
    LIMIT 1;

    -- Function to recursively update node and children
    -- Note: This is a simplified version - actual implementation depends on template structure
    
    -- For now, let's just show what needs to be updated
    RAISE NOTICE 'Template ID: %', template_id;
    RAISE NOTICE 'You need to manually update the template JSON to add groups to Document Control';
    
END;
$$ LANGUAGE plpgsql;

-- To manually update the template, you would need to:
-- 1. Export the template JSON
-- 2. Find the "Document Control" node under "Project Delivery"
-- 3. Add to the groups array: {"name": "dc-team@dtgsa.com", "role": "contentManager"}
-- 4. Add to the groups array: {"name": "DC@dtgsa.com", "role": "contentManager"}
-- 5. Recursively apply to all children
-- 6. Update the template_json column

-- Alternative: Update via UI in the Template editor
-- Navigate to: Template > Edit > Project Delivery > Document Control
-- Add groups there with "Content Manager" role
