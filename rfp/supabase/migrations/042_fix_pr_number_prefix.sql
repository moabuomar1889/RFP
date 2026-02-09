-- Fix get_next_pr_number to use PRJ- prefix instead of PR-
-- This fixes the bug where new projects were created with PR-022 instead of PRJ-022

CREATE OR REPLACE FUNCTION rfp.get_next_pr_number()
RETURNS TEXT AS $$
DECLARE
    max_num INTEGER;
    next_num TEXT;
BEGIN
    SELECT GREATEST(
        COALESCE(MAX(
            CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER)
        ), 0),
        COALESCE(MAX(
            CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER)
        ), 0)
    ) INTO max_num
    FROM rfp.projects
    UNION ALL
    SELECT COALESCE(MAX(
        CAST(NULLIF(regexp_replace(pr_number, '[^0-9]', '', 'g'), '') AS INTEGER)
    ), 0)
    FROM rfp.project_requests
    WHERE status IN ('pending', 'approved');

    next_num := 'PRJ-' || LPAD((max_num + 1)::TEXT, 3, '0');
    RETURN next_num;
END;
$$ LANGUAGE plpgsql;
