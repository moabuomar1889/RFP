-- ═══════════════════════════════════════════════════════════════════════════
-- Cancel a running sync job by setting its status to 'cancelled'
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cancel_sync_job(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    updated_count INT;
BEGIN
    UPDATE rfp.sync_jobs
    SET status = 'cancelled',
        completed_at = NOW()
    WHERE id = p_job_id
      AND status IN ('running', 'pending');

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_sync_job(UUID) TO anon, authenticated, service_role;
