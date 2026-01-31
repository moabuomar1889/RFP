# RFP System - Complete Project Context

> **Last Updated:** 2025-01-31
> **Status:** Production-Ready with some mock data remnants being fixed

---

## 1️⃣ SYSTEM PURPOSE

**System name:** RFP System  
**Purpose:** High-performance Google Drive Shared Drive project management

### Core Goals:
- ✅ **Strict permission enforcement** on folder/file level
- ✅ **Diff-based sync** (NOT full rescans)
- ✅ **Auto-revert** unauthorized permission changes
- ✅ **Metadata-only** storage in Supabase (no file storage)
- ✅ **Scalable background processing** via Inngest

### What This System Does NOT Do:
- ❌ NO Apps Script
- ❌ NO file storage outside Google Drive
- ❌ NO modification of Shared Drive membership
- ❌ NO full Drive rescans

---

## 2️⃣ TECH STACK

| Layer | Technology |
|-------|------------|
| **Frontend/Backend** | Next.js 16 (App Router) |
| **Deployment** | Vercel |
| **Database** | Supabase (PostgreSQL) |
| **Schema** | `rfp` (NOT public) |
| **Auth** | Google OAuth (single admin) |
| **Storage** | Google Workspace Shared Drives |
| **APIs** | Google Drive API, Google Admin SDK |
| **Background Jobs** | Inngest |
| **UI** | shadcn/ui + Tailwind CSS |

---

## 3️⃣ PROJECT STRUCTURE

```
rfp/
├── src/
│   ├── app/
│   │   ├── (dashboard)/        # Dashboard layout routes
│   │   │   ├── projects/       # Project list + detail
│   │   │   ├── approvals/      # Request approval page
│   │   │   ├── audit/          # Audit log viewer
│   │   │   ├── template/       # Template editor
│   │   │   ├── settings/       # System settings
│   │   │   └── ...
│   │   └── api/
│   │       ├── auth/           # OAuth routes (login, callback, logout)
│   │       ├── projects/       # Project CRUD + [id] route
│   │       ├── requests/       # Project requests + approve/reject
│   │       ├── dashboard/      # Dashboard stats
│   │       ├── audit/          # Audit log API
│   │       ├── template/       # Template get/save
│   │       ├── scan/           # Drive scan endpoints
│   │       └── inngest/        # Inngest webhook
│   ├── lib/
│   │   ├── config.ts           # Google, Supabase, App config
│   │   ├── supabase.ts         # Supabase client
│   │   ├── inngest.ts          # Inngest client + event types
│   │   ├── crypto.ts           # Token encryption
│   │   └── strict-mode-scope.ts # STRICT MODE documentation
│   ├── server/
│   │   ├── google-drive.ts     # Drive API functions
│   │   ├── google-admin.ts     # Admin SDK functions
│   │   └── jobs.ts             # Inngest job definitions (919 lines!)
│   └── components/             # UI components (shadcn)
└── supabase/
    ├── migrations/             # 8 migration files
    └── scripts/
        └── diagnostic.sql      # DB diagnostic script
```

---

## 4️⃣ DATABASE SCHEMA (`rfp` schema)

### Tables:

| Table | Purpose |
|-------|---------|
| `projects` | Project metadata (pr_number, name, phase, status, drive_folder_id) |
| `project_requests` | Approval workflow (new project, upgrade to PD) |
| `template_versions` | Template JSON versions |
| `template_changes` | Diff-based template changes |
| `folder_index` | Indexed folders per project |
| `expected_permissions` | What permissions SHOULD be on each folder |
| `permission_violations` | Detected unauthorized changes |
| `reconciliation_log` | Auto-revert actions taken |
| `sync_jobs` | Background job tracking |
| `sync_tasks` | Individual tasks within jobs |
| `user_tokens` | Encrypted OAuth tokens |
| `app_settings` | System configuration |
| `audit_log` | All system actions |
| `permission_roles` | Role definitions |
| `role_principals` | Users/groups per role |

### Key RPCs (in `public` schema):

