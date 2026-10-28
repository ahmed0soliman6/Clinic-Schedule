import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type {
  CenterSettings,
  DailyScheduleData,
  DayId,
  FacebookFallbackMode,
  FacebookPostMode,
  PublicDailyScheduleData,
  ReminderSettings,
  ScheduleRow,
  UserProfile,
} from '../src/types/schedule.js';
import {
  decideFacebookPublishPlan,
  inspectStoredPosterImageStatus,
} from '../src/utils/facebookPostLogic.js';
import {
  computeTokenDocId,
  DEFAULT_CATCH_UP_WINDOW_MINUTES,
  DEFAULT_REMINDER_SETTINGS,
  evaluateFbAutoPostGate,
  FB_POST_LOCK_DURATION_MS,
  filterEligibleReminderTokens,
  formatReminderMessage,
  isWithinReminderWindow,
  MAX_FB_POST_ATTEMPTS_PER_DATE,
  PUBLIC_SUBSCRIBER_EMAIL,
  resolveTargetDayId,
  sanitizeFbAutoPostError,
  StoredTokenEntry,
} from '../src/utils/reminderLogic.js';
import {
  DAYS_LIST,
  DEFAULT_POST_TEMPLATE,
  WHATSAPP_CHANNEL_SHORT_URL,
  buildDailySocialPostText,
  emailToDocId,
  filterNonEmptyRows,
  PRIMARY_ADMIN_EMAIL,
} from '../src/utils/scheduleLogic.js';

interface VercelRequestLike {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponseLike {
  status: (code: number) => VercelResponseLike;
  json: (body: Record<string, unknown>) => void;
}

interface FacebookPostResult {
  ok: boolean;
  success: boolean;
  post_id?: string;
  dayId?: DayId;
  dayLabel?: string;
  message?: string;
  error?: string;
  statusCode?: number;
}

const FALLBACK_CENTER_SETTINGS: CenterSettings = {
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

function formatFacebookSchedulePost(params: {
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

async function publishPhotoToFacebookPage(params: {
  pageId: string;
  accessToken: string;
  jpegBuffer: Buffer;
  caption?: string;
  dayId: string;
}): Promise<FacebookPostResult> {
  const cleanPageId = normalizeFacebookPageId(params.pageId);
  const cleanToken = normalizeEnvSecret(params.accessToken);

  if (!cleanPageId || !cleanToken) {
    return {
      ok: false,
      success: false,
      statusCode: 500,
      error:
        'متغيرات فيسبوك (FB_PAGE_ID أو FB_PAGE_ACCESS_TOKEN) غير مضبوطة في إعدادات بيئة الخادم (Vercel Environment Variables) أو تحتاج إلى Redeploy لتفعيلها.',
    };
  }

  const graphUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
    cleanPageId
  )}/photos`;

  const form = new FormData();
  form.append(
    'source',
    new Blob([new Uint8Array(params.jpegBuffer)], { type: 'image/jpeg' }),
    `schedule-${params.dayId}.jpg`
  );
  if (params.caption && params.caption.trim().length > 0) {
    form.append('caption', params.caption.trim());
  }
  form.append('published', 'true');
  form.append('access_token', cleanToken);

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
      return {
        ok: false,
        success: false,
        statusCode: response.status || 502,
        error: `فشل نشر صورة الجدول عبر Meta Graph API v21.0${fbErrorCode}: ${fbErrorMsg}`,
      };
    }

    const postId = String(data.post_id || data.id || '').trim();
    return {
      ok: true,
      success: true,
      post_id: postId,
      statusCode: 200,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      success: false,
      statusCode: 502,
      error: `تعذر الاتصال بخدمة رفع الصور في Meta Graph API v21.0: ${rawMsg}`,
    };
  }
}

async function publishFeedTextToFacebookPage(params: {
  pageId: string;
  accessToken: string;
  message: string;
}): Promise<FacebookPostResult> {
  const cleanPageId = normalizeFacebookPageId(params.pageId);
  const cleanToken = normalizeEnvSecret(params.accessToken);
  const cleanMessage = (params.message || '').trim();

  if (!cleanPageId || !cleanToken) {
    return {
      ok: false,
      success: false,
      statusCode: 500,
      error:
        'متغيرات فيسبوك (FB_PAGE_ID أو FB_PAGE_ACCESS_TOKEN) غير مضبوطة في إعدادات بيئة الخادم (Vercel Environment Variables) أو تحتاج إلى Redeploy لتفعيلها.',
    };
  }

  if (!cleanMessage) {
    return {
      ok: false,
      success: false,
      statusCode: 400,
      error: 'نص المنشور فارغ، لا يمكن إرسال منشور فارغ إلى فيسبوك.',
    };
  }

  const graphUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
    cleanPageId
  )}/feed`;

  try {
    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: cleanMessage,
        access_token: cleanToken,
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
        success: false,
        statusCode: response.status || 502,
        error: `فشل النشر عبر Meta Graph API v21.0${fbErrorCode}: ${fbErrorMsg}`,
      };
    }

    const postId = String(data.post_id || data.id || '').trim();
    return {
      ok: true,
      success: true,
      post_id: postId,
      statusCode: 200,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      success: false,
      statusCode: 502,
      error: `تعذر الاتصال بواجهة Meta Graph API v21.0: ${rawMsg}`,
    };
  }
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

function getAdminApp() {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawJson) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable.');
  }
  const serviceAccount = JSON.parse(rawJson);
  return initializeApp({
    credential: cert(serviceAccount),
  });
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

