# دليل شامل: التحقق من إعدادات Shared Drive في Admin Console

## 📋 لماذا هذا مهم؟

عندما تحاول تطبيق "Limited Access" على مجلد في Shared Drive، قد تواجه تحذير:
```
Warning: 1 domain permission(s) still exist
```

هذا يعني أن **صلاحيات Domain** لا تزال موجودة على المجلد، وقد تكون **موروثة** من إعدادات Shared Drive نفسه.

---

## 🔍 الخطوة 1: الوصول إلى Admin Console

### 1.1 تسجيل الدخول:
1. افتح المتصفح واذهب إلى: **https://admin.google.com**
2. سجل الدخول بحساب **Super Admin** (حساب المسؤول الرئيسي)
3. تأكد من أن لديك صلاحيات **Super Admin** وليس فقط **Admin**

### 1.2 الوصول إلى إعدادات Drive:
1. من القائمة الجانبية، اضغط على **"Apps"** (التطبيقات)
2. اضغط على **"Google Workspace"**
3. اضغط على **"Drive and Docs"** (Drive والمستندات)

---

## ⚙️ الخطوة 2: إعدادات Shared Drives

### 2.1 الوصول إلى إعدادات Shared Drives:
1. في صفحة "Drive and Docs"، ابحث عن قسم **"Shared drives"** (المحركات المشتركة)
2. اضغط على **"Shared drives"** أو **"Manage shared drives"**

### 2.2 الإعدادات المهمة:

#### أ) **Default access level** (مستوى الوصول الافتراضي):
- **الموقع:** `Shared drives` → `Default access level`
- **ما يجب التحقق منه:**
  - يجب أن يكون **"Viewer"** أو **"Commenter"** وليس **"Content manager"** أو **"Manager"**
  - **لا يجب** أن يكون **"Full access"** أو **"Organizer"**

#### ب) **Sharing settings** (إعدادات المشاركة):
- **الموقع:** `Shared drives` → `Sharing settings`
- **ما يجب التحقق منه:**
  - ✅ **"Allow users in your organization to create shared drives"** - يمكن تفعيله
  - ❌ **"Allow users to share files outside your organization"** - يجب تعطيله للأمان
  - ❌ **"Allow users to share files with anyone"** - يجب تعطيله للأمان

#### ج) **Default sharing permissions** (صلاحيات المشاركة الافتراضية):
- **الموقع:** `Shared drives` → `Default sharing permissions`
- **ما يجب التحقق منه:**
  - ✅ **"Only people in your organization can access"** - يجب تفعيله
  - ❌ **"Anyone with the link can access"** - يجب تعطيله
  - ❌ **"Public on the web"** - يجب تعطيله

---

## 🎯 الخطوة 3: إعدادات Shared Drive المحدد

### 3.1 الوصول إلى Shared Drive المحدد:
1. في صفحة "Shared drives"، ابحث عن **Shared Drive** الذي تستخدمه (مثلاً: "DTG Projects")
2. اضغط على اسم **Shared Drive**

### 3.2 التحقق من إعدادات Shared Drive:

#### أ) **Access settings** (إعدادات الوصول):
- **الموقع:** داخل Shared Drive → `Settings` → `Access`
- **ما يجب التحقق منه:**
  - ✅ **"Only people in your organization can access"** - يجب تفعيله
  - ❌ **"Anyone with the link can access"** - يجب تعطيله
  - ❌ **"Public on the web"** - يجب تعطيله

#### ب) **Default member permissions** (صلاحيات الأعضاء الافتراضية):
- **الموقع:** داخل Shared Drive → `Settings` → `Members`
- **ما يجب التحقق منه:**
  - يجب أن يكون **"Viewer"** أو **"Commenter"** وليس **"Content manager"** أو **"Manager"**
  - **لا يجب** أن يكون **"Full access"** أو **"Organizer"**

#### ج) **Sharing restrictions** (قيود المشاركة):
- **الموقع:** داخل Shared Drive → `Settings` → `Sharing`
- **ما يجب التحقق منه:**
  - ✅ **"Only people in your organization can access"** - يجب تفعيله
  - ❌ **"Allow sharing outside your organization"** - يجب تعطيله

---

## 🔧 الخطوة 4: إزالة Domain Permissions من Shared Drive

### 4.1 المشكلة:
إذا كان Shared Drive لديه **Domain Permission** على مستوى **Shared Drive نفسه**، فإن جميع المجلدات والملفات داخله **ترث** هذه الصلاحية.

### 4.2 الحل:

#### الطريقة 1: من Admin Console (الأسهل):
1. اذهب إلى **Shared Drive** المحدد
2. اضغط على **"Settings"** (الإعدادات)
3. ابحث عن **"Access"** أو **"Permissions"**
4. ابحث عن أي **"Domain"** permission
5. إذا وجدت، **احذفها** أو **غيّرها** إلى **"Viewer"** فقط

