-- ═══════════════════════════════════════════════════════════════════════════
-- RFP Schema - Database Migration
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Create schema
CREATE SCHEMA IF NOT EXISTS rfp;

-- ─────────────────────────────────────────────────────────────────────────────
-- USER TOKENS (Encrypted OAuth tokens for background jobs)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- APP SETTINGS (Configurable settings including protected principals)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default protected principals
INSERT INTO rfp.app_settings (key, value) VALUES 
  ('protected_principals', '["mo.abuomar@dtgsa.com", "admins@dtgsa.com"]'),
  ('strict_mode_enabled', 'true'),
  ('daily_enforcement_enabled', 'false'),
  ('daily_enforcement_time', '"02:00"');

-- ─────────────────────────────────────────────────────────────────────────────
-- TEMPLATE VERSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL UNIQUE,
  template_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TEMPLATE CHANGES (Diff/Delta between versions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.template_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_version INTEGER REFERENCES rfp.template_versions(version_number),
  to_version INTEGER NOT NULL REFERENCES rfp.template_versions(version_number),
  change_type TEXT NOT NULL,
  affected_path TEXT NOT NULL,
  change_details JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_template_changes_version ON rfp.template_changes(to_version);

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISSION ROLES (e.g., ADMIN, PM, QS, EXEC_TEAM)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.permission_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  drive_role TEXT NOT NULL, -- organizer, fileOrganizer, writer, commenter, reader
  is_system BOOLEAN DEFAULT false, -- System roles cannot be deleted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO rfp.permission_roles (name, description, drive_role, is_system) VALUES
  ('ADMIN', 'Full administrative access', 'organizer', true),
  ('PROJECT_MANAGER', 'Project manager access', 'fileOrganizer', false),
  ('QUANTITY_SURVEYOR', 'Quantity surveyor access', 'writer', false),
  ('TECHNICAL_TEAM', 'Technical team access', 'writer', false),
  ('EXECUTION_TEAM', 'Execution team access', 'writer', false),
  ('VIEWER', 'Read-only access', 'reader', false);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLE PRINCIPALS (Maps roles to Google Groups or Users)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.role_principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES rfp.permission_roles(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL, -- 'group' or 'user'
  principal_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, principal_email)
);

CREATE INDEX idx_role_principals_role ON rfp.role_principals(role_id);
CREATE INDEX idx_role_principals_email ON rfp.role_principals(principal_email);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'bidding',
  drive_folder_id TEXT NOT NULL,
  rfp_folder_id TEXT,
  pd_folder_id TEXT,
  synced_version INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  last_enforced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_pr ON rfp.projects(pr_number);
CREATE INDEX idx_projects_status ON rfp.projects(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- FOLDER INDEX (Critical for performance - maps path to folder_id)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.folder_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES rfp.projects(id) ON DELETE CASCADE,
  template_path TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  drive_folder_name TEXT NOT NULL,
  limited_access_enabled BOOLEAN DEFAULT false,
  permissions_hash TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, template_path)
);

CREATE INDEX idx_folder_index_path ON rfp.folder_index(template_path);
CREATE INDEX idx_folder_index_drive_id ON rfp.folder_index(drive_folder_id);
CREATE INDEX idx_folder_index_project ON rfp.folder_index(project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- EXPECTED PERMISSIONS (What permissions each template path should have)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.expected_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_path TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES rfp.permission_roles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_path, role_id)
);

CREATE INDEX idx_expected_permissions_path ON rfp.expected_permissions(template_path);

-- ─────────────────────────────────────────────────────────────────────────────
-- SYNC JOBS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  target_version INTEGER,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  progress_percent INTEGER DEFAULT 0,
  started_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_summary TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_status ON rfp.sync_jobs(status);
CREATE INDEX idx_sync_jobs_type ON rfp.sync_jobs(job_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- SYNC TASKS (Individual tasks within a job)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.sync_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES rfp.sync_jobs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES rfp.projects(id),
  folder_index_id UUID REFERENCES rfp.folder_index(id),
  task_type TEXT NOT NULL,
  task_details JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_tasks_job ON rfp.sync_tasks(job_id);
CREATE INDEX idx_sync_tasks_status ON rfp.sync_tasks(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISSION VIOLATIONS (Detected unauthorized changes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.permission_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_index_id UUID REFERENCES rfp.folder_index(id),
  project_id UUID REFERENCES rfp.projects(id),
  violation_type TEXT NOT NULL,
  expected JSONB,
  actual JSONB,
  auto_reverted BOOLEAN DEFAULT false,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX idx_permission_violations_project ON rfp.permission_violations(project_id);
CREATE INDEX idx_permission_violations_detected ON rfp.permission_violations(detected_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- FOLDER RECONCILIATION LOG (For drift detection)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_index_id UUID REFERENCES rfp.folder_index(id),
  project_id UUID REFERENCES rfp.projects(id),
  issue_type TEXT NOT NULL, -- 'renamed', 'moved', 'deleted', 'orphaned'
  expected_path TEXT,
  expected_name TEXT,
  actual_path TEXT,
  actual_name TEXT,
  resolution TEXT, -- 'auto_fixed', 'flagged', 'ignored'
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_project ON rfp.reconciliation_log(project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE rfp.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  details JSONB,
  performed_by TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_time ON rfp.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity ON rfp.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_action ON rfp.audit_log(action);

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to get next template version number
CREATE OR REPLACE FUNCTION rfp.get_next_template_version()
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(version_number), 0) + 1 FROM rfp.template_versions;
$$ LANGUAGE SQL;

-- Function to update job progress
CREATE OR REPLACE FUNCTION rfp.update_job_progress(p_job_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE rfp.sync_jobs
  SET 
    completed_tasks = (SELECT COUNT(*) FROM rfp.sync_tasks WHERE job_id = p_job_id AND status = 'completed'),
    failed_tasks = (SELECT COUNT(*) FROM rfp.sync_tasks WHERE job_id = p_job_id AND status = 'failed'),
    progress_percent = CASE 
      WHEN total_tasks = 0 THEN 0
      ELSE ((SELECT COUNT(*) FROM rfp.sync_tasks WHERE job_id = p_job_id AND status IN ('completed', 'failed', 'skipped')) * 100 / total_tasks)
    END
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (Optional - enable if needed)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables (uncomment if needed)
-- ALTER TABLE rfp.user_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rfp.projects ENABLE ROW LEVEL SECURITY;
-- etc.

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