function isInvalidTokenError(err: unknown): boolean {
  const code =
    (err as { code?: string; errorInfo?: { code?: string } })?.code ||
    (err as { errorInfo?: { code?: string } })?.errorInfo?.code ||
    '';
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

/**
 * Shared execution engine for automatic daily Facebook Page publishing (used by both
 * the scheduled cron job and the Admin "Run Auto-Post Now" action).
 */
async function executeAutomatedFacebookPublish(params: {
  db: Firestore;
  now: Date;
  ignoreTimeWindow?: boolean;
  forceRePost?: boolean;
}): Promise<Record<string, unknown>> {
  const { db, now, ignoreTimeWindow = false, forceRePost = false } = params;
  const remindersRef = db.collection('appConfig').doc('reminders');

  // Step 1: Transactionally check eligibility and acquire 5-minute lock (without setting lastFbPostTargetDate yet)
  const lockOutcome = await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(remindersRef);
    const freshData = (freshSnap.data() || {}) as Partial<ReminderSettings>;
    const mergedConfig: ReminderSettings = {
      ...DEFAULT_REMINDER_SETTINGS,
      ...freshData,
      timezone: 'Africa/Cairo',
    };

    const gate = evaluateFbAutoPostGate({
      now,
      fbAutoPostEnabled: Boolean(mergedConfig.fbAutoPostEnabled),
      fbAutoPostTime:
        mergedConfig.fbAutoPostTime || mergedConfig.time || '20:00',
      fbTargetDay:
        mergedConfig.fbTargetDay === 'today' ? 'today' : 'tomorrow',
      lastFbPostTargetDate: mergedConfig.lastFbPostTargetDate,
      fbPostLockUntil: mergedConfig.fbPostLockUntil,
      fbPostAttempts: mergedConfig.fbPostAttempts,
      maxAttempts: MAX_FB_POST_ATTEMPTS_PER_DATE,
      windowMinutes: DEFAULT_CATCH_UP_WINDOW_MINUTES,
      timeZone: 'Africa/Cairo',
      ignoreTimeWindow,
      forceRePost,
    });

    if (!gate.shouldExecute) {
      return {
        acquired: false as const,
        gate,
        config: mergedConfig,
      };
    }

    tx.set(
      remindersRef,
      {
        fbPostLockUntil: now.getTime() + FB_POST_LOCK_DURATION_MS,
      },
      { merge: true }
    );

    return {
      acquired: true as const,
      gate,
      config: mergedConfig,
    };
  });

  const { acquired, gate, config } = lockOutcome;

  if (!acquired) {
    return {
      ok: gate.reason === 'already_posted_for_target_date',
      executed: false,
      skipped: true,
      reason: gate.reason,
      dayId: gate.targetDayId,
      dayLabel: gate.targetDayLabel,
      targetDateStr: gate.targetDateStr,
    };
  }

  const targetDayId = gate.targetDayId;
  const targetDayLabel = gate.targetDayLabel;
  const targetDateStr = gate.targetDateStr;
  const nextAttemptCount = gate.currentAttemptsCount + 1;

  try {
    const [settingsSnap, schedSnap, pubSchedSnap, posterSnap] =
      await Promise.all([
        db.collection('settings').doc('center').get(),
        db.collection('schedules').doc(targetDayId).get(),
        db.collection('publicSchedules').doc(targetDayId).get(),
        db.collection('posterImages').doc(targetDayId).get(),
      ]);

    const centerSettings: CenterSettings = settingsSnap.exists
      ? {
          ...FALLBACK_CENTER_SETTINGS,
          ...(settingsSnap.data() as Partial<CenterSettings>),
        }
      : FALLBACK_CENTER_SETTINGS;

    let targetRows: ScheduleRow[] = [];
    let scheduleVersion = 1;
    if (schedSnap.exists) {
      const sData = schedSnap.data() as DailyScheduleData;
      scheduleVersion = sData.version || 1;
      targetRows = filterNonEmptyRows(
        sData.draftRows || sData.publishedRows || []
      );
    } else if (pubSchedSnap.exists) {
      const pData = pubSchedSnap.data() as PublicDailyScheduleData;
      targetRows = filterNonEmptyRows(pData.publishedRows || []);
    }

    const skipEmptyDay =
      typeof config.fbSkipEmptyDay === 'boolean' ? config.fbSkipEmptyDay : true;

    // Deliverable 3: If fbSkipEmptyDay=true and day has no non-empty clinic rows, skip and mark targetDateStr completed
    if (skipEmptyDay && targetRows.length === 0) {
      const nowIso = new Date().toISOString();
      const skipMsg = `تم تخطي النشر التلقائي لجدول يوم ${targetDayLabel} (${targetDateStr}) لعدم وجود عيادات مسجلة.`;
      await remindersRef.set(
        {
          lastFbPostTargetDate: targetDateStr,
          lastFbPostDate: gate.cairoDateStr,
          lastFbPostStatus: 'skipped_no_clinics',
          lastFbPostAt: nowIso,
          lastFbPostId: '',
          lastFbPostError: skipMsg,
          fbPostAttempts: { date: targetDateStr, count: nextAttemptCount },
          fbPostLockUntil: 0,
        },
        { merge: true }
      );

      return {
        ok: true,
        executed: false,
        skipped: true,
        status: 'skipped_no_clinics',
        dayId: targetDayId,
        dayLabel: targetDayLabel,
        targetDateStr,
        message: skipMsg,
      };
    }

    let storedPosterImage: {
      dayId: string;
      version: number;
      imageBase64: string;
      mime: string;
    } | null = null;

    if (posterSnap.exists) {
      const pData = posterSnap.data();
      if (pData && typeof pData.imageBase64 === 'string') {
        storedPosterImage = {
          dayId: targetDayId,
          version: Number(pData.version || 0),
          imageBase64: pData.imageBase64,
          mime: String(pData.mime || 'image/jpeg'),
        };
      }
    }

    const postMode: FacebookPostMode =
      config.fbPostMode === 'photo_only' ||
      config.fbPostMode === 'text_only' ||
      config.fbPostMode === 'photo_with_caption'
        ? config.fbPostMode
        : 'photo_with_caption';

    const fallbackMode: FacebookFallbackMode =
      config.fbFallbackMode === 'skip' ? 'skip' : 'text';

    const plan = decideFacebookPublishPlan({
      mode: postMode,
      fallbackMode,
      scheduleVersion,
      storedPosterImage,
      dayLabel: targetDayLabel,
      settings: centerSettings,
      isManualTrigger: false,
    });

    if (plan.action === 'skip_retry' || plan.action === 'reject_error') {
      const errMsg = sanitizeFbAutoPostError(
        plan.action === 'skip_retry' ? plan.errorMessage : plan.errorMessage
      );
      await remindersRef.set(
        {
          lastFbPostStatus: 'failed',
          lastFbPostAt: new Date().toISOString(),
          lastFbPostError: errMsg,
          fbPostAttempts: { date: targetDateStr, count: nextAttemptCount },
          fbPostLockUntil: 0,
        },
        { merge: true }
      );

      return {
        ok: false,
        executed: false,
        status: 'failed',
        dayId: targetDayId,
        dayLabel: targetDayLabel,
        targetDateStr,
        error: errMsg,
        message: errMsg,
      };
    }

    const cleanPageId = normalizeFacebookPageId(process.env.FB_PAGE_ID);
    const cleanToken = normalizeEnvSecret(process.env.FB_PAGE_ACCESS_TOKEN);

    let fbPublish: FacebookPostResult;

    if (plan.action === 'post_photo') {
      fbPublish = await publishPhotoToFacebookPage({
        pageId: cleanPageId,
        accessToken: cleanToken,
        jpegBuffer: plan.jpegBuffer,
        caption: plan.caption,
        dayId: targetDayId,
      });
    } else {
      const fbMessage = formatFacebookSchedulePost({
        dayLabel: targetDayLabel,
        rows: targetRows,
        settings: centerSettings,
      });

      fbPublish = await publishFeedTextToFacebookPage({
        pageId: cleanPageId,
        accessToken: cleanToken,
        message: fbMessage,
      });
    }

    const nowIso = new Date().toISOString();

    if (fbPublish.ok && fbPublish.post_id) {
      const finalStatus =
        plan.action === 'post_photo' ? 'success' : 'success_text_fallback';
      const fallbackWarning =
        plan.action === 'post_text_only'
          ? sanitizeFbAutoPostError(plan.warning || plan.reason)
          : '';

      await remindersRef.set(
        {
          lastFbPostTargetDate: targetDateStr,
          lastFbPostDate: gate.cairoDateStr,
          lastFbPostStatus: finalStatus,
          lastFbPostAt: nowIso,
          lastFbPostId: fbPublish.post_id,
          lastFbPostError: fallbackWarning,
          lastFbPostWarning: fallbackWarning,
          fbPostAttempts: { date: targetDateStr, count: nextAttemptCount },
          fbPostLockUntil: 0,
        },
        { merge: true }
      );

      return {
        ok: true,
        executed: true,
        status: finalStatus,
        post_id: fbPublish.post_id,
        dayId: targetDayId,
        dayLabel: targetDayLabel,
        targetDateStr,
        isPhotoPost: plan.action === 'post_photo',
        warning: fallbackWarning || undefined,
        message:
          plan.action === 'post_photo'
            ? `✅ تم نشر صورة جدول يوم ${targetDayLabel} (${targetDateStr}) تلقائياً على فيسبوك! (post_id: ${fbPublish.post_id})`
            : `✅ تم نشر جدول يوم ${targetDayLabel} (${targetDateStr}) كنص بديل على فيسبوك! (post_id: ${fbPublish.post_id})`,
      };
    }

    const sanitizedErr = sanitizeFbAutoPostError(
      fbPublish.error || 'فشل النشر التلقائي على فيسبوك.'
    );

    await remindersRef.set(
      {
        lastFbPostStatus: 'failed',
        lastFbPostAt: nowIso,
        lastFbPostError: sanitizedErr,
        fbPostAttempts: { date: targetDateStr, count: nextAttemptCount },
        fbPostLockUntil: 0,
      },
      { merge: true }
    );

    return {
      ok: false,
      executed: true,
      status: 'failed',
      dayId: targetDayId,
      dayLabel: targetDayLabel,
      targetDateStr,
      error: sanitizedErr,
      message: sanitizedErr,
    };
  } catch (err) {
    const rawErr = err instanceof Error ? err.message : String(err);
    const sanitizedErr = sanitizeFbAutoPostError(
      `خطأ غير متوقع أثناء النشر التلقائي: ${rawErr}`
    );
    await remindersRef
      .set(
        {
          lastFbPostStatus: 'failed',
          lastFbPostAt: new Date().toISOString(),
          lastFbPostError: sanitizedErr,
          fbPostAttempts: { date: targetDateStr, count: nextAttemptCount },
          fbPostLockUntil: 0,
        },
        { merge: true }
      )
      .catch(() => undefined);

    return {
      ok: false,
      executed: false,
      status: 'failed',
      dayId: targetDayId,
      dayLabel: targetDayLabel,
      targetDateStr,
      error: sanitizedErr,
      message: sanitizedErr,
    };
  }
}

