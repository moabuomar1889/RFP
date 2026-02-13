-- RFP SCHEMA INTROSPECTION REPORT (Postgres / Supabase)
-- Change schema here if needed:
DO $$
DECLARE
  target_schema text := 'rfp';
BEGIN
  RAISE NOTICE 'Introspecting schema: %', target_schema;
END $$;


--Result 
-- [Success. No rows returned]


==========================================================


-- 1) Tables & Views
SELECT
  n.nspname                            AS schema_name,
  c.relname                            AS object_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned_table'
    WHEN 'v' THEN 'view'
    WHEN 'm' THEN 'materialized_view'
    WHEN 'f' THEN 'foreign_table'
    ELSE c.relkind::text
  END                                   AS object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'rfp'
  AND c.relkind IN ('r','p','v','m','f')
ORDER BY object_type, object_name;


--Result 
-- [
  {
    "schema_name": "rfp",
    "object_name": "app_settings",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "audit_log",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "expected_permissions",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "folder_index",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "folder_templates",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "group_directory",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "permission_audit",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "permission_roles",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "permission_violations",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "project_requests",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "projects",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "reconciliation_log",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "reset_jobs",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "role_principals",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "sync_jobs",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "sync_tasks",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "system_settings",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "template_changes",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "template_versions",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "user_directory",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "user_group_membership",
    "object_type": "table"
  },
  {
    "schema_name": "rfp",
    "object_name": "user_tokens",
    "object_type": "table"
  }
]


==========================================================

-- 2) Columns (with types, nullability, defaults, identity, comments)
SELECT
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.is_identity,
  c.identity_generation,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  pgd.description AS column_comment
FROM information_schema.columns c
LEFT JOIN pg_catalog.pg_statio_all_tables st
  ON st.schemaname = c.table_schema AND st.relname = c.table_name
LEFT JOIN pg_catalog.pg_description pgd
  ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
