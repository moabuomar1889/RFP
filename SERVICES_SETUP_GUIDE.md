# دليل إعداد Services و OAuth Scopes

## المشكلة
بعض الصلاحيات لا يمكن حذفها حتى من قبل Owner بسبب قيود في Google Drive API.

## الحلول المطلوبة

### 1. تفعيل Advanced Services

تأكد من تفعيل Advanced Services التالية في Apps Script:

1. **افتح Apps Script Project**
2. اذهب إلى **Extensions → Apps Script Services**
3. تأكد من تفعيل:
   - ✅ **Admin SDK API** (AdminDirectory)
   - ✅ **Drive API**

### 2. OAuth Scopes المطلوبة

الـ Scopes التالية موجودة في `appsscript.json`:
- ✅ `https://www.googleapis.com/auth/drive`
- ✅ `https://www.googleapis.com/auth/drive.metadata`
- ✅ `https://www.googleapis.com/auth/admin.directory.*`

### 3. Domain-wide Delegation (اختياري - للمستخدمين العاديين)

إذا كنت **Super Admin**، لا تحتاج إلى Domain-wide Delegation.

إذا كنت **مستخدم عادي** وتريد استخدام `useDomainAdminAccess`:
1. اذهب إلى **Google Cloud Console**
2. **APIs & Services → Credentials**
3. أنشئ **Service Account**
4. فعّل **Domain-wide Delegation**
5. أضف الـ Scopes المطلوبة

### 4. إعادة تفويض الصلاحيات

بعد أي تغيير في OAuth Scopes:
1. افتح **Web App**
2. وافق على الصلاحيات الجديدة
3. أعد تفويض الصلاحيات للمستخدمين

### 5. التحقق من صلاحيات المستخدم

تأكد من أن المستخدم الحالي:
- ✅ لديه دور **Manager/Organizer** على Shared Drive
- ✅ لديه صلاحيات **Super Admin** (إذا كنت تستخدم `useDomainAdminAccess`)
- ✅ هو **Owner** للمجلد أو Shared Drive

## ملاحظات مهمة

### لماذا لا يمكن حذف بعض الصلاحيات؟

1. **صلاحيات موروثة**: الصلاحيات الموروثة من Shared Drive أو المجلدات الأب لا يمكن حذفها من مستوى المجلد
2. **صلاحيات محمية**: بعض الصلاحيات محمية من قبل إعدادات Shared Drive
3. **صلاحيات من مستخدم آخر**: إذا أنشأ الصلاحية مستخدم آخر لديه صلاحيات أعلى، قد لا يمكن حذفها

### الحل البديل

إذا استمرت المشكلة:
1. استخدم **Google Drive UI** لحذف الصلاحيات يدوياً
2. أو استخدم **Google Admin Console** لإدارة الصلاحيات على مستوى Shared Drive

## التحقق من الإعدادات

### 1. التحقق من Advanced Services
```javascript
// في Apps Script Editor
// Extensions → Apps Script Services
// تأكد من وجود:
// - Admin SDK API (AdminDirectory)
// - Drive API
```

### 2. التحقق من OAuth Scopes
```javascript
// في Apps Script Editor
// View → Show manifest file (appsscript.json)
// تأكد من وجود جميع الـ scopes المطلوبة
```

### 3. التحقق من صلاحيات المستخدم
```javascript
// في Apps Script Editor
// Run → getAuthInfo()
// تحقق من أن isAdmin = true
```

## الخطوات التالية

1. ✅ تأكد من تفعيل Advanced Services
2. ✅ أعد تفويض الصلاحيات
3. ✅ جرب "Clean Permissions" مرة أخرى
4. ✅ تحقق من الـ Logs للتفاصيل





