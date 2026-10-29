import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type {
  CenterSettings,
  DailyScheduleData,
  DayId,
  FacebookPostMode,
  PublicDailyScheduleData,
  ReminderSettings,
  ScheduleRow,
} from '../src/types/schedule.js';
import {
  decideFacebookPublishPlan,
} from '../src/utils/facebookPostLogic.js';
import { resolveTargetDayId } from '../src/utils/reminderLogic.js';
import {
  DAYS_LIST,
  DEFAULT_POST_TEMPLATE,
  WHATSAPP_CHANNEL_SHORT_URL,
  buildDailySocialPostText,
  emailToDocId,
  filterNonEmptyRows,
  PRIMARY_ADMIN_EMAIL,
} from '../src/utils/scheduleLogic.js';

export interface VercelRequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface VercelResponseLike {
  status: (code: number) => VercelResponseLike;
  json: (body: Record<string, unknown>) => void;
}

const DEFAULT_CENTER_SETTINGS: CenterSettings = {
  complexName: 'مجمع ميت عزون الطبي',
  associationName: 'جمعية تنمية المجتمع المحلي',
  registrationNumber: 'مشهرة برقم 2406',
  rightLogoUrl: '/logos/complex-logo.svg',
  leftLogoUrl: '/logos/association-logo.svg',
  address: 'ميت عزون - بجوار المسجد الكبير',
  whatsappPhone: '01202027567',
  landlinePhone: '0502053187',
  dentalPhone: '01515674347',
  dentalLabel: 'عيادة الأسنان',
  bgStartColor: '#f3effb',
  bgEndColor: '#e8dff5',
  clinicHeaderColor: '#f59e0b',
  doctorHeaderColor: '#0d9456',
  fromHeaderColor: '#f59e0b',
  toHeaderColor: '#0088cc',
  footerBgColor: '#1e295b',
  postTemplate: DEFAULT_POST_TEMPLATE,
};

function normalizeEnvSecret(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizeFacebookPageId(raw?: string): string {
  const clean = normalizeEnvSecret(raw);
  if (!clean) return '';
  try {
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      const url = new URL(clean);
      const idParam = url.searchParams.get('id');
      if (idParam && idParam.trim()) {
        return idParam.trim();
      }
      const segments = url.pathname
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length > 0) {
        return segments[segments.length - 1];
      }
    }
  } catch {
    // Ignore URL parse error
  }
  return clean;
}

function formatClinicRowForFacebook(row: ScheduleRow): string {
  const rawClinic = (row.clinicName || '').trim();
  const rawDoctor = (row.doctorName || '').trim();
  const start = (row.startTime || '').trim();
  const end = (row.endTime || '').trim();

  const clinicLabel = rawClinic.startsWith('عيادة')
    ? rawClinic
    : `عيادة ${rawClinic}`;

  const hasDoctorPrefix =
    rawDoctor.startsWith('د.') ||
    rawDoctor.startsWith('د/') ||
    rawDoctor.startsWith('د ') ||
    rawDoctor.startsWith('دكتور');
  const doctorLabel = hasDoctorPrefix ? rawDoctor : `د/ ${rawDoctor}`;

  return `🔹 ${clinicLabel} — ${doctorLabel} (من ${start} إلى ${end})`;
}

function formatFacebookScheduleFullText(params: {
  dayLabel: string;
  rows: ScheduleRow[];
  settings: CenterSettings;
}): string {
  const { dayLabel, rows, settings } = params;
  const cleanRows = filterNonEmptyRows(rows || []);

  const clinicsBlock =
    cleanRows.length > 0
      ? cleanRows.map((row) => formatClinicRowForFacebook(row)).join('\n')
      : 'لا توجد عيادات مسجلة لهذا اليوم حالياً.';

  const rawTemplate =
    typeof settings.postTemplate === 'string' &&
    settings.postTemplate.trim().length > 0
      ? settings.postTemplate.trim()
      : DEFAULT_POST_TEMPLATE;

  if (rawTemplate.includes('{العيادات}')) {
    const cleanWa = (settings.whatsappPhone || '').replace(/\D/g, '');
    const waIntl = cleanWa.startsWith('2') ? cleanWa : `2${cleanWa}`;
    const waUrl = `https://wa.me/${waIntl}`;
    const dentalLabel = (settings.dentalLabel || 'عيادة الأسنان').trim();

    return rawTemplate
      .replace(/\{اليوم\}/g, dayLabel)
      .replace(/\{المجمع\}/g, settings.complexName)
      .replace(/\{الجمعية\}/g, settings.associationName)
      .replace(/\{العنوان\}/g, settings.address)
      .replace(/\{الواتساب\}/g, settings.whatsappPhone)
      .replace(/\{الأرضي\}/g, settings.landlinePhone)
      .replace(/\{الأسنان\}/g, settings.dentalPhone)
      .replace(/\{تسمية_الأسنان\}/g, dentalLabel)
      .replace(/\{رابط_الواتساب\}/g, waUrl)
      .replace(/\{قناة_الواتساب\}/g, WHATSAPP_CHANNEL_SHORT_URL)
      .replace(/\{العيادات\}/g, clinicsBlock);
  }

  const baseText = buildDailySocialPostText(dayLabel, settings, cleanRows);
  const lines = baseText.split('\n');
  if (lines.length <= 1) {
    return `${baseText}\n\n${clinicsBlock}`;
  }

  const headerLine = lines[0];
  const footerLines = lines.slice(1).join('\n');
  return `${headerLine}\n\n${clinicsBlock}\n\n${footerLines}`;
}

