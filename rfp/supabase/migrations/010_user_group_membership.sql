-- ═══════════════════════════════════════════════════════════════════════════
-- USER GROUP MEMBERSHIP - Track which groups users belong to
-- Run this in Supabase SQL Editor
-- ALL OBJECTS IN RFP SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- USER GROUP MEMBERSHIP TABLE
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC FUNCTIONS (ALL IN RFP SCHEMA)
-- ─────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────
-- GRANT PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION rfp.get_user_groups(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.add_user_to_group(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.remove_user_from_group(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION rfp.get_users_with_groups() TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
