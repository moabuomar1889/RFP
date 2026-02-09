-- Add DC@dtgsa.com as contentManager to Document Control and all subfolders
-- This script recursively updates the template JSON

-- Step 1: Create a recursive function to add the group to all nodes
CREATE OR REPLACE FUNCTION rfp.add_group_to_node_recursive(
    node jsonb,
    group_email text,
    group_role text
) RETURNS jsonb AS $$
DECLARE
    updated_node jsonb;
    groups_array jsonb;
    child jsonb;
    updated_children jsonb := '[]'::jsonb;
BEGIN
    updated_node := node;
    
    -- Get existing groups array or create empty one
    groups_array := COALESCE(node -> 'groups', '[]'::jsonb);
    
    -- Check if group already exists
    IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(groups_array) elem
        WHERE elem ->> 'email' = group_email
    ) THEN
        -- Add new group
        groups_array := groups_array || jsonb_build_object(
            'role', group_role,
            'email', group_email
        );
        updated_node := jsonb_set(updated_node, '{groups}', groups_array);
    END IF;
    
    -- Recursively process children if they exist
    IF node ? 'children' AND jsonb_array_length(node -> 'children') > 0 THEN
        FOR child IN SELECT * FROM jsonb_array_elements(node -> 'children')
        LOOP
            updated_children := updated_children || rfp.add_group_to_node_recursive(child, group_email, group_role);
        END LOOP;
        updated_node := jsonb_set(updated_node, '{children}', updated_children);
    END IF;
    
    RETURN updated_node;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Update the Document Control node in the template
DO $$
DECLARE
    current_template jsonb;
    template_id uuid;
    updated_template jsonb;
    phase_node jsonb;
    updated_phase_node jsonb;
    phase_index int;
    doc_control_node jsonb;
    updated_doc_control_node jsonb;
    doc_control_index int;
BEGIN
    -- Get current active template
    SELECT id, template_json INTO template_id, current_template
    FROM rfp.template_versions
    WHERE is_active = true
    LIMIT 1;
    
    IF template_id IS NULL THEN
        RAISE EXCEPTION 'No active template found';
    END IF;
    
    -- Find Project Delivery phase node (index)
    SELECT idx - 1, elem INTO phase_index, phase_node
    FROM jsonb_array_elements(current_template) WITH ORDINALITY AS arr(elem, idx)
    WHERE elem ->> 'name' = 'Project Delivery'
    LIMIT 1;
    
    IF phase_node IS NULL THEN
        RAISE EXCEPTION 'Project Delivery phase node not found';
    END IF;
    
    -- Find Document Control node within Project Delivery
    SELECT idx - 1, elem INTO doc_control_index, doc_control_node
    FROM jsonb_array_elements(phase_node -> 'children') WITH ORDINALITY AS arr(elem, idx)
    WHERE elem ->> 'name' = 'Document Control'
    LIMIT 1;
    
    IF doc_control_node IS NULL THEN
        RAISE EXCEPTION 'Document Control node not found';
    END IF;
    
    -- Add DC@dtgsa.com to Document Control and all children recursively
    updated_doc_control_node := rfp.add_group_to_node_recursive(
        doc_control_node,
        'DC@dtgsa.com',
        'contentManager'
    );
    
    -- Update the phase node with the updated Document Control
    updated_phase_node := jsonb_set(
        phase_node,
        array['children', doc_control_index::text],
        updated_doc_control_node
    );
    
    -- Update the template with the updated phase node
    updated_template := jsonb_set(
        current_template,
        array[phase_index::text],
        updated_phase_node
    );
    
    -- Save the updated template
    UPDATE rfp.template_versions
    SET template_json = updated_template
    WHERE id = template_id;
    
    RAISE NOTICE 'Successfully added DC@dtgsa.com as contentManager to Document Control and all subfolders';
END;
$$;

-- Step 3: Cleanup - Drop the helper function
DROP FUNCTION IF EXISTS rfp.add_group_to_node_recursive(jsonb, text, text);

-- Verify the update
SELECT 
    jsonb_pretty(
        jsonb_path_query(
            template_json,
            '$.** ? (@.name == "Document Control")'
        )
    ) as updated_document_control
FROM rfp.template_versions
WHERE is_active = true
LIMIT 1;