WHERE c.table_schema = 'rfp'
ORDER BY c.table_name, c.ordinal_position;
--Result 
-- [
  {
    "table_schema": "rfp",
    "table_name": "app_settings",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "app_settings",
    "ordinal_position": 2,
    "column_name": "key",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "app_settings",
    "ordinal_position": 3,
    "column_name": "value",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "app_settings",
    "ordinal_position": 4,
    "column_name": "updated_by",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "app_settings",
    "ordinal_position": 5,
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 2,
    "column_name": "action",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 3,
    "column_name": "entity_type",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 4,
    "column_name": "entity_id",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 5,
    "column_name": "old_value",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 6,
    "column_name": "new_value",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 7,
    "column_name": "details",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 8,
    "column_name": "performed_by",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 9,
    "column_name": "ip_address",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "ordinal_position": 10,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "expected_permissions",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "expected_permissions",
    "ordinal_position": 2,
    "column_name": "template_path",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "expected_permissions",
    "ordinal_position": 3,
    "column_name": "role_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "expected_permissions",
    "ordinal_position": 4,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 2,
    "column_name": "project_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 3,
    "column_name": "drive_folder_id",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 4,
    "column_name": "template_path",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 5,
    "column_name": "expected_limited_access",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "NO",
    "column_default": "false",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": "From template - whether Limited Access should be enabled"
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 6,
    "column_name": "expected_groups",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": "'[]'::jsonb",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 7,
    "column_name": "expected_users",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": "'[]'::jsonb",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 8,
    "column_name": "actual_limited_access",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": "From Drive API - whether inheritedPermissionsDisabled is actually true"
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 9,
    "column_name": "last_verified_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 10,
    "column_name": "is_compliant",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": "Computed: true when actual matches expected Limited Access state"
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 11,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 12,
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "ordinal_position": 13,
    "column_name": "normalized_template_path",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_templates",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_templates",
    "ordinal_position": 2,
    "column_name": "version_number",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": 32,
    "numeric_scale": 0,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_templates",
    "ordinal_position": 3,
    "column_name": "template_json",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_templates",
    "ordinal_position": 4,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_templates",
    "ordinal_position": 5,
    "column_name": "created_by",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_templates",
    "ordinal_position": 6,
    "column_name": "is_active",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": "true",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_templates",
    "ordinal_position": 7,
    "column_name": "notes",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 2,
    "column_name": "google_id",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 3,
    "column_name": "email",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 4,
    "column_name": "name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 5,
    "column_name": "description",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 6,
    "column_name": "member_count",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "YES",
    "column_default": "0",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": 32,
    "numeric_scale": 0,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 7,
    "column_name": "mapped_role",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 8,
    "column_name": "synced_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "ordinal_position": 9,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 2,
    "column_name": "folder_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 3,
    "column_name": "job_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 4,
    "column_name": "action",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": "Type of action: add, remove, enable_limited_access, disable_limited_access, skip_inherited"
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 5,
    "column_name": "principal_type",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 6,
    "column_name": "principal_email",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 7,
    "column_name": "principal_role",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 8,
    "column_name": "permission_id",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 9,
    "column_name": "is_inherited",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": "false",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": "True if this permission is inherited from parent folder and cannot be deleted"
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 10,
    "column_name": "inherited_from",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": "Drive folder ID where inherited permission originates (for troubleshooting)"
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 11,
    "column_name": "before_state",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 12,
    "column_name": "after_state",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 13,
    "column_name": "result",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 14,
    "column_name": "error_message",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "ordinal_position": 15,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_roles",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_roles",
    "ordinal_position": 2,
    "column_name": "name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_roles",
    "ordinal_position": 3,
    "column_name": "description",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_roles",
    "ordinal_position": 4,
    "column_name": "drive_role",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_roles",
    "ordinal_position": 5,
    "column_name": "is_system",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": "false",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_roles",
    "ordinal_position": 6,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 2,
    "column_name": "folder_index_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 3,
    "column_name": "project_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 4,
    "column_name": "violation_type",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 5,
    "column_name": "expected",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 6,
    "column_name": "actual",
    "data_type": "jsonb",
    "udt_name": "jsonb",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 7,
    "column_name": "auto_reverted",
    "data_type": "boolean",
    "udt_name": "bool",
    "is_nullable": "YES",
    "column_default": "false",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 8,
    "column_name": "detected_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 9,
    "column_name": "resolved_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "ordinal_position": 10,
    "column_name": "resolved_by",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 2,
    "column_name": "request_type",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 3,
    "column_name": "project_name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 4,
    "column_name": "pr_number",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 5,
    "column_name": "project_id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 6,
    "column_name": "status",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": "'pending'::text",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 7,
    "column_name": "requested_by",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 8,
    "column_name": "requested_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 9,
    "column_name": "reviewed_by",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 10,
    "column_name": "reviewed_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 11,
    "column_name": "rejection_reason",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "ordinal_position": 12,
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": "now()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 1,
    "column_name": "id",
    "data_type": "uuid",
    "udt_name": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 2,
    "column_name": "pr_number",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 3,
    "column_name": "name",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 4,
    "column_name": "status",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": "'bidding'::text",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 5,
    "column_name": "drive_folder_id",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "NO",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 6,
    "column_name": "rfp_folder_id",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 7,
    "column_name": "pd_folder_id",
    "data_type": "text",
    "udt_name": "text",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 8,
    "column_name": "synced_version",
    "data_type": "integer",
    "udt_name": "int4",
    "is_nullable": "YES",
    "column_default": "0",
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": 32,
    "numeric_scale": 0,
    "column_comment": null
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "ordinal_position": 9,
    "column_name": "last_synced_at",
    "data_type": "timestamp with time zone",
    "udt_name": "timestamptz",
    "is_nullable": "YES",
    "column_default": null,
    "is_identity": "NO",
    "identity_generation": null,
    "character_maximum_length": null,
    "numeric_precision": null,
    "numeric_scale": null,
    "column_comment": null
  }
]


==========================================================


-- 3) Primary Keys
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
 AND tc.table_name = kcu.table_name
WHERE tc.table_schema = 'rfp'
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name, kcu.ordinal_position;
--Result 
-- [
  {
    "table_schema": "rfp",
    "table_name": "app_settings",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "audit_log",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "expected_permissions",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_templates",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_roles",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "reconciliation_log",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "reset_jobs",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "role_principals",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "sync_jobs",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "sync_tasks",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "system_settings",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "template_changes",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "template_versions",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "user_directory",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "user_group_membership",
    "column_name": "id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "user_tokens",
    "column_name": "id",
    "ordinal_position": 1
  }
]


