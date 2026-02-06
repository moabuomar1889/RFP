-- Migration 034: Create permission_audit table
-- Purpose: Comprehensive audit trail for all permission changes
-- Author: Permission System Refactor
-- Date: 2026-02-06

CREATE TABLE rfp.permission_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    folder_id UUID REFERENCES rfp.folder_index(id) ON DELETE CASCADE,
    job_id UUID,
    
    -- Action details
    action TEXT NOT NULL, 
    -- Valid values: 'add' | 'remove' | 'enable_limited_access' | 'disable_limited_access' | 'skip_inherited'
    
    -- Principal details
    principal_type TEXT, -- 'user' | 'group' | 'domain' | 'anyone'
    principal_email TEXT,
    principal_role TEXT, -- 'reader' | 'writer' | 'fileOrganizer' | 'organizer'
    permission_id TEXT,
    
    -- Inheritance tracking (critical for inherited permission violations)
    is_inherited BOOLEAN DEFAULT false,
    inherited_from TEXT, -- Drive folder ID where permission originates
    
    -- State tracking
    before_state JSONB,
    after_state JSONB,
    
    -- Result
    result TEXT NOT NULL, -- 'success' | 'failed' | 'skipped'
    error_message TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_permission_audit_folder 
    ON rfp.permission_audit(folder_id);

CREATE INDEX idx_permission_audit_job 
    ON rfp.permission_audit(job_id);

CREATE INDEX idx_permission_audit_action 
    ON rfp.permission_audit(action);

CREATE INDEX idx_permission_audit_result 
    ON rfp.permission_audit(result) 
    WHERE result = 'failed';

CREATE INDEX idx_permission_audit_inherited 
    ON rfp.permission_audit(is_inherited) 
    WHERE is_inherited = true;

CREATE INDEX idx_permission_audit_created 
    ON rfp.permission_audit(created_at DESC);

-- Grants
GRANT SELECT, INSERT ON rfp.permission_audit TO authenticated;
GRANT SELECT ON rfp.permission_audit TO anon;

-- Comments
COMMENT ON TABLE rfp.permission_audit IS 'Audit trail for all permission changes and violations';
COMMENT ON COLUMN rfp.permission_audit.action IS 'Type of action: add, remove, enable_limited_access, disable_limited_access, skip_inherited';
COMMENT ON COLUMN rfp.permission_audit.is_inherited IS 'True if this permission is inherited from parent folder and cannot be deleted';
COMMENT ON COLUMN rfp.permission_audit.inherited_from IS 'Drive folder ID where inherited permission originates (for troubleshooting)';
