# Phase 0: Implementation Plan

## Project: RFP (Google Drive Project Management System)

---

## 1. What We're Building

A Next.js application that replicates and improves the existing Apps Script system for managing Google Workspace Shared Drive project folders with:
- **STRICT permission enforcement** (template is source of truth)
- **Diff-based sync** (only apply changes, not full scans)
- **Role-based permissions** via Google Groups
- **Background jobs** via Inngest on Vercel

---

## 2. Original System Logic (From Apps Script Scan)

### Project Structure
```
Shared Drive Root
└── PRJ-PR-001-ProjectName/           ← Project root
    ├── PRJ-PR-001-RFP/               ← Bidding phase (RFP)
    │   ├── 1-PR-001-RFP-SOW/
    │   ├── 2-PR-001-RFP-Technical/
    │   └── ...                       ← ~15 folders
    └── PRJ-PR-001-PD/                ← Execution phase (PD)
        ├── 1-PR-001-PD-Project Management/
        ├── 2-PR-001-PD-QC/
        └── ...                       ← ~35 folders
```

### Limited Access Folders
- Uses `inheritedPermissionsDisabled: true` on Drive folders
- Removes domain-wide access, adds only specific groups
- Groups have roles: `organizer`, `fileOrganizer`, `writer`, `reader`

### Permission Application Flow (Old System)
1. Create folder in Drive
2. Set `inheritedPermissionsDisabled: true` if limited access
3. Remove all domain permissions
4. Add group permissions per template
5. Never remove admin/protected permissions

---

## 3. Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 App Router |
| UI | shadcn/ui + Tailwind CSS |
| Database | Supabase PostgreSQL (schema: `RFP`) |
| Auth | Google OAuth (User OAuth, offline access) |
| Jobs | Inngest (Vercel-compatible) |
| APIs | Drive API v3 + Admin SDK Directory API |
| Hosting | Vercel |

---

## 4. Database Tables (Schema: RFP)

| Table | Purpose |
|-------|---------|
| `user_tokens` | Encrypted OAuth tokens for background jobs |
| `template_versions` | Full template snapshots with version numbers |
| `template_changes` | Diff records between versions |
| `projects` | Project metadata + sync status |
| `folder_index` | path → drive_folder_id mapping (performance critical) |
| `permission_roles` | Role definitions (ADMIN, PM, QS, etc.) |
| `role_principals` | Role → Group/User email mapping |
| `expected_permissions` | What permissions each folder path should have |
| `sync_jobs` | Job tracking with progress |
| `sync_tasks` | Individual tasks within jobs |
| `permission_violations` | Detected manual changes |
| `audit_log` | Who did what |

---

## 5. UI Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard with stats |
| `/projects` | Projects list with sync status |
| `/projects/[id]` | Project details + folder tree + sync actions |
| `/projects/new` | Create new project |
| `/template` | Template editor + version history + diff preview |
| `/users` | Google Workspace users list + app role assignment |
| `/groups` | Google Workspace groups + role mapping |
| `/roles` | Permission Directory (role → principals) |
| `/jobs` | Job history + progress + retry |
| `/audit` | Audit log viewer |
| `/settings` | Auth status + strict mode + protected principals |

---

## 6. Background Jobs (Inngest)

| Job | Trigger | Description |
|-----|---------|-------------|
| `sync-template-all` | Manual | Apply current template to ALL projects |
| `sync-template-changes` | On template save | Apply only changes to ALL projects |
| `sync-project` | Manual | Full sync one project |
| `enforce-permissions` | Scheduled (hourly) + Manual | Detect and revert unauthorized changes |
| `build-folder-index` | Manual | Rebuild folder_index from Drive |

---

## 7. API Scopes Required

```
# Google Drive API
https://www.googleapis.com/auth/drive

# Google Admin SDK Directory API (for users/groups)
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/admin.directory.group.readonly
https://www.googleapis.com/auth/admin.directory.group.member.readonly
```

---

