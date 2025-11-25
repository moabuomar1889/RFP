# تقرير إصلاح مشاكل الصلاحيات

## المشاكل التي تم اكتشافها وإصلاحها:

### 1. ✅ إصلاح `appsscript.json` - إزالة التكرار في OAuth Scopes
**المشكلة:** 
- `https://www.googleapis.com/auth/drive` موجود مرتين (السطر 25 و 33)
- `https://www.googleapis.com/auth/drive.file` موجود لكن `drive` أوسع منه

**الإصلاح:**
- تم إزالة التكرار
- تم إزالة `drive.file` لأن `drive` يغطيه

### 2. ✅ إضافة `useDomainAdminAccess` في `applyAccessPolicyToFile`
**المشكلة:** 
- `Drive.Permissions.insert` لا يستخدم `useDomainAdminAccess` مما يسبب مشاكل في Shared Drives

**الإصلاح:**
- تم إضافة `useDomainAdminAccess: true` إلى `Drive.Permissions.insert`

### 3. ✅ إضافة `useDomainAdminAccess` في `Drive.Files.patch`
**المشكلة:** 
- `Drive.Files.patch` لا يستخدم `useDomainAdminAccess` في عدة أماكن

**الإصلاح:**
- تم إضافة `useDomainAdminAccess: true` إلى جميع استدعاءات `Drive.Files.patch`

### 4. ✅ إضافة `useDomainAdminAccess` في `Drive.Files.remove`
**المشكلة:** 
- `Drive.Files.remove` في `monitorAndDeleteBlockedFiles` لا يستخدم `useDomainAdminAccess`

**الإصلاح:**
- تم إضافة `useDomainAdminAccess: true` إلى `Drive.Files.remove`

## ما يجب عليك فعله:

### 1. تفعيل Advanced Services في Google Apps Script:
1. افتح مشروع Apps Script
2. اذهب إلى **Extensions** → **Apps Script Services**
3. تأكد من تفعيل:
   - ✅ **Admin SDK API** (AdminDirectory)
   - ✅ **Drive API**

### 2. تفعيل Domain-wide Delegation (إذا لزم الأمر):
إذا كنت تواجه مشاكل في الصلاحيات:
1. اذهب إلى **Google Cloud Console**
2. افتح مشروع Apps Script
3. اذهب إلى **APIs & Services** → **Credentials**
4. أنشئ **Service Account** أو استخدم الموجود
5. فعّل **Domain-wide Delegation**
6. أضف Scopes المطلوبة

### 3. التأكد من الصلاحيات في Google Workspace Admin Console:
1. اذهب إلى **Admin Console**
2. **Security** → **API Controls** → **Domain-wide Delegation**
3. تأكد من أن Service Account لديه الصلاحيات المطلوبة

### 4. إعادة تفويض الصلاحيات:
بعد التعديلات، قد تحتاج إلى:
1. فتح Web App
2. الموافقة على الصلاحيات الجديدة
3. إعادة تفويض الصلاحيات للمستخدمين

## ملاحظات مهمة:

- `useDomainAdminAccess: true` ضروري للعمل مع Shared Drives
- يجب أن يكون المستخدم الذي يشغل السكربت لديه صلاحيات Admin في Google Workspace
- بعض العمليات قد تحتاج إلى Domain-wide Delegation

## الاختبار:

بعد التعديلات، اختبر:
1. إنشاء مشروع جديد
2. تطبيق الصلاحيات على المجلدات
3. إضافة/إزالة المجموعات
4. حذف الملفات المحظورة





