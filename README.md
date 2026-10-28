# مجمع ميت عزون الطبي — منصة إدارة ونشر جدول العيادات (Clinic-Schedule)

تطبيق ويب تقدمي (PWA) مبني بـ **React + Vite + Firebase** لإدارة ومشاركة جدول عيادات مجمع ميت عزون الطبي (جمعية تنمية المجتمع المحلي - مشهرة برقم 2406).

---

## خطوات إعداد الإشعارات اليومية والنشر التلقائي على فيسبوك

لتشغيل نظام الإشعار اليومي لمسؤولي الجدول والنشر التلقائي اليومي على صفحة فيسبوك في بيئة الإنتاج على **Vercel**، اتبع الخطوات التالية:

### 1) استخراج مفتاح `VITE_FIREBASE_VAPID_KEY` من Firebase Console
1. افتح [Firebase Console](https://console.firebase.google.com/) واختر مشروع **`mitazoun-schedule`**.
2. انتقل إلى **Project Settings (إعدادات المشروع)** > تبويب **Cloud Messaging**.
3. في قسم **Web configuration (Web Push certificates)**، انسخ مفتاح الـ **Key pair** العام (أو اضغط **Generate key pair** إذا لم يكن موجوداً).
4. ضع القيمة في متغير البيئة `VITE_FIREBASE_VAPID_KEY`.

### 2) استخراج `FIREBASE_SERVICE_ACCOUNT_JSON`
1. من **Project Settings** في Firebase Console، افتح تبويب **Service accounts**.
2. اضغط على زر **Generate new private key** لتحميل ملف JSON الخاص بحساب الخدمة.
3. انسخ محتوى ملف الـ JSON بالكامل (كسطر نصي واحد أو JSON كامل) وضعه في متغير البيئة `FIREBASE_SERVICE_ACCOUNT_JSON`.

### 3) إضافة المتغيرات في Vercel Environment Variables
1. افتح لوحة تحكم مشروعك على **Vercel** ثم انتقل إلى **Settings > Environment Variables**.
2. أضف المتغيرات التالية لبيئة `Production` (و`Preview` عند الحاجة):
   - `VITE_FIREBASE_VAPID_KEY`: مفتاح Web Push العام من الخطوة (1).
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: محتوى ملف JSON لحساب الخدمة من الخطوة (2).
   - `CRON_SECRET`: كلمة سر عشوائية قوية تختارها لحماية نقطة `/api/send-reminders`.
   - `FB_PAGE_ID`: رقم معرّف صفحة فيسبوك (Page ID).
   - `FB_PAGE_ACCESS_TOKEN`: رمز وصول الصفحة الدائم (Page Access Token) بصلاحيات `pages_manage_posts` و`pages_read_engagement`.
3. أعد نشر المشروع (**Redeploy**) لتفعيل المتغيرات.

> **ملاحظة مهمة:** إعدادات **GitHub Actions Secrets** منفصلة تماماً عن **Vercel Environment Variables**؛ الكود الذي يعمل داخل Vercel يقرأ المتغيرات من إعدادات Vercel فقط، بينما يستخدم GitHub Actions أو `cron-job.org` قيمة `CRON_SECRET` لاستدعاء الرابط الخارجي لموقعك.

---

### 4) إعداد المجدول الأساسي المجاني عبر `cron-job.org` (موصى به لضمان الدقة كل 5 دقائق)
نظراً لأن مجدول GitHub Actions المجاني قد يتأخر أحياناً في أوقات الذروة، يُنصح بربط خدمة **[cron-job.org](https://cron-job.org)** المجانية كمجدول أساسي بجانب GitHub Actions:
1. أنشئ حساباً مجانياً على موقع [cron-job.org](https://cron-job.org) واضغط **Create cronjob**.
2. في حقل **Title**: اكتب `Clinic Schedule Auto-Post & Reminders`.
3. في حقل **URL**: ضع رابط نقطة النهاية في موقعك على Vercel:
   `https://<YOUR_VERCEL_DOMAIN>/api/send-reminders`
   *(مثال: `https://mitazoun-schedule.vercel.app/api/send-reminders`)*.
4. في قسم **Execution schedule**: اختر **Every 5 minutes** (كل 5 دقائق).
5. افتح تبويب **Advanced** (أو **Headers**):
   - اختر طريقة الطلب (**Request method**): `GET`.
   - أضف ترويسة (**Header**) جديدة:
     - **Key**: `Authorization`
     - **Value**: `Bearer <CRON_SECRET>` *(استبدل `<CRON_SECRET>` بنفس القيمة السرية الموضوعة في Vercel Environment Variables)*.
6. اضغط **Create** لتفعيل المجدول، ويمكنك الضغط على **Test run** للتأكد من عودة الاستجابة `HTTP 200` وتحديث مؤشر «آخر تشغيل للمجدول» داخل نافذة الإشعارات والنشر التلقائي في التطبيق.

### 5) إعداد `.github/workflows/reminders.yml` كمجدول احتياطي (Backup)
1. افتح مستودع المشروع على **GitHub** وانتقل إلى **Settings > Secrets and variables > Actions**.
2. أضف الـ Repository Secrets التالية:
   - `CRON_SECRET`: نفس القيمة السرية التي وضعتها في Vercel بالضبط.
   - `SITE_URL`: رابط موقعك الأساسي على Vercel بدون `/` في النهاية (مثال: `https://mitazoun-schedule.vercel.app`).
3. يعمل ملف `.github/workflows/reminders.yml` كل 5 دقائق (`*/5 * * * *`) ويطبع كود حالة HTTP وجسم الاستجابة، ويفشل الـ Job تلقائياً إذا لم تكن الاستجابة `2xx`.

---

## الأوامر البرمجية

```bash
# فحص الأنواع (TypeScript)
npx tsc --noEmit

# تشغيل الاختبارات (Unit Tests)
npm test

# بناء نسخة الإنتاج (Production Build + Service Worker InjectManifest)
npm run build
```