==========================================================


-- 4) Foreign Keys (relationships)
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS referenced_schema,
  ccu.table_name   AS referenced_table,
  ccu.column_name  AS referenced_column,
  rc.update_rule,
  rc.delete_rule,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
 AND rc.constraint_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'rfp'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name, referenced_table, referenced_column;
--Result 
-- [
  {
    "table_schema": "rfp",
    "table_name": "expected_permissions",
    "column_name": "role_id",
    "referenced_schema": "rfp",
    "referenced_table": "permission_roles",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "NO ACTION",
    "constraint_name": "expected_permissions_role_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "column_name": "project_id",
    "referenced_schema": "rfp",
    "referenced_table": "projects",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "CASCADE",
    "constraint_name": "folder_index_project_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_audit",
    "column_name": "folder_id",
    "referenced_schema": "rfp",
    "referenced_table": "folder_index",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "CASCADE",
    "constraint_name": "permission_audit_folder_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_violations",
    "column_name": "project_id",
    "referenced_schema": "rfp",
    "referenced_table": "projects",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "NO ACTION",
    "constraint_name": "permission_violations_project_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "project_requests",
    "column_name": "project_id",
    "referenced_schema": "rfp",
    "referenced_table": "projects",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "CASCADE",
    "constraint_name": "project_requests_project_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "reconciliation_log",
    "column_name": "project_id",
    "referenced_schema": "rfp",
    "referenced_table": "projects",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "NO ACTION",
    "constraint_name": "reconciliation_log_project_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "reset_jobs",
    "column_name": "project_id",
    "referenced_schema": "rfp",
    "referenced_table": "projects",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "CASCADE",
    "constraint_name": "reset_jobs_project_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "role_principals",
    "column_name": "role_id",
    "referenced_schema": "rfp",
    "referenced_table": "permission_roles",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "CASCADE",
    "constraint_name": "role_principals_role_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "sync_tasks",
    "column_name": "job_id",
    "referenced_schema": "rfp",
    "referenced_table": "sync_jobs",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "CASCADE",
    "constraint_name": "sync_tasks_job_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "sync_tasks",
    "column_name": "project_id",
    "referenced_schema": "rfp",
    "referenced_table": "projects",
    "referenced_column": "id",
    "update_rule": "NO ACTION",
    "delete_rule": "CASCADE",
    "constraint_name": "sync_tasks_project_id_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "template_changes",
    "column_name": "from_version",
    "referenced_schema": "rfp",
    "referenced_table": "template_versions",
    "referenced_column": "version_number",
    "update_rule": "NO ACTION",
    "delete_rule": "NO ACTION",
    "constraint_name": "template_changes_from_version_fkey"
  },
  {
    "table_schema": "rfp",
    "table_name": "template_changes",
    "column_name": "to_version",
    "referenced_schema": "rfp",
    "referenced_table": "template_versions",
    "referenced_column": "version_number",
    "update_rule": "NO ACTION",
    "delete_rule": "NO ACTION",
    "constraint_name": "template_changes_to_version_fkey"
  }
]


==========================================================


-- 5) Unique Constraints
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'rfp'
  AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
--Result 
-- [
  {
    "table_schema": "rfp",
    "table_name": "app_settings",
    "constraint_name": "app_settings_key_key",
    "column_name": "key",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "expected_permissions",
    "constraint_name": "expected_permissions_template_path_role_id_key",
    "column_name": "template_path",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "expected_permissions",
    "constraint_name": "expected_permissions_template_path_role_id_key",
    "column_name": "role_id",
    "ordinal_position": 2
  },
  {
    "table_schema": "rfp",
    "table_name": "folder_index",
    "constraint_name": "folder_index_drive_folder_id_key",
    "column_name": "drive_folder_id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "constraint_name": "group_directory_email_key",
    "column_name": "email",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "group_directory",
    "constraint_name": "group_directory_google_id_key",
    "column_name": "google_id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "permission_roles",
    "constraint_name": "permission_roles_name_key",
    "column_name": "name",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "projects",
    "constraint_name": "projects_pr_number_key",
    "column_name": "pr_number",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "role_principals",
    "constraint_name": "role_principals_role_id_principal_email_key",
    "column_name": "role_id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "role_principals",
    "constraint_name": "role_principals_role_id_principal_email_key",
    "column_name": "principal_email",
    "ordinal_position": 2
  },
  {
    "table_schema": "rfp",
    "table_name": "system_settings",
    "constraint_name": "system_settings_setting_key_key",
    "column_name": "setting_key",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "template_versions",
    "constraint_name": "template_versions_version_number_key",
    "column_name": "version_number",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "user_directory",
    "constraint_name": "user_directory_email_key",
    "column_name": "email",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "user_directory",
    "constraint_name": "user_directory_google_id_key",
    "column_name": "google_id",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "user_group_membership",
    "constraint_name": "user_group_membership_user_email_group_email_key",
    "column_name": "user_email",
    "ordinal_position": 1
  },
  {
    "table_schema": "rfp",
    "table_name": "user_group_membership",
    "constraint_name": "user_group_membership_user_email_group_email_key",
    "column_name": "group_email",
    "ordinal_position": 2
  },
  {
    "table_schema": "rfp",
    "table_name": "user_tokens",
    "constraint_name": "user_tokens_email_key",
    "column_name": "email",
    "ordinal_position": 1
  }
]

