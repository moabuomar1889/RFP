# Prisma Code-First Migration Guide

## 🎯 GOAL: Complete migration from Supabase SQL to Prisma code-first

---

## Step 1: Drop Existing Schema (MANUAL - via Supabase SQL Editor)

```sql
-- BACKUP template data first if not already done!
-- Then run this in Supabase SQL Editor:

DROP SCHEMA IF EXISTS rfp CASCADE;
DROP SCHEMA IF EXISTS rfp_shadow CASCADE;

-- Recreate empty schemas
CREATE SCHEMA IF NOT EXISTS rfp;
CREATE SCHEMA IF NOT EXISTS rfp_shadow;
```

---

## Step 2: Push Prisma Schema to Database

```bash
# From rfp directory
npx prisma db push --accept-data-loss
```

This will create all tables, enums, and indexes defined in `prisma/schema.prisma`.

---

## Step 3: Verify Schema Created

```bash
npx prisma studio
```

Open Prisma Studio and verify all tables exist:
- folder_templates
- projects  
- folder_index
- permission_audit
- reset_jobs
- reset_job_folders

---

## Step 4: Import Template Data (Seed Script)

```bash
npm run seed
```

This will:
1. Import the backed-up template JSON
2. Create initial folder_templates record
3. Set version_number = 1, is_active = true

---

## Step 5: Code Refactor Status

### ✅ COMPLETED:
- [x] Prisma Client singleton (`src/lib/prisma.ts`)
- [x] Schema defined in `prisma/schema.prisma`
- [x] Enums for type safety (ResetJobStatus, PermissionAction, PermissionResult, PrincipalType)

### 🔄 IN PROGRESS:
- [ ] Replace all `supabaseAdmin.from()` calls with `prisma.{model}.{operation}`
- [ ] Replace all `.rpc()` calls with Prisma queries or raw SQL wrapped in helpers
- [ ] Update reset API to use Prisma Client
- [ ] Update job workers to use Prisma Client

### ⏳ NOT STARTED:
- [ ] Seed script implementation
- [ ] Verification endpoint (`/api/admin/verify-folder`)
- [ ] Acceptance testing

---

## Code Migration Pattern

### BEFORE (Supabase):
```typescript
const { data, error } = await supabaseAdmin
    .from('folder_index')
    .select('*')
    .eq('project_id', projectId);
```

### AFTER (Prisma):
```typescript
const folders = await prisma.folderIndex.findMany({
    where: { project_id: projectId }
});
```

---

## Files That Need Refactoring

| File | Supabase Calls | Priority |
|------|---------------|----------|
| `src/app/api/permissions/reset/route.ts` | ~5 | HIGH |
| `src/server/jobs.ts` | ~30 | HIGH |
| `src/server/google-drive.ts` | ~5 | MEDIUM |
| `src/app/api/*/route.ts` (various) | ~20 | MEDIUM |

---

## Testing Strategy

1. **Unit**: Test Prisma queries in isolation
2. **Integration**: Test API endpoints with Prisma
3. **Manual**: Run reset on test project (5-10 folders)
4. **Acceptance**: Verify all 7 ACs pass

---

## Rollback Plan

If migration fails:
1. Stop application
2. Restore from Supabase SQL migrations (001-037)
3. Re-import template via Supabase UI
4. Restart application with old code

---

## Next Steps (in order)

1. ✅ User runs `DROP SCHEMA` SQL in Supabase
2. ✅ User runs `npx prisma db push`  
3. ⏳ Complete seed script
4. ⏳ Refactor data access layer (5-10 files)
5. ⏳ Test on local dev environment
6. ⏳ Deploy to production
