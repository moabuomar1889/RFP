-- Migration: Update approve_request to return more info + add update_project_folder RPC
-- Run this in Supabase SQL Editor

-- Drop existing functions
DROP FUNCTION IF EXISTS public.approve_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.update_project_folder(UUID, TEXT);

-- Recreate approve_request with more return values
CREATE OR REPLACE FUNCTION public.approve_request(
    p_request_id UUID,
    p_reviewed_by TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
    v_project_id UUID;
BEGIN
    SELECT * INTO v_request
    FROM rfp.project_requests
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
    END IF;
    
    UPDATE rfp.project_requests
    SET status = 'approved',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW()
    WHERE id = p_request_id;
    
    IF v_request.request_type = 'new_project' THEN
        INSERT INTO rfp.projects (
            pr_number,
            name,
            status,
            phase,
            drive_folder_id
        ) VALUES (
            v_request.pr_number,
            v_request.project_name,
            'pending_creation',
            'bidding',
            ''
        )
        RETURNING id INTO v_project_id;
    END IF;
    
    IF v_request.request_type = 'upgrade_to_pd' AND v_request.project_id IS NOT NULL THEN
        UPDATE rfp.projects
        SET phase = 'execution'
        WHERE id = v_request.project_id;
        v_project_id := v_request.project_id;
    END IF;
    
    INSERT INTO rfp.audit_log (action, entity_type, entity_id, performed_by, details)
    VALUES ('request_approved', 'project_request', p_request_id::TEXT, p_reviewed_by,
            jsonb_build_object('request_type', v_request.request_type, 'project_name', v_request.project_name));
    
    -- Return more info needed for folder creation
    RETURN jsonb_build_object(
        'success', true, 
        'project_id', v_project_id,
        'pr_number', v_request.pr_number,
        'project_name', v_request.project_name,
        'request_type', v_request.request_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the function to update project with folder ID and set to active
CREATE OR REPLACE FUNCTION public.update_project_folder(
    p_project_id UUID,
    p_drive_folder_id TEXT
)
RETURNS JSONB AS $$
BEGIN
    UPDATE rfp.projects 
    SET 
        drive_folder_id = p_drive_folder_id,
        status = 'active'
    WHERE id = p_project_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Project not found');
    END IF;
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_request(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_folder(UUID, TEXT) TO anon, authenticated;