function resolveDayMetaById(dayId?: string | null): {
  dayId: DayId;
  dayLabel: string;
} {
  const clean = (dayId || '').trim().toLowerCase() as DayId;
  const match = DAYS_LIST.find((d) => d.id === clean);
  if (match) {
    return { dayId: match.id, dayLabel: match.label };
  }
  return { dayId: DAYS_LIST[0].id, dayLabel: DAYS_LIST[0].label };
}

function getAdminAppOrNull() {
  try {
    const existing = getApps();
    if (existing.length > 0) {
      return existing[0];
    }
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawJson) {
      return null;
    }
    const serviceAccount = JSON.parse(rawJson);
    return initializeApp({
      credential: cert(serviceAccount),
    });
  } catch {
    return null;
  }
}

function extractBearerToken(
  authHeader: string | string[] | undefined
): string | null {
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  return trimmed.slice(7).trim() || null;
}

function parseRequestBody(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

/**
 * Uploads a poster photo to Facebook Page via Meta Graph API v21.0 /{page-id}/photos
 */
async function publishPhotoToFacebookPage(params: {
  pageId: string;
  accessToken: string;
  jpegBuffer: Buffer;
  caption?: string;
  dayId: string;
}): Promise<{ ok: boolean; post_id?: string; error?: string; statusCode?: number }> {
  const { pageId, accessToken, jpegBuffer, caption, dayId } = params;
  const graphUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
    pageId
  )}/photos`;

  const maxAttempts = 2;
  let lastResult: { ok: boolean; post_id?: string; error?: string; statusCode?: number } = {
    ok: false,
    statusCode: 502,
    error: 'فشل نشر صورة الجدول عبر Meta Graph API v21.0',
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const form = new FormData();
    form.append(
      'source',
      new Blob([new Uint8Array(jpegBuffer)], { type: 'image/jpeg' }),
      `schedule-${dayId}.jpg`
    );
    if (caption && caption.trim().length > 0) {
      form.append('caption', caption.trim());
    }
    form.append('published', 'true');
    form.append('access_token', accessToken);

    try {
      const response = await fetch(graphUrl, {
        method: 'POST',
        body: form,
      });

      const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        post_id?: string;
        error?: {
          message?: string;
          type?: string;
          code?: number;
        };
      };

      if (!response.ok || data.error) {
        const fbErrorMsg =
          data.error?.message || `HTTP ${response.status} من خادم فيسبوك`;
        const fbErrorCode = data.error?.code ? ` (كود ${data.error.code})` : '';

        if (
          response.status === 401 ||
          response.status === 403 ||
          data.error?.code === 190
        ) {
          return {
            ok: false,
            statusCode: response.status || 401,
            error: `⚠️ فشل التحقق من صفحة فيسبوك${fbErrorCode}: انتهت صلاحية مفتاح الصفحة (FB_PAGE_ACCESS_TOKEN) أو الصلاحيات غير كافية (${fbErrorMsg}). تحقق من Vercel Environment Variables.`,
          };
        }

        if (
          response.status === 400 &&
          (data.error?.code === 100 || data.error?.code === 803)
        ) {
          return {
            ok: false,
            statusCode: 400,
            error: `⚠️ معرف صفحة فيسبوك (FB_PAGE_ID) غير صحيح أو المعاملات غير مدعومة${fbErrorCode}: ${fbErrorMsg}`,
          };
        }

        lastResult = {
          ok: false,
          statusCode: response.status || 502,
          error: `فشل نشر صورة الجدول عبر Meta Graph API v21.0${fbErrorCode}: ${fbErrorMsg}`,
        };

        if ([400, 401, 403, 429].includes(response.status)) {
          return lastResult;
        }
      } else {
        const postId = String(data.post_id || data.id || '').trim();
        if (!postId) {
          return {
            ok: false,
            statusCode: 502,
            error: 'لم يُرجع فيسبوك معرف المنشور (post_id). تحقق من صلاحيات تطبيق فيسبوك.',
          };
        }
        return {
          ok: true,
          statusCode: 200,
          post_id: postId,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastResult = {
        ok: false,
        statusCode: 502,
        error: `تعذر الاتصال بخدمة رفع الصور في Meta Graph API v21.0: ${msg}`,
      };
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  return lastResult;
}

/**
 * Publishes text-only post to Facebook Page via Meta Graph API v21.0 /{page-id}/feed
 */
async function publishTextFeedToFacebookPage(params: {
  pageId: string;
  accessToken: string;
  message: string;
}): Promise<{ ok: boolean; post_id?: string; error?: string; statusCode?: number }> {
  const { pageId, accessToken, message } = params;
  const graphUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
    pageId
  )}/feed`;

  try {
    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        access_token: accessToken,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      post_id?: string;
      error?: {
        message?: string;
        type?: string;
        code?: number;
      };
    };

    if (!response.ok || data.error) {
      const fbErrorMsg =
        data.error?.message || `HTTP ${response.status} من خادم فيسبوك`;
      const fbErrorCode = data.error?.code ? ` (كود ${data.error.code})` : '';
      return {
        ok: false,
        statusCode: response.status || 502,
        error: `فشل النشر عبر Meta Graph API v21.0${fbErrorCode}: ${fbErrorMsg}`,
      };
    }

    const postId = String(data.post_id || data.id || '').trim();
    return {
      ok: true,
      statusCode: 200,
      post_id: postId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      statusCode: 502,
      error: `تعذر الاتصال بواجهة Meta Graph API v21.0: ${msg}`,
    };
  }
}

