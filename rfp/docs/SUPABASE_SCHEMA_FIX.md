# Supabase Schema Exposure & Permission Fix (PGRST106)
> **Last Applied**: 2026-02-13
> **Affects**: All `.schema('rfp')` calls in the codebase

## Problem
Custom schema `rfp` exposed in Supabase Dashboard but API returns:
- `PGRST106`: Invalid schema: rfp
- `PGRST205`: Table not found

## Root Causes
1. **Case Sensitivity**: Dashboard forces uppercase (`RFP`), DB uses lowercase (`rfp`)
2. **Config Conflict**: Manual `ALTER ROLE authenticator SET pgrst.db_schemas` overrides Dashboard
3. **Missing Search Path**: `rfp` not in `search_path` for `anon`/`authenticated` roles

## Fix SQL (run in Supabase SQL Editor)
```sql
-- A. Reset PostgREST config to sync with Dashboard
ALTER ROLE authenticator RESET pgrst.db_schemas;
NOTIFY pgrst, 'reload config';

-- B. Grant full access (CRUD) to the rfp schema
GRANT ALL PRIVILEGES ON SCHEMA rfp TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA rfp TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA rfp TO anon, authenticated, service_role;

-- C. Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA rfp 
GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated, service_role;

-- D. Update Search Path for automatic discovery
ALTER ROLE authenticator SET search_path TO rfp, public;
ALTER ROLE anon SET search_path TO rfp, public;
```

## Prevention Rules
- ❌ **NEVER** manually set `pgrst.db_schemas` on `authenticator` role
- ✅ Always use **lowercase** schema names
- 🔄 Re-run this script after any Supabase upgrade/migration that resets roles
