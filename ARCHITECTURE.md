# High-Performance Google Drive Project Management System

## Architecture Design Document

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS UI (Vercel)                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │ Projects    │ │ Template    │ │ Permissions │ │ Jobs Dashboard          ││
│  │ Dashboard   │ │ Editor      │ │ Manager     │ │ (real-time progress)    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────────┘│
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ API Routes
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE (PostgreSQL)                             │
│  Schema: RFP                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ template_    │ │ template_    │ │ projects     │ │ folder_index      │  │
│  │ versions     │ │ changes      │ │              │ │ (path → drive_id) │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └───────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ sync_jobs    │ │ sync_tasks   │ │ audit_log    │ │ user_tokens       │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └───────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────────────┐
│      INNGEST JOB QUEUE          │ │         WORKER (Vercel / VPS)           │
│  - permission-sync-queue        │ │  - Polls task queue                     │
│  - folder-create-queue          │ │  - Calls Google Drive API               │
│  - enforcement-queue            │ │  - Updates Supabase                     │
│  - (retry + dead-letter)        │ │  - Handles rate limits                  │
└─────────────────────────────────┘ └─────────────────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌─────────────────────────────────────────┐
                                    │        GOOGLE WORKSPACE                 │
                                    │  - Shared Drive (file storage)          │
                                    │  - Google Groups (permissions)          │
                                    └─────────────────────────────────────────┘
```

---

## 2. Core Constraints

| Constraint | Decision |
|------------|----------|
| File Storage | Google Workspace Shared Drives (non-negotiable) |
| Metadata DB | Supabase PostgreSQL, Schema: `RFP` |
| UI Framework | Next.js App Router + shadcn/ui + Tailwind |
| Auth | User OAuth (your Google account) |
| Hosting Now | Vercel |
| Hosting Later | VPS |
| Permission Mode | STRICT (auto-revert manual changes) |

---

## 3. Key Performance Strategy: Diff-Based Sync

### The Problem
Current system scans ALL 1,500 folders on every template change.

### The Solution
1. **Index once**: Store `template_path → drive_folder_id` mapping
2. **Calculate diff**: What actually changed in template
3. **Apply only changes**: Touch only affected folders

### Example

```
Template Change: Rename "Technical" → "Technical Proposal"

OLD WAY: Loop all 30 projects × 50 folders = 1,500 API calls
NEW WAY: Look up 30 folder IDs from index, rename each = 30 API calls

Speed improvement: 50x faster
```

---

## 4. Database Schema (Supabase - Schema: RFP)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA: RFP
-- ═══════════════════════════════════════════════════════════════════════════

-- USER AUTHENTICATION
CREATE TABLE rfp.user_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TEMPLATE VERSIONS
CREATE TABLE rfp.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INTEGER NOT NULL UNIQUE,
  template_json JSONB NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT false
);

-- TEMPLATE CHANGES (DIFF/DELTA)
CREATE TABLE rfp.template_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_version INTEGER REFERENCES rfp.template_versions(version_number),
  to_version INTEGER NOT NULL REFERENCES rfp.template_versions(version_number),
  change_type TEXT NOT NULL,
  affected_path TEXT NOT NULL,
  change_details JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROJECTS
CREATE TABLE rfp.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'bidding',
  drive_folder_id TEXT NOT NULL,
  synced_version INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  last_enforced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FOLDER INDEX (Critical for performance)
CREATE TABLE rfp.folder_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES rfp.projects(id) ON DELETE CASCADE,
  template_path TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  drive_folder_name TEXT NOT NULL,
  limited_access_enabled BOOLEAN DEFAULT false,
  permissions_hash TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, template_path)
);

CREATE INDEX idx_folder_index_path ON rfp.folder_index(template_path);
CREATE INDEX idx_folder_index_drive_id ON rfp.folder_index(drive_folder_id);

-- EXPECTED PERMISSIONS
CREATE TABLE rfp.expected_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_path TEXT NOT NULL,
  permission_type TEXT NOT NULL,
  email_or_domain TEXT NOT NULL,
  role TEXT NOT NULL,
  UNIQUE(template_path, permission_type, email_or_domain)
);

-- SYNC JOBS
CREATE TABLE rfp.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  target_version INTEGER,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  failed_tasks INTEGER DEFAULT 0,
  progress_percent INTEGER DEFAULT 0,
  started_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SYNC TASKS
CREATE TABLE rfp.sync_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES rfp.sync_jobs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES rfp.projects(id),
  folder_index_id UUID REFERENCES rfp.folder_index(id),
  task_type TEXT NOT NULL,
  task_details JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_tasks_job ON rfp.sync_tasks(job_id);
CREATE INDEX idx_sync_tasks_status ON rfp.sync_tasks(status);

-- AUDIT LOG
CREATE TABLE rfp.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  performed_by TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_time ON rfp.audit_log(created_at DESC);

-- PERMISSION VIOLATIONS
CREATE TABLE rfp.permission_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_index_id UUID REFERENCES rfp.folder_index(id),
  violation_type TEXT NOT NULL,
  expected JSONB,
  actual JSONB,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
```

---

## 5. Shared Drive Permission Rules

### Role Hierarchy

