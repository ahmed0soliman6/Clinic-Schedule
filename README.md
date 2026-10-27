# مجمع ميت عزون الطبي — منصة إدارة ونشر جدول العيادات (Clinic-Schedule)

تطبيق ويب تقدمي (PWA) مبني بـ **React + Vite + Firebase** لإدارة ومشاركة جدول عيادات مجمع ميت عزون الطبي (جمعية تنمية المجتمع المحلي - مشهرة برقم 2406).

---

## خطوات إعداد الإشعارات اليومية والجدولة التلقائية (4 خطوات)

لتشغيل نظام الإشعار اليومي لمسؤولي الجدول في بيئة الإنتاج على **Vercel** و**GitHub Actions**، اتبع الخطوات الأربع التالية:

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
3. أعد نشر المشروع (**Redeploy**) لتفعيل المتغيرات.

### 4) إضافة `CRON_SECRET` و`SITE_URL` في GitHub Actions Secrets
1. افتح مستودع المشروع على **GitHub** وانتقل إلى **Settings > Secrets and variables > Actions**.
2. أضف الـ Repository Secrets التالية:
   - `CRON_SECRET`: نفس القيمة السرية التي وضعتها في Vercel بالضبط.
   - `SITE_URL`: رابط موقعك الأساسي على Vercel بدون `/` في النهاية (مثال: `https://clinic-schedule.vercel.app`).
3. سيعمل ملف `.github/workflows/reminders.yml` تلقائياً كل 10 دقائق لفحص وقت التذكير بتوقيت القاهرة (`Africa/Cairo`) وإرسال الإشعار لمسؤولي الجدول، كما يمكنك تشغيله يدوياً من تبويب **Actions > Daily Clinic Schedule Reminders > Run workflow**.

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
