---
description: Fix Supabase PGRST106 "Invalid schema rfp" error - schema exposure and permissions
---

# Fix Supabase Schema Exposure & Permission (PGRST106)

> **When to use**: API returns `PGRST106` (Schema not exposed) or `PGRST205` (Table not found) when querying the `rfp` schema.

## Problem
- Custom schema `rfp` is exposed in Supabase Dashboard but API returns PGRST106
- API defaults to `public` or `realtime` schemas instead of `rfp`

## Root Causes
1. **Case Sensitivity**: Dashboard UI forces schema name to uppercase (`RFP`), but DB uses lowercase (`rfp`)
2. **Configuration Conflict**: Manual overrides on `authenticator` role's `pgrst.db_schemas` prevent Dashboard from updating PostgREST config
3. **Search Path**: `rfp` schema missing from default `search_path` for `anon` and `authenticated` roles

## Solution

### Step 1: Run this SQL in Supabase SQL Editor

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

### Step 2: Verify in Dashboard
- Go to **Settings > API > Exposed schemas** and confirm `rfp` (lowercase) is listed

### Step 3: Test
```typescript
const { data, error } = await supabase
  .schema('rfp')
  .from('projects')
  .select('*');
```

## Prevention
- **NEVER** manually set `pgrst.db_schemas` on the `authenticator` role — it overrides Dashboard settings
- Always use **lowercase** schema names
- If this error returns after a Supabase upgrade, re-run Step 1
