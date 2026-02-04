-- ═══════════════════════════════════════════════════════════════════════════
-- DASHBOARD STATS RPCs (RFP SCHEMA)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Get folder count
CREATE OR REPLACE FUNCTION rfp.get_folder_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM rfp.folder_index);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending requests count
CREATE OR REPLACE FUNCTION rfp.get_pending_requests_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM rfp.project_requests WHERE status = 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unresolved violations count
CREATE OR REPLACE FUNCTION rfp.get_violations_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM rfp.permission_violations WHERE resolved_at IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active jobs count
CREATE OR REPLACE FUNCTION rfp.get_active_jobs_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM rfp.sync_jobs WHERE status = 'running');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get last scan time
CREATE OR REPLACE FUNCTION rfp.get_last_scan_time()
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN (
        SELECT completed_at 
        FROM rfp.sync_jobs 
        WHERE status = 'completed' 
        ORDER BY completed_at DESC 
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION rfp.get_folder_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.get_pending_requests_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.get_violations_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.get_active_jobs_count() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.get_last_scan_time() TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
