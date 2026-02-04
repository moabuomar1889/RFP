-- Migration 014: Fix approve_request for upgrade scenarios
-- Returns existing folder ID for upgrades so we don't create a new root folder
-- Run this in Supabase SQL Editor

DROP FUNCTION IF EXISTS public.approve_request(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.approve_request(
    p_request_id UUID,
    p_reviewed_by TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_request RECORD;
    v_project_id UUID;
    v_existing_folder_id TEXT;
    v_existing_pr_number TEXT;
    v_existing_name TEXT;
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
        -- Create new project for new_project requests
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
        
        -- Return info for new project (no existing folder)
        INSERT INTO rfp.audit_log (action, entity_type, entity_id, performed_by, details)
        VALUES ('request_approved', 'project_request', p_request_id::TEXT, p_reviewed_by,
                jsonb_build_object('request_type', v_request.request_type, 'project_name', v_request.project_name));
        
        RETURN jsonb_build_object(
            'success', true, 
            'project_id', v_project_id,
            'pr_number', v_request.pr_number,
            'project_name', v_request.project_name,
            'request_type', v_request.request_type,
            'phase', 'bidding',
            'existing_folder_id', NULL
        );
    END IF;
    
    IF v_request.request_type = 'upgrade_to_pd' AND v_request.project_id IS NOT NULL THEN
        -- Get existing project info for upgrade
        SELECT drive_folder_id, pr_number, name 
        INTO v_existing_folder_id, v_existing_pr_number, v_existing_name
        FROM rfp.projects
        WHERE id = v_request.project_id;
        
        -- Update phase to execution
        UPDATE rfp.projects
        SET phase = 'execution'
        WHERE id = v_request.project_id;
        
        v_project_id := v_request.project_id;
        
        INSERT INTO rfp.audit_log (action, entity_type, entity_id, performed_by, details)
        VALUES ('request_approved', 'project_request', p_request_id::TEXT, p_reviewed_by,
                jsonb_build_object('request_type', v_request.request_type, 'project_name', v_existing_name));
        
        -- Return existing folder ID for upgrade (don't create new root folder!)
        RETURN jsonb_build_object(
            'success', true, 
            'project_id', v_project_id,
            'pr_number', v_existing_pr_number,
            'project_name', v_existing_name,
            'request_type', v_request.request_type,
            'phase', 'execution',
            'existing_folder_id', v_existing_folder_id
        );
    END IF;
    
    RETURN jsonb_build_object('success', false, 'error', 'Unknown request type');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.approve_request(UUID, TEXT) TO anon, authenticated, service_role;