| Role | Drive Name | Capabilities |
|------|------------|--------------|
| `organizer` | Manager | Manage members, delete drive |
| `fileOrganizer` | Content Manager | Organize files, move between folders |
| `writer` | Contributor | Edit files |
| `commenter` | Commenter | View + comment |
| `reader` | Viewer | Read only |

### Important Rules

1. **`organizer` only at Drive root** - Use `fileOrganizer` for subfolders
2. **Limited Access folders** - Set `inheritedPermissionsDisabled: true`
3. **Protected permissions** - Never remove admin/owner access

### Safe Permission Sync Algorithm

```typescript
const PROTECTED = [
  { type: 'user', email: 'mo.abuomar@dtgsa.com' },
  { type: 'group', email: 'admins@dtgsa.com' },
];

async function syncFolderPermissions(folderId, expected) {
  const current = await drive.permissions.list(folderId);
  
  // ADD: In template but not in Drive
  const toAdd = expected.filter(e => !current.find(c => matches(c, e)));
  
  // REMOVE: In Drive but not in template (except protected)
  const toRemove = current.filter(c => {
    if (isProtected(c) || c.inherited) return false;
    return !expected.find(e => matches(c, e));
  });
  
  // Execute: ADD first, then REMOVE
  for (const p of toAdd) await drive.permissions.create(folderId, p);
  for (const p of toRemove) await drive.permissions.delete(folderId, p.id);
}
```

---

## 6. Job Queue System (Inngest)

### Why Inngest?
- Works on Vercel (no VPS needed initially)
- Same code works on VPS later
- Built-in retries, rate limiting, progress
- Free tier: 25,000 runs/month

### Job Types

| Job Type | Trigger | Description |
|----------|---------|-------------|
| `template_sync` | User applies template | Apply template changes to all projects |
| `permission_enforcement` | Hourly cron | Detect and revert manual changes |
| `folder_create` | New project | Create folder structure |
| `full_rescan` | Manual | Rebuild folder_index from Drive |

### Example Function

```typescript
export const templateSync = inngest.createFunction(
  { id: 'template-sync', retries: 3, concurrency: { limit: 5 } },
  { event: 'template/sync.requested' },
  async ({ event, step }) => {
    const { jobId, changes } = event.data;
    const projects = await step.run('get-projects', getProjects);
    
    for (const project of projects) {
      await step.run(`sync-${project.pr_number}`, async () => {
        for (const change of changes) {
          await applyChange(project, change);
        }
        await updateProjectSyncStatus(project.id);
      });
      await updateJobProgress(jobId);
    }
  }
);
```

---

## 7. User OAuth for Background Jobs

### Challenge
Background jobs run without user logged in.

### Solution: Secure Refresh Token Storage

```typescript
// Store encrypted tokens on login
async function handleOAuthCallback(tokens) {
  await supabase.from('rfp.user_tokens').upsert({
    email: user.email,
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    token_expiry: new Date(tokens.expiry_date),
  });
}

// Background job refreshes token automatically
async function getAccessToken() {
  const stored = await getStoredTokens();
  
  if (stored.token_expiry > new Date()) {
    return decrypt(stored.access_token_encrypted);
  }
  
  // Auto-refresh using refresh token
  const newTokens = await refreshAccessToken(decrypt(stored.refresh_token_encrypted));
  await saveNewTokens(newTokens);
  return newTokens.access_token;
}
```

**Note:** Refresh tokens don't expire unless you change your Google password.

---

## 8. Migration Plan

### Phase 0: Foundation (Week 1)
- [ ] Setup Supabase project with RFP schema
- [ ] Setup Next.js with shadcn/ui + Tailwind
- [ ] Implement Google OAuth
- [ ] Build UI skeleton

### Phase 1: Folder Index (Week 2)
- [ ] Build initial Drive scanner
- [ ] Populate folder_index table
- [ ] Build Projects dashboard
- [ ] Build Project detail page

### Phase 2: Template Engine (Week 3)
- [ ] Build template editor UI
- [ ] Implement diff calculator
- [ ] Build "Preview Changes" UI
- [ ] Implement version history

### Phase 3: Sync Engine (Week 4)
- [ ] Setup Inngest
- [ ] Build sync functions (create/rename/permissions)
- [ ] Build progress tracking UI
- [ ] Test end-to-end

### Phase 4: Permission Enforcement (Week 5)
- [ ] Build permission comparison
- [ ] Build violation detection
- [ ] Build enforcement job
- [ ] Setup hourly cron

### Phase 5: Cutover (Week 6)
- [ ] Full data import
- [ ] Parallel testing
- [ ] Disable old system
- [ ] Monitor and fix

---

## 9. Expected Performance

| Operation | Current | New System |
|-----------|---------|------------|
| Add 1 folder | 30+ min | 30-60 sec |
| Rename 1 folder | 30+ min | 30-60 sec |
| Change 1 permission | 30+ min | 30-60 sec |
| Full template sync | 60+ min | 3-5 min |
| Permission enforcement | N/A | Hourly (auto) |

---

## 10. Technology Stack Summary

| Component | Choice |
|-----------|--------|
| UI | Next.js App Router + shadcn/ui + Tailwind |
| Database | Supabase PostgreSQL (schema: RFP) |
| Auth | User OAuth with encrypted token storage |
| Job Queue | Inngest |
| Hosting Now | Vercel |
| Hosting Later | VPS (same codebase) |
| File Storage | Google Workspace Shared Drives |