export default async function facebookPostHandler(
  req: VercelRequestLike,
  res: VercelResponseLike
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const bearer = extractBearerToken(
      req.headers.authorization || req.headers.Authorization
    );

    if (!bearer) {
      res.status(401).json({
        ok: false,
        error:
          'مطلوب تسجيل الدخول أو إرسال ترويسة Authorization: Bearer للنشر على فيسبوك.',
      });
      return;
    }

    const cronSecret = normalizeEnvSecret(process.env.CRON_SECRET);
    const isCronAuthorized = Boolean(cronSecret && bearer === cronSecret);

    const adminApp = getAdminAppOrNull();
    const db = adminApp ? getFirestore(adminApp) : null;

    if (!isCronAuthorized && adminApp && db) {
      const adminAuth = getAuth(adminApp);
      const decoded = await adminAuth.verifyIdToken(bearer);
      const email = (decoded.email || '').trim().toLowerCase();
      if (!email) {
        res.status(403).json({
          ok: false,
          error: 'الحساب لا يحتوي على بريد إلكتروني معتمد.',
        });
        return;
      }

      const isSuperAdmin = email === PRIMARY_ADMIN_EMAIL;
      let isAuthorizedStaff = isSuperAdmin;
      if (!isAuthorizedStaff) {
        const userSnap = await db
          .collection('users')
          .doc(emailToDocId(email))
          .get();
        const role = userSnap.data()?.role;
        if (userSnap.exists && (role === 'ADMIN' || role === 'EDITOR')) {
          isAuthorizedStaff = true;
        }
      }

      if (!isAuthorizedStaff) {
        res.status(403).json({
          ok: false,
          error: 'النشر على صفحة فيسبوك متاح للموظفين ومدير المجمع فقط.',
        });
        return;
      }
    }

    const payload = parseRequestBody(req.body);
    const rawQueryDay = req.query?.dayId;
    const queryDayId = Array.isArray(rawQueryDay) ? rawQueryDay[0] : rawQueryDay;
    const requestedDayId =
      typeof payload.dayId === 'string' && payload.dayId.trim()
        ? payload.dayId.trim()
        : typeof queryDayId === 'string' && queryDayId.trim()
        ? queryDayId.trim()
        : null;

    const targetMode =
      payload.targetDay === 'today' || req.query?.targetDay === 'today'
        ? 'today'
        : 'tomorrow';

    const now = new Date();
    const targetDayMeta = requestedDayId
      ? resolveDayMetaById(requestedDayId)
      : resolveTargetDayId(now, targetMode, 'Africa/Cairo');

    const dayId: DayId = targetDayMeta.dayId;
    const dayLabel: string = targetDayMeta.dayLabel;

    let centerSettings: CenterSettings = DEFAULT_CENTER_SETTINGS;
    let scheduleRows: ScheduleRow[] = [];
    let scheduleVersion = 1;
    let storedPosterImage: {
      dayId: string;
      version: number;
      imageBase64: string;
      mime: string;
    } | null = null;
    let postMode: FacebookPostMode = 'photo_with_caption';

    if (db) {
      const [
        settingsSnap,
        remindersSnap,
        scheduleSnap,
        publicScheduleSnap,
        posterSnap,
      ] = await Promise.all([
        db.collection('settings').doc('center').get(),
        db.collection('appConfig').doc('reminders').get(),
        db.collection('schedules').doc(dayId).get(),
        db.collection('publicSchedules').doc(dayId).get(),
        db.collection('posterImages').doc(dayId).get(),
      ]);

      if (settingsSnap.exists) {
        centerSettings = {
          ...DEFAULT_CENTER_SETTINGS,
          ...(settingsSnap.data() as Partial<CenterSettings>),
        };
      }

      if (remindersSnap.exists) {
        const rData = remindersSnap.data() as Partial<ReminderSettings>;
        if (
          rData?.fbPostMode === 'photo_only' ||
          rData?.fbPostMode === 'text_only' ||
          rData?.fbPostMode === 'photo_with_caption'
        ) {
          postMode = rData.fbPostMode;
        }
      }

      if (scheduleSnap.exists) {
        const schedData = scheduleSnap.data() as DailyScheduleData;
        scheduleVersion = schedData.version || 1;
        scheduleRows = filterNonEmptyRows(
          schedData.draftRows || schedData.publishedRows || []
        );
      } else if (publicScheduleSnap.exists) {
        const pubData = publicScheduleSnap.data() as PublicDailyScheduleData;
        scheduleRows = filterNonEmptyRows(pubData.publishedRows || []);
      }

      if (posterSnap.exists) {
        const pData = posterSnap.data();
        if (pData && typeof pData.imageBase64 === 'string') {
          storedPosterImage = {
            dayId,
            version: Number(pData.version || 0),
            imageBase64: pData.imageBase64,
            mime: String(pData.mime || 'image/jpeg'),
          };
        }
      }
    }

    // Determine publish decision strictly from server-side Firestore records
    const plan = decideFacebookPublishPlan({
      mode: postMode,
      scheduleVersion,
      storedPosterImage,
      dayLabel,
      settings: centerSettings,
      isManualTrigger: !isCronAuthorized,
    });

    if (plan.action === 'reject_error') {
      res.status(400).json({
        ok: false,
        success: false,
        dayId,
        dayLabel,
        error: plan.errorMessage,
      });
      return;
    }

    const cleanPageId = normalizeFacebookPageId(process.env.FB_PAGE_ID);
    const cleanToken = normalizeEnvSecret(process.env.FB_PAGE_ACCESS_TOKEN);

    if (!cleanPageId || !cleanToken) {
      res.status(500).json({
        ok: false,
        success: false,
        dayId,
        dayLabel,
        error:
          'متغيرات فيسبوك (FB_PAGE_ID أو FB_PAGE_ACCESS_TOKEN) غير مضبوطة في إعدادات بيئة الخادم (Vercel Environment Variables) أو تحتاج إلى Redeploy لتفعيلها.',
      });
      return;
    }

    if (plan.action === 'post_photo') {
      const publishResult = await publishPhotoToFacebookPage({
        pageId: cleanPageId,
        accessToken: cleanToken,
        jpegBuffer: plan.jpegBuffer,
        caption: plan.caption,
        dayId,
      });

      if (!publishResult.ok) {
        res.status(publishResult.statusCode || 502).json({
          ok: false,
          success: false,
          dayId,
          dayLabel,
          error: publishResult.error,
        });
        return;
      }

      res.status(200).json({
        ok: true,
        success: true,
        post_id: publishResult.post_id,
        dayId,
        dayLabel,
        postMode,
        isPhotoPost: true,
        caption: plan.caption,
        message: `تم نشر صورة بوستر جدول عيادات يوم ${dayLabel} بنجاح على صفحة فيسبوك! (معرف المنشور: ${publishResult.post_id})`,
      });
      return;
    }

    // Fallback or explicit text-only post
    const formattedPostMessage = formatFacebookScheduleFullText({
      dayLabel,
      rows: scheduleRows,
      settings: centerSettings,
    });

    const feedResult = await publishTextFeedToFacebookPage({
      pageId: cleanPageId,
      accessToken: cleanToken,
      message: formattedPostMessage,
    });

    if (!feedResult.ok) {
      res.status(feedResult.statusCode || 502).json({
        ok: false,
        success: false,
        dayId,
        dayLabel,
        error: feedResult.error,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      success: true,
      post_id: feedResult.post_id,
      dayId,
      dayLabel,
      postMode,
      isPhotoPost: false,
      postContent: formattedPostMessage,
      warning: plan.action === 'post_text_only' ? plan.warning : undefined,
      message: `تم نشر جدول عيادات يوم ${dayLabel} (نص) بنجاح على صفحة فيسبوك! (معرف المنشور: ${feedResult.post_id})`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      ok: false,
      success: false,
      error: `فشل تنفيذ خدمة النشر على فيسبوك: ${msg}`,
    });
  }
}
