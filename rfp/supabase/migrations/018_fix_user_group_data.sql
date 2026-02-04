-- ═══════════════════════════════════════════════════════════════════════════
-- DATA FIX: Populate user_group_membership from group_members table
-- Run this in Supabase SQL Editor to fix the Groups column immediately
-- ═══════════════════════════════════════════════════════════════════════════

-- First, let's see what's in group_members
SELECT 'group_members data:' as info;
SELECT gm.member_email, g.email as group_email, g.name as group_name
FROM rfp.group_members gm
JOIN rfp.group_directory g ON gm.group_id = g.id
LIMIT 20;

-- Copy group_members data into user_group_membership
INSERT INTO rfp.user_group_membership (user_email, group_email, added_by, added_at)
SELECT 
    LOWER(gm.member_email) as user_email,
    LOWER(g.email) as group_email,
    'data_fix' as added_by,
    NOW() as added_at
FROM rfp.group_members gm
JOIN rfp.group_directory g ON gm.group_id = g.id
ON CONFLICT (user_email, group_email) DO NOTHING;

-- Verify the fix
SELECT 'user_group_membership after fix:' as info;
SELECT COUNT(*) as total_memberships FROM rfp.user_group_membership;

-- Show sample data
SELECT * FROM rfp.user_group_membership LIMIT 10;