==========================================================


-- 6) Check Constraints (expressions)
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class t ON t.oid = con.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'rfp'
  AND con.contype = 'c'
ORDER BY table_name, constraint_name;
--Result 
-- [
  {
    "schema_name": "rfp",
    "table_name": "project_requests",
    "constraint_name": "project_requests_request_type_check",
    "constraint_definition": "CHECK ((request_type = ANY (ARRAY['new_project'::text, 'upgrade_to_pd'::text])))"
  },
  {
    "schema_name": "rfp",
    "table_name": "project_requests",
    "constraint_name": "project_requests_status_check",
    "constraint_definition": "CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))"
  },
  {
    "schema_name": "rfp",
    "table_name": "projects",
    "constraint_name": "projects_phase_check",
    "constraint_definition": "CHECK ((phase = ANY (ARRAY['bidding'::text, 'execution'::text])))"
  },
  {
    "schema_name": "rfp",
    "table_name": "reset_jobs",
    "constraint_name": "valid_counts",
    "constraint_definition": "CHECK (((successful_folders + failed_folders) <= processed_folders))"
  },
  {
    "schema_name": "rfp",
    "table_name": "reset_jobs",
    "constraint_name": "valid_progress",
    "constraint_definition": "CHECK ((processed_folders <= total_folders))"
  },
  {
    "schema_name": "rfp",
    "table_name": "reset_jobs",
    "constraint_name": "valid_status",
    "constraint_definition": "CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))"
  }
]


==========================================================


-- 7) Indexes (including unique, method, columns)
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  i.relname AS index_name,
  ix.indisunique AS is_unique,
  ix.indisprimary AS is_primary,
  am.amname AS index_method,
  pg_get_indexdef(ix.indexrelid) AS index_def
