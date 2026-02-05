-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETE USER & GROUP MANAGEMENT RPCs
-- Run this ENTIRE script in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════
-- END - Run this entire script in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
