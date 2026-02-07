-- ═══════════════════════════════════════════════════════════════════════════
-- RESTORE MISSING TABLES (SAFE VERSION)
-- Only creates tables that DON'T already exist from Prisma
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. USER TOKENS (required for login)
CREATE TABLE IF NOT EXISTS rfp.user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. APP SETTINGS
CREATE TABLE IF NOT EXISTS rfp.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rfp.app_settings (key, value) VALUES 
  ('protected_principals', '["mo.abuomar@dtgsa.com", "admins@dtgsa.com"]'),
  ('strict_mode_enabled', 'true'),
  ('daily_enforcement_enabled', 'false'),
  ('daily_enforcement_time', '"02:00"')
ON CONFLICT (key) DO NOTHING;

-- 3. TEMPLATE VERSIONS
CREATE TABLE IF NOT EXISTS rfp.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL UNIQUE,
  template_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false
);

-- 4. TEMPLATE CHANGES
CREATE TABLE IF NOT EXISTS rfp.template_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_version INTEGER REFERENCES rfp.template_versions(version_number),
  to_version INTEGER NOT NULL REFERENCES rfp.template_versions(version_number),
  change_type TEXT NOT NULL,
  affected_path TEXT NOT NULL,
  change_details JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PERMISSION ROLES
CREATE TABLE IF NOT EXISTS rfp.permission_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  drive_role TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO rfp.permission_roles (name, description, drive_role, is_system) VALUES
  ('ADMIN', 'Full administrative access', 'organizer', true),
  ('PROJECT_MANAGER', 'Project manager access', 'fileOrganizer', false),
  ('QUANTITY_SURVEYOR', 'Quantity surveyor access', 'writer', false),
  ('TECHNICAL_TEAM', 'Technical team access', 'writer', false),
  ('EXECUTION_TEAM', 'Execution team access', 'writer', false),
  ('VIEWER', 'Read-only access', 'reader', false)
ON CONFLICT (name) DO NOTHING;

-- 6. ROLE PRINCIPALS
CREATE TABLE IF NOT EXISTS rfp.role_principals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES rfp.permission_roles(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL,
  principal_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, principal_email)
);

-- 7. EXPECTED PERMISSIONS
CREATE TABLE IF NOT EXISTS rfp.expected_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_path TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES rfp.permission_roles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_path, role_id)
);

-- 8. SYNC JOBS
CREATE TABLE IF NOT EXISTS rfp.sync_jobs (
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

-- 9. SYNC TASKS
CREATE TABLE IF NOT EXISTS rfp.sync_tasks (
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

-- 10. PERMISSION VIOLATIONS
CREATE TABLE IF NOT EXISTS rfp.permission_violations (
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

-- 11. RECONCILIATION LOG
CREATE TABLE IF NOT EXISTS rfp.reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_index_id UUID REFERENCES rfp.folder_index(id),
  project_id UUID REFERENCES rfp.projects(id),
  issue_type TEXT NOT NULL,
  expected_path TEXT,
  expected_name TEXT,
  actual_path TEXT,
  actual_name TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. AUDIT LOG
CREATE TABLE IF NOT EXISTS rfp.audit_log (
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

-- 13. Add missing columns to projects (Prisma may have created it without these)
DO $$ BEGIN
  ALTER TABLE rfp.projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'bidding';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE rfp.projects ADD COLUMN IF NOT EXISTS rfp_folder_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE rfp.projects ADD COLUMN IF NOT EXISTS pd_folder_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE rfp.projects ADD COLUMN IF NOT EXISTS synced_version INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE rfp.projects ADD COLUMN IF NOT EXISTS last_enforced_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 14. Add missing columns to folder_index (Prisma may have created it differently)
DO $$ BEGIN
  ALTER TABLE rfp.folder_index ADD COLUMN IF NOT EXISTS drive_folder_name TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE rfp.folder_index ADD COLUMN IF NOT EXISTS limited_access_enabled BOOLEAN DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE rfp.folder_index ADD COLUMN IF NOT EXISTS permissions_hash TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 15. Helper functions
CREATE OR REPLACE FUNCTION rfp.get_next_template_version()
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(version_number), 0) + 1 FROM rfp.template_versions;
$$ LANGUAGE SQL;

-- VERIFY
SELECT table_name FROM information_schema.tables WHERE table_schema = 'rfp' ORDER BY table_name;
