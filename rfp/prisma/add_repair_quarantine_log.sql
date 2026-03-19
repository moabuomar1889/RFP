-- Migration: Batch Folder Repair — quarantine log table + RPC
-- Date: 2026-03-19

CREATE TABLE IF NOT EXISTS rfp.repair_quarantine_log (
    id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id                UUID REFERENCES rfp.projects(id) ON DELETE SET NULL,
    project_code              TEXT,
    folder_id                 TEXT NOT NULL,
    folder_name               TEXT,
    old_parent_id             TEXT,
    new_parent_id             TEXT,
    confidence                TEXT CHECK (confidence IN ('HIGH', 'AMBIGUOUS')),
    reason                    TEXT,
    matched_correct_folder_id TEXT,
    matched_correct_path      TEXT,
    quarantined_at            TIMESTAMPTZ DEFAULT NOW(),
    quarantined_by            TEXT,
    recovered_at              TIMESTAMPTZ,
    notes                     TEXT
);

CREATE INDEX IF NOT EXISTS idx_repair_quarantine_project
    ON rfp.repair_quarantine_log(project_id);

CREATE INDEX IF NOT EXISTS idx_repair_quarantine_folder
    ON rfp.repair_quarantine_log(folder_id);

-- RPC: list quarantine log entries for one or all projects
DROP FUNCTION IF EXISTS public.get_repair_quarantine_log(UUID);
CREATE OR REPLACE FUNCTION public.get_repair_quarantine_log(
    p_project_id UUID DEFAULT NULL
)
RETURNS SETOF rfp.repair_quarantine_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, rfp
AS $$
BEGIN
    IF p_project_id IS NULL THEN
        RETURN QUERY SELECT * FROM rfp.repair_quarantine_log ORDER BY quarantined_at DESC;
    ELSE
        RETURN QUERY SELECT * FROM rfp.repair_quarantine_log
            WHERE project_id = p_project_id
            ORDER BY quarantined_at DESC;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_repair_quarantine_log(UUID) TO service_role;

COMMENT ON TABLE rfp.repair_quarantine_log IS
'Audit log for every folder quarantined by the batch folder-repair workflow. Never deleted.';
