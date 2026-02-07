# Comprehensive Line-by-Line Permission Analysis
## PRJ-019 vs PRJ-020

---

## 📊 Overall Pattern Summary

Based on manual analysis of the comparison file:

### ✅ Consistent Pattern: Expected Permissions are IDENTICAL
Both projects have the exact same expected permissions for every folder. This confirms they use the same template.

### ❌ Problem 1: HSE-Team Inheritance Differs

| Folder | Expected | PRJ-019 Actual | PRJ-020 Actual |
|--------|----------|----------------|----------------|
| Bidding | ❌ No HSE-Team | ✓ HSE-Team (reader) | ✓ HSE-Team (writer) |
| Bidding/SOW | ❌ No HSE-Team | ✓ HSE-Team (reader) | ✓ HSE-Team (reader) |
| Bidding/Technical Proposal | ❌ No HSE-Team | ✓ HSE-Team (reader) | ✓ HSE-Team (reader) |
| Bidding/Vendors Quotations | ❌ No HSE-Team | ✓ HSE-Team (reader) | ✓ HSE-Team (reader) |
| Bidding/Commercial Proposal | ❌ No HSE-Team | ✓ HSE-Team (reader) | ✓ HSE-Team (reader) |

**Key Finding:** HSE-Team inherits differently ONLY on the root **Bidding** folder:
- PRJ-019: reader
- PRJ-020: **writer** (wrong!)

All subfolders then inherit HSE-Team as reader from their parents.

### ❌ Problem 2: Vendors Quotations Subfolders Differ

| Folder | PRJ-019 Status | PRJ-020 Status | PRJ-020 Extras |
|--------|----------------|----------------|----------------|
| Vendors Quotations/Civil and Finishes | ✅ match | ❌ extra | technical-team, projects-control |
| Vendors Quotations/Mechanical | ✅ match | ❌ extra | technical-team, projects-control |
| Vendors Quotations/E&I | ✅ match | ❌ extra | technical-team, projects-control |
| Vendors Quotations/IT | ✅ match | ❌ extra | technical-team, projects-control |

**Key Finding:** All 4 subfolders have extra inherited permissions in PRJ-020 but NOT in PRJ-019.

---

## 📁 Detailed Folder-by-Folder Analysis

### 1. Bidding
**Expected (Both):** technical-team (reader); dc-team (reader); survey-team (reader); projects-control (reader); admin (organizer); quality-control (reader); projects-managers (reader)

**PRJ-019 Actual:**
- All expected ✓
- **+ HSE-Team (reader)** [INHERITED]
- + mo.abuomar (organizer) [INHERITED]
- Status: match ✓

**PRJ-020 Actual:**
- All expected ✓
- **+ HSE-Team (writer)** [INHERITED] ❌ DIFFERENT ROLE
- + mo.abuomar (organizer) [INHERITED]
- Status: match ✓

**Analysis:**
- Both show "match" because comparison ignores inherited permissions when `limitedAccess=false`
- HSE-Team inherits from different parent permissions
- **This is the ROOT CAUSE**: PRJ-020's Bidding folder inherits HSE-Team as writer, while PRJ-019 inherits as reader

---

### 2. Bidding/SOW (Limited Access Folder)
**Expected (Both):** technical-team (writer); projects-control (writer); admin (organizer); projects-managers (writer); abed.ahmad (writer); Waseem (writer)

**PRJ-019 Actual:**
- All expected ✓
- + DC-Team (reader) [INHERITED]
- + Survey-Team (reader) [INHERITED]
- + Quality-Control (reader) [INHERITED]
- + HSE-Team (reader) [INHERITED]
- + mo.abuomar (organizer) [INHERITED]
- + domain [INHERITED]
- Status: **extra** ❌

**PRJ-020 Actual:**
- **IDENTICAL to PRJ-019** ❌
- Same inherited permissions
- Status: **extra** ❌

**Analysis:**
- Both have IDENTICAL extras (same discrepancies)
- This is expected because both inherit from Bidding folder
- The inherited permissions are flagged as "extra" because `limitedAccess=true`
- Both PRJ-019 and PRJ-020 behave the same way here

---

### 3. Bidding/Technical Proposal
**Expected (Both):** admin (organizer); projects-managers (writer); technical-team (writer); a.albaz (writer); abed.ahmad (writer); DC (writer); Waseem (writer)