#### الطريقة 2: من Google Drive مباشرة:
1. افتح **Google Drive** (https://drive.google.com)
2. ابحث عن **Shared Drive** المحدد
3. اضغط بزر الماوس الأيمن على **Shared Drive**
4. اضغط على **"Share"** (مشاركة)
5. ابحث عن **"yourdomain.com"** في قائمة الصلاحيات
6. إذا وجدت، **احذفها** أو **غيّرها** إلى **"Viewer"** فقط

#### الطريقة 3: من الكود (للمطورين):
```javascript
// إزالة Domain Permission من Shared Drive
function removeDomainPermissionFromSharedDrive(sharedDriveId) {
  try {
    // الحصول على جميع الصلاحيات
    const perms = Drive.Permissions.list(sharedDriveId, {
      supportsAllDrives: true,
      useDomainAdminAccess: true
    });
    
    // البحث عن Domain Permission
    const domainPerms = (perms.items || []).filter(p => p.type === 'domain');
    
    // حذف Domain Permissions
    domainPerms.forEach(perm => {
      try {
        Drive.Permissions.remove(sharedDriveId, perm.id, {
          supportsAllDrives: true,
          useDomainAdminAccess: true
        });
        console.log(`Removed domain permission: ${perm.id}`);
      } catch (e) {
        console.error(`Could not remove domain permission: ${e.message}`);
      }
    });
    
    return `Removed ${domainPerms.length} domain permission(s)`;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    throw err;
  }
}
```

---

## 📊 الخطوة 5: التحقق من الصلاحيات

### 5.1 من Admin Console:
1. اذهب إلى **Shared Drive** المحدد
2. اضغط على **"Settings"** → **"Access"**
3. تحقق من أن **لا يوجد** **"Domain"** permission
4. تحقق من أن **فقط** المجموعات المحددة لديها صلاحيات

### 5.2 من Google Drive:
1. افتح **Google Drive**
2. ابحث عن **Shared Drive** المحدد
3. اضغط بزر الماوس الأيمن → **"Share"**
4. تحقق من أن **لا يوجد** **"yourdomain.com"** في قائمة الصلاحيات
5. تحقق من أن **فقط** المجموعات المحددة لديها صلاحيات

### 5.3 من الكود (استخدام Test Folder Permissions):
1. افتح التطبيق
2. اذهب إلى **"Groups & Members"** → **"Test Folder Permissions"**
3. أدخل **Folder ID** للمجلد الذي تريد التحقق منه
4. اضغط **"Test"**
5. تحقق من أن **"domain"** count = **0**
6. تحقق من أن **"groups"** count = **عدد المجموعات المحددة**

---

## ⚠️ ملاحظات مهمة:

### 1. **الوراثة (Inheritance)**:
- في Shared Drive، الصلاحيات **ترث** من المستوى الأعلى
- إذا كان Shared Drive لديه Domain Permission، **جميع** المجلدات والملفات داخله ترث هذه الصلاحية
- **لا يمكن** إزالة الصلاحيات الموروثة من المستوى الأدنى

### 2. **Domain Permissions**:
- Domain Permissions تعني أن **جميع** المستخدمين في المؤسسة لديهم صلاحية معينة
- في Shared Drive، Domain Permissions **موروثة** ولا يمكن إزالتها بسهولة
- **الحل:** إزالة Domain Permission من **Shared Drive نفسه** أولاً

### 3. **Group Permissions**:
- Group Permissions تعني أن **فقط** أعضاء المجموعة لديهم صلاحية معينة
- Group Permissions **لا ترث** من Domain Permissions
- **الحل:** إضافة Group Permissions **بعد** إزالة Domain Permissions

---

## 🎯 الخلاصة:

### الخطوات المطلوبة:
1. ✅ **التحقق من إعدادات Shared Drive** في Admin Console
2. ✅ **إزالة Domain Permissions** من Shared Drive نفسه
3. ✅ **تطبيق Group Permissions** على المجلدات المحددة
4. ✅ **التحقق من الصلاحيات** باستخدام Test Folder Permissions

### النتيجة المتوقعة:
- ✅ **لا يوجد** Domain Permissions على المجلدات المحمية
- ✅ **فقط** المجموعات المحددة لديها صلاحيات
- ✅ **المستخدمون الآخرون** لا يستطيعون رؤية المجلدات المحمية

---

## 📞 إذا استمرت المشكلة:

### 1. **تحقق من Logs**:
- افتح **"Groups & Members"** → **"Recent Logs"**
- ابحث عن تحذيرات **"domain permission(s) still exist"**
- تحقق من **"DEBUG: Full node structure"** لمعرفة المجموعات المخزنة

### 2. **تحقق من القالب**:
- افتح **"Folder Structure"**
- اختر المجلد المحمي
- تحقق من قائمة **"Allowed Groups"**
- تأكد من أن **فقط** المجموعات المطلوبة موجودة

### 3. **اتصل بالدعم**:
- إذا استمرت المشكلة، قد تحتاج إلى **Super Admin** لإزالة Domain Permissions
- أو قد تحتاج إلى **Google Workspace Support** للمساعدة

---

## 🔗 روابط مفيدة:

- **Admin Console:** https://admin.google.com
- **Google Drive:** https://drive.google.com
- **Shared Drive Settings:** https://admin.google.com/ac/appslist/core/drive/shareddrives
- **Drive API Documentation:** https://developers.google.com/drive/api/v2/reference

---

**آخر تحديث:** 2025-01-19





