-- ========== 001_initial_schema.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RFP Schema - Database Migration
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Create schema
CREATE SCHEMA IF NOT EXISTS rfp;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- USER TOKENS (Encrypted OAuth tokens for background jobs)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE rfp.user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- APP SETTINGS (Configurable settings including protected principals)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- TEMPLATE VERSIONS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE rfp.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL UNIQUE,
  template_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false
);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- TEMPLATE CHANGES (Diff/Delta between versions)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- PERMISSION ROLES (e.g., ADMIN, PM, QS, EXEC_TEAM)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- ROLE PRINCIPALS (Maps roles to Google Groups or Users)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- PROJECTS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- FOLDER INDEX (Critical for performance - maps path to folder_id)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- EXPECTED PERMISSIONS (What permissions each template path should have)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE rfp.expected_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_path TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES rfp.permission_roles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_path, role_id)
);

CREATE INDEX idx_expected_permissions_path ON rfp.expected_permissions(template_path);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SYNC JOBS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- SYNC TASKS (Individual tasks within a job)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- PERMISSION VIOLATIONS (Detected unauthorized changes)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- FOLDER RECONCILIATION LOG (For drift detection)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- AUDIT LOG
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- HELPER FUNCTIONS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- ROW LEVEL SECURITY (Optional - enable if needed)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Enable RLS on all tables (uncomment if needed)
-- ALTER TABLE rfp.user_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rfp.projects ENABLE ROW LEVEL SECURITY;
-- etc.

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 002_add_safe_test_mode.sql ==========

-- Add safe_test_mode setting to app_settings
-- Run this in Supabase SQL Editor

INSERT INTO rfp.app_settings (key, value, updated_by, updated_at) 
VALUES ('safe_test_mode', 'true', 'system', NOW())
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW();

-- Add test_project_id setting (single project for safe test mode)
INSERT INTO rfp.app_settings (key, value, updated_by, updated_at) 
VALUES ('test_project_id', 'null', 'system', NOW())
ON CONFLICT (key) DO NOTHING;

-- Add bulk_operations_approved setting
INSERT INTO rfp.app_settings (key, value, updated_by, updated_at) 
VALUES ('bulk_operations_approved', 'false', 'system', NOW())
ON CONFLICT (key) DO NOTHING;



-- ========== 002_user_group_directory.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RFP Schema - User and Group Directory Tables + RPC Functions
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- USER DIRECTORY (Cached from Google Workspace)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS rfp.user_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  given_name TEXT,
  family_name TEXT,
  photo_url TEXT,
  department TEXT,
  role TEXT DEFAULT 'User',
  status TEXT DEFAULT 'Active',
  last_login TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_directory_email ON rfp.user_directory(email);
CREATE INDEX IF NOT EXISTS idx_user_directory_status ON rfp.user_directory(status);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- GROUP DIRECTORY (Cached from Google Workspace)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS rfp.group_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  member_count INTEGER DEFAULT 0,
  mapped_role TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_directory_email ON rfp.group_directory(email);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- RPC FUNCTIONS (in public schema, access rfp tables)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Upsert user from Google Workspace
