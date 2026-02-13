# PROJECT CONTRACT — RFP System

> **Status:** FROZEN — Governance Lock Active
> **Derived from:** Forensic Code Audit (February 2026)
> **Scope:** Single Source of Truth for this repository

---

## 1. PURPOSE

This system manages Google Drive folder structures and permissions for construction projects (RFP — Request for Proposal). It is responsible for:

- Maintaining a versioned permission template that defines folder hierarchy, group/user access, and Limited Access flags
- Creating project folder structures in a Google Shared Drive from the active template
- Enforcing template-defined permissions on project folders via a reset-then-apply strategy
- Maintaining a database index (`folder_index`) that maps template paths to Google Drive folder IDs
- Detecting drift between the database index and actual Google Drive state
- Providing a single-admin dashboard for managing projects, templates, jobs, users, groups, and roles
- Auditing all permission changes with detailed job logs

---

## 2. NON-GOALS

This system does **NOT**:

- Provide multi-user authentication or RBAC (single admin only)
- Manage file contents inside Drive folders (folders only, no files)
- Provide real-time permission monitoring (enforcement is manual-trigger only)
- Handle billing, scheduling, or project management workflows
- Implement automated rollback of failed permission enforcement
- Serve as a general-purpose Drive permission manager (scoped to the `rfp` schema and one Shared Drive)
- Implement structural template sync to Drive folders (`syncProjectWithTemplate` is a stub function — per forensic report §1.10, §3.3)

---

## 3. SYSTEM ARCHITECTURE

### High-Level Flow

1. Admin logs in via Google OAuth → session cookie set (`rfp_session`)
2. Admin edits permission template in tree editor → saved to `rfp.template_versions`
3. Admin creates project → Inngest job `project/create` → Drive folders created from template
4. Admin triggers "Enforce Permissions" → Inngest job `permissions/enforce` → per-project reset-then-apply via Google Drive API
5. Admin triggers "Build Folder Index" → Inngest job `folder-index/build` → scans Drive recursively, upserts to `rfp.folder_index`
6. Admin triggers "Reconcile Index" → Inngest job `folder-index/reconcile` → detects renamed/moved/deleted/orphaned folders

### Actual Modules and Responsibilities

- **Next.js App Router** (`src/app/`): 23 API routes, 12 dashboard pages, login page
- **Server Layer** (`src/server/`): 4 files — `jobs.ts` (all Inngest handlers), `google-drive.ts` (Drive API), `google-admin.ts` (Admin SDK), `audit-helpers.ts` (normalization)
- **Lib Layer** (`src/lib/`): `config.ts`, `supabase.ts`, `crypto.ts`, `prisma.ts`, `inngest.ts`, `template-engine/` (pure-function inheritance engine)
- **Database**: Supabase PostgreSQL, `rfp` schema, 14+ tables, 38 migration files
- **Background Jobs**: Inngest Cloud, 7 registered functions, all in `jobs.ts`

---

## 4. SOURCE OF TRUTH RULES

### What Is Authoritative

| Domain | Source of Truth | Location |
|--------|----------------|----------|
| Permission template | `rfp.template_versions` table (`template_json` column, `is_active = true`) | Supabase DB |
| Folder-to-Drive mapping | `rfp.folder_index` table | Supabase DB |
| Actual folder permissions | Google Drive API (live query via `listPermissions`) | Google Drive |
| Protected principals | `rfp.app_settings` WHERE `key = 'protected_principals'` | Supabase DB |
| Project registry | `rfp.projects` table | Supabase DB |
| Job/task status | `rfp.sync_jobs` + `rfp.sync_task_logs` tables | Supabase DB |
| OAuth tokens | `rfp.user_tokens` table (AES-256 encrypted) | Supabase DB |
| App configuration | `src/lib/config.ts` + `.env` file | Filesystem |
| Role definitions | `CANONICAL_RANK` in `src/lib/template-engine/types.ts` | Filesystem |

### Conflict Resolution Rules

