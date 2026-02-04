-- ═══════════════════════════════════════════════════════════════════════════
-- SYNC JOB RPCs
-- Functions for creating and managing sync jobs
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Get active template version
CREATE OR REPLACE FUNCTION public.get_active_template_version()
RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
BEGIN
    SELECT version_number INTO v_version
    FROM rfp.template_versions
    WHERE is_active = true
    LIMIT 1;
    
    RETURN COALESCE(v_version, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create sync job
CREATE OR REPLACE FUNCTION public.create_sync_job(
    p_id UUID,
    p_job_type TEXT,
    p_status TEXT,
    p_triggered_by TEXT,
    p_job_details JSONB
)
RETURNS UUID AS $$
BEGIN
    INSERT INTO rfp.sync_jobs (id, job_type, status, triggered_by, job_details)
    VALUES (p_id, p_job_type, p_status, p_triggered_by, p_job_details);
    
    RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update sync job status
CREATE OR REPLACE FUNCTION public.update_sync_job_status(
    p_id UUID,
    p_status TEXT,
    p_result JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE rfp.sync_jobs
    SET status = p_status,
        result = COALESCE(p_result, result),
        completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log audit entry
CREATE OR REPLACE FUNCTION public.log_audit(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_performed_by TEXT,
    p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.audit_logs (action, entity_type, entity_id, performed_by, details)
    VALUES (p_action, p_entity_type, p_entity_id, p_performed_by, p_details)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_active_template_version() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_sync_job(UUID, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_sync_job_status(UUID, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
