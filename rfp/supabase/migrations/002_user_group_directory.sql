-- ═══════════════════════════════════════════════════════════════════════════
-- RFP Schema - Migration: Add User and Group Directory Tables
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- USER DIRECTORY (Cached users from Google Workspace)
-- ─────────────────────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_user_directory_department ON rfp.user_directory(department);

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP DIRECTORY (Cached groups from Google Workspace)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP MEMBERS (User-Group relationships)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfp.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES rfp.group_directory(id) ON DELETE CASCADE,
  user_id UUID REFERENCES rfp.user_directory(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_type TEXT DEFAULT 'USER', -- USER, GROUP, EXTERNAL
  role TEXT DEFAULT 'MEMBER', -- OWNER, MANAGER, MEMBER
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON rfp.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON rfp.group_members(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISSION DIRECTORY (Alternative to permission_roles for simpler queries)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfp.permission_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT UNIQUE NOT NULL,
  description TEXT,
  drive_role TEXT NOT NULL,
  principals JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing roles to permission_directory
INSERT INTO rfp.permission_directory (role_name, description, drive_role, is_system, principals)
SELECT name, description, drive_role, is_system, '[]'::jsonb
FROM rfp.permission_roles
ON CONFLICT (role_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
