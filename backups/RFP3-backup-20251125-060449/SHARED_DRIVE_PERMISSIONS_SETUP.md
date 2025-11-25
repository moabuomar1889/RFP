# دليل إعداد الصلاحيات في Shared Drive

## المشكلة
الصلاحيات المطبقة من السكريبت لا تعمل في Google Drive لأن Shared Drive له قواعد خاصة.

---

## الحلول الموصى بها

### 1️⃣ استخدام DLP (Data Loss Prevention) + Drive Labels

#### المتطلبات:
- Google Workspace Enterprise Plus أو Enterprise Standard
- صلاحيات Super Admin

#### الخطوات:

##### أ. تفعيل Drive Labels API:
1. اذهب إلى **Admin Console** → **Security** → **Access and data control** → **API controls**
2. فعّل **Drive Labels API**
3. احفظ التغييرات

##### ب. إنشاء Drive Label:
1. اذهب إلى **Admin Console** → **Security** → **Data protection** → **Labels**
2. اضغط **Create Label**
3. اختر **Drive Label**
4. أدخل:
   - **Label Name**: "Limited Access Files"
   - **Description**: "Files that require group-based access"
5. احفظ Label

##### ج. ربط Label مع DLP Policy:
1. اذهب إلى **Admin Console** → **Security** → **Data protection** → **DLP**
2. اضغط **Create Rule**
3. اختر **Drive** كـ Data Source
4. في **Conditions**:
   - اختر **Label** → **Limited Access Files**
5. في **Actions**:
   - اختر **Restrict sharing**
   - حدد **Only specific groups can access**
   - أضف المجموعات المطلوبة
6. احفظ القاعدة

---

### 2️⃣ استخدام Trust Rules في Admin Console

#### الخطوات:

##### أ. تفعيل Trust Rules:
1. اذهب إلى **Admin Console** → **Security** → **Access and data control** → **API controls**
2. ابحث عن **Trust Rules** أو **Drive sharing settings**
3. فعّل **Trust Rules**

##### ب. إنشاء Trust Rule:
1. اذهب إلى **Admin Console** → **Security** → **Access and data control** → **Trust Rules**
2. اضغط **Create Rule**
3. حدد:
   - **Rule Name**: "Limited Access Folders"
   - **Scope**: Shared Drive (اختر Shared Drive الخاص بك)
   - **Condition**: Files with specific label أو Files in specific folders
   - **Action**: Restrict sharing to specific groups
4. احفظ القاعدة

---

### 3️⃣ مراجعة إعدادات Shared Drive

#### الخطوات:

##### أ. فحص إعدادات Shared Drive:
1. اذهب إلى **Admin Console** → **Apps** → **Google Workspace** → **Drive and Docs**
2. اضغط على **Shared drives**
3. اختر Shared Drive الخاص بك
4. تحقق من:
   - **Sharing settings**: يجب أن تكون "Allow sharing outside organization" حسب الحاجة
   - **Member access**: تحقق من الصلاحيات الافتراضية

##### ب. إعدادات الصلاحيات:
1. في نفس الصفحة، اذهب إلى **Sharing settings**
2. فعّل **Prevent members from sharing files outside the organization** (اختياري)
3. فعّل **Prevent members from downloading, copying, or printing files** (اختياري - للحماية الإضافية)

---

### 4️⃣ استخدام Drive API مباشرة (تعديل السكريبت)

إذا لم تكن لديك Enterprise Plus، يمكن تعديل السكريبت لاستخدام طرق أخرى:

#### أ. استخدام `useDomainAdminAccess`:
```javascript
Drive.Permissions.insert(body, fileId, { 
  supportsAllDrives: true,
  useDomainAdminAccess: true,  // إضافة هذا
  sendNotificationEmails: false 
});
```

#### ب. التأكد من إزالة الصلاحيات الموروثة:
```javascript
// إزالة جميع الصلاحيات الموروثة من المجلد
const file = Drive.Files.get(fileId, {
  supportsAllDrives: true,
  fields: 'parents,permissions'
});

// إزالة الصلاحيات الموروثة
if (file.parents && file.parents.length > 0) {
  // إزالة الصلاحيات من الملف
  // ثم إضافة الصلاحيات الجديدة
}
```

---

## الحل البديل: استخدام Groups مع Permissions

### الخطوات:

#### 1. إنشاء Google Groups:
1. اذهب إلى **Admin Console** → **Groups**
2. أنشئ المجموعات المطلوبة (مثلاً: Engineering Team, Management)

#### 2. إضافة الأعضاء للمجموعات:
- أضف المستخدمين للمجموعات من تبويب "Groups & Members" في السكريبت

#### 3. التأكد من تطبيق الصلاحيات:
- استخدم "Apply Protection to All" في السكريبت
- تحقق من السجلات (Logs) للتأكد من نجاح العملية

---

## التحقق من عمل الصلاحيات

### 1. من حساب Admin:
1. افتح Google Drive
2. اذهب إلى Shared Drive
3. افتح ملف محمي
4. اضغط بزر الماوس الأيمن → **Share**
5. تحقق من الصلاحيات:
   - يجب أن ترى فقط المجموعات المحددة
   - لا يجب أن ترى "Anyone in the organization"

### 2. من حساب عادي (غير عضو في المجموعة):
1. سجل دخول من حساب آخر
2. حاول الوصول للملف المحمي
3. يجب أن ترى رسالة "You need permission" أو لا ترى الملف أصلاً

### 3. من حساب عضو في المجموعة:
1. سجل دخول من حساب عضو في المجموعة المحددة
2. يجب أن تتمكن من الوصول للملف
3. الصلاحيات يجب أن تكون حسب الدور المحدد (Reader/Commenter/Writer)

---

## استكشاف الأخطاء

### المشكلة: الصلاحيات لا تعمل
**الحلول:**
1. تحقق من أن المجموعات موجودة في Google Workspace
2. تحقق من أن عناوين البريد الإلكتروني للمجموعات صحيحة
3. تحقق من السجلات (Logs) في السكريبت
4. تأكد من أن Shared Drive يسمح بتطبيق الصلاحيات

### المشكلة: الملفات ما زالت مرئية للجميع
**الحلول:**
1. استخدم "Apply Protection to All" مرة أخرى
2. تحقق من أن `limitedAccess = true` في القالب
3. تأكد من أن المجموعات محددة بشكل صحيح
4. راجع إعدادات Shared Drive في Admin Console

### المشكلة: لا يمكن إزالة صلاحيات domain
**الحلول:**
1. في Shared Drive، قد لا يمكن إزالة صلاحيات domain من الملفات
2. استخدم DLP أو Trust Rules كحل بديل
3. أو استخدم Drive Labels للتصنيف

---

## ملاحظات مهمة

1. **Shared Drive Limitations**: في Shared Drive، الملفات قد ترث الصلاحيات من المجلدات ولا يمكن منع ذلك دائماً
2. **Enterprise Features**: DLP و Drive Labels تتطلب Google Workspace Enterprise Plus
3. **Admin Permissions**: تحتاج صلاحيات Super Admin لتطبيق بعض الإعدادات
4. **Testing**: اختبر الصلاحيات من حسابات مختلفة للتأكد من عملها

---

## الخطوات التالية

1. ✅ راجع إعدادات Shared Drive في Admin Console
2. ✅ إذا كان لديك Enterprise Plus: فعّل DLP و Drive Labels
3. ✅ أنشئ المجموعات المطلوبة
4. ✅ طبق الصلاحيات من السكريبت
5. ✅ اختبر الصلاحيات من حسابات مختلفة





