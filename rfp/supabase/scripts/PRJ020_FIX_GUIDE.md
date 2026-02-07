# PRJ-020 Permission Fix - READY TO EXECUTE

## Folders to Fix (with Direct Links)

### 1. Root Folder (shows as "Bidding" in audit)
- **Folder Name**: `PRJ-020-RFP`
- **Drive ID**: `1A-LFJlyhYrCgsDUnnnVis5fol0L78t1X`
- **Direct Link**: https://drive.google.com/drive/folders/1A-LFJlyhYrCgsDUnnnVis5fol0L78t1X
- **Fix Needed**: Change `HSE-Team@dtgsa.com` role from **writer** → **reader**

### 2. Vendors Quotations Folder
- **Folder Name**: `PRJ-020-RFP/3-PRJ-020-RFP-Vendors Quotations`
- **Drive ID**: `1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN`
- **Direct Link**: https://drive.google.com/drive/folders/1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN
- **Fix Needed**: Remove these 2 permissions:
  - `Technical-Team@dtgsa.com` (reader)
  - `Projects-Control@dtgsa.com` (reader)

---

## Fix Steps

### Option A: Using Google Drive UI

1. **Fix Root Folder (PRJ-020-RFP)**:
   - Click: https://drive.google.com/drive/folders/1A-LFJlyhYrCgsDUnnnVis5fol0L78t1X
   - Right-click → **Share** → **Manage access**
   - Find `HSE-Team@dtgsa.com`
   - Change from **Editor** to **Viewer**
   - Click **Done**

2. **Fix Vendors Quotations**:
   - Click: https://drive.google.com/drive/folders/1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN
   - Right-click → **Share** → **Manage access**
   - Find `Technical-Team@dtgsa.com` → Click **X** to remove
   - Find `Projects-Control@dtgsa.com` → Click **X** to remove
   - Click **Done**

### Option B: Using Drive API (Advanced)

**Fix Root Folder - Change HSE-Team role:**
```bash
# First, list permissions to get the permission ID
curl "https://www.googleapis.com/drive/v3/files/1A-LFJlyhYrCgsDUnnnVis5fol0L78t1X/permissions?supportsAllDrives=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Then update the permission (replace PERMISSION_ID with ID from above)
curl -X PATCH \
  "https://www.googleapis.com/drive/v3/files/1A-LFJlyhYrCgsDUnnnVis5fol0L78t1X/permissions/PERMISSION_ID?supportsAllDrives=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "reader"}'
```

**Fix Vendors Quotations - Remove permissions:**
```bash
# List permissions
curl "https://www.googleapis.com/drive/v3/files/1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN/permissions?supportsAllDrives=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Delete Technical-Team permission (replace TECH_TEAM_PERMISSION_ID)
curl -X DELETE \
  "https://www.googleapis.com/drive/v3/files/1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN/permissions/TECH_TEAM_PERMISSION_ID?supportsAllDrives=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Delete Projects-Control permission (replace PROJECTS_CONTROL_PERMISSION_ID)
curl -X DELETE \
  "https://www.googleapis.com/drive/v3/files/1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN/permissions/PROJECTS_CONTROL_PERMISSION_ID?supportsAllDrives=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Verification

After applying fixes:

1. **Re-run Permission Audit** for PRJ-020
2. **Compare with PRJ-019** - should now be identical
3. **Check specific results**:
   - Root folder (Bidding): Should show "match" with NO HSE-Team writer
   - Vendors Quotations subfolders: Should show "match" with NO extra Technical-Team or Projects-Control

**Expected Result**: PRJ-020 audit results should be identical to PRJ-019 (template compliance).

---

## Summary

**Root Cause**: PRJ-020 drifted from template with 2 permission discrepancies on parent folders that inherited to children.

**Fix**: Manual correction of 2 folders in Google Drive (1 role change, 2 permission removals).

**Prevention**: Consider setting `expected_limited_access=true` on critical folders to prevent inheritance drift.
