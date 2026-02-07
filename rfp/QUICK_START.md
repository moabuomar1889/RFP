# 🎯 QUICK START: Insert Template & Test

## Step 1: Insert Template (Choose One Method)

### Method A: SQL (Fastest - 2 minutes)

1. Open `c:\Users\Mo.abuomar\Desktop\RFP3\rfp\template_output.json`
2. Copy the ENTIRE JSON content
3. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/cxpyiibkethevsbotuui/sql
4. Paste and run:

```sql
INSERT INTO rfp.folder_templates (
    version_number,
    template_json,
    is_active,
    created_by,
    notes
)
VALUES (
    1,
    '<PASTE YOUR JSON HERE>'::jsonb,
    true,
    'production_seed',
    'Real template from template_output.json'
);

-- Verify
SELECT id, version_number, is_active, created_at 
FROM rfp.folder_templates;
```

### Method B: Prisma Studio (Visual - 3 minutes)

```bash
cd c:\Users\Mo.abuomar\Desktop\RFP3\rfp
npx prisma studio
```

1. Click `folder_templates` table
2. Click "Add record"
3. Fill in:
   - version_number: `1`
   - template_json: Paste JSON from `template_output.json`
   - is_active: `true`
   - created_by: `"studio"`
4. Save

---

## Step 2: Test System (5 minutes)

### Test Reset API

```powershell
# Get a project ID from your database
# Then test reset:

curl -X POST http://localhost:3001/api/permissions/reset `
  -H "Content-Type: application/json" `
  -d '{"projectId": "YOUR_PROJECT_ID_HERE"}'
```

**Expected Response:**
```json
{
  "success": true,
  "jobId": "xxx-xxx-xxx",
  "totalFolders": 123,
  "message": "Reset job started"
}
```

### Check Progress

```powershell
curl "http://localhost:3001/api/permissions/reset?jobId=YOUR_JOB_ID"
```

### Verify Folder

```powershell
curl "http://localhost:3001/api/admin/verify-folder?folderId=YOUR_FOLDER_ID"
```

---

## Step 3: Monitor Logs

Watch the terminal for:
- ✅ "Limited Access ENABLED and VERIFIED"
- ✅ "✓ Folder reset complete"
- ✅ "RESET COMPLETE"

---

## ✅ Success Criteria

You're done when:
1. Template appears in `folder_templates` table
2. Reset API returns success
3. Job completes with 0 failed folders
4. Audit logs show permission changes

---

**Time to Complete:** 10 minutes  
**Difficulty:** Easy  
**Status:** Code is 100% ready, just needs template + testing