CREATE OR REPLACE FUNCTION public.upsert_user_directory(
    p_google_id TEXT,
    p_email TEXT,
    p_name TEXT,
    p_given_name TEXT DEFAULT NULL,
    p_family_name TEXT DEFAULT NULL,
    p_photo_url TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL,
    p_role TEXT DEFAULT 'User',
    p_status TEXT DEFAULT 'Active',
    p_last_login TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.user_directory (
        google_id, email, name, given_name, family_name, 
        photo_url, department, role, status, last_login, synced_at
    )
    VALUES (
        p_google_id, p_email, p_name, p_given_name, p_family_name,
        p_photo_url, p_department, p_role, p_status, p_last_login, NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        google_id = COALESCE(EXCLUDED.google_id, rfp.user_directory.google_id),
        name = EXCLUDED.name,
        given_name = EXCLUDED.given_name,
        family_name = EXCLUDED.family_name,
        photo_url = EXCLUDED.photo_url,
        department = EXCLUDED.department,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        last_login = EXCLUDED.last_login,
        synced_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert group from Google Workspace
CREATE OR REPLACE FUNCTION public.upsert_group_directory(
    p_google_id TEXT,
    p_email TEXT,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_member_count INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.group_directory (
        google_id, email, name, description, member_count, synced_at
    )
    VALUES (
        p_google_id, p_email, p_name, p_description, p_member_count, NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
        google_id = COALESCE(EXCLUDED.google_id, rfp.group_directory.google_id),
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        member_count = EXCLUDED.member_count,
        synced_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all users
CREATE OR REPLACE FUNCTION public.get_users()
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    given_name TEXT,
    family_name TEXT,
    photo_url TEXT,
    department TEXT,
    role TEXT,
    status TEXT,
    last_login TIMESTAMPTZ,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.google_id, u.email, u.name, u.given_name, u.family_name,
        u.photo_url, u.department, u.role, u.status, u.last_login, 
        u.synced_at, u.created_at
    FROM rfp.user_directory u
    ORDER BY u.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all groups
CREATE OR REPLACE FUNCTION public.get_groups()
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    description TEXT,
    member_count INTEGER,
    mapped_role TEXT,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id, g.google_id, g.email, g.name, g.description,
        g.member_count, g.mapped_role, g.synced_at, g.created_at
    FROM rfp.group_directory g
    ORDER BY g.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user by ID
CREATE OR REPLACE FUNCTION public.get_user_by_id(p_id UUID)
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    given_name TEXT,
    family_name TEXT,
    photo_url TEXT,
    department TEXT,
    role TEXT,
    status TEXT,
    last_login TIMESTAMPTZ,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.google_id, u.email, u.name, u.given_name, u.family_name,
        u.photo_url, u.department, u.role, u.status, u.last_login, 
        u.synced_at, u.created_at
    FROM rfp.user_directory u
    WHERE u.id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- GRANT PERMISSIONS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT EXECUTE ON FUNCTION public.upsert_user_directory(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_group_directory(TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_users() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_groups() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 003_project_lifecycle.sql ==========

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



-- ========== 004_default_template.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RFP Schema - Default Template Migration
-- Insert the production folder template with Bidding and Project Delivery phases
-- Run this in Supabase SQL Editor AFTER 001, 002, 003 migrations
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Insert default template as version 1
INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
VALUES (
  1,
  '{
    "exportDate": "2026-01-31T09:38:24.633Z",
    "exportVersion": "2.5",
    "template": [
      {
        "_expanded": true,
        "limitedAccess": false,
        "groups": [],
        "nodes": [
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Admins", "role": "organizer"},
              {"name": "Technical Team", "role": "writer"},
              {"name": "Projects Managers", "role": "writer"},
              {"name": "Projects Control", "role": "writer"},
              {"name": "dc team", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"}
            ],
            "text": "SOW",
            "users": []
          },
          {
            "_expanded": true,
            "groups": [{"name": "Projects Managers", "role": "writer"}],
            "limitedAccess": true,
            "nodes": [
              {"limitedAccess": false, "text": "TBE"},
              {"limitedAccess": false, "text": "Technical Proposal"}
            ],
            "text": "Technical Propsal",
            "users": [{"type": "user", "email": "Marwan@dtgsa.com", "role": "fileOrganizer"}]
          },
          {
            "_expanded": true,
            "limitedAccess": true,
            "groups": [
              {"name": "Admins", "role": "organizer"},
              {"name": "Projects Managers", "role": "fileOrganizer"}
            ],
            "nodes": [
              {"limitedAccess": false, "text": "Civil and Finishes"},
              {"limitedAccess": false, "text": "Mechanical"},
              {"limitedAccess": false, "text": "E&I"},
              {"limitedAccess": false, "text": "IT"}
            ],
            "text": "Vendors Quotations",
            "users": []
          },
          {
            "groups": [{"name": "Projects Managers", "role": "writer"}],
            "limitedAccess": true,
            "text": "Commercial Propsal",
            "users": []
          }
        ],
        "text": "Bidding",
        "users": []
      },
      {
        "_expanded": true,
        "groups": [],
        "limitedAccess": false,
        "nodes": [
          {
            "_expanded": true,
            "groups": [
              {"name": "Document Control", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
              {"name": "Projects Managers", "email": "projects-managers@dtgsa.com", "role": "fileOrganizer"},
              {"name": "Admins", "email": "admin@dtgsa.com", "role": "organizer"}
            ],
            "limitedAccess": true,
            "nodes": [
              {"groups": [], "limitedAccess": true, "nodes": [], "text": "Forms", "folderType": "PD", "users": []},
              {"groups": [], "limitedAccess": true, "nodes": [], "text": "MDR", "folderType": "PD", "users": []},
              {
                "nodes": [
                  {
                    "nodes": [
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Construction", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "EHS", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Minutes of Meetings", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Procurment", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "Project Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Quality Control", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "Letters", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "SI & CCCOR", "folderType": "PD", "users": []}
                    ],
                    "_expanded": true,
                    "limitedAccess": false,
                    "groups": [],
                    "text": "Ongoing",
                    "folderType": "PD",
                    "users": []
                  },
                  {
                    "nodes": [
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Construction", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "EHS", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Minutes of Meetings", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Procurment", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Project Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Quality Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Letters", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "SI & CCCOR", "folderType": "PD", "users": []}
                    ],
                    "_expanded": true,
                    "limitedAccess": false,
                    "groups": [],
                    "text": "Received",
                    "folderType": "PD",
                    "users": []
                  }
                ],
                "_expanded": true,
                "groups": [],
                "limitedAccess": false,
                "text": "Submittals",
                "folderType": "PD",
                "users": []
              },
              {
                "limitedAccess": false,
                "groups": [],
                "nodes": [
                  {"limitedAccess": false, "groups": [], "nodes": [], "text": "Received", "folderType": "PD", "users": []},
                  {"limitedAccess": false, "groups": [], "nodes": [], "text": "Sent", "folderType": "PD", "users": []}
                ],
                "text": "Transmittals",
                "folderType": "PD",
                "users": []
              }
            ],
            "text": "Document Control",
            "users": []
          },
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Quality Control", "role": "fileOrganizer"},
              {"name": "Projects Control", "role": "reader"},
              {"name": "Projects Managers", "role": "writer"},
              {"name": "dc team", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"}
            ],
            "text": "Quality Control",
            "users": []
          },
          {"limitedAccess": false, "text": "HSE"},
          {
            "_expanded": true,
            "groups": [
              {"name": "Projects Control", "role": "fileOrganizer"},
              {"name": "Admins", "role": "organizer"}
            ],
            "limitedAccess": true,
            "nodes": [
              {
                "groups": [],
                "limitedAccess": false,
                "nodes": [
                  {"limitedAccess": false, "nodes": [], "text": "Reports", "folderType": "PD"},
                  {"limitedAccess": false, "nodes": [], "text": "Planning Deliverables", "folderType": "PD"}
                ],
                "text": "Planning",
                "folderType": "PD",
                "users": []
              },
              {
                "nodes": [
                  {
                    "_expanded": true,
                    "limitedAccess": false,
                    "nodes": [
                      {"limitedAccess": false, "nodes": [], "text": "Contract & PO", "folderType": "PD"},
                      {"limitedAccess": false, "nodes": [], "text": "Change Orders", "folderType": "PD"}
                    ],
                    "text": "Agreements",
                    "folderType": "PD"
                  },
                  {"limitedAccess": false, "nodes": [], "text": "Invoices", "folderType": "PD"}
                ],
                "_expanded": true,
                "groups": [
                  {"name": "Projects Managers", "role": "fileOrganizer"},
                  {"name": "Admins", "role": "organizer"}
                ],
                "limitedAccess": true,
                "text": "Commercial",
                "folderType": "PD",
                "users": []
              }
            ],
            "text": "Project Control",
            "users": []
          },
          {"limitedAccess": false, "text": "IFC Drawings"},
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Technical Team", "role": "fileOrganizer"},
              {"name": "Projects Managers", "role": "fileOrganizer"}
            ],
            "text": "Engineering (EPC ONLY)",
            "users": []
          },
          {
            "groups": [
              {"name": "Projects Managers", "role": "fileOrganizer"},
              {"name": "Projects Control", "role": "fileOrganizer"}
            ],
            "limitedAccess": true,
            "nodes": [],
            "text": "Quantity Survuy",
            "folderType": "PD",
            "users": []
          },
          {"limitedAccess": false, "nodes": [], "text": "Operation", "folderType": "PD"},
          {
            "groups": [{"name": "survey team", "email": "survey-team@dtgsa.com", "role": "fileOrganizer"}],
            "limitedAccess": false,
            "nodes": [],
            "text": "Survey",
            "folderType": "PD"
          }
        ],
        "text": "Project Delivery"
      }
    ]
  }'::jsonb,
  'system',
  true
)
ON CONFLICT (version_number) 
DO UPDATE SET 
  template_json = EXCLUDED.template_json,
  is_active = true;

-- Log the template insertion
INSERT INTO rfp.audit_log (action, entity_type, entity_id, details, performed_by)
VALUES (
  'template_created',
  'template',
  '1',
  '{"version": 1, "phases": ["Bidding", "Project Delivery"], "description": "Production folder structure template"}'::jsonb,
  'system'
);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 005_comprehensive_rpcs.sql ==========

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



-- ========== 006_insert_default_template.sql ==========

-- Migration: Update or Insert the correct default template
-- Run this in Supabase SQL Editor

-- First, delete any existing templates to avoid conflicts
DELETE FROM rfp.template_versions WHERE version_number = 1;

-- Insert the correct default template
INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
VALUES (
    1,
    '[
      {
        "_expanded": true,
        "limitedAccess": false,
        "groups": [],
        "nodes": [
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Admins", "role": "organizer"},
              {"name": "Technical Team", "role": "writer"},
              {"name": "Projects Managers", "role": "writer"},
              {"name": "Projects Control", "role": "writer"},
              {"name": "dc team", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"}
            ],
            "text": "SOW",
            "users": []
          },
          {
            "_expanded": true,
            "groups": [{"name": "Projects Managers", "role": "writer"}],
            "limitedAccess": true,
            "nodes": [
              {"limitedAccess": false, "text": "TBE"},
              {"limitedAccess": false, "text": "Technical Proposal"}
            ],
            "text": "Technical Propsal",
            "users": [{"type": "user", "email": "Marwan@dtgsa.com", "role": "fileOrganizer"}]
          },
          {
            "_expanded": true,
            "limitedAccess": true,
            "groups": [
              {"name": "Admins", "role": "organizer"},
              {"name": "Projects Managers", "role": "fileOrganizer"}
            ],
            "nodes": [
              {"limitedAccess": false, "text": "Civil and Finishes"},
              {"limitedAccess": false, "text": "Mechanical"},
              {"limitedAccess": false, "text": "E&I"},
              {"limitedAccess": false, "text": "IT"}
            ],
            "text": "Vendors Quotations",
            "users": []
          },
          {
            "groups": [{"name": "Projects Managers", "role": "writer"}],
            "limitedAccess": true,
            "text": "Commercial Propsal",
            "users": []
          }
        ],
        "text": "Bidding",
        "users": []
      },
      {
        "_expanded": true,
        "groups": [],
        "limitedAccess": false,
        "nodes": [
          {
            "_expanded": true,
            "groups": [
              {"name": "Document Control", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
              {"name": "Projects Managers", "email": "projects-managers@dtgsa.com", "role": "fileOrganizer"},
              {"name": "Admins", "email": "admin@dtgsa.com", "role": "organizer"}
            ],
            "limitedAccess": true,
            "nodes": [
              {"groups": [], "limitedAccess": true, "nodes": [], "text": "Forms", "folderType": "PD", "users": []},
              {"groups": [], "limitedAccess": true, "nodes": [], "text": "MDR", "folderType": "PD", "users": []},
              {
                "nodes": [
                  {
                    "nodes": [
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Construction", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "EHS", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Minutes of Meetings", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Procurment", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "Project Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Quality Control", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "Letters", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "SI & CCCOR", "folderType": "PD", "users": []}
                    ],
                    "_expanded": true,
                    "limitedAccess": false,
                    "groups": [],
                    "text": "Ongoing",
                    "folderType": "PD",
                    "users": []
                  },
                  {
                    "nodes": [
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Construction", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "EHS", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Minutes of Meetings", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Procurment", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Project Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Quality Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Letters", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "SI & CCCOR", "folderType": "PD", "users": []}
                    ],
                    "_expanded": true,
                    "limitedAccess": false,
                    "groups": [],
                    "text": "Received",
                    "folderType": "PD",
                    "users": []
                  }
                ],
                "_expanded": true,
                "groups": [],
                "limitedAccess": false,
                "text": "Submittals",
                "folderType": "PD",
                "users": []
              },
              {
                "limitedAccess": false,
                "groups": [],
                "nodes": [
                  {"limitedAccess": false, "groups": [], "nodes": [], "text": "Received", "folderType": "PD", "users": []},
                  {"limitedAccess": false, "groups": [], "nodes": [], "text": "Sent", "folderType": "PD", "users": []}
                ],
                "text": "Transmittals",
                "folderType": "PD",
                "users": []
              }
            ],
            "text": "Document Control",
            "users": []
          },
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Quality Control", "role": "fileOrganizer"},
              {"name": "Projects Control", "role": "reader"},
              {"name": "Projects Managers", "role": "writer"},
              {"name": "dc team", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"}
            ],
            "text": "Quality Control",
            "users": []
          },
          {"limitedAccess": false, "text": "HSE"},
          {
            "_expanded": true,
            "groups": [
              {"name": "Projects Control", "role": "fileOrganizer"},
              {"name": "Admins", "role": "organizer"}
            ],
            "limitedAccess": true,
            "nodes": [
              {
                "groups": [],
                "limitedAccess": false,
                "nodes": [
                  {"limitedAccess": false, "nodes": [], "text": "Reports", "folderType": "PD"},
                  {"limitedAccess": false, "nodes": [], "text": "Planning Deliverables", "folderType": "PD"}
                ],
                "text": "Planning",
                "folderType": "PD",
                "users": []
              },
              {
                "nodes": [
                  {
                    "_expanded": true,
                    "limitedAccess": false,
                    "nodes": [
                      {"limitedAccess": false, "nodes": [], "text": "Contract & PO", "folderType": "PD"},
                      {"limitedAccess": false, "nodes": [], "text": "Change Orders", "folderType": "PD"}
                    ],
                    "text": "Agreements",
                    "folderType": "PD"
                  },
                  {"limitedAccess": false, "nodes": [], "text": "Invoices", "folderType": "PD"}
                ],
                "_expanded": true,
                "groups": [
                  {"name": "Projects Managers", "role": "fileOrganizer"},
                  {"name": "Admins", "role": "organizer"}
                ],
                "limitedAccess": true,
                "text": "Commercial",
                "folderType": "PD",
                "users": []
              }
            ],
            "text": "Project Control",
            "users": []
          },
          {"limitedAccess": false, "text": "IFC Drawings"},
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Technical Team", "role": "fileOrganizer"},
              {"name": "Projects Managers", "role": "fileOrganizer"}
            ],
            "text": "Engineering (EPC ONLY)",
            "users": []
          },
          {
            "groups": [
              {"name": "Projects Managers", "role": "fileOrganizer"},
              {"name": "Projects Control", "role": "fileOrganizer"}
            ],
            "limitedAccess": true,
            "nodes": [],
            "text": "Quantity Survuy",
            "folderType": "PD",
            "users": []
          },
          {"limitedAccess": false, "nodes": [], "text": "Operation", "folderType": "PD"},
          {
            "groups": [{"name": "survey team", "email": "survey-team@dtgsa.com", "role": "fileOrganizer"}],
            "limitedAccess": false,
            "nodes": [],
            "text": "Survey",
            "folderType": "PD"
          }
        ],
        "text": "Project Delivery"
      }
    ]'::jsonb,
    'system',
    true
);