1. **Template vs Drive**: The database template (`template_versions.template_json`) is authoritative. Enforcement overwrites Drive to match template.
2. **folder_index vs Drive**: Drive is ground truth for folder existence. `buildFolderIndex` syncs DB to match Drive. `reconcileFolderIndex` detects drift.
3. **Protected principals**: `app_settings` table is authoritative for the enforcement handler. However, `hardResetPermissions` in `google-drive.ts` has a hardcoded fallback array — this is a **known divergence** (forensic §3.2 #5, §4 Q3).
4. **Role definitions**: `CANONICAL_RANK` in `types.ts` is authoritative. `ROLE_RANK` (same file), `DRIVE_ROLES` (config.ts), and `normalizeRole` (audit-helpers.ts) are legacy/bridge code — this is a **known divergence** (forensic §4 Q6).

### Drift Prevention Rules

- Folder index must be rebuilt (`buildFolderIndex`) before running enforcement if structural changes have occurred in Drive
- Enforcement must be triggered manually; there is no automated schedule (forensic §4 Q4)
- `reconcileFolderIndex` detects drift but does not auto-fix — flags only

---

## 5. MODULE RESPONSIBILITY MATRIX

| Module | Source Files | Responsibilities | Interfaces | Source of Truth | Protected | Approval Required |
|--------|-------------|------------------|------------|-----------------|-----------|-------------------|
| **Job Orchestrator** | `src/server/jobs.ts` | All 7 Inngest job handlers, all job helpers, job logging, progress tracking | Inngest events, Supabase RPCs, Drive API | `sync_jobs` table | Y | Y — any change affects all jobs |
| **Drive API Wrapper** | `src/server/google-drive.ts` | Folder CRUD, permission CRUD, Limited Access, hard reset, shortcut creation | Google Drive API v3 | Google Drive (live) | Y | Y |
| **Admin SDK Wrapper** | `src/server/google-admin.ts` | User/group listing, sync to DB, group membership management | Google Admin Directory API | Google Admin | N | N |
| **Audit Helpers** | `src/server/audit-helpers.ts` | Template normalization, permission mapping, effective policy computation | Imported by jobs.ts + API routes | `template_versions` | Y | Y — shared by audit + enforcement |
| **Template Engine** | `src/lib/template-engine/` | Deserialization, inheritance computation, override validation, serialization | Pure functions, no I/O | `template_versions` | Y | Y — defines policy semantics |
| **Auth** | `src/app/api/auth/` (4 routes) | Google OAuth login, token storage, session cookie, logout | Cookie (`rfp_session`), Supabase RPCs | `user_tokens` table | Y | Y |
| **Config** | `src/lib/config.ts` | Env var loading, constant definitions (roles, statuses, job types) | Imported by all server modules | `.env` file | Y | Y |
| **Supabase Client** | `src/lib/supabase.ts` | Lazy client initialization (anon + service role), proxy object | Imported by all server modules | `.env` file | Y | Y |
| **Crypto** | `src/lib/crypto.ts` | AES-256 encrypt/decrypt, SHA-256 hashing | Imported by auth + Drive | `TOKEN_ENCRYPTION_KEY` | Y | Y |
| **Inngest Client** | `src/lib/inngest.ts` | Inngest client instance, event type definitions | Inngest SDK | `.env` file | Y | Y |
| **Prisma Client** | `src/lib/prisma.ts` | Prisma ORM singleton | Prisma SDK | `DIRECT_URL` env var | N | N |
| **Dashboard UI** | `src/app/(dashboard)/` | 12 page views, sidebar, layout | React components, API fetch | N/A | N | N |
| **API Routes** | `src/app/api/` (19 non-auth) | REST endpoints for projects, jobs, templates, users, groups, etc. | HTTP, Supabase RPCs | Various tables | N | N |
| **DB Migrations** | `supabase/migrations/` | 38 SQL migration files, schema definition | SQL, Supabase CLI | Migration files | Y | Y |

### Architectural Risk Flags (Overlapping Responsibilities)

| Overlap | Modules | Risk |
|---------|---------|------|
| Protected principals | `google-drive.ts` (hardcoded) + `app_settings` table | Two sources; can diverge |
| Role normalization | `template-engine/types.ts` (`toCanonicalRole`) + `audit-helpers.ts` (`normalizeRole`) | Same mapping, separate implementations |
| Google config | `config.ts` (`GOOGLE_CONFIG`) + `auth/login/route.ts` + `auth/callback/route.ts` (inline) | Config defined in 3 places |
| DB access | `supabase.ts` (RPC) + `prisma.ts` (ORM) | Two patterns used in same module (`jobs.ts`) |

### ⚠️ RECURRING ISSUE: Supabase PGRST106 "Invalid schema: rfp"

> **This issue has occurred multiple times.** If API calls to `.schema('rfp')` fail with PGRST106, run this SQL in the Supabase SQL Editor:

```sql
-- A. Reset PostgREST config (Dashboard overrides get blocked by manual config)
ALTER ROLE authenticator RESET pgrst.db_schemas;
NOTIFY pgrst, 'reload config';

-- B. Grant full access to rfp schema
GRANT ALL PRIVILEGES ON SCHEMA rfp TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA rfp TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA rfp TO anon, authenticated, service_role;

-- C. Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA rfp 
GRANT ALL PRIVILEGES ON TABLES TO anon, authenticated, service_role;

-- D. Update search path
ALTER ROLE authenticator SET search_path TO rfp, public;
ALTER ROLE anon SET search_path TO rfp, public;
```

**Root Causes:** (1) Dashboard forces uppercase `RFP`, DB uses lowercase `rfp`. (2) Manual `ALTER ROLE authenticator SET pgrst.db_schemas` overrides Dashboard config. (3) Missing search_path for `anon`/`authenticated` roles.

**Prevention:** NEVER manually set `pgrst.db_schemas` on the `authenticator` role. See `docs/SUPABASE_SCHEMA_FIX.md` for full details.

---

## 6. FOLDER & NAMING CONVENTIONS

### Repository Structure (Must Not Change)

```
rfp/
├── src/
│   ├── app/           # Next.js App Router (pages + API)
│   │   ├── (dashboard)/  # Authenticated dashboard pages
│   │   ├── api/          # API route handlers
│   │   └── login/        # Login page
│   ├── server/        # Server-only modules (NOT importable by client)
│   ├── lib/           # Shared libraries (importable by both)
│   │   └── template-engine/  # Pure-function template engine
│   └── components/    # React components
│       └── ui/        # shadcn/ui primitives
├── supabase/
│   └── migrations/    # Numbered SQL migrations (NNN_description.sql)
├── prisma/            # Prisma schema + migrations
├── scripts/           # Operational scripts
└── docs/              # Governance documentation (this folder)
```

### Naming Conventions

| Convention | Pattern | Example |
|------------|---------|---------|
| Migration files | `NNN_description.sql` | `001_initial_schema.sql` |
| API routes | `src/app/api/{resource}/route.ts` | `src/app/api/projects/route.ts` |
| Dashboard pages | `src/app/(dashboard)/{feature}/page.tsx` | `src/app/(dashboard)/jobs/page.tsx` |
| Server modules | `src/server/{service}.ts` | `src/server/google-drive.ts` |
| Lib modules | `src/lib/{name}.ts` | `src/lib/config.ts` |
| Inngest function IDs | kebab-case | `sync-template-all` |
| Inngest event names | `{domain}/{action}` | `permissions/enforce` |
| DB tables | `rfp.{snake_case}` | `rfp.folder_index` |
| DB RPCs | `{verb}_{noun}` | `get_active_template` |

---

## 7. CHANGE POLICY

### Allowed Without Approval

- UI-only changes in `src/app/(dashboard)/` that do not alter data flow
- Adding new dashboard pages
- CSS/styling changes in `src/app/globals.css`
- Adding new shadcn/ui components to `src/components/ui/`
- Documentation changes in `docs/`

### Requires Explicit Approval

- Any change to `src/server/jobs.ts` (protected — all jobs affected)
- Any change to `src/server/google-drive.ts` (protected — all Drive operations affected)
- Any change to `src/server/audit-helpers.ts` (protected — shared by audit + enforcement)
- Any change to `src/lib/template-engine/` (protected — defines policy semantics)
- Any change to `src/lib/config.ts` (protected — affects all modules)
- Any change to `src/lib/supabase.ts` or `src/lib/crypto.ts` (protected)
- Any change to `src/app/api/auth/` routes (protected — auth flow)
- Any new database migration in `supabase/migrations/`
- Any change to `.env` or `.env.example`
- Any change to `prisma/schema.prisma`
- Any change to `src/lib/inngest.ts` (event type definitions)

### Forbidden Changes

- Deleting or renaming any file in `src/server/`
- Deleting or renaming any file in `src/lib/`
- Modifying migration files that have already been applied (append-only)
- Removing entries from the `PROTECTED_PRINCIPALS` array in `google-drive.ts`
- Removing entries from `app_settings` WHERE `key = 'protected_principals'`
- Disabling Inngest retries or concurrency limits
- Removing the `rfp` schema namespace from database queries

---

## 8. WORKFLOW CONTRACT (HOW AI MUST OPERATE)

Any AI agent working on this repository MUST follow this workflow:

1. **ANALYZE** — Read the forensic audit, this contract, and relevant source files before proposing changes
2. **PLAN** — Create an implementation plan documenting: files affected, functions modified, expected behavior change, risk assessment
3. **MINIMAL DIFF** — Propose the smallest possible change that achieves the goal. No refactors, no cleanups, no "while we're here" improvements
4. **EXPLICIT APPROVAL** — Present the plan to the human operator. Do NOT proceed without explicit approval. For protected modules, highlight the protection status
5. **APPLY** — Make the approved changes. One logical change per commit
6. **VERIFY** — Run build verification (`npm run build`). If tests exist, run them. Confirm no regressions
7. **UPDATE DOCS** — If the change affects any item documented in this contract or the forensic audit, update the relevant documentation

### Behavioral Rules

- Do NOT modify production files during analysis or planning
- Do NOT suggest refactors or improvements unless explicitly asked
- Do NOT rename files, folders, or functions
- Do NOT introduce new dependencies without approval
- Do NOT change database schema without a migration file
- Treat `src/server/` and `src/lib/` as protected zones — read freely, write only with approval
- Always check `docs/PROJECT_CONTRACT.md` before starting work

---

## 9. DEFINITION OF DONE (DoD)

A task is considered complete when ALL of the following are true:

- [ ] Code changes compile without errors (`npm run build` passes)
- [ ] No protected module was modified without explicit approval
- [ ] No new TODO/FIXME/HACK comments were introduced
- [ ] If database was changed: migration file created and numbered sequentially
- [ ] If API route was added/modified: endpoint documented
- [ ] If job logic was changed: job behavior described in commit message
- [ ] Relevant documentation updated (if applicable)
- [ ] Human operator has confirmed the change is acceptable

---

## 10. DEBUG & LOGGING POLICY

### Where Logs Are Allowed

| Location | Allowed Logging |
|----------|----------------|
| `src/server/jobs.ts` | `writeJobLog()` RPC for structured logs; `console.error` for unrecoverable failures only |
| `src/server/google-drive.ts` | `console.error` for API errors only |
| `src/server/google-admin.ts` | `console.error` for API errors only |
| `src/app/api/` routes | `console.error` for errors; `console.log` for request-level debugging (development only) |

### What Must Never Be Logged

- OAuth access tokens or refresh tokens (encrypted or plaintext)
- `SUPABASE_SERVICE_ROLE_KEY` or any service account private key
- `TOKEN_ENCRYPTION_KEY`
- Full contents of `template_json` (can be very large)
- User email addresses in production logs (use anonymized identifiers where possible)

### Known Violation

- `src/app/api/auth/callback/route.ts` contains 8 `console.log` statements including token metadata. This is a **known security risk** from the forensic audit (§3.2 #4).

---

## 11. RISK REGISTER

### Architectural Risks (from Forensic Audit §3.1)

| # | Risk | Severity | Forensic Ref |
|---|------|----------|--------------|
| AR-1 | `jobs.ts` is a 2,300-line monolith containing all 7 job handlers | 🔴 Critical | §3.1 #1 |
| AR-2 | `syncProjectWithTemplate` is a stub (body = `console.log`) — template sync is a no-op | 🔴 Critical | §3.1 #2, §3.3 |
| AR-3 | Dual DB access patterns: Supabase RPC + Prisma used interchangeably | 🟡 High | §3.1 #3 |
| AR-4 | Google config duplicated in 3 locations | 🟡 High | §3.1 #4 |
| AR-5 | Env var naming split: `SHARED_DRIVE_ID` vs `GOOGLE_SHARED_DRIVE_ID` | 🟡 High | §3.1 #5 |
| AR-6 | No error boundary — job counter drift on failures | 🟡 High | §3.1 #6 |
| AR-7 | Hardcoded fallback Drive folder ID in config.ts | 🟡 Medium | §3.1 #7 |
| AR-8 | No authentication on most API routes | 🟡 Medium | §3.1 #8 |
| AR-9 | No rate limiting on API routes | 🟡 Medium | §3.1 #9 |
| AR-10 | Dead tables and constants (`expected_permissions`, `ROLE_RANK`) | 🟢 Low | §3.1 #10 |

### Sync Risks (from Forensic Audit §3.3)

| # | Risk | Severity | Forensic Ref |
|---|------|----------|--------------|
| SR-1 | Full template sync is a no-op (stub function) | 🔴 Critical | §3.3 |
| SR-2 | `synced_version` is set even when nothing happened | 🟡 High | §3.3 |
| SR-3 | All sync jobs serialize (concurrency: 1) — bottleneck | 🟡 High | §3.3 |

### Permission Enforcement Risks (from Forensic Audit §3.4)

| # | Risk | Severity | Forensic Ref |
|---|------|----------|--------------|
| PR-1 | Reset-then-apply has no rollback — mid-failure leaves zero permissions | 🟡 High | §3.4 |
| PR-2 | Two enforcement strategies coexist (`WithLogging` + `WithReset`) — dead code risk | 🟡 High | §3.4 |
| PR-3 | Rate limiting = only `sleep(200)` — can hit Drive 429 errors | 🟡 High | §3.4 |
| PR-4 | Protected principals defined in 2 locations (hardcoded + DB) | 🟡 High | §3.2 #5, §4 Q3 |

### Security Risks (from Forensic Audit §3.2)

| # | Risk | Severity | Forensic Ref |
|---|------|----------|--------------|
| SEC-1 | RLS disabled + anon key exposed to client | 🔴 Critical | §3.2 #1 |
| SEC-2 | Session cookie stores plain email (forgeable) | 🟡 High | §3.2 #2 |
| SEC-3 | No CSRF protection on POST routes | 🟡 High | §3.2 #3 |
| SEC-4 | Verbose auth logging in production | 🟡 Medium | §3.2 #4 |

---

## 12. GOVERNANCE LOCK

> **This contract is FROZEN as of February 2026.**
>
> It represents the documented state of the system derived strictly from the forensic code audit.
>
> Any deviation from this contract — including modifications to protected modules, changes to source-of-truth boundaries, or alterations to the module responsibility matrix — **MUST be explicitly approved by the project owner** before implementation.
>
> Changes to this contract itself require:
> 1. A forensic re-audit of the affected area
> 2. Explicit approval from the project owner
> 3. Version-stamped update with changelog entry
>
> **No AI agent may override, bypass, or reinterpret this governance lock.**
