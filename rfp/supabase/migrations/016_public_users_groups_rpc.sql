-- ═══════════════════════════════════════════════════════════════════════════
-- PUBLIC WRAPPER FOR GET USERS WITH GROUPS
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
