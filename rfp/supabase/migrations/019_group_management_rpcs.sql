-- ═══════════════════════════════════════════════════════════════════════════
-- GROUP MANAGEMENT RPCs
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
