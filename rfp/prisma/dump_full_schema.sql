-- ═══════════════════════════════════════════════════════════════
-- FULL RFP SCHEMA DUMP
-- Run this in Supabase SQL Editor and copy the JSON results
-- ═══════════════════════════════════════════════════════════════

-- QUERY 1: All tables and their columns
SELECT 
    t.table_name,
    json_agg(
        json_build_object(
            'column', c.column_name,
            'type', c.data_type,
            'udt', c.udt_name,
            'nullable', c.is_nullable,
            'default', c.column_default,
            'max_length', c.character_maximum_length
        ) ORDER BY c.ordinal_position
    ) as columns
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema = 'rfp' AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
