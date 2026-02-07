# 🎯 INSERT TEMPLATE - SIMPLE STEPS

## Prisma Studio is Opening...

You should see a browser window open at `http://localhost:5555`

---

## STEPS TO INSERT TEMPLATE:

### 1. In Prisma Studio (browser):
   - Click on `folder_templates` table on the left
   - Click **"Add record"** button (top right)

### 2. Fill in the fields:
   
   **version_number:** `1`
   
   **template_json:** 
   - Click into the JSON field
   - Open `template_output.json` in VSCode
   - **CTRL+A** (select all)
   - **CTRL+C** (copy)
   - Go back to Prisma Studio
   - **CTRL+V** (paste into the template_json field)
   
   **is_active:** `true` (checkbox - tick it)
   
   **created_by:** `"system_seed"`
   
   **notes:** `"Production template from template_output.json"`

### 3. Click **"Save 1 change"** button (bottom right)

---

## ✅ VERIFY:

You should see the new record appear with:
- A UUID in the `id` field
- `version_number: 1`
- `is_active: true`
- Large JSON in `template_json`

---

## 🚀 NEXT STEP:

Once template is saved, close Prisma Studio and we'll test the reset API!

---

**Time:** 2 minutes  
**Difficulty:** Copy-paste
