-- Migration 035: Create reset_jobs table
-- Purpose: Track batched reset job execution for large projects (1000+ folders)
-- Author: Permission System Refactor
-- Date: 2026-02-06

CREATE TABLE rfp.reset_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Scope
    project_id UUID REFERENCES rfp.projects(id) ON DELETE CASCADE,
    folder_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Specific folders to reset (if not whole project)
    
    -- Progress tracking
    total_folders INTEGER NOT NULL,
    processed_folders INTEGER DEFAULT 0,
    successful_folders INTEGER DEFAULT 0,
    failed_folders INTEGER DEFAULT 0,
    
    -- Execution state
    status TEXT NOT NULL DEFAULT 'pending', 
    -- Valid values: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Audit
    created_by TEXT,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT valid_progress CHECK (processed_folders <= total_folders),
    CONSTRAINT valid_counts CHECK (
        successful_folders + failed_folders <= processed_folders
    )
);

-- Indexes
CREATE INDEX idx_reset_jobs_project 
    ON rfp.reset_jobs(project_id);

CREATE INDEX idx_reset_jobs_status 
    ON rfp.reset_jobs(status);

CREATE INDEX idx_reset_jobs_created 
    ON rfp.reset_jobs(created_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE ON rfp.reset_jobs TO authenticated;
GRANT SELECT ON rfp.reset_jobs TO anon;

-- RPC: Get reset job progress
CREATE OR REPLACE FUNCTION public.get_reset_job_progress(p_job_id UUID)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    total_folders INTEGER,
    processed_folders INTEGER,
    successful_folders INTEGER,
    failed_folders INTEGER,
    status TEXT,
    progress_percent NUMERIC,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rj.id,
        rj.project_id,
        rj.total_folders,
        rj.processed_folders,
        rj.successful_folders,
        rj.failed_folders,
        rj.status,
        CASE 
            WHEN rj.total_folders > 0 THEN (rj.processed_folders::numeric / rj.total_folders::numeric * 100)
            ELSE 0
        END as progress_percent,
        rj.started_at,
        rj.completed_at,
        CASE 
            WHEN rj.completed_at IS NOT NULL AND rj.started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (rj.completed_at - rj.started_at))::INTEGER
            WHEN rj.started_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (now() - rj.started_at))::INTEGER
            ELSE NULL
        END as duration_seconds
    FROM rfp.reset_jobs rj
    WHERE rj.id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_reset_job_progress(UUID) TO authenticated, anon;

-- Comments
COMMENT ON TABLE rfp.reset_jobs IS 'Tracks batched permission reset jobs for resumability and progress monitoring';
COMMENT ON COLUMN rfp.reset_jobs.folder_ids IS 'Specific folder UUIDs to reset (empty array means entire project)';
COMMENT ON COLUMN rfp.reset_jobs.status IS 'Execution status: pending, running, completed, failed, cancelled';