## 8. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Token Encryption
TOKEN_ENCRYPTION_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App Config
SHARED_DRIVE_ID=
ADMIN_EMAIL=mo.abuomar@dtgsa.com
```

---

## 9. Implementation Checklist

### A) Project Setup
- [ ] Create Next.js app named `RFP`
- [ ] Configure Tailwind CSS
- [ ] Install and configure shadcn/ui
- [ ] Setup folder structure (/app, /components, /lib, /server, /docs)
- [ ] Configure TypeScript

### B) Supabase Schema
- [ ] Create schema `RFP`
- [ ] Create all tables with indexes
- [ ] Create migration files
- [ ] Setup Row Level Security (RLS)

### C) Google OAuth
- [ ] Setup OAuth consent screen (internal)
- [ ] Implement login/logout flow
- [ ] Store encrypted refresh token
- [ ] Implement token refresh logic
- [ ] Protect API routes with auth

### D) Google API Clients
- [ ] Drive API v3 wrapper (Shared Drives support)
- [ ] Admin SDK Directory API wrapper (users/groups)
- [ ] Permission CRUD operations
- [ ] Rate limiting and error handling

### E) Folder Index System
- [ ] Initial folder scan function
- [ ] Populate folder_index table
- [ ] Lookup functions (path → folder_id)
- [ ] Index refresh/rebuild

### F) Template System
- [ ] Template editor UI (folder tree)
- [ ] Version save with diff calculation
- [ ] Diff preview before apply
- [ ] Version history viewer

### G) Permission Directory
- [ ] Role definitions CRUD
- [ ] Role → Principal mapping
- [ ] Template references roles (not emails)
- [ ] Protected principals list

### H) Sync Engine
- [ ] Full sync (one project)
- [ ] Diff sync (changes only)
- [ ] Create folder operation
- [ ] Rename folder operation
- [ ] Set permissions operation
- [ ] Remove unauthorized permissions
- [ ] Admin protection (never remove)

### I) Strict Enforcement
- [ ] Read actual permissions from Drive
- [ ] Compare with expected (from template)
- [ ] Calculate violations
- [ ] Auto-revert violations
- [ ] Log all changes

### J) Inngest Jobs
- [ ] Setup Inngest client
- [ ] Configure /api/inngest endpoint
- [ ] Implement all job functions
- [ ] Progress tracking
- [ ] Retry logic
- [ ] Rate limiting

### K) UI Pages
- [ ] Dashboard (/)
- [ ] Projects list (/projects)
- [ ] Project details (/projects/[id])
- [ ] Create project (/projects/new)
- [ ] Template editor (/template)
- [ ] Users list (/users)
- [ ] Groups list (/groups)
- [ ] Roles/Permission Directory (/roles)
- [ ] Jobs dashboard (/jobs)
- [ ] Audit log (/audit)
- [ ] Settings (/settings)

### L) Documentation
- [ ] README with setup instructions
- [ ] Environment variables documentation
- [ ] Deployment guide (Vercel)
- [ ] Verification checklist

---

## 10. Strict Mode Rules

1. **Template is source of truth** - All folder permissions derived from template
2. **Auto-revert** - Any manual permission changes detected and reverted
3. **Protected principals** - Admin account and admin groups NEVER removed:
   - `mo.abuomar@dtgsa.com` (organizer)
   - `admins@dtgsa.com` group (organizer)
4. **Warning in UI** - Clear message that manual changes will be reverted
5. **Audit trail** - All enforcement actions logged

---

## 11. Estimated Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Setup | 1 day | Next.js + Supabase + shadcn |
| Auth | 1 day | Google OAuth + token storage |
| API Clients | 1 day | Drive + Admin SDK wrappers |
| Database | 1 day | All tables + migrations |
| Folder Index | 1 day | Index system + sync |
| Template System | 2 days | Editor + versioning + diff |
| Permission System | 2 days | Roles + enforcement |
| Inngest Jobs | 2 days | All background jobs |
| UI Pages | 3 days | All pages listed |
| Testing | 1 day | End-to-end verification |

**Total: ~2 weeks**

---

## 12. Verification Checklist (Post-Implementation)

To verify the system matches original Apps Script workflows:

- [ ] Create new Bidding project creates correct folder structure
- [ ] Upgrade to Execution creates PD folders
- [ ] Limited access folders have `inheritedPermissionsDisabled: true`
- [ ] Groups receive correct roles (organizer/fileOrganizer/writer/reader)
- [ ] Template changes propagate to all projects
- [ ] Manual permission changes are detected
- [ ] Manual permission changes are reverted
- [ ] Admin account is never removed from any folder
- [ ] Folder naming matches: `N-PR-XXX-PHASE-FolderName`
- [ ] Project naming matches: `PRJ-PR-XXX-ProjectName`

---

# ⏸️ AWAITING YOUR APPROVAL

Please review this plan and reply with **APPROVED** to proceed with implementation.

If you have any changes or questions, let me know before I start building.
