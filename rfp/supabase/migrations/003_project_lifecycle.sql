-- Migration: Add project lifecycle workflow tables
-- Run this in Supabase SQL Editor

-- 1. Add phase column to projects table
ALTER TABLE rfp.projects 
ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'bidding' 
CHECK (phase IN ('bidding', 'execution'));

-- 2. Create project_requests table for approval workflow
CREATE TABLE IF NOT EXISTS rfp.project_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type TEXT NOT NULL CHECK (request_type IN ('new_project', 'upgrade_to_pd')),
    project_name TEXT NOT NULL,
    pr_number TEXT, -- Auto-generated for new projects
    project_id UUID REFERENCES rfp.projects(id), -- For upgrade requests
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_project_requests_status ON rfp.project_requests(status);
CREATE INDEX IF NOT EXISTS idx_project_requests_requested_by ON rfp.project_requests(requested_by);

-- 4. Add allowed_requesters setting (roles that can request new projects)
INSERT INTO rfp.app_settings (key, value, updated_by, updated_at) 
VALUES ('allowed_requesters', '["ADMIN", "PROJECT_MANAGER"]', 'system', NOW())
ON CONFLICT (key) DO NOTHING;

-- 5. Create function to get next PR number
CREATE OR REPLACE FUNCTION rfp.get_next_pr_number()
RETURNS TEXT AS $$
DECLARE
    max_num INTEGER;
    next_num TEXT;
BEGIN
    -- Get the highest PR number from existing projects
    SELECT COALESCE(MAX(
        CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER)
    ), 0) INTO max_num
    FROM rfp.projects;
    
    -- Also check pending requests
    SELECT GREATEST(max_num, COALESCE(MAX(
        CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER)
    ), 0)) INTO max_num
    FROM rfp.project_requests
    WHERE status IN ('pending', 'approved');
    
    -- Format as PR-XXX with leading zeros
    next_num := 'PR-' || LPAD((max_num + 1)::TEXT, 3, '0');
    
    RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- 6. Grant permissions
GRANT ALL ON rfp.project_requests TO authenticated;
GRANT EXECUTE ON FUNCTION rfp.get_next_pr_number() TO authenticated;