/**
 * Handles Admin testing tools:
 * - `POST /api/send-reminders?action=fb-auto&mode=dry`: Dry-run inspection without publishing.
 * - `POST /api/send-reminders?action=fb-auto&mode=now`: Immediate execution of the real auto-post flow.
 */
async function handleFbAutoAdminAction(
  req: VercelRequestLike,
  res: VercelResponseLike
) {
  try {
    const bearer = extractBearerToken(
      req.headers.authorization || req.headers.Authorization
    );

    if (!bearer) {
      res.status(401).json({
        ok: false,
        error: 'مطلوب تسجيل الدخول بحساب مدير المجمع (ADMIN).',
      });
      return;
    }

    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
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

    let isAdminUser = email === PRIMARY_ADMIN_EMAIL;
    if (!isAdminUser) {
      const userSnap = await db
        .collection('users')
        .doc(emailToDocId(email))
        .get();
      if (userSnap.exists && userSnap.data()?.role === 'ADMIN') {
        isAdminUser = true;
      }
    }

    if (!isAdminUser) {
      res.status(403).json({
        ok: false,
        error: 'أدوات فحص وتشغيل النشر التلقائي متاحة لمدير المجمع (ADMIN) فقط.',
      });
      return;
    }

    const payload = parseRequestBody(req.body);
    const rawMode = req.query?.mode;
    const queryMode = Array.isArray(rawMode) ? rawMode[0] : rawMode;
    const mode =
      queryMode === 'now' || payload.mode === 'now' ? 'now' : 'dry';
    const force =
      payload.force === true ||
      req.query?.force === '1' ||
      req.query?.force === 'true';

    const now = new Date();
    const remindersRef = db.collection('appConfig').doc('reminders');
    const remindersSnap = await remindersRef.get();
    const reminderConfig: ReminderSettings = remindersSnap.exists
      ? {
          ...DEFAULT_REMINDER_SETTINGS,
          ...(remindersSnap.data() as Partial<ReminderSettings>),
          timezone: 'Africa/Cairo',
        }
      : {
          ...DEFAULT_REMINDER_SETTINGS,
          timezone: 'Africa/Cairo',
        };

    const fbTargetDay =
      reminderConfig.fbTargetDay === 'today' ? 'today' : 'tomorrow';
    const targetMeta = resolveTargetDayId(now, fbTargetDay, 'Africa/Cairo');

    if (mode === 'dry') {
      const [settingsSnap, schedSnap, pubSchedSnap, posterSnap] =
        await Promise.all([
          db.collection('settings').doc('center').get(),
          db.collection('schedules').doc(targetMeta.dayId).get(),
          db.collection('publicSchedules').doc(targetMeta.dayId).get(),
          db.collection('posterImages').doc(targetMeta.dayId).get(),
        ]);

      const centerSettings: CenterSettings = settingsSnap.exists
        ? {
            ...FALLBACK_CENTER_SETTINGS,
            ...(settingsSnap.data() as Partial<CenterSettings>),
          }
        : FALLBACK_CENTER_SETTINGS;

      let scheduleRows: ScheduleRow[] = [];
      let scheduleVersion = 1;
      if (schedSnap.exists) {
        const sData = schedSnap.data() as DailyScheduleData;
        scheduleVersion = sData.version || 1;
        scheduleRows = filterNonEmptyRows(
          sData.draftRows || sData.publishedRows || []
        );
      } else if (pubSchedSnap.exists) {
        const pData = pubSchedSnap.data() as PublicDailyScheduleData;
        scheduleRows = filterNonEmptyRows(pData.publishedRows || []);
      }

      let storedPosterImage: {
        dayId: string;
        version: number;
        imageBase64: string;
        mime: string;
      } | null = null;

      if (posterSnap.exists) {
        const pData = posterSnap.data();
        if (pData && typeof pData.imageBase64 === 'string') {
          storedPosterImage = {
            dayId: targetMeta.dayId,
            version: Number(pData.version || 0),
            imageBase64: pData.imageBase64,
            mime: String(pData.mime || 'image/jpeg'),
          };
        }
      }

      const postMode: FacebookPostMode =
        reminderConfig.fbPostMode === 'photo_only' ||
        reminderConfig.fbPostMode === 'text_only' ||
        reminderConfig.fbPostMode === 'photo_with_caption'
          ? reminderConfig.fbPostMode
          : 'photo_with_caption';

      const fallbackMode: FacebookFallbackMode =
        reminderConfig.fbFallbackMode === 'skip' ? 'skip' : 'text';

      const skipEmptyDay =
        typeof reminderConfig.fbSkipEmptyDay === 'boolean'
          ? reminderConfig.fbSkipEmptyDay
          : true;

      const willSkipNoClinics = skipEmptyDay && scheduleRows.length === 0;
      const imageInspection = inspectStoredPosterImageStatus(
        scheduleVersion,
        storedPosterImage
      );

      const plan = decideFacebookPublishPlan({
        mode: postMode,
        fallbackMode,
        scheduleVersion,
        storedPosterImage,
        dayLabel: targetMeta.dayLabel,
        settings: centerSettings,
        isManualTrigger: false,
      });

      const plannedAction = willSkipNoClinics
        ? 'skip_no_clinics'
        : plan.action;

      const imageStatusLabel =
        imageInspection.status === 'up_to_date'
          ? `محدّثة ✓ (إصدار ${imageInspection.posterVersion})`
          : imageInspection.status === 'outdated'
          ? `قديمة ⚠ (إصدار الصورة ${imageInspection.posterVersion} مقابل الجدول ${scheduleVersion})`
          : imageInspection.status === 'missing'
          ? 'غير موجودة ✗'
          : 'تالفة/غير صالحة ✗';

      const plannedActionLabel =
        plannedAction === 'skip_no_clinics'
          ? 'سيتم التخطي (لا توجد عيادات مسجلة)'
          : plannedAction === 'post_photo'
          ? postMode === 'photo_only'
            ? 'سينشر صورة البوستر فقط (بدون كابشن)'
            : 'سينشر صورة البوستر مع كابشن قصير'
          : plannedAction === 'post_text_only'
          ? 'سينشر نص الجدول (بديل نصي)'
          : 'سيتوقف ولن ينشر حتى تُحدّث الصورة';

      res.status(200).json({
        ok: true,
        dryRun: true,
        targetDayId: targetMeta.dayId,
        targetDayLabel: targetMeta.dayLabel,
        targetDateStr: targetMeta.targetDateStr,
        fbTargetDay,
        fbPostMode: postMode,
        fbFallbackMode: fallbackMode,
        fbSkipEmptyDay: skipEmptyDay,
        rowCount: scheduleRows.length,
        willSkipNoClinics,
        scheduleVersion,
        posterVersion: imageInspection.posterVersion,
        imageStatus: imageInspection.status,
        imageStatusLabel,
        plannedAction,
        plannedActionLabel,
        alreadyPostedForTargetDate:
          reminderConfig.lastFbPostTargetDate === targetMeta.targetDateStr,
        message: `معاينة النشر التلقائي: اليوم المستهدف «${targetMeta.dayLabel}» (${targetMeta.targetDateStr}) • عدد العيادات: ${scheduleRows.length} • حالة الصورة: ${imageStatusLabel} • القرار: ${plannedActionLabel}.`,
      });
      return;
    }

    // mode === 'now'
    if (
      !force &&
      reminderConfig.lastFbPostTargetDate &&
      reminderConfig.lastFbPostTargetDate.trim() === targetMeta.targetDateStr
    ) {
      res.status(200).json({
        ok: false,
        needsForceConfirm: true,
        targetDayId: targetMeta.dayId,
        targetDayLabel: targetMeta.dayLabel,
        targetDateStr: targetMeta.targetDateStr,
        message: `تم نشر جدول يوم ${targetMeta.dayLabel} (${targetMeta.targetDateStr}) مسبقاً. هل تريد تأكيد إعادة النشر الفوري؟`,
      });
      return;
    }

    const execResult = await executeAutomatedFacebookPublish({
      db,
      now,
      ignoreTimeWindow: true,
      forceRePost: force,
    });

    res.status(execResult.ok ? 200 : 400).json(execResult);
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      ok: false,
      error: sanitizeFbAutoPostError(`فشل تنفيذ طلب النشر التلقائي: ${rawMsg}`),
    });
  }
}

