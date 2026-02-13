# CHAT CONTEXT PACK — RFP System

> **Purpose:** 1-page bootstrap for any new AI chat session on this repository.
> **Copy this entire document into the first message of a new chat.**

---

## What This System IS

A **Google Drive permission management system** for construction projects. It maintains a versioned folder/permission template in Supabase, creates project folder structures in a Shared Drive, and enforces template-defined permissions via a reset-then-apply strategy. Single admin, single Shared Drive.

**Stack:** Next.js (App Router) · Supabase (PostgreSQL, `rfp` schema) · Google Drive API v3 · Google Admin SDK · Inngest (background jobs) · Prisma v7

## What This System is NOT

- NOT multi-user (single hardcoded admin: `ADMIN_EMAIL` env var)
- NOT a file manager (folders only, no file content)
- NOT real-time (enforcement is manual-trigger only)
- NOT a project management tool (no scheduling, billing, or workflows)
- Full template sync (`syncProjectWithTemplate`) is a **stub function** — not operational

## Source of Truth Summary

| Domain | Authoritative Source |
|--------|---------------------|
| Permission template | `rfp.template_versions` (`is_active = true`) |
| Folder → Drive mapping | `rfp.folder_index` table |
| Live permissions | Google Drive API (queried live) |
| Protected principals | `rfp.app_settings` WHERE `key = 'protected_principals'` |
| App config | `src/lib/config.ts` + `.env` |
| Role definitions | `CANONICAL_RANK` in `src/lib/template-engine/types.ts` |

**Known divergences:** Protected principals also hardcoded in `google-drive.ts:39-42`. Role mapping exists in 3 places. Google config duplicated in 3 files.

## Protected Modules (Require Approval to Change)

| Module | File(s) |
|--------|---------|
| Job Orchestrator | `src/server/jobs.ts` (2,300 lines, all 7 jobs) |
| Drive API Wrapper | `src/server/google-drive.ts` |
| Audit Helpers | `src/server/audit-helpers.ts` |
| Template Engine | `src/lib/template-engine/` |
| Auth Routes | `src/app/api/auth/` (4 routes) |
| Config | `src/lib/config.ts` |
| Supabase Client | `src/lib/supabase.ts` |
| Crypto | `src/lib/crypto.ts` |
| Inngest Client | `src/lib/inngest.ts` |
| DB Migrations | `supabase/migrations/` |

## How AI Must Behave

1. **READ** `docs/PROJECT_CONTRACT.md` before doing anything
2. **NEVER** modify protected modules without explicit approval
3. **NEVER** refactor, rename, or "improve" existing code unless asked
4. **ANALYZE → PLAN → MINIMAL DIFF → APPROVAL → APPLY → VERIFY → UPDATE DOCS**
5. **NEVER** delete entries from `PROTECTED_PRINCIPALS` or `app_settings`
6. **NEVER** modify applied migration files (append-only)
7. **NEVER** log tokens, keys, or encryption secrets

## Top Risks to Be Aware Of

- 🔴 RLS disabled + anon key exposed — all tables readable from browser
- 🔴 `jobs.ts` is a 2,300-line monolith — one error blocks all jobs
- 🔴 `syncProjectWithTemplate` is a stub — template sync does nothing
- 🟡 Session cookie = plain email (forgeable, no HMAC/JWT)
- 🟡 Reset-then-apply has no rollback on mid-failure
- 🟡 `SHARED_DRIVE_ID` vs `GOOGLE_SHARED_DRIVE_ID` — naming inconsistency

## Quick Reference

```
# Key files
src/server/jobs.ts          # ALL background job logic (7 Inngest functions)
src/server/google-drive.ts  # ALL Drive API operations
src/server/audit-helpers.ts # Shared normalization
src/lib/template-engine/    # Pure-function template engine
src/lib/config.ts           # Centralized config + env vars
src/lib/supabase.ts         # DB client (anon + service role)
docs/PROJECT_CONTRACT.md    # Governance contract (read first)
```

---

**To start a new chat safely, paste this document as the first message, followed by your task.**
