-- ═══════════════════════════════════════════════════════════════════════════
-- RFP Schema - User and Group Directory Tables + RPC Functions
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- USER DIRECTORY (Cached from Google Workspace)
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
CREATE INDEX IF NOT EXISTS idx_user_directory_status ON rfp.user_directory(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP DIRECTORY (Cached from Google Workspace)
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
-- RPC FUNCTIONS (in public schema, access rfp tables)
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────
-- GRANT PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.upsert_user_directory(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_group_directory(TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_users() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_groups() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_by_id(UUID) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