FROM pg_index ix
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_am am ON am.oid = i.relam
WHERE n.nspname = 'rfp'
ORDER BY table_name, index_name;
--Result 
-- [
  {
    "schema_name": "rfp",
    "table_name": "app_settings",
    "index_name": "app_settings_key_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX app_settings_key_key ON rfp.app_settings USING btree (key)"
  },
  {
    "schema_name": "rfp",
    "table_name": "app_settings",
    "index_name": "app_settings_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX app_settings_pkey ON rfp.app_settings USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "audit_log",
    "index_name": "audit_log_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX audit_log_pkey ON rfp.audit_log USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "audit_log",
    "index_name": "idx_audit_log_action",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_audit_log_action ON rfp.audit_log USING btree (action)"
  },
  {
    "schema_name": "rfp",
    "table_name": "audit_log",
    "index_name": "idx_audit_log_entity",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_audit_log_entity ON rfp.audit_log USING btree (entity_type, entity_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "audit_log",
    "index_name": "idx_audit_log_time",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_audit_log_time ON rfp.audit_log USING btree (created_at DESC)"
  },
  {
    "schema_name": "rfp",
    "table_name": "expected_permissions",
    "index_name": "expected_permissions_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX expected_permissions_pkey ON rfp.expected_permissions USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "expected_permissions",
    "index_name": "expected_permissions_template_path_role_id_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX expected_permissions_template_path_role_id_key ON rfp.expected_permissions USING btree (template_path, role_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "expected_permissions",
    "index_name": "idx_expected_permissions_path",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_expected_permissions_path ON rfp.expected_permissions USING btree (template_path)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_index",
    "index_name": "folder_index_drive_folder_id_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX folder_index_drive_folder_id_key ON rfp.folder_index USING btree (drive_folder_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_index",
    "index_name": "folder_index_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX folder_index_pkey ON rfp.folder_index USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_index",
    "index_name": "idx_folder_index_drive_folder",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_folder_index_drive_folder ON rfp.folder_index USING btree (drive_folder_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_index",
    "index_name": "idx_folder_index_noncompliant",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_folder_index_noncompliant ON rfp.folder_index USING btree (is_compliant) WHERE (is_compliant = false)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_index",
    "index_name": "idx_folder_index_project",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_folder_index_project ON rfp.folder_index USING btree (project_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_index",
    "index_name": "idx_folder_index_template_path",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_folder_index_template_path ON rfp.folder_index USING btree (template_path)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_index",
    "index_name": "idx_folder_index_unverified",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_folder_index_unverified ON rfp.folder_index USING btree (last_verified_at NULLS FIRST)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_templates",
    "index_name": "folder_templates_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX folder_templates_pkey ON rfp.folder_templates USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_templates",
    "index_name": "idx_folder_templates_active",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_folder_templates_active ON rfp.folder_templates USING btree (is_active, created_at DESC) WHERE (is_active = true)"
  },
  {
    "schema_name": "rfp",
    "table_name": "group_directory",
    "index_name": "group_directory_email_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX group_directory_email_key ON rfp.group_directory USING btree (email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "group_directory",
    "index_name": "group_directory_google_id_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX group_directory_google_id_key ON rfp.group_directory USING btree (google_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "group_directory",
    "index_name": "group_directory_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX group_directory_pkey ON rfp.group_directory USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "group_directory",
    "index_name": "idx_group_directory_email",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_group_directory_email ON rfp.group_directory USING btree (email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_audit",
    "index_name": "idx_permission_audit_action",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_permission_audit_action ON rfp.permission_audit USING btree (action)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_audit",
    "index_name": "idx_permission_audit_created",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_permission_audit_created ON rfp.permission_audit USING btree (created_at DESC)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_audit",
    "index_name": "idx_permission_audit_folder",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_permission_audit_folder ON rfp.permission_audit USING btree (folder_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_audit",
    "index_name": "idx_permission_audit_inherited",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_permission_audit_inherited ON rfp.permission_audit USING btree (is_inherited) WHERE (is_inherited = true)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_audit",
    "index_name": "idx_permission_audit_job",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_permission_audit_job ON rfp.permission_audit USING btree (job_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_audit",
    "index_name": "idx_permission_audit_result",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_permission_audit_result ON rfp.permission_audit USING btree (result) WHERE (result = 'failed'::text)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_audit",
    "index_name": "permission_audit_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX permission_audit_pkey ON rfp.permission_audit USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_roles",
    "index_name": "permission_roles_name_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX permission_roles_name_key ON rfp.permission_roles USING btree (name)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_roles",
    "index_name": "permission_roles_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX permission_roles_pkey ON rfp.permission_roles USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_violations",
    "index_name": "idx_permission_violations_detected",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_permission_violations_detected ON rfp.permission_violations USING btree (detected_at DESC)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_violations",
    "index_name": "idx_permission_violations_project",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_permission_violations_project ON rfp.permission_violations USING btree (project_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_violations",
    "index_name": "permission_violations_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX permission_violations_pkey ON rfp.permission_violations USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "project_requests",
    "index_name": "idx_project_requests_requested_by",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_project_requests_requested_by ON rfp.project_requests USING btree (requested_by)"
  },
  {
    "schema_name": "rfp",
    "table_name": "project_requests",
    "index_name": "idx_project_requests_status",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_project_requests_status ON rfp.project_requests USING btree (status)"
  },
  {
    "schema_name": "rfp",
    "table_name": "project_requests",
    "index_name": "project_requests_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX project_requests_pkey ON rfp.project_requests USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "projects",
    "index_name": "idx_projects_pr",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_projects_pr ON rfp.projects USING btree (pr_number)"
  },
  {
    "schema_name": "rfp",
    "table_name": "projects",
    "index_name": "idx_projects_status",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_projects_status ON rfp.projects USING btree (status)"
  },
  {
    "schema_name": "rfp",
    "table_name": "projects",
    "index_name": "projects_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX projects_pkey ON rfp.projects USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "projects",
    "index_name": "projects_pr_number_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX projects_pr_number_key ON rfp.projects USING btree (pr_number)"
  },
  {
    "schema_name": "rfp",
    "table_name": "reconciliation_log",
    "index_name": "idx_reconciliation_project",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_reconciliation_project ON rfp.reconciliation_log USING btree (project_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "reconciliation_log",
    "index_name": "reconciliation_log_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX reconciliation_log_pkey ON rfp.reconciliation_log USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "reset_jobs",
    "index_name": "idx_reset_jobs_created",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_reset_jobs_created ON rfp.reset_jobs USING btree (created_at DESC)"
  },
  {
    "schema_name": "rfp",
    "table_name": "reset_jobs",
    "index_name": "idx_reset_jobs_project",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_reset_jobs_project ON rfp.reset_jobs USING btree (project_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "reset_jobs",
    "index_name": "idx_reset_jobs_status",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_reset_jobs_status ON rfp.reset_jobs USING btree (status)"
  },
  {
    "schema_name": "rfp",
    "table_name": "reset_jobs",
    "index_name": "reset_jobs_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX reset_jobs_pkey ON rfp.reset_jobs USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "role_principals",
    "index_name": "idx_role_principals_email",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_role_principals_email ON rfp.role_principals USING btree (principal_email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "role_principals",
    "index_name": "idx_role_principals_role",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_role_principals_role ON rfp.role_principals USING btree (role_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "role_principals",
    "index_name": "role_principals_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX role_principals_pkey ON rfp.role_principals USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "role_principals",
    "index_name": "role_principals_role_id_principal_email_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX role_principals_role_id_principal_email_key ON rfp.role_principals USING btree (role_id, principal_email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "sync_jobs",
    "index_name": "idx_sync_jobs_status",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_sync_jobs_status ON rfp.sync_jobs USING btree (status)"
  },
  {
    "schema_name": "rfp",
    "table_name": "sync_jobs",
    "index_name": "idx_sync_jobs_type",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_sync_jobs_type ON rfp.sync_jobs USING btree (job_type)"
  },
  {
    "schema_name": "rfp",
    "table_name": "sync_jobs",
    "index_name": "sync_jobs_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX sync_jobs_pkey ON rfp.sync_jobs USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "sync_tasks",
    "index_name": "idx_sync_tasks_job",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_sync_tasks_job ON rfp.sync_tasks USING btree (job_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "sync_tasks",
    "index_name": "idx_sync_tasks_status",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_sync_tasks_status ON rfp.sync_tasks USING btree (status)"
  },
  {
    "schema_name": "rfp",
    "table_name": "sync_tasks",
    "index_name": "sync_tasks_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX sync_tasks_pkey ON rfp.sync_tasks USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "system_settings",
    "index_name": "system_settings_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX system_settings_pkey ON rfp.system_settings USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "system_settings",
    "index_name": "system_settings_setting_key_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX system_settings_setting_key_key ON rfp.system_settings USING btree (setting_key)"
  },
  {
    "schema_name": "rfp",
    "table_name": "template_changes",
    "index_name": "idx_template_changes_version",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_template_changes_version ON rfp.template_changes USING btree (to_version)"
  },
  {
    "schema_name": "rfp",
    "table_name": "template_changes",
    "index_name": "template_changes_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX template_changes_pkey ON rfp.template_changes USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "template_versions",
    "index_name": "template_versions_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX template_versions_pkey ON rfp.template_versions USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "template_versions",
    "index_name": "template_versions_version_number_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX template_versions_version_number_key ON rfp.template_versions USING btree (version_number)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_directory",
    "index_name": "idx_user_directory_email",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_user_directory_email ON rfp.user_directory USING btree (email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_directory",
    "index_name": "idx_user_directory_status",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_user_directory_status ON rfp.user_directory USING btree (status)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_directory",
    "index_name": "user_directory_email_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX user_directory_email_key ON rfp.user_directory USING btree (email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_directory",
    "index_name": "user_directory_google_id_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX user_directory_google_id_key ON rfp.user_directory USING btree (google_id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_directory",
    "index_name": "user_directory_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX user_directory_pkey ON rfp.user_directory USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_group_membership",
    "index_name": "idx_user_group_member_group",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_user_group_member_group ON rfp.user_group_membership USING btree (group_email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_group_membership",
    "index_name": "idx_user_group_member_user",
    "is_unique": false,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE INDEX idx_user_group_member_user ON rfp.user_group_membership USING btree (user_email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_group_membership",
    "index_name": "user_group_membership_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX user_group_membership_pkey ON rfp.user_group_membership USING btree (id)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_group_membership",
    "index_name": "user_group_membership_user_email_group_email_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX user_group_membership_user_email_group_email_key ON rfp.user_group_membership USING btree (user_email, group_email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_tokens",
    "index_name": "user_tokens_email_key",
    "is_unique": true,
    "is_primary": false,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX user_tokens_email_key ON rfp.user_tokens USING btree (email)"
  },
  {
    "schema_name": "rfp",
    "table_name": "user_tokens",
    "index_name": "user_tokens_pkey",
    "is_unique": true,
    "is_primary": true,
    "index_method": "btree",
    "index_def": "CREATE UNIQUE INDEX user_tokens_pkey ON rfp.user_tokens USING btree (id)"
  }
]


==========================================================


-- 8) RLS status per table (important في Supabase)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'rfp'
  AND c.relkind IN ('r','p')
ORDER BY table_name;
--Result 
-- [
  {
    "schema_name": "rfp",
    "table_name": "app_settings",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "audit_log",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "expected_permissions",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_index",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "folder_templates",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "group_directory",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_audit",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_roles",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "permission_violations",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "project_requests",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "projects",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "reconciliation_log",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "reset_jobs",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "role_principals",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "sync_jobs",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "sync_tasks",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "system_settings",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "template_changes",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "template_versions",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "user_directory",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "user_group_membership",
    "rls_enabled": false,
    "rls_forced": false
  },
  {
    "schema_name": "rfp",
    "table_name": "user_tokens",
    "rls_enabled": false,
    "rls_forced": false
  }
]


==========================================================

-- All tables and their columns in rfp schema
SELECT 
    t.table_name,
    json_agg(
        json_build_object(
            'column', c.column_name,
            'type', c.data_type,
            'udt', c.udt_name,
            'nullable', c.is_nullable,
            'default', c.column_default
        ) ORDER BY c.ordinal_position
    ) as columns
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema = 'rfp' AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;

--Result 
-- [
  {
    "table_name": "app_settings",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "key",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "value",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "updated_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "updated_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "audit_log",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "action",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "entity_type",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "entity_id",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "old_value",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "new_value",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "details",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "performed_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "ip_address",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "expected_permissions",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "template_path",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "role_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "folder_index",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "project_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "drive_folder_id",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "template_path",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "expected_limited_access",
        "type": "boolean",
        "udt": "bool",
        "nullable": "NO",
        "default": "false"
      },
      {
        "column": "expected_groups",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": "'[]'::jsonb"
      },
      {
        "column": "expected_users",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": "'[]'::jsonb"
      },
      {
        "column": "actual_limited_access",
        "type": "boolean",
        "udt": "bool",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "last_verified_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "is_compliant",
        "type": "boolean",
        "udt": "bool",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "updated_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "normalized_template_path",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      }
    ]
  },
  {
    "table_name": "folder_templates",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "version_number",
        "type": "integer",
        "udt": "int4",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "template_json",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "created_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "is_active",
        "type": "boolean",
        "udt": "bool",
        "nullable": "YES",
        "default": "true"
      },
      {
        "column": "notes",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      }
    ]
  },
  {
    "table_name": "group_directory",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "google_id",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "email",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "name",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "description",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "member_count",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "mapped_role",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "synced_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "permission_audit",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "folder_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "job_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "action",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "principal_type",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "principal_email",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "principal_role",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "permission_id",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "is_inherited",
        "type": "boolean",
        "udt": "bool",
        "nullable": "YES",
        "default": "false"
      },
      {
        "column": "inherited_from",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "before_state",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "after_state",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "result",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "error_message",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "permission_roles",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "name",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "description",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "drive_role",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "is_system",
        "type": "boolean",
        "udt": "bool",
        "nullable": "YES",
        "default": "false"
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "permission_violations",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "folder_index_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "project_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "violation_type",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "expected",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "actual",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "auto_reverted",
        "type": "boolean",
        "udt": "bool",
        "nullable": "YES",
        "default": "false"
      },
      {
        "column": "detected_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "resolved_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "resolved_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      }
    ]
  },
  {
    "table_name": "project_requests",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "request_type",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "project_name",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "pr_number",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "project_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "status",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": "'pending'::text"
      },
      {
        "column": "requested_by",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "requested_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "reviewed_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "reviewed_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "rejection_reason",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "projects",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "pr_number",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "name",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "status",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": "'bidding'::text"
      },
      {
        "column": "drive_folder_id",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "rfp_folder_id",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "pd_folder_id",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "synced_version",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "last_synced_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "last_enforced_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "phase",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": "'bidding'::text"
      }
    ]
  },
  {
    "table_name": "reconciliation_log",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "folder_index_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "project_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "issue_type",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "expected_path",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "expected_name",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "actual_path",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "actual_name",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "resolution",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "resolved_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "detected_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "reset_jobs",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "project_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "folder_ids",
        "type": "ARRAY",
        "udt": "_uuid",
        "nullable": "YES",
        "default": "ARRAY[]::uuid[]"
      },
      {
        "column": "total_folders",
        "type": "integer",
        "udt": "int4",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "processed_folders",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "successful_folders",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "failed_folders",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "status",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": "'pending'::text"
      },
      {
        "column": "started_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "completed_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "created_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      }
    ]
  },
  {
    "table_name": "role_principals",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "role_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "principal_type",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "principal_email",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "sync_jobs",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "job_type",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "target_version",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "status",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": "'pending'::text"
      },
      {
        "column": "priority",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "5"
      },
      {
        "column": "total_tasks",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "completed_tasks",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "failed_tasks",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "progress_percent",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "started_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "started_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "completed_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "error_summary",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "metadata",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "sync_tasks",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "job_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "project_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "folder_index_id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "task_type",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "task_details",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "status",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": "'pending'::text"
      },
      {
        "column": "attempts",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "0"
      },
      {
        "column": "max_attempts",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": "3"
      },
      {
        "column": "last_error",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "started_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "completed_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      }
    ]
  },
  {
    "table_name": "system_settings",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "setting_key",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "setting_value",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "NO",
        "default": "'{}'::jsonb"
      },
      {
        "column": "description",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "updated_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "updated_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": "'system'::text"
      }
    ]
  },
  {
    "table_name": "template_changes",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "from_version",
        "type": "integer",
        "udt": "int4",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "to_version",
        "type": "integer",
        "udt": "int4",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "change_type",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "affected_path",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "change_details",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "template_versions",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "version_number",
        "type": "integer",
        "udt": "int4",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "template_json",
        "type": "jsonb",
        "udt": "jsonb",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "created_by",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "is_active",
        "type": "boolean",
        "udt": "bool",
        "nullable": "YES",
        "default": "false"
      }
    ]
  },
  {
    "table_name": "user_directory",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "google_id",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "email",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "name",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "given_name",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "family_name",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "photo_url",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "department",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "role",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": "'User'::text"
      },
      {
        "column": "status",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": "'Active'::text"
      },
      {
        "column": "last_login",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "synced_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  },
  {
    "table_name": "user_group_membership",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "user_email",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "group_email",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "added_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "added_by",
        "type": "text",
        "udt": "text",
        "nullable": "YES",
        "default": null
      }
    ]
  },
  {
    "table_name": "user_tokens",
    "columns": [
      {
        "column": "id",
        "type": "uuid",
        "udt": "uuid",
        "nullable": "NO",
        "default": "gen_random_uuid()"
      },
      {
        "column": "email",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "access_token_encrypted",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "refresh_token_encrypted",
        "type": "text",
        "udt": "text",
        "nullable": "NO",
        "default": null
      },
      {
        "column": "token_expiry",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": null
      },
      {
        "column": "created_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      },
      {
        "column": "updated_at",
        "type": "timestamp with time zone",
        "udt": "timestamptz",
        "nullable": "YES",
        "default": "now()"
      }
    ]
  }
]


==========================================================
