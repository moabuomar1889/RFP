-- ============================================================================
-- Migration: Add comprehensive RPC functions for API access
-- Run this in Supabase SQL Editor after running previous migrations
-- ============================================================================

-- Drop existing functions first to allow signature changes
DROP FUNCTION IF EXISTS public.get_projects(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_pending_requests();
DROP FUNCTION IF EXISTS public.get_request_history(INTEGER);
DROP FUNCTION IF EXISTS public.create_project_request(TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.approve_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_request(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_audit_log(INTEGER);
DROP FUNCTION IF EXISTS public.log_audit(TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.get_active_template();
DROP FUNCTION IF EXISTS public.save_template(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
DROP FUNCTION IF EXISTS public.upsert_project(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_project_by_id(UUID);
DROP FUNCTION IF EXISTS public.get_app_setting(TEXT);
DROP FUNCTION IF EXISTS public.set_app_setting(TEXT, JSONB, TEXT);

-- ============================================================================
-- PROJECTS RPCs
-- ============================================================================

-- Get all projects with optional filters
CREATE OR REPLACE FUNCTION public.get_projects(
    p_status TEXT DEFAULT NULL,
    p_phase TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    pr_number TEXT,
    name TEXT,
    phase TEXT,
    status TEXT,
    drive_folder_id TEXT,
    synced_version INTEGER,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.pr_number,
        p.name,
        COALESCE(p.phase, 'bidding')::TEXT as phase,
        COALESCE(p.status, 'active')::TEXT as status,
        p.drive_folder_id,
        p.synced_version,
        p.last_synced_at,
        p.created_at
    FROM rfp.projects p
    WHERE (p_status IS NULL OR p.status = p_status)
      AND (p_phase IS NULL OR p.phase = p_phase)
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROJECT REQUESTS RPCs
-- ============================================================================

-- Get pending project requests
CREATE OR REPLACE FUNCTION public.get_pending_requests()
RETURNS TABLE (
    id UUID,
    request_type TEXT,
    project_name TEXT,
    pr_number TEXT,
    project_id UUID,
    status TEXT,
    requested_by TEXT,
    requested_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.request_type,
        r.project_name,
        r.pr_number,
        r.project_id,
        r.status,
        r.requested_by,
        r.requested_at
    FROM rfp.project_requests r
    WHERE r.status = 'pending'
    ORDER BY r.requested_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get request history (approved/rejected)
CREATE OR REPLACE FUNCTION public.get_request_history(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    request_type TEXT,
    project_name TEXT,
    pr_number TEXT,
    project_id UUID,
    status TEXT,
    requested_by TEXT,
    requested_at TIMESTAMPTZ,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.request_type,
        r.project_name,
        r.pr_number,
        r.project_id,
        r.status,
        r.requested_by,
        r.requested_at,
        r.reviewed_by,
        r.reviewed_at,
        r.rejection_reason
    FROM rfp.project_requests r
    WHERE r.status != 'pending'
    ORDER BY r.reviewed_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new project request
CREATE OR REPLACE FUNCTION public.create_project_request(
    p_request_type TEXT,
    p_project_name TEXT,
    p_requested_by TEXT,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    pr_number TEXT
) AS $$
DECLARE
    v_pr_number TEXT;
    v_id UUID;
BEGIN
    IF p_request_type = 'new_project' THEN
        v_pr_number := rfp.get_next_pr_number();
    END IF;
    
    INSERT INTO rfp.project_requests (
        request_type,
        project_name,
        pr_number,
        project_id,
        requested_by
    ) VALUES (
        p_request_type,
        p_project_name,
        v_pr_number,
        p_project_id,
        p_requested_by
    )
    RETURNING project_requests.id INTO v_id;
    
    RETURN QUERY SELECT v_id, v_pr_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Approve a project request
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
    
    RETURN jsonb_build_object('success', true, 'project_id', v_project_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject a project request
CREATE OR REPLACE FUNCTION public.reject_request(
    p_request_id UUID,
    p_reviewed_by TEXT,
    p_reason TEXT
)
RETURNS JSONB AS $$
BEGIN
    UPDATE rfp.project_requests
    SET status = 'rejected',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        rejection_reason = p_reason
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
    END IF;
    
    INSERT INTO rfp.audit_log (action, entity_type, entity_id, performed_by, details)
    VALUES ('request_rejected', 'project_request', p_request_id::TEXT, p_reviewed_by,
            jsonb_build_object('reason', p_reason));
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUDIT LOG RPCs
-- ============================================================================

-- Get audit log entries
CREATE OR REPLACE FUNCTION public.get_audit_log(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    performed_by TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.performed_by,
        a.created_at
    FROM rfp.audit_log a
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log an audit entry
CREATE OR REPLACE FUNCTION public.log_audit(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_performed_by TEXT,
    p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.audit_log (action, entity_type, entity_id, performed_by, details)
    VALUES (p_action, p_entity_type, p_entity_id, p_performed_by, p_details)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TEMPLATE RPCs
-- ============================================================================

-- Get active template
CREATE OR REPLACE FUNCTION public.get_active_template()
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    template_json JSONB,
    created_by TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.version_number,
        t.template_json,
        t.created_by,
        t.created_at
    FROM rfp.template_versions t
    WHERE t.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Save template (creates new version)
CREATE OR REPLACE FUNCTION public.save_template(
    p_template_json JSONB,
    p_created_by TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM rfp.template_versions;
    
    UPDATE rfp.template_versions SET is_active = false WHERE is_active = true;
    
    INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
    VALUES (v_version, p_template_json, p_created_by, true);
    
    INSERT INTO rfp.audit_log (action, entity_type, entity_id, performed_by)
    VALUES ('template_saved', 'template', v_version::TEXT, p_created_by);
    
    RETURN v_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DASHBOARD STATS RPC
-- ============================================================================

-- Get dashboard statistics
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'totalProjects', (SELECT COUNT(*) FROM rfp.projects),
        'biddingCount', (SELECT COUNT(*) FROM rfp.projects WHERE phase = 'bidding'),
        'executionCount', (SELECT COUNT(*) FROM rfp.projects WHERE phase = 'execution'),
        'pendingRequests', (SELECT COUNT(*) FROM rfp.project_requests WHERE status = 'pending'),
        'indexedFolders', (SELECT COUNT(*) FROM rfp.folder_index),
        'violations', (SELECT COUNT(*) FROM rfp.permission_violations WHERE resolved_at IS NULL),
        'activeJobs', (SELECT COUNT(*) FROM rfp.sync_jobs WHERE status = 'running')
    ) INTO v_stats;
    
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROJECT MANAGEMENT RPCs
-- ============================================================================

-- Upsert project (for drive scanning)
CREATE OR REPLACE FUNCTION public.upsert_project(
    p_pr_number TEXT,
    p_name TEXT,
    p_drive_folder_id TEXT,
    p_phase TEXT DEFAULT 'bidding'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.projects (pr_number, name, drive_folder_id, phase, status)
    VALUES (p_pr_number, p_name, p_drive_folder_id, p_phase, 'active')
    ON CONFLICT (drive_folder_id) DO UPDATE SET
        pr_number = EXCLUDED.pr_number,
        name = EXCLUDED.name,
        phase = EXCLUDED.phase
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get project by ID
CREATE OR REPLACE FUNCTION public.get_project_by_id(p_id UUID)
RETURNS TABLE (
    id UUID,
    pr_number TEXT,
    name TEXT,
    phase TEXT,
    status TEXT,
    drive_folder_id TEXT,
    synced_version INTEGER,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.pr_number,
        p.name,
        COALESCE(p.phase, 'bidding')::TEXT as phase,
        COALESCE(p.status, 'active')::TEXT as status,
        p.drive_folder_id,
        p.synced_version,
        p.last_synced_at,
        p.created_at
    FROM rfp.projects p
    WHERE p.id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SETTINGS RPCs
-- ============================================================================

-- Get app setting
CREATE OR REPLACE FUNCTION public.get_app_setting(p_key TEXT)
RETURNS JSONB AS $$
DECLARE
    v_value JSONB;
BEGIN
    SELECT value INTO v_value
    FROM rfp.app_settings
    WHERE key = p_key;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set app setting
CREATE OR REPLACE FUNCTION public.set_app_setting(
    p_key TEXT,
    p_value JSONB,
    p_updated_by TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO rfp.app_settings (key, value, updated_by, updated_at)
    VALUES (p_key, p_value, p_updated_by, NOW())
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW();
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_projects(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_requests() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_request_history(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_project_request(TEXT, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_request(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_request(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_log(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_template() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_template(JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_project(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_by_id(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_setting(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_app_setting(TEXT, JSONB, TEXT) TO anon, authenticated;
