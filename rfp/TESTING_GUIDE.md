# 🧪 TESTING GUIDE - Prisma Code-First System

## Prerequisites
- ✅ Database schema created
- ✅ Template loaded
- ✅ Dev server running

---

## Step 1: Start Dev Server

```powershell
cd c:\Users\Mo.abuomar\Desktop\RFP3\rfp
npm run dev
```

Wait for: `Ready on http://localhost:3001`

---

## Step 2: Get a Project ID

Open Prisma Studio to find a project:

```powershell
npx prisma studio
```

- Go to `projects` table
- Copy a project `id` (UUID)
- Or use SQL Editor in Supabase:
  ```sql
  SELECT id, name, pr_number FROM rfp.projects LIMIT 5;
  ```

---

## Step 3: Test Reset API

### A. Start a Reset Job

```powershell
# Replace YOUR_PROJECT_ID with actual UUID
curl -X POST http://localhost:3001/api/permissions/reset `
  -H "Content-Type: application/json" `
  -d '{\"projectId\": \"YOUR_PROJECT_ID\"}'
```

**Expected Response:**
```json
{
  "success": true,
  "jobId": "abc-123-def",
  "totalFolders": 50,
  "message": "Reset job started"
}
```

### B. Check Progress

```powershell
# Use jobId from above
curl "http://localhost:3001/api/permissions/reset?jobId=YOUR_JOB_ID"
```

**Expected Response:**
```json
{
  "id": "abc-123-def",
  "status": "running",
  "processed_folders": 25,
  "total_folders": 50,
  "successful_folders": 24,
  "failed_folders": 1,
  "project": {
    "name": "Project Name",
    "pr_number": "PR-123"
  }
}
```

### C. Verify Folder Compliance

```powershell
# Get folder ID from database
curl "http://localhost:3001/api/admin/verify-folder?folderId=YOUR_FOLDER_ID"
```

**Expected Response:**
```json
{
  "folder": {
    "template_path": "Project Delivery/Document Control",
    "drive_folder_id": "abc123"
  },
  "expected": {
    "limited_access": true,
    "groups": [...],
    "total_principals": 5
  },
  "actual": {
    "limited_access": true,
    "permissions": [...],
    "total_principals": 5
  },
  "compliance": {
    "is_compliant": true,
    "limited_access_match": true,
    "missing_principals": [],
    "unexpected_principals": []
  }
}
```

---

## Step 4: Check Audit Logs

In Prisma Studio or Supabase:

```sql
SELECT 
  id, 
  action, 
  principal_email, 
  result, 
  created_at 
FROM rfp.permission_audit 
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY created_at DESC
LIMIT 20;
```

**What to Look For:**
- ✅ `action: 'add'` for added permissions
- ✅ `action: 'remove'` for removed permissions
- ✅ `action: 'enable_limited_access'` or `'disable_limited_access'`
- ✅ `result: 'success'` for most entries
- ✅ `is_inherited: true` for inherited permissions

---

## Step 5: Verify Database Updates

```sql
-- Check job completion
SELECT id, status, total_folders, successful_folders, failed_folders
FROM rfp.reset_jobs
ORDER BY created_at DESC
LIMIT 5;

-- Check folder compliance
SELECT 
  template_path,
  expected_limited_access,
  actual_limited_access,
  is_compliant,
  last_verified_at
FROM rfp.folder_index
WHERE project_id = 'YOUR_PROJECT_ID'
ORDER BY template_path;
```

---

## 🎯 Success Criteria

You've successfully tested when:

1. ✅ Reset job starts and returns `jobId`
2. ✅ Progress endpoint shows increasing `processed_folders`
3. ✅ Job completes with `status: 'completed'`
4. ✅ Audit logs show permission changes
5. ✅ Folder compliance updates (`is_compliant: true`)
6. ✅ No critical errors in terminal

---

## 🐛 Troubleshooting

### "No projects found"
- Check database has projects: `SELECT * FROM rfp.projects;`
- Create a test project if needed

### "Template not found"
- Verify template exists: `SELECT * FROM rfp.folder_templates WHERE is_active = true;`

### "Drive API errors"
- Check Google credentials in `.env.local`
- Verify service account has Drive access

### Job stays in "pending"
- Check server logs for errors
- Verify worker function is called
- Check database connection

---

## 📊 Quick Test Script

```powershell
# All-in-one test (replace IDs)
$projectId = "YOUR_PROJECT_ID"

# Start reset
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/permissions/reset" `
  -Method POST `
  -ContentType "application/json" `
  -Body "{`"projectId`":`"$projectId`"}"

Write-Host "Job ID: $($response.jobId)"

# Wait and check
Start-Sleep -Seconds 5
Invoke-RestMethod -Uri "http://localhost:3001/api/permissions/reset?jobId=$($response.jobId)"
```

---

**Testing Time:** 10-15 minutes  
**Difficulty:** Medium  
**Status:** Ready to test!