-- ========== 007_update_project_folder_rpc.sql ==========

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



-- ========== 008_upsert_user_token_rpc.sql ==========

-- Migration: Add upsert_user_token RPC that handles NULL refresh token
-- Google only provides refresh_token on first authorization
-- On subsequent logins, we must preserve the existing refresh_token
-- Run this in Supabase SQL Editor

-- Drop if exists
DROP FUNCTION IF EXISTS public.upsert_user_token(TEXT, TEXT, TEXT, TIMESTAMPTZ);

-- Create the function
CREATE OR REPLACE FUNCTION public.upsert_user_token(
    p_email TEXT,
    p_access_token TEXT,
    p_refresh_token TEXT,
    p_token_expiry TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_existing_refresh TEXT;
BEGIN
    -- If refresh_token is null, try to get existing one
    IF p_refresh_token IS NULL THEN
        SELECT refresh_token_encrypted INTO v_existing_refresh
        FROM rfp.user_tokens
        WHERE email = p_email;
        
        -- If no existing refresh token, we can't proceed
        IF v_existing_refresh IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No refresh token available');
        END IF;
    ELSE
        v_existing_refresh := p_refresh_token;
    END IF;
    
    -- Upsert the token
    INSERT INTO rfp.user_tokens (email, access_token_encrypted, refresh_token_encrypted, token_expiry, updated_at)
    VALUES (p_email, p_access_token, v_existing_refresh, p_token_expiry, NOW())
    ON CONFLICT (email) 
    DO UPDATE SET
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = COALESCE(NULLIF(EXCLUDED.refresh_token_encrypted, ''), rfp.user_tokens.refresh_token_encrypted),
        token_expiry = EXCLUDED.token_expiry,
        updated_at = NOW();
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.upsert_user_token(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;



-- ========== 009_insert_folder_index_rpc.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- INSERT FOLDER INDEX RPC (RFP SCHEMA)
-- Run this in Supabase SQL Editor  
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Drop existing function if exists
DROP FUNCTION IF EXISTS rfp.insert_folder_index(UUID, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.insert_folder_index(UUID, TEXT, TEXT, TEXT, BOOLEAN);

-- Insert folder index entry
CREATE OR REPLACE FUNCTION rfp.insert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_drive_folder_name TEXT,
    p_limited_access_enabled BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.folder_index (
        project_id,
        template_path,
        drive_folder_id,
        drive_folder_name,
        limited_access_enabled
    )
    VALUES (
        p_project_id,
        p_template_path,
        p_drive_folder_id,
        p_drive_folder_name,
        p_limited_access_enabled
    )
    ON CONFLICT (drive_folder_id) DO UPDATE SET
        template_path = EXCLUDED.template_path,
        drive_folder_name = EXCLUDED.drive_folder_name,
        limited_access_enabled = EXCLUDED.limited_access_enabled
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION rfp.insert_folder_index(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 010_user_group_membership.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- USER GROUP MEMBERSHIP - Track which groups users belong to
-- Run this in Supabase SQL Editor
-- ALL OBJECTS IN RFP SCHEMA
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- USER GROUP MEMBERSHIP TABLE
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS rfp.user_group_membership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    group_email TEXT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by TEXT,
    UNIQUE(user_email, group_email)
);

CREATE INDEX IF NOT EXISTS idx_user_group_member_user ON rfp.user_group_membership(user_email);
CREATE INDEX IF NOT EXISTS idx_user_group_member_group ON rfp.user_group_membership(group_email);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- RPC FUNCTIONS (ALL IN RFP SCHEMA)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Get groups for a user
CREATE OR REPLACE FUNCTION rfp.get_user_groups(p_user_email TEXT)
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    description TEXT,
    member_count INTEGER,
    mapped_role TEXT,
    synced_at TIMESTAMPTZ,
    added_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id, g.google_id, g.email, g.name, g.description,
        g.member_count, g.mapped_role, g.synced_at,
        m.added_at
    FROM rfp.group_directory g
    INNER JOIN rfp.user_group_membership m ON g.email = m.group_email
    WHERE m.user_email = p_user_email
    ORDER BY g.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add user to group
CREATE OR REPLACE FUNCTION rfp.add_user_to_group(
    p_user_email TEXT,
    p_group_email TEXT,
    p_added_by TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.user_group_membership (user_email, group_email, added_by)
    VALUES (p_user_email, p_group_email, p_added_by)
    ON CONFLICT (user_email, group_email) DO NOTHING
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove user from group
CREATE OR REPLACE FUNCTION rfp.remove_user_from_group(
    p_user_email TEXT,
    p_group_email TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM rfp.user_group_membership
    WHERE user_email = p_user_email AND group_email = p_group_email;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all users with their groups (for efficient loading)
CREATE OR REPLACE FUNCTION rfp.get_users_with_groups()
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    given_name TEXT,
    family_name TEXT,
    photo_url TEXT,
    department TEXT,
    role TEXT,
    status TEXT,
    last_login TIMESTAMPTZ,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    groups TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.google_id, u.email, u.name, u.given_name, u.family_name,
        u.photo_url, u.department, u.role, u.status, u.last_login, 
        u.synced_at, u.created_at,
        COALESCE(ARRAY_AGG(g.name) FILTER (WHERE g.name IS NOT NULL), '{}') as groups
    FROM rfp.user_directory u
    LEFT JOIN rfp.user_group_membership m ON u.email = m.user_email
    LEFT JOIN rfp.group_directory g ON m.group_email = g.email
    GROUP BY u.id, u.google_id, u.email, u.name, u.given_name, u.family_name,
             u.photo_url, u.department, u.role, u.status, u.last_login, 
             u.synced_at, u.created_at
    ORDER BY u.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- GRANT PERMISSIONS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GRANT EXECUTE ON FUNCTION rfp.get_user_groups(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.add_user_to_group(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.remove_user_from_group(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.get_users_with_groups() TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 011_dashboard_stats_rpcs.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- DASHBOARD STATS RPCs (RFP SCHEMA)
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 012_project_delete_rpcs.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PROJECT DELETE RPCs 
-- These are PUBLIC SCHEMA wrappers that access RFP schema tables
-- This follows the same pattern as other RPCs (get_project_by_id, get_projects, etc.)
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Delete folder_index entries for a project
-- Function is in public schema (so RPC can find it)
-- but operates on rfp.folder_index table
CREATE OR REPLACE FUNCTION public.delete_folder_index_by_project(p_project_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rfp.folder_index WHERE project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete a project from the database
-- Function is in public schema but operates on rfp.projects table
CREATE OR REPLACE FUNCTION public.delete_project(p_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rfp.projects WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.delete_folder_index_by_project(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_project(UUID) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 013_sync_job_rpcs.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SYNC JOB RPCs (FIXED COLUMN NAMES)
-- Functions for creating and managing sync jobs
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

-- Create sync job (using correct column names: started_by, metadata)
CREATE OR REPLACE FUNCTION public.create_sync_job(
    p_id UUID,
    p_job_type TEXT,
    p_status TEXT,
    p_triggered_by TEXT,
    p_job_details JSONB
)
RETURNS UUID AS $$
BEGIN
    INSERT INTO rfp.sync_jobs (id, job_type, status, started_by, metadata)
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
        metadata = COALESCE(p_result, metadata),
        completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log audit entry (using correct table: audit_log not audit_logs)
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
    INSERT INTO rfp.audit_log (action, entity_type, entity_id, performed_by, details)
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

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 014_fix_upgrade_folder.sql ==========

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



-- ========== 015_direct_sync_rpcs.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- DIRECT SYNC RPCs
-- Functions for direct project sync without Inngest
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Upsert folder index entry
CREATE OR REPLACE FUNCTION public.upsert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_drive_folder_name TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO rfp.folder_index (project_id, template_path, drive_folder_id, drive_folder_name, last_verified_at)
    VALUES (p_project_id, p_template_path, p_drive_folder_id, p_drive_folder_name, NOW())
    ON CONFLICT (project_id, template_path) 
    DO UPDATE SET 
        drive_folder_id = EXCLUDED.drive_folder_id,
        drive_folder_name = EXCLUDED.drive_folder_name,
        last_verified_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update project sync timestamp
CREATE OR REPLACE FUNCTION public.update_project_sync(p_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE rfp.projects
    SET last_synced_at = NOW()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clear and rebuild folder index for a project
CREATE OR REPLACE FUNCTION public.clear_folder_index(p_project_id UUID)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM rfp.folder_index WHERE project_id = p_project_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get folder index for project
CREATE OR REPLACE FUNCTION public.get_folder_index(p_project_id UUID)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    template_path TEXT,
    drive_folder_id TEXT,
    drive_folder_name TEXT,
    limited_access_enabled BOOLEAN,
    permission_status TEXT,
    last_verified_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT fi.id, fi.project_id, fi.template_path, fi.drive_folder_id, 
           fi.drive_folder_name, fi.limited_access_enabled, fi.permission_status,
           fi.last_verified_at
    FROM rfp.folder_index fi
    WHERE fi.project_id = p_project_id
    ORDER BY fi.template_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.upsert_folder_index(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_project_sync(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_folder_index(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_folder_index(UUID) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 016_public_users_groups_rpc.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- PUBLIC WRAPPER FOR GET USERS WITH GROUPS
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Public wrapper for get_users_with_groups
CREATE OR REPLACE FUNCTION public.get_users_with_groups()
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    given_name TEXT,
    family_name TEXT,
    photo_url TEXT,
    department TEXT,
    role TEXT,
    status TEXT,
    last_login TIMESTAMPTZ,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    groups TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.google_id, u.email, u.name, u.given_name, u.family_name,
        u.photo_url, u.department, u.role, u.status, u.last_login, 
        u.synced_at, u.created_at,
        COALESCE(ARRAY_AGG(g.name) FILTER (WHERE g.name IS NOT NULL), '{}') as groups
    FROM rfp.user_directory u
    LEFT JOIN rfp.user_group_membership m ON u.email = m.user_email
    LEFT JOIN rfp.group_directory g ON m.group_email = g.email
    GROUP BY u.id, u.google_id, u.email, u.name, u.given_name, u.family_name,
             u.photo_url, u.department, u.role, u.status, u.last_login, 
             u.synced_at, u.created_at
    ORDER BY u.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_users_with_groups() TO anon, authenticated, service_role;

-- Public wrapper for add_user_to_group
CREATE OR REPLACE FUNCTION public.add_user_to_group(
    p_user_email TEXT,
    p_group_email TEXT,
    p_added_by TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.user_group_membership (user_email, group_email, added_by)
    VALUES (p_user_email, p_group_email, p_added_by)
    ON CONFLICT (user_email, group_email) DO NOTHING
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.add_user_to_group(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 017_fix_upsert_project.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- FIX UPSERT PROJECT RPC
-- The original used ON CONFLICT (drive_folder_id) but pr_number is the unique key
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Fix upsert_project to conflict on pr_number (the actual unique constraint)
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
    ON CONFLICT (pr_number) DO UPDATE SET
        name = EXCLUDED.name,
        drive_folder_id = EXCLUDED.drive_folder_id,
        phase = EXCLUDED.phase
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.upsert_project(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 019_group_management_rpcs.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- GROUP MANAGEMENT RPCs
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Public wrapper for get_users_with_groups (already created in 016)
-- Here we add the remaining needed RPCs

-- Get user by ID
CREATE OR REPLACE FUNCTION public.get_user_by_id(p_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    role TEXT,
    department TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.email, u.name, u.role, u.department, u.status
    FROM rfp.user_directory u
    WHERE u.id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO anon, authenticated, service_role;

-- Remove user from group
CREATE OR REPLACE FUNCTION public.remove_user_from_group(
    p_user_email TEXT,
    p_group_email TEXT
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rfp.user_group_membership 
    WHERE user_email = p_user_email 
    AND group_email = p_group_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.remove_user_from_group(TEXT, TEXT) TO anon, authenticated, service_role;

-- Get groups list
CREATE OR REPLACE FUNCTION public.get_groups()
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    description TEXT,
    member_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id, g.google_id, g.email, g.name, g.description, g.member_count
    FROM rfp.group_directory g
    ORDER BY g.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_groups() TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END OF MIGRATION
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 020_complete_group_rpcs.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- COMPLETE USER & GROUP MANAGEMENT RPCs
-- Run this ENTIRE script in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- 1. Make sure user_group_membership table exists
CREATE TABLE IF NOT EXISTS rfp.user_group_membership (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    group_email TEXT NOT NULL,
    added_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_email, group_email)
);

-- 2. Get users with their groups
DROP FUNCTION IF EXISTS public.get_users_with_groups();
CREATE OR REPLACE FUNCTION public.get_users_with_groups()
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    given_name TEXT,
    family_name TEXT,
    photo_url TEXT,
    department TEXT,
    role TEXT,
    status TEXT,
    last_login TIMESTAMPTZ,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    groups TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.google_id, u.email, u.name, u.given_name, u.family_name,
        u.photo_url, u.department, u.role, u.status, u.last_login, 
        u.synced_at, u.created_at,
        COALESCE(ARRAY_AGG(g.name) FILTER (WHERE g.name IS NOT NULL), '{}') as groups
    FROM rfp.user_directory u
    LEFT JOIN rfp.user_group_membership m ON LOWER(u.email) = LOWER(m.user_email)
    LEFT JOIN rfp.group_directory g ON LOWER(m.group_email) = LOWER(g.email)
    GROUP BY u.id, u.google_id, u.email, u.name, u.given_name, u.family_name,
             u.photo_url, u.department, u.role, u.status, u.last_login, 
             u.synced_at, u.created_at
    ORDER BY u.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_users_with_groups() TO anon, authenticated, service_role;

-- 3. Add user to group
DROP FUNCTION IF EXISTS public.add_user_to_group(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.add_user_to_group(
    p_user_email TEXT,
    p_group_email TEXT,
    p_added_by TEXT DEFAULT 'admin'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.user_group_membership (user_email, group_email, added_by)
    VALUES (LOWER(p_user_email), LOWER(p_group_email), p_added_by)
    ON CONFLICT (user_email, group_email) DO UPDATE SET added_by = p_added_by
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.add_user_to_group(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. Remove user from group
DROP FUNCTION IF EXISTS public.remove_user_from_group(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.remove_user_from_group(
    p_user_email TEXT,
    p_group_email TEXT
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM rfp.user_group_membership 
    WHERE LOWER(user_email) = LOWER(p_user_email) 
    AND LOWER(group_email) = LOWER(p_group_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.remove_user_from_group(TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. Get user by ID
DROP FUNCTION IF EXISTS public.get_user_by_id(UUID);
CREATE OR REPLACE FUNCTION public.get_user_by_id(p_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    role TEXT,
    department TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, u.email, u.name, u.role, u.department, u.status
    FROM rfp.user_directory u
    WHERE u.id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO anon, authenticated, service_role;

-- 6. Get all groups
DROP FUNCTION IF EXISTS public.get_groups();
CREATE OR REPLACE FUNCTION public.get_groups()
RETURNS TABLE (
    id UUID,
    google_id TEXT,
    email TEXT,
    name TEXT,
    description TEXT,
    member_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id, g.google_id, g.email, g.name, g.description, g.member_count
    FROM rfp.group_directory g
    ORDER BY g.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_groups() TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END - Run this entire script in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 021_template_rpcs.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- COMPLETE TEMPLATE AND PERMISSIONS RPCs
-- Run this ENTIRE script in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- 1. Create template_versions table if not exists
CREATE TABLE IF NOT EXISTS rfp.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INTEGER UNIQUE NOT NULL,
    template_json JSONB NOT NULL,
    created_by TEXT DEFAULT 'system',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Get active template
DROP FUNCTION IF EXISTS public.get_active_template();
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

GRANT EXECUTE ON FUNCTION public.get_active_template() TO anon, authenticated, service_role;

-- 3. Save template (creates new version)
DROP FUNCTION IF EXISTS public.save_template(JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.save_template(
    p_template_json JSONB,
    p_created_by TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version FROM rfp.template_versions;
    
    -- Deactivate all existing templates
    UPDATE rfp.template_versions SET is_active = false WHERE is_active = true;
    
    -- Insert new template
    INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
    VALUES (v_version, p_template_json, p_created_by, true);
    
    RETURN v_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_template(JSONB, TEXT) TO anon, authenticated, service_role;

-- 4. Insert default template if none exists
INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
SELECT 1, 
'{
  "exportDate": "2026-01-31T09:38:24.633Z",
  "exportVersion": "2.5",
  "template": [
    {
      "_expanded": true,
      "limitedAccess": false,
      "groups": [],
      "nodes": [
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Admins", "role": "organizer"},
            {"name": "Technical Team", "role": "writer"},
            {"name": "Projects Managers", "role": "writer"},
            {"name": "Projects Control", "role": "writer"}
          ],
          "text": "SOW",
          "users": []
        },
        {
          "groups": [{"name": "Projects Managers", "role": "writer"}],
          "limitedAccess": true,
          "text": "Technical Proposal",
          "users": []
        },
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Admins", "role": "organizer"},
            {"name": "Projects Managers", "role": "fileOrganizer"}
          ],
          "text": "Vendors Quotations",
          "users": []
        },
        {
          "groups": [{"name": "Projects Managers", "role": "writer"}],
          "limitedAccess": true,
          "text": "Commercial Proposal",
          "users": []
        }
      ],
      "text": "Bidding",
      "users": []
    },
    {
      "_expanded": true,
      "groups": [],
      "limitedAccess": false,
      "nodes": [
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Document Control", "role": "fileOrganizer"},
            {"name": "Projects Managers", "role": "fileOrganizer"},
            {"name": "Admins", "role": "organizer"}
          ],
          "text": "Document Control",
          "users": []
        },
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Quality Control", "role": "fileOrganizer"},
            {"name": "Projects Control", "role": "reader"},
            {"name": "Projects Managers", "role": "writer"}
          ],
          "text": "Quality Control",
          "users": []
        },
        {"limitedAccess": false, "text": "HSE"},
        {
          "groups": [
            {"name": "Projects Control", "role": "fileOrganizer"},
            {"name": "Admins", "role": "organizer"}
          ],
          "limitedAccess": true,
          "text": "Project Control",
          "users": []
        },
        {"limitedAccess": false, "text": "IFC Drawings"},
        {
          "limitedAccess": true,
          "groups": [
            {"name": "Technical Team", "role": "fileOrganizer"},
            {"name": "Projects Managers", "role": "fileOrganizer"}
          ],
          "text": "Engineering (EPC ONLY)",
          "users": []
        },
        {
          "groups": [
            {"name": "Projects Managers", "role": "fileOrganizer"},
            {"name": "Projects Control", "role": "fileOrganizer"}
          ],
          "limitedAccess": true,
          "text": "Quantity Survey",
          "users": []
        },
        {"limitedAccess": false, "text": "Operation"},
        {"limitedAccess": false, "text": "Survey"}
      ],
      "text": "Project Delivery"
    }
  ]
}'::jsonb,
'system',
true
WHERE NOT EXISTS (SELECT 1 FROM rfp.template_versions WHERE is_active = true);

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END - Run this entire script in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 022_settings_rpcs.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SETTINGS TABLE AND RPCs
-- Run this ENTIRE script in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- 1. Create settings table
CREATE TABLE IF NOT EXISTS rfp.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT 'system'
);

-- 2. Insert default settings if not exist
INSERT INTO rfp.system_settings (setting_key, setting_value, description) VALUES
('safe_test_mode', '{"enabled": true}'::jsonb, 'Safe test mode restricts bulk operations'),
('strict_mode', '{"enabled": true}'::jsonb, 'Strict mode enables permission enforcement'),
('bulk_approved', '{"approved": false}'::jsonb, 'Whether bulk operations have been approved'),
('protected_principals', '{"emails": ["mo.abuomar@dtgsa.com", "admins@dtgsa.com"]}'::jsonb, 'Protected email addresses that cannot be removed')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Get all settings
DROP FUNCTION IF EXISTS public.get_settings();
CREATE OR REPLACE FUNCTION public.get_settings()
RETURNS TABLE (
    setting_key TEXT,
    setting_value JSONB,
    description TEXT,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.setting_key,
        s.setting_value,
        s.description,
        s.updated_at
    FROM rfp.system_settings s
    ORDER BY s.setting_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_settings() TO anon, authenticated, service_role;

-- 4. Update a setting
DROP FUNCTION IF EXISTS public.update_setting(TEXT, JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.update_setting(
    p_key TEXT,
    p_value JSONB,
    p_updated_by TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE rfp.system_settings 
    SET 
        setting_value = p_value,
        updated_at = NOW(),
        updated_by = p_updated_by
    WHERE setting_key = p_key;
    
    IF NOT FOUND THEN
        INSERT INTO rfp.system_settings (setting_key, setting_value, updated_by)
        VALUES (p_key, p_value, p_updated_by);
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_setting(TEXT, JSONB, TEXT) TO anon, authenticated, service_role;

-- 5. Bulk update settings (for Save Settings button)
DROP FUNCTION IF EXISTS public.save_all_settings(JSONB);
CREATE OR REPLACE FUNCTION public.save_all_settings(
    p_settings JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_key TEXT;
    v_value JSONB;
BEGIN
    -- Loop through each key in the settings object
    FOR v_key, v_value IN SELECT * FROM jsonb_each(p_settings)
    LOOP
        UPDATE rfp.system_settings 
        SET 
            setting_value = v_value,
            updated_at = NOW(),
            updated_by = 'admin'
        WHERE setting_key = v_key;
        
        IF NOT FOUND THEN
            INSERT INTO rfp.system_settings (setting_key, setting_value, updated_by)
            VALUES (v_key, v_value, 'admin');
        END IF;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.save_all_settings(JSONB) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END - Run this entire script in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 023_new_default_template.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- NEW DEFAULT TEMPLATE FROM PRJ-014 EXTRACTION
-- Generated: 2026-02-05
-- Run this ENTIRE script in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Deactivate all existing templates
UPDATE rfp.template_versions SET is_active = false;

-- Get the next version number and insert the new template
DO $$
DECLARE
    v_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version FROM rfp.template_versions;
    
    INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
    VALUES (
        v_version,
        '[
  {
    "name": "Project Delivery",
    "limitedAccess": false,
    "groups": [
      {"email": "technical-team@dtgsa.com", "role": "reader"},
      {"email": "dc-team@dtgsa.com", "role": "reader"},
      {"email": "survey-team@dtgsa.com", "role": "reader"},
      {"email": "projects-control@dtgsa.com", "role": "reader"},
      {"email": "admin@dtgsa.com", "role": "organizer"},
      {"email": "quality-control@dtgsa.com", "role": "reader"},
      {"email": "projects-managers@dtgsa.com", "role": "reader"}
    ],
    "children": [
      {
        "name": "Quantity Survey",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
        ]
      },
      {
        "name": "Engineering (EPC ONLY)",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "fileOrganizer"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
        ]
      },
      {
        "name": "Project Control",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ],
        "children": [
          {
            "name": "Commercial",
            "limitedAccess": true,
            "groups": [
              {"email": "projects-control@dtgsa.com", "role": "reader"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
            ],
            "children": [
              {
                "name": "Invoices",
                "limitedAccess": true,
                "groups": [
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ]
              },
              {
                "name": "Agreements",
                "limitedAccess": true,
                "groups": [
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ],
                "children": [
                  {
                    "name": "Change Orders",
                    "limitedAccess": true,
                    "groups": [
                      {"email": "admin@dtgsa.com", "role": "organizer"},
                      {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                    ]
                  },
                  {
                    "name": "Contract & PO",
                    "limitedAccess": true,
                    "groups": [
                      {"email": "admin@dtgsa.com", "role": "organizer"},
                      {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                    ]
                  }
                ]
              }
            ]
          },
          {
            "name": "Planning",
            "limitedAccess": true,
            "groups": [
              {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
              {"email": "admin@dtgsa.com", "role": "organizer"}
            ],
            "children": [
              {
                "name": "Planning Deliverables",
                "limitedAccess": true,
                "groups": [
                  {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"}
                ]
              },
              {
                "name": "Reports",
                "limitedAccess": true,
                "groups": [
                  {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"}
                ]
              }
            ]
          }
        ]
      },
      {
        "name": "Quality Control",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "fileOrganizer"},
          {"email": "projects-managers@dtgsa.com", "role": "writer"}
        ]
      },
      {
        "name": "Document Control",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
        ],
        "children": [
          {
            "name": "MDR",
            "limitedAccess": true,
            "groups": [
              {"email": "dc-team@dtgsa.com", "role": "reader"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "reader"}
            ]
          },
          {
            "name": "Forms",
            "limitedAccess": true,
            "groups": [
              {"email": "dc-team@dtgsa.com", "role": "reader"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "reader"}
            ]
          },
          {
            "name": "Transmittals",
            "limitedAccess": true,
            "groups": [
              {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
            ],
            "children": [
              {
                "name": "Sent",
                "limitedAccess": true,
                "groups": [
                  {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ]
              },
              {
                "name": "Received",
                "limitedAccess": true,
                "groups": [
                  {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ]
              }
            ]
          },
          {
            "name": "Submittals",
            "limitedAccess": true,
            "groups": [
              {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
            ],
            "children": [
              {
                "name": "Received",
                "limitedAccess": true,
                "groups": [
                  {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ],
                "children": [
                  {"name": "SI & CCCOR", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Letters", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Quality Control", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Project Control", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Procurement", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Minutes of Meetings", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "EHS", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Construction", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]}
                ]
              },
              {
                "name": "Ongoing",
                "limitedAccess": true,
                "groups": [
                  {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ],
                "children": [
                  {"name": "SI & CCCOR", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Letters", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Quality Control", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Project Control", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Procurement", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Minutes of Meetings", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "EHS", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Construction", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]}
                ]
              }
            ]
          }
        ]
      },
      {
        "name": "Survey",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ]
      },
      {
        "name": "Operation",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ]
      },
      {
        "name": "IFC Drawings",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ]
      },
      {
        "name": "HSE",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ]
      }
    ]
  },
  {
    "name": "Bidding",
    "limitedAccess": false,
    "groups": [
      {"email": "technical-team@dtgsa.com", "role": "reader"},
      {"email": "dc-team@dtgsa.com", "role": "reader"},
      {"email": "survey-team@dtgsa.com", "role": "reader"},
      {"email": "projects-control@dtgsa.com", "role": "reader"},
      {"email": "admin@dtgsa.com", "role": "organizer"},
      {"email": "quality-control@dtgsa.com", "role": "reader"},
      {"email": "projects-managers@dtgsa.com", "role": "reader"}
    ],
    "children": [
      {
        "name": "Commercial Proposal",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "writer"}
        ],
        "children": [
          {
            "name": "Admin Only",
            "limitedAccess": true,
            "groups": [
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "reader"}
            ]
          }
        ]
      },
      {
        "name": "Vendors Quotations",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
        ],
        "children": [
          {"name": "Civil and Finishes", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
          {"name": "IT", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
          {"name": "E&I", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
          {"name": "Mechanical", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]}
        ]
      },
      {
        "name": "Technical Proposal",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "writer"}
        ],
        "children": [
          {"name": "TBE", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "writer"}]},
          {"name": "Technical Proposal", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "writer"}]}
        ]
      },
      {
        "name": "SOW",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "writer"},
          {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "writer"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "writer"}
        ]
      }
    ]
  }
]'::jsonb,
        'system_extracted_prj014',
        true
    );
    
    RAISE NOTICE 'New template version % created successfully', v_version;
END $$;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- VERIFICATION: Check the new active template
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
SELECT 
    version_number,
    created_by,
    is_active,
    created_at,
    jsonb_array_length(template_json) as phase_count
FROM rfp.template_versions
WHERE is_active = true;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- END - Run this entire script in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



-- ========== 025_job_progress_rpc.sql ==========

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Public RPC for updating job progress
-- Run this in Supabase SQL Editor
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Drop existing function if exists with wrong signature
DROP FUNCTION IF EXISTS public.update_job_progress(uuid, int, int, int, text);

-- Create public wrapper for updating job progress
CREATE OR REPLACE FUNCTION public.update_job_progress(
    p_job_id UUID,
    p_progress INT DEFAULT 0,
    p_completed_tasks INT DEFAULT 0,
    p_total_tasks INT DEFAULT 0,
    p_status TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    UPDATE rfp.sync_jobs
    SET 
        progress_percent = p_progress,
        completed_tasks = p_completed_tasks,
        total_tasks = p_total_tasks,
        status = COALESCE(p_status, status),
        started_at = CASE 
            WHEN p_status = 'running' AND started_at IS NULL THEN NOW()
            ELSE started_at
        END,
        completed_at = CASE 
            WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW()
            ELSE completed_at
        END
    WHERE id = p_job_id;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.update_job_progress(UUID, INT, INT, INT, TEXT) TO anon, authenticated, service_role;

-- Also create a clear_jobs function
CREATE OR REPLACE FUNCTION public.clear_old_jobs(
    p_keep_recent_hours INT DEFAULT 24
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM rfp.sync_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < NOW() - (p_keep_recent_hours || ' hours')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_old_jobs(INT) TO anon, authenticated, service_role;

-- Create clear_all_jobs function
CREATE OR REPLACE FUNCTION public.clear_all_jobs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM rfp.sync_jobs
    WHERE status IN ('completed', 'failed', 'cancelled');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_all_jobs() TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Upsert folder index entry
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Drop old function first to allow signature change
DROP FUNCTION IF EXISTS public.upsert_folder_index(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.upsert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_drive_folder_name TEXT,
    p_normalized_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.folder_index (project_id, template_path, drive_folder_id, drive_folder_name, normalized_template_path, last_verified_at)
    VALUES (p_project_id, p_template_path, p_drive_folder_id, p_drive_folder_name, COALESCE(p_normalized_path, p_template_path), NOW())
    ON CONFLICT (project_id, template_path) 
    DO UPDATE SET 
        drive_folder_id = p_drive_folder_id,
        drive_folder_name = p_drive_folder_name,
        normalized_template_path = COALESCE(p_normalized_path, rfp.folder_index.normalized_template_path),
        last_verified_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_folder_index(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Insert job log (for writeJobLog function)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE OR REPLACE FUNCTION public.insert_job_log(
    p_job_id UUID,
    p_project_id UUID DEFAULT NULL,
    p_project_name TEXT DEFAULT NULL,
    p_folder_path TEXT DEFAULT NULL,
    p_action TEXT DEFAULT 'info',
    p_status TEXT DEFAULT 'info',
    p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.sync_tasks (
        job_id, 
        project_id, 
        task_type, 
        task_details, 
        status,
        completed_at
    )
    VALUES (
        p_job_id, 
        p_project_id, 
        p_action, 
        jsonb_build_object(
            'message', COALESCE(p_folder_path, ''),
            'project_name', COALESCE(p_project_name, ''),
            'details', p_details,
            'log_status', p_status
        ),
        CASE WHEN p_status = 'error' THEN 'failed' ELSE 'completed' END,
        NOW()
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_job_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- Insert sync task (for detailed job logs)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE OR REPLACE FUNCTION public.insert_sync_task(
    p_job_id UUID,
    p_project_id UUID DEFAULT NULL,
    p_task_type TEXT DEFAULT 'info',
    p_task_details JSONB DEFAULT '{}',
    p_status TEXT DEFAULT 'completed'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO rfp.sync_tasks (
        job_id, 
        project_id, 
        task_type, 
        task_details, 
        status,
        completed_at
    )
    VALUES (
        p_job_id, 
        p_project_id, 
        p_task_type, 
        p_task_details, 
        p_status,
        CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_sync_task(UUID, UUID, TEXT, JSONB, TEXT) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- List job logs (for Live Logs display)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

CREATE OR REPLACE FUNCTION public.list_job_logs(
    p_job_id UUID,
    p_limit INT DEFAULT 200
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    RETURN (
        SELECT json_agg(row_to_json(t)) FROM (
            SELECT 
                st.id,
                st.job_id,
                st.project_id,
                p.pr_number as project_name,
                st.task_details->>'message' as folder_path,
                st.task_type as action,
                st.status,
                st.task_details as details,
                st.created_at
            FROM rfp.sync_tasks st
            LEFT JOIN rfp.projects p ON st.project_id = p.id
            WHERE st.job_id = p_job_id
            ORDER BY st.created_at DESC
            LIMIT p_limit
        ) t
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_job_logs(UUID, INT) TO anon, authenticated, service_role;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- List project folders (for enforce permissions)
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

DROP FUNCTION IF EXISTS public.list_project_folders(UUID);

CREATE OR REPLACE FUNCTION public.list_project_folders(
    p_project_id UUID
)
RETURNS SETOF rfp.folder_index
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM rfp.folder_index
    WHERE project_id = p_project_id
    ORDER BY template_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_project_folders(UUID) TO anon, authenticated, service_role;



-- ========== 030_fix_job_logs_details.sql ==========

-- Fix list_job_logs to extract nested details properly
-- The details are stored as task_details->'details' but UI expects flat structure

CREATE OR REPLACE FUNCTION public.list_job_logs(
    p_job_id UUID,
    p_limit INT DEFAULT 200
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    RETURN (
        SELECT json_agg(row_to_json(t)) FROM (
            SELECT 
                st.id,
                st.job_id,
                st.project_id,
                p.pr_number as project_name,
                st.task_details->>'message' as folder_path,
                st.task_type as action,
                COALESCE(st.task_details->>'log_status', st.status) as status,
                -- Extract the nested 'details' object directly for the UI
                st.task_details->'details' as details,
                st.created_at
            FROM rfp.sync_tasks st
            LEFT JOIN rfp.projects p ON st.project_id = p.id
            WHERE st.job_id = p_job_id
            ORDER BY st.created_at DESC
            LIMIT p_limit
        ) t
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_job_logs(UUID, INT) TO anon, authenticated, service_role;



-- ========== 031_get_bidding_folders_rpc.sql ==========

-- Create RPC to get bidding folders for cleanup
CREATE OR REPLACE FUNCTION public.get_bidding_folders()
RETURNS TABLE (
    id UUID,
    project_id UUID,
    drive_folder_id TEXT,
    template_path TEXT,
    physical_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fi.id,
        fi.project_id,
        fi.drive_folder_id,
        fi.template_path,
        fi.physical_path
    FROM rfp.folder_index fi
    WHERE fi.template_path ILIKE '%Bidding%'
      AND fi.drive_folder_id IS NOT NULL;
END;
$$;



-- ========== 032_folder_templates.sql ==========

-- Migration: Create folder_templates table and RPCs
-- This enables storing and versioning folder structure templates

-- Table: folder_templates
CREATE TABLE IF NOT EXISTS rfp.folder_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number INTEGER NOT NULL,
    template_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT,
    is_active BOOLEAN DEFAULT true,
    notes TEXT
);

-- Index for quick active template lookup
CREATE INDEX IF NOT EXISTS idx_folder_templates_active 
ON rfp.folder_templates (is_active, created_at DESC) 
WHERE is_active = true;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.save_template(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.get_active_template();
DROP FUNCTION IF EXISTS public.get_template_by_version(INTEGER);

-- RPC: save_template
-- Saves a new template version and deactivates old ones
CREATE OR REPLACE FUNCTION public.save_template(
    p_template_json JSONB,
    p_created_by TEXT DEFAULT 'admin'
) RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
BEGIN
    -- Deactivate all old templates
    UPDATE rfp.folder_templates SET is_active = false WHERE is_active = true;
    
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO v_version
    FROM rfp.folder_templates;
    
    -- Insert new template
    INSERT INTO rfp.folder_templates (
        version_number, 
        template_json, 
        created_by, 
        is_active
    )
    VALUES (
        v_version, 
        p_template_json, 
        p_created_by, 
        true
    );
    
    RETURN v_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_active_template
-- Returns the currently active template
CREATE OR REPLACE FUNCTION public.get_active_template()
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    template_json JSONB,
    created_at TIMESTAMPTZ,
    created_by TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id, 
        ft.version_number, 
        ft.template_json, 
        ft.created_at,
        ft.created_by
    FROM rfp.folder_templates ft
    WHERE ft.is_active = true
    ORDER BY ft.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_template_by_version
-- Returns a specific template version
CREATE OR REPLACE FUNCTION public.get_template_by_version(p_version INTEGER)
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    template_json JSONB,
    created_at TIMESTAMPTZ,
    created_by TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ft.id, 
        ft.version_number, 
        ft.template_json, 
        ft.created_at,
        ft.created_by,
        ft.is_active
    FROM rfp.folder_templates ft
    WHERE ft.version_number = p_version
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON rfp.folder_templates TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_template(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_template() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_template_by_version(INTEGER) TO anon, authenticated;



-- ========== 033_rebuild_folder_index.sql ==========

-- Migration 033: Rebuild folder_index table
-- Purpose: Add expected vs actual permission tracking for reset-based enforcement
-- Author: Permission System Refactor
-- Date: 2026-02-06

-- Step 1: Drop existing table (will be rebuilt from Drive via backfill RPC)
DROP TABLE IF EXISTS rfp.folder_index CASCADE;

-- Step 2: Create new folder_index with enhanced permission tracking
CREATE TABLE rfp.folder_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core mapping
    project_id UUID NOT NULL REFERENCES rfp.projects(id) ON DELETE CASCADE,
    drive_folder_id TEXT NOT NULL UNIQUE,
    template_path TEXT NOT NULL,
    
    -- Expected state (from template - source of truth)
    expected_limited_access BOOLEAN NOT NULL DEFAULT false,
    expected_groups JSONB DEFAULT '[]'::jsonb,
    expected_users JSONB DEFAULT '[]'::jsonb,
    
    -- Actual state (from Drive API - corrected to match expected)
    actual_limited_access BOOLEAN,
    last_verified_at TIMESTAMPTZ,
    
    -- Compliance tracking (computed)
    is_compliant BOOLEAN GENERATED ALWAYS AS (
        actual_limited_access IS NOT NULL AND 
        actual_limited_access = expected_limited_access
    ) STORED,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_folder_index_project 
    ON rfp.folder_index(project_id);

CREATE INDEX idx_folder_index_drive_folder 
    ON rfp.folder_index(drive_folder_id);

CREATE INDEX idx_folder_index_template_path 
    ON rfp.folder_index(template_path);

CREATE INDEX idx_folder_index_noncompliant 
    ON rfp.folder_index(is_compliant) 
    WHERE is_compliant = false;

CREATE INDEX idx_folder_index_unverified 
    ON rfp.folder_index(last_verified_at NULLS FIRST);

-- Step 4: Create trigger to update updated_at
CREATE OR REPLACE FUNCTION rfp.update_folder_index_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_folder_index_updated_at
    BEFORE UPDATE ON rfp.folder_index
    FOR EACH ROW
    EXECUTE FUNCTION rfp.update_folder_index_updated_at();

-- Step 5: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON rfp.folder_index TO authenticated;
GRANT SELECT ON rfp.folder_index TO anon;

-- Comments for documentation
COMMENT ON TABLE rfp.folder_index IS 'Maps Drive folders to template paths with expected vs actual permission state tracking';
COMMENT ON COLUMN rfp.folder_index.expected_limited_access IS 'From template - whether Limited Access should be enabled';
COMMENT ON COLUMN rfp.folder_index.actual_limited_access IS 'From Drive API - whether inheritedPermissionsDisabled is actually true';
COMMENT ON COLUMN rfp.folder_index.is_compliant IS 'Computed: true when actual matches expected Limited Access state';



-- ========== 034_create_permission_audit.sql ==========

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



-- ========== 035_create_reset_jobs.sql ==========

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



-- ========== 036_backfill_folder_index_rpc.sql ==========

-- Migration 036: Backfill folder_index from Drive
-- Purpose: RPC to rebuild folder_index mapping from Drive + template after schema rebuild
-- Author: Permission System Refactor
-- Date: 2026-02-06

-- Drop existing if any
DROP FUNCTION IF EXISTS public.backfill_folder_index_from_drive(UUID);

-- RPC: Backfill folder_index for a project
-- This will be called from application layer after Drive folders are created
CREATE OR REPLACE FUNCTION public.backfill_folder_index_from_drive(
    p_project_id UUID
) RETURNS TABLE (
    folders_added INTEGER,
    folders_updated INTEGER,
    errors TEXT[]
) AS $$
DECLARE
    v_folders_added INTEGER := 0;
    v_folders_updated INTEGER := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- This is a placeholder RPC
    -- Actual backfill logic will be implemented in application layer (jobs.ts)
    -- because it requires Drive API calls which cannot be done in SQL
    
    -- This RPC exists for:
    -- 1. Documentation of backfill requirement
    -- 2. Future enhancement if Drive API integration moves to database layer
    
    RAISE NOTICE 'Backfill must be triggered from application layer (POST /api/sync)';
    
    RETURN QUERY SELECT 
        v_folders_added,
        v_folders_updated,
        v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.backfill_folder_index_from_drive(UUID) TO authenticated;

-- Helper RPC: Get folder sync status for a project
CREATE OR REPLACE FUNCTION public.get_folder_sync_status(p_project_id UUID)
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    total_folders INTEGER,
    folders_with_expected_config INTEGER,
    folders_with_actual_state INTEGER,
    compliant_folders INTEGER,
    noncompliant_folders INTEGER,
    unverified_folders INTEGER,
    last_sync_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as project_id,
        p.name as project_name,
        COUNT(fi.id)::INTEGER as total_folders,
        COUNT(fi.id) FILTER (WHERE fi.expected_limited_access IS NOT NULL)::INTEGER as folders_with_expected_config,
        COUNT(fi.id) FILTER (WHERE fi.actual_limited_access IS NOT NULL)::INTEGER as folders_with_actual_state,
        COUNT(fi.id) FILTER (WHERE fi.is_compliant = true)::INTEGER as compliant_folders,
        COUNT(fi.id) FILTER (WHERE fi.is_compliant = false)::INTEGER as noncompliant_folders,
        COUNT(fi.id) FILTER (WHERE fi.last_verified_at IS NULL)::INTEGER as unverified_folders,
        MAX(fi.last_verified_at) as last_sync_at
    FROM rfp.projects p
    LEFT JOIN rfp.folder_index fi ON fi.project_id = p.id
    WHERE p.id = p_project_id
    GROUP BY p.id, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_folder_sync_status(UUID) TO authenticated, anon;

-- Helper RPC: Get noncompliant folders for a project (for reset prioritization)
CREATE OR REPLACE FUNCTION public.get_noncompliant_folders(p_project_id UUID)
RETURNS TABLE (
    folder_id UUID,
    drive_folder_id TEXT,
    template_path TEXT,
    expected_limited_access BOOLEAN,
    actual_limited_access BOOLEAN,
    last_verified_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fi.id as folder_id,
        fi.drive_folder_id,
        fi.template_path,
        fi.expected_limited_access,
        fi.actual_limited_access,
        fi.last_verified_at
    FROM rfp.folder_index fi
    WHERE fi.project_id = p_project_id
      AND fi.is_compliant = false
    ORDER BY fi.template_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_noncompliant_folders(UUID) TO authenticated;

-- Comments
COMMENT ON FUNCTION public.backfill_folder_index_from_drive(UUID) IS 'Placeholder for backfill - actual implementation in application layer via POST /api/sync';
COMMENT ON FUNCTION public.get_folder_sync_status(UUID) IS 'Returns folder compliance statistics for a project';
COMMENT ON FUNCTION public.get_noncompliant_folders(UUID) IS 'Returns list of folders where actual Limited Access state does not match expected';



-- ========== 037_fix_upsert_folder_index_rpc.sql ==========

-- Migration 037: Update upsert_folder_index RPC for new schema
-- Purpose: Fix sync to work with rebuilt folder_index table from migration 033
-- Author: Permission System Refactor
-- Date: 2026-02-06

-- Drop old RPC
DROP FUNCTION IF EXISTS public.upsert_folder_index(UUID, TEXT, TEXT, TEXT, TEXT);

-- Create new RPC compatible with new folder_index schema
CREATE OR REPLACE FUNCTION public.upsert_folder_index(
    p_project_id UUID,
    p_template_path TEXT,
    p_drive_folder_id TEXT,
    p_expected_limited_access BOOLEAN DEFAULT false,
    p_expected_groups JSONB DEFAULT '[]'::jsonb,
    p_expected_users JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Insert or update folder_index with new schema
    INSERT INTO rfp.folder_index (
        project_id, 
        drive_folder_id, 
        template_path,
        expected_limited_access,
        expected_groups,
        expected_users,
        actual_limited_access,
        last_verified_at
    )
    VALUES (
        p_project_id, 
        p_drive_folder_id, 
        p_template_path,
        p_expected_limited_access,
        p_expected_groups,
        p_expected_users,
        NULL, -- Will be populated by reset tool
        NOW()
    )
    ON CONFLICT (drive_folder_id) 
    DO UPDATE SET 
        template_path = p_template_path,
        expected_limited_access = p_expected_limited_access,
        expected_groups = p_expected_groups,
        expected_users = p_expected_users,
        last_verified_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.upsert_folder_index(UUID, TEXT, TEXT, BOOLEAN, JSONB, JSONB) TO anon, authenticated, service_role;

-- Comments
COMMENT ON FUNCTION public.upsert_folder_index IS 'Upserts folder to folder_index with expected permissions from template';