async function handleFacebookPostAction(
  req: VercelRequestLike,
  res: VercelResponseLike
) {
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
    const dayLabel: string =
      typeof payload.dayLabel === 'string' && payload.dayLabel.trim()
        ? payload.dayLabel.trim()
        : targetDayMeta.dayLabel;

    let centerSettings: CenterSettings = {
      ...FALLBACK_CENTER_SETTINGS,
      ...(payload.settings && typeof payload.settings === 'object'
        ? (payload.settings as Partial<CenterSettings>)
        : {}),
    };

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
          ...centerSettings,
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

    const plan = decideFacebookPublishPlan({
      mode: postMode,
      scheduleVersion,
      storedPosterImage,
      dayLabel,
      settings: centerSettings,
      isManualTrigger: !isCronAuthorized,
    });

    if (plan.action === 'reject_error' || plan.action === 'skip_retry') {
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
      const fbResult = await publishPhotoToFacebookPage({
        pageId: cleanPageId,
        accessToken: cleanToken,
        jpegBuffer: plan.jpegBuffer,
        caption: plan.caption,
        dayId,
      });

      if (!fbResult.ok || !fbResult.post_id) {
        res.status(fbResult.statusCode || 500).json({
          ok: false,
          success: false,
          dayId,
          dayLabel,
          error:
            fbResult.error ||
            'تعذر رفع صورة الجدول على صفحة فيسبوك عبر Meta Graph API v21.0.',
        });
        return;
      }

      res.status(200).json({
        ok: true,
        success: true,
        post_id: fbResult.post_id,
        dayId,
        dayLabel,
        isPhotoPost: true,
        caption: plan.caption,
        message: `تم نشر صورة بوستر جدول عيادات يوم ${dayLabel} بنجاح على صفحة فيسبوك! (معرف المنشور: ${fbResult.post_id})`,
      });
      return;
    }

    const formattedPostMessage = formatFacebookSchedulePost({
      dayLabel,
      rows: scheduleRows,
      settings: centerSettings,
    });

    const feedResult = await publishFeedTextToFacebookPage({
      pageId: cleanPageId,
      accessToken: cleanToken,
      message: formattedPostMessage,
    });

    if (!feedResult.ok || !feedResult.post_id) {
      res.status(feedResult.statusCode || 500).json({
        ok: false,
        success: false,
        dayId,
        dayLabel,
        error:
          feedResult.error ||
          'تعذر النشر على صفحة فيسبوك عبر Meta Graph API v21.0.',
      });
      return;
    }

    res.status(200).json({
      ok: true,
      success: true,
      post_id: feedResult.post_id,
      dayId,
      dayLabel,
      rowCount: scheduleRows.length,
      isPhotoPost: false,
      postContent: formattedPostMessage,
      warning: plan.warning,
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

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const rawAction = req.query?.action;
  const action = Array.isArray(rawAction) ? rawAction[0] : rawAction;

  // Handle manual/direct Facebook Page post requests (`?action=facebook-post`)
  if (action === 'facebook-post') {
    await handleFacebookPostAction(req, res);
    return;
  }

  // Handle Admin Facebook Auto-Post dry-run & immediate trigger (`?action=fb-auto`)
  if (action === 'fb-auto') {
    await handleFbAutoAdminAction(req, res);
    return;
  }

  // If opened directly in a browser tab (GET without Authorization header and without test=1),
  // return a helpful JSON health & configuration status check instead of an error screen.
  const rawAuthHeader = req.headers.authorization || req.headers.Authorization;
  const isTestMode =
    req.query?.test === '1' ||
    (Array.isArray(req.query?.test) && req.query?.test[0] === '1');

  if (req.method === 'GET' && !rawAuthHeader && !isTestMode) {
    res.status(200).json({
      ok: true,
      status: 'ready',
      message:
        'خدمة الإشعارات والنشر على فيسبوك (api/send-reminders) تعمل بنجاح على Vercel.',
      configStatus: {
        FIREBASE_SERVICE_ACCOUNT_JSON: Boolean(
          normalizeEnvSecret(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
        ),
        CRON_SECRET: Boolean(normalizeEnvSecret(process.env.CRON_SECRET)),
        FB_PAGE_ID: Boolean(normalizeFacebookPageId(process.env.FB_PAGE_ID)),
        FB_PAGE_ACCESS_TOKEN: Boolean(
          normalizeEnvSecret(process.env.FB_PAGE_ACCESS_TOKEN)
        ),
      },
    });
    return;
  }

  try {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const messaging = getMessaging(adminApp);
    const adminAuth = getAuth(adminApp);

    // Public/External Device Subscription & Unsubscription via firebase-admin
    if (req.method === 'POST' && action === 'subscribe') {
      const payload = parseRequestBody(req.body);
      const token = typeof payload.token === 'string' ? payload.token.trim() : '';
      if (token.length < 10 || token.length > 4096) {
        res.status(400).json({ error: 'رمز الإشعارات غير صالح.' });
        return;
      }
      const docId = await computeTokenDocId(token);
      const email =
        typeof payload.email === 'string' && payload.email.trim()
          ? payload.email.trim().toLowerCase().slice(0, 160)
          : PUBLIC_SUBSCRIBER_EMAIL;
      const uid =
        typeof payload.uid === 'string' && payload.uid.trim()
          ? payload.uid.trim().slice(0, 128)
          : 'public';
      const platform =
        typeof payload.platform === 'string' && payload.platform.trim()
          ? payload.platform.trim().slice(0, 120)
          : 'web';

      await db.collection('fcmTokens').doc(docId).set(
        {
          token,
          email,
          uid,
          platform,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
        { merge: true }
      );
      res.status(200).json({ ok: true, docId });
      return;
    }

    if (req.method === 'POST' && action === 'unsubscribe') {
      const payload = parseRequestBody(req.body);
      const rawDocId =
        typeof payload.docId === 'string' ? payload.docId.trim() : '';
      const rawToken =
        typeof payload.token === 'string' ? payload.token.trim() : '';
      const docId =
        rawDocId ||
        (rawToken.length >= 10 ? await computeTokenDocId(rawToken) : '');
      if (docId && /^[a-zA-Z0-9_-]{1,128}$/.test(docId)) {
        await db
          .collection('fcmTokens')
          .doc(docId)
          .delete()
          .catch(() => undefined);
      }
      res.status(200).json({ ok: true });
      return;
    }

    const bearer = extractBearerToken(rawAuthHeader);

    if (!bearer) {
      res.status(401).json({ error: 'مطلوب ترويسة Authorization: Bearer.' });
      return;
    }

    let testAdminEmail: string | null = null;

    if (isTestMode) {
      const decoded = await adminAuth.verifyIdToken(bearer);
      const email = (decoded.email || '').trim().toLowerCase();
      if (!email) {
        res
          .status(403)
          .json({ error: 'الحساب لا يحتوي على بريد إلكتروني معتمد.' });
        return;
      }
      const isSuperAdmin = email === PRIMARY_ADMIN_EMAIL;
      let isAdminInUsers = isSuperAdmin;
      if (!isAdminInUsers) {
        const userSnap = await db
          .collection('users')
          .doc(emailToDocId(email))
          .get();
        if (userSnap.exists && userSnap.data()?.role === 'ADMIN') {
          isAdminInUsers = true;
        }
      }
      if (!isAdminInUsers) {
        res
          .status(403)
          .json({ error: 'إرسال الإشعار التجريبي متاح لمدير المجمع (ADMIN) فقط.' });
        return;
      }
      testAdminEmail = email;
    } else {
      const cronSecret = normalizeEnvSecret(process.env.CRON_SECRET);
      if (!cronSecret || bearer !== cronSecret) {
        res.status(401).json({ error: 'CRON_SECRET غير صالح.' });
        return;
      }
    }

    const now = new Date();
    const remindersRef = db.collection('appConfig').doc('reminders');

    // Deliverable 4: Record lastCronRunAt on every authorized scheduler invocation
    if (!isTestMode) {
      await remindersRef
        .set({ lastCronRunAt: now.toISOString() }, { merge: true })
        .catch(() => undefined);
    }

    const remindersSnap = await remindersRef.get();
    const reminderConfig: ReminderSettings = remindersSnap.exists
      ? {
          ...DEFAULT_REMINDER_SETTINGS,
          ...(remindersSnap.data() as Partial<ReminderSettings>),
          timezone: 'Africa/Cairo',
        }
      : {
          ...DEFAULT_REMINDER_SETTINGS,
          timezone: 'Africa/Cairo',
        };

    // Staff reminder targetDay is strictly separate from fbTargetDay
    const targetDay = resolveTargetDayId(
      now,
      reminderConfig.targetDay === 'today' ? 'today' : 'tomorrow',
      'Africa/Cairo'
    );

    // -------------------------------------------------------------------------
    // Automatic Daily Facebook Page Post (when fbAutoPostEnabled === true)
    // Uses fbTargetDay, 180-minute catch-up window, 5-minute lock, and targetDate deduplication
    // -------------------------------------------------------------------------
    let facebookAutoPostResult: Record<string, unknown> | null = null;

    if (!isTestMode && reminderConfig.fbAutoPostEnabled) {
      facebookAutoPostResult = await executeAutomatedFacebookPublish({
        db,
        now,
        ignoreTimeWindow: false,
        forceRePost: false,
      });
    }

    if (!isTestMode) {
      if (!reminderConfig.enabled) {
        res.status(200).json({
          ok: true,
          skipped: true,
          reason: 'disabled',
          message: 'الإشعار اليومي غير مفعّل حالياً.',
          facebookAutoPost: facebookAutoPostResult,
        });
        return;
      }

      // Catch-up window (up to 180 minutes, never crossing midnight 23:59)
      const windowCheck = isWithinReminderWindow({
        now,
        scheduledTime: reminderConfig.time,
        lastSentDate: reminderConfig.lastSentDate,
        timeZone: 'Africa/Cairo',
        windowMinutes: DEFAULT_CATCH_UP_WINDOW_MINUTES,
      });

      if (!windowCheck.shouldSend) {
        res.status(200).json({
          ok: true,
          skipped: true,
          reason: windowCheck.reason,
          cairoDate: windowCheck.cairoDateStr,
          cairoTime: windowCheck.cairoTimeHHmm,
          facebookAutoPost: facebookAutoPostResult,
        });
        return;
      }

      const claimed = await db.runTransaction(async (tx) => {
        const freshSnap = await tx.get(remindersRef);
        const freshData = (freshSnap.data() || {}) as Partial<ReminderSettings>;
        if (freshData.lastSentDate === windowCheck.cairoDateStr) {
          return false;
        }
        tx.set(
          remindersRef,
          {
            ...DEFAULT_REMINDER_SETTINGS,
            ...freshData,
            lastSentDate: windowCheck.cairoDateStr,
          },
          { merge: true }
        );
        return true;
      });

      if (!claimed) {
        res.status(200).json({
          ok: true,
          skipped: true,
          reason: 'already_sent_today',
          cairoDate: windowCheck.cairoDateStr,
          facebookAutoPost: facebookAutoPostResult,
        });
        return;
      }
    }

    const [tokensSnap, usersSnap] = await Promise.all([
      db.collection('fcmTokens').get(),
      db.collection('users').get(),
    ]);

    const allTokens: StoredTokenEntry[] = [];
    tokensSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && typeof data.token === 'string') {
        allTokens.push({
          docId: docSnap.id,
          token: data.token,
          email: String(data.email || '').trim().toLowerCase(),
          uid: String(data.uid || ''),
        });
      }
    });

    const registeredUsers: UserProfile[] = [];
    usersSnap.forEach((docSnap) => {
      const data = docSnap.data() as UserProfile;
      if (data && data.email) {
        registeredUsers.push({
          uid: docSnap.id,
          email: data.email.trim().toLowerCase(),
          displayName: data.displayName || data.email,
          role: data.role === 'ADMIN' ? 'ADMIN' : 'EDITOR',
          allowedDays: Array.isArray(data.allowedDays) ? data.allowedDays : [],
        });
      }
    });

    const recipients = isTestMode
      ? allTokens.filter(
          (t) =>
            t.email === testAdminEmail || t.email === PUBLIC_SUBSCRIBER_EMAIL
        )
      : filterEligibleReminderTokens(
          allTokens,
          registeredUsers,
          targetDay.dayId
        );

    if (recipients.length === 0) {
      res.status(200).json({
        ok: true,
        sentCount: 0,
        targetDay: targetDay.dayId,
        facebookAutoPost: facebookAutoPostResult,
        message: isTestMode
          ? 'لا يوجد جهاز مفعّل عليه الإشعارات حالياً. فعّل الإشعارات من زر الجرس بالواجهة أولاً.'
          : 'لا توجد أجهزة مؤهلة لإرسال الإشعار حالياً.',
      });
      return;
    }

    const formatted = formatReminderMessage(reminderConfig, targetDay.dayLabel);
    const targetUrl = `/?day=${targetDay.dayId}`;

    let sentCount = 0;
    let deletedExpiredCount = 0;

    await Promise.all(
      recipients.map(async (recipient) => {
        try {
          await messaging.send({
            token: recipient.token,
            data: {
              title: formatted.title,
              body: formatted.body,
              url: targetUrl,
              dayId: targetDay.dayId,
              tag: 'clinic-schedule-daily-reminder',
            },
          });
          sentCount += 1;
        } catch (sendErr) {
          if (isInvalidTokenError(sendErr)) {
            deletedExpiredCount += 1;
            await db
              .collection('fcmTokens')
              .doc(recipient.docId)
              .delete()
              .catch(() => undefined);
          }
        }
      })
    );

    res.status(200).json({
      ok: true,
      sentCount,
      deletedExpiredCount,
      targetDay: targetDay.dayId,
      url: targetUrl,
      facebookAutoPost: facebookAutoPostResult,
      message: `تم إرسال الإشعار بنجاح إلى ${sentCount} جهاز (${targetDay.dayLabel}).`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `فشل تنفيذ خدمة الإشعارات: ${msg}`,
    });
  }
}

