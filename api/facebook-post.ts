import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type {
  CenterSettings,
  DailyScheduleData,
  DayId,
  PublicDailyScheduleData,
  ScheduleRow,
} from '../src/types/schedule.js';
import {
  formatFacebookSchedulePost,
  publishToFacebookPageGraphApi,
  resolveDayMetaById,
} from '../src/utils/facebookPostLogic.js';
import { resolveTargetDayId } from '../src/utils/reminderLogic.js';
import {
  DEFAULT_POST_TEMPLATE,
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

function getAdminAppOrNull() {
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
 * Serverless Endpoint: `/api/facebook-post` (also accessible via `/api/send-reminders?action=facebook-post`)
 * - Fetches the clinic schedule (automatically defaults to tomorrow's schedule in `Africa/Cairo`,
 *   or accepts a specific `dayId` / `targetMode: 'tomorrow' | 'today'` for manual publishing).
 * - Formats the clinic schedule into a clean, readable Arabic post using `formatFacebookSchedulePost`.
 * - Publishes the post to the Facebook Page via Meta Graph API v21.0 (`POST https://graph.facebook.com/v21.0/{FB_PAGE_ID}/feed`)
 *   using `process.env.FB_PAGE_ID` and `process.env.FB_PAGE_ACCESS_TOKEN`.
 * - Returns `{ ok: true, success: true, post_id, dayId, dayLabel, message }` or a descriptive Arabic error.
 */
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
        error: 'مطلوب تسجيل الدخول أو إرسال ترويسة Authorization: Bearer للنشر على فيسبوك.',
      });
      return;
    }

    const cronSecret = process.env.CRON_SECRET;
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
    } else if (!isCronAuthorized && !adminApp) {
      // If FIREBASE_SERVICE_ACCOUNT_JSON is not set in local preview, still allow testing the Graph API check
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

    // Default to tomorrow's schedule automatically unless a specific dayId was requested
    const now = new Date();
    const targetDayMeta = requestedDayId
      ? resolveDayMetaById(requestedDayId)
      : resolveTargetDayId(now, targetMode, 'Africa/Cairo');

    const dayId: DayId = targetDayMeta.dayId;
    const dayLabel: string =
      typeof payload.dayLabel === 'string' && payload.dayLabel.trim()
        ? payload.dayLabel.trim()
        : targetDayMeta.dayLabel;

    // Fetch CenterSettings & Schedule rows from Firestore (or fallback to payload if provided)
    let centerSettings: CenterSettings = {
      ...DEFAULT_CENTER_SETTINGS,
      ...(payload.settings && typeof payload.settings === 'object'
        ? (payload.settings as Partial<CenterSettings>)
        : {}),
    };

    let scheduleRows: ScheduleRow[] = Array.isArray(payload.rows)
      ? filterNonEmptyRows(payload.rows as ScheduleRow[])
      : [];

    if (db) {
      const [settingsSnap, scheduleSnap, publicScheduleSnap] = await Promise.all([
        db.collection('settings').doc('center').get(),
        db.collection('schedules').doc(dayId).get(),
        db.collection('publicSchedules').doc(dayId).get(),
      ]);

      if (settingsSnap.exists) {
        centerSettings = {
          ...centerSettings,
          ...(settingsSnap.data() as Partial<CenterSettings>),
        };
      }

      if (scheduleRows.length === 0) {
        if (scheduleSnap.exists) {
          const schedData = scheduleSnap.data() as DailyScheduleData;
          scheduleRows = filterNonEmptyRows(
            schedData.draftRows || schedData.publishedRows || []
          );
        } else if (publicScheduleSnap.exists) {
          const pubData = publicScheduleSnap.data() as PublicDailyScheduleData;
          scheduleRows = filterNonEmptyRows(pubData.publishedRows || []);
        }
      }
    }

    const customMessage =
      typeof payload.message === 'string' && payload.message.trim().length > 0
        ? payload.message.trim()
        : '';

    const formattedPostMessage =
      customMessage ||
      formatFacebookSchedulePost({
        dayLabel,
        rows: scheduleRows,
        settings: centerSettings,
      });

    const fbResult = await publishToFacebookPageGraphApi({
      pageId: process.env.FB_PAGE_ID,
      pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,
      message: formattedPostMessage,
    });

    if (!fbResult.ok || !fbResult.post_id) {
      res.status(fbResult.statusCode || 500).json({
        ok: false,
        success: false,
        dayId,
        dayLabel,
        error:
          fbResult.error ||
          'تعذر النشر على صفحة فيسبوك عبر Meta Graph API v21.0.',
      });
      return;
    }

    res.status(200).json({
      ok: true,
      success: true,
      post_id: fbResult.post_id,
      dayId,
      dayLabel,
      rowCount: scheduleRows.length,
      postContent: formattedPostMessage,
      message: `تم نشر جدول عيادات يوم ${dayLabel} على صفحة فيسبوك بنجاح! (معرف المنشور: ${fbResult.post_id})`,
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