| RPC | Purpose |
|-----|---------|
| `get_projects(status, phase)` | List projects with filters |
| `get_project_by_id(id)` | Single project |
| `get_pending_requests()` | Pending approvals |
| `create_project_request(...)` | New project/upgrade request |
| `approve_request(id, reviewer)` | Approve + create project + folder |
| `reject_request(id, reviewer, reason)` | Reject request |
| `update_project_folder(id, folder_id)` | Set Drive folder ID |
| `get_active_template()` | Current template JSON |
| `save_template(json)` | Save new template version |
| `get_dashboard_stats()` | Dashboard aggregates |
| `get_audit_log(limit)` | Recent audit entries |
| `log_audit(...)` | Log an action |
| `upsert_user_token(...)` | Store OAuth tokens |

---

## 5️⃣ INNGEST JOBS

Defined in `src/server/jobs.ts`:

| Job | Event | Purpose |
|-----|-------|---------|
| `syncTemplateAll` | `template/sync.all` | Apply template to ALL projects |
| `syncTemplateChanges` | `template/sync.changes` | Apply ONLY changes (diff) |
| `syncSingleProject` | `project/sync` | Sync one project |
| `enforcePermissions` | `permissions/enforce` | Detect + revert violations |
| `buildFolderIndex` | `folder-index/build` | Scan folders from Drive |
| `reconcileFolders` | `folder-index/reconcile` | Match folders to template |

---

## 6️⃣ STRICT MODE BEHAVIOR

### What STRICT MODE does:
- ✅ Reads folder/file permissions
- ✅ Adds/removes folder/file permissions
- ✅ Detects unauthorized changes
- ✅ Reverts unauthorized changes

### What STRICT MODE does NOT do:
- ❌ Modify Shared Drive membership
- ❌ Use `drives.permissions` API
- ❌ Add/remove Drive members

### Protected Principals:
- Admin email (never removed)
- Admin groups (never removed)
- Configurable in `/settings`

---

## 7️⃣ API ROUTES SUMMARY

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | GET | Redirect to Google OAuth |
| `/api/auth/callback` | GET | OAuth callback, store tokens |
| `/api/auth/logout` | POST | Clear session |
| `/api/projects` | GET | List projects |
| `/api/projects/[id]` | GET | Get single project |
| `/api/requests` | GET/POST | List/create requests |
| `/api/requests/[id]/approve` | POST | Approve + create folder |
| `/api/requests/[id]/reject` | POST | Reject request |
| `/api/dashboard/stats` | GET | Dashboard statistics |
| `/api/audit` | GET | Audit log |
| `/api/template` | GET/POST | Get/save template |
| `/api/scan/projects` | GET/POST | Drive scanning |

---

## 8️⃣ CURRENT ISSUES / TODO

### Fixed in This Session:
- ✅ Project detail page showing mock data → Now fetches real data
- ✅ Template page crash on folder click → Fixed groups/roles
- ✅ Login refresh_token error → Added upsert_user_token RPC
- ✅ Folder creation on approval → Now creates Drive folder immediately

### Remaining Issues:
- ⚠️ Dashboard may show cached/mock data (Vercel cache)
- ⚠️ Enforce Now / Sync buttons not wired to APIs
- ⚠️ Folder tree in project detail is empty (needs index API)
- ⚠️ Users/Groups sync not implemented

---

## 9️⃣ MIGRATIONS TO RUN

| Migration | Description | Status |
|-----------|-------------|--------|
| 001-006 | Initial schema + RPCs | ✅ Run |
| 007 | `update_project_folder` + updated `approve_request` | ✅ Run |
| 008 | `upsert_user_token` for login fix | ✅ Run |

---

## 🔟 OPERATING RULES (NON-NEGOTIABLE)

1. **Never suggest full Drive rescans**
2. **Never suggest Apps Script**
3. **Never copy files to other storage**
4. **Never weaken permission enforcement**
5. **Never introduce multi-user auth without explicit instruction**
6. **Always prefer incremental, idempotent operations**
7. **Always protect system invariants**

---

## 📋 Quick Commands

```bash
# Build
npm run build

# Dev
npm run dev

# Push to production
git add . && git commit -m "message" && git push origin main
```

---

**Context loaded successfully. Memory updated.**