**PRJ-019 & PRJ-020 Actual:**
- Both IDENTICAL
- Both have inherited: DC-Team, Survey-Team, Quality-Control, HSE-Team, Projects-Control, mo.abuomar
- Status: match ✓ (both)

**Analysis:**
- Identical behavior
- Inherited permissions ignored because `limitedAccess=false`

---

### 4. Bidding/Technical Proposal/TBE
**Expected (Both):** admin (organizer); projects-managers (writer); Marwan (writer)

**PRJ-019 & PRJ-020 Actual:**
- Both IDENTICAL
- Both have extras: technical-team, waseem, abed.ahmad, a.albaz, dc
- Status: extra ❌ (both)

**Analysis:**
- Identical behavior
- Same extras in both projects

---

### 5. Bidding/Vendors Quotations
**Expected (Both):** technical-team (reader); projects-control (reader); admin (organizer); projects-managers (fileOrganizer)

**PRJ-019 & PRJ-020 Actual:**
- Both IDENTICAL
- Both have inherited: DC-Team, Survey-Team, Quality-Control, HSE-Team, mo.abuomar
- Status: match ✓ (both)

**Analysis:**
- Identical behavior
- Inherited permissions ignored

---

### 6. Bidding/Vendors Quotations/Civil and Finishes
**Expected (Both):** admin (organizer); projects-managers (fileOrganizer); a.albaz (writer)

**PRJ-019 Actual:**
- a.albaz (writer) ✓
- Admin (organizer) ✓
- Projects-Managers (fileOrganizer) ✓
- mo.abuomar (organizer) [INHERITED]
- Status: match ✓

**PRJ-020 Actual:**
- a.albaz (writer) ✓
- Admin (organizer) ✓
- Projects-Managers (fileOrganizer) ✓
- mo.abuomar (organizer) [INHERITED]
- **+ Technical-Team (reader)** [INHERITED] ❌
- **+ Projects-Control (reader)** [INHERITED] ❌
- Status: extra ❌

**Analysis:**
- PRJ-020 has 2 extra inherited permissions that PRJ-019 doesn't have
- This suggests the parent folder (Vendors Quotations) has different permissions set in PRJ-020

---

### 7-9. Bidding/Vendors Quotations/Mechanical, E&I, IT
**Same pattern as Civil and Finishes:**
- PRJ-019: Clean (match)
- PRJ-020: Has extras (technical-team + projects-control)

---

### 10. Bidding/Commercial Proposal
**Expected (Both):** admin (organizer); projects-managers (writer)

**PRJ-019 & PRJ-020 Actual:**
- Both IDENTICAL
- Both have many inherited permissions
- Status: match ✓ (both)

**Analysis:**
- Identical behavior

---

### 11. Bidding/Commercial Proposal/Admin Only
**Expected (Both):** admin (organizer); mo.abuomar (writer)

**PRJ-019 & PRJ-020 Actual:**
- Both IDENTICAL
- Both have extra: Projects-Managers (reader)
- Status: extra ❌ (both)

**Analysis:**
- Identical behavior

---

## 🔍 Root Cause Analysis

### Finding 1: HSE-Team Writer on PRJ-020 Bidding
**Where it comes from:**
- The **Bidding folder** in PRJ-020 has HSE-Team set directly as **writer**
- The **Bidding folder** in PRJ-019 has HSE-Team set as **reader**

**Why this happened:**
- Likely someone manually edited the Bidding folder permissions in Drive
- OR the enforcement job set it incorrectly on PRJ-020

### Finding 2: Vendors Quotations Subfolders Have Extras in PRJ-020
**Where it comes from:**
- The **Vendors Quotations folder** itself has technical-team + projects-control set
- These permissions inherit down to all 4 subfolders
- PRJ-019's Vendors Quotations folder does NOT have these permissions

**Why this happened:**
- Same as above - manual edit or enforcement bug

---

## ✅ Next Steps

1. **Check Drive directly:** Look at the actual Bidding and Vendors Quotations folders in Drive to see what permissions are set
2. **Check enforcement logs:** See if enforcement set these permissions or if they were manually added
3. **Fix the discrepancy:** Decide which is correct and update the other project to match
4. **Prevent future drift:** Ensure enforcement always sets consistent permissions

