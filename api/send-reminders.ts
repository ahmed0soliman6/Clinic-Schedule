import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type {
  CenterSettings,
  DailyScheduleData,
  PublicDailyScheduleData,
  ReminderSettings,
  ScheduleRow,
  UserProfile,
} from '../src/types/schedule.js';
import {
  formatFacebookSchedulePost,
  publishToFacebookPageGraphApi,
} from '../src/utils/facebookPostLogic.js';
import {
  computeTokenDocId,
  DEFAULT_REMINDER_SETTINGS,
  filterEligibleReminderTokens,
  formatReminderMessage,
  isWithinReminderWindow,
  PUBLIC_SUBSCRIBER_EMAIL,
  resolveTargetDayId,
  StoredTokenEntry,
} from '../src/utils/reminderLogic.js';
import {
  DEFAULT_POST_TEMPLATE,
  emailToDocId,
  filterNonEmptyRows,
  PRIMARY_ADMIN_EMAIL,
} from '../src/utils/scheduleLogic.js';
import facebookPostHandler from './facebook-post.js';

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

  // Delegate manual/direct Facebook Page post requests (`?action=facebook-post`)
  if (action === 'facebook-post') {
    await facebookPostHandler(req, res);
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

    const isTestMode =
      req.query?.test === '1' ||
      (Array.isArray(req.query?.test) && req.query?.test[0] === '1');
    const bearer = extractBearerToken(
      req.headers.authorization || req.headers.Authorization
    );

    if (!bearer) {
      res.status(401).json({ error: 'مطلوب ترويسة Authorization: Bearer.' });
      return;
    }

    let testAdminEmail: string | null = null;

    if (isTestMode) {
      // Verify Firebase ID Token and ADMIN role
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
      // Cron mode: verify CRON_SECRET
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || bearer !== cronSecret) {
        res.status(401).json({ error: 'CRON_SECRET غير صالح.' });
        return;
      }
    }

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

    const targetDay = resolveTargetDayId(
      now,
      reminderConfig.targetDay === 'today' ? 'today' : 'tomorrow',
      'Africa/Cairo'
    );

    // -------------------------------------------------------------------------
    // Automatic Daily Facebook Page Post (when fbAutoPostEnabled === true)
    // Always publishes tomorrow's clinic schedule once per day at the scheduled time
    // -------------------------------------------------------------------------
    let facebookAutoPostResult: Record<string, unknown> | null = null;

    if (!isTestMode && reminderConfig.fbAutoPostEnabled) {
      const fbWindowCheck = isWithinReminderWindow({
        now,
        scheduledTime: reminderConfig.time,
        lastSentDate: reminderConfig.lastFbPostDate,
        timeZone: 'Africa/Cairo',
        windowMinutes: 10,
      });

      if (fbWindowCheck.shouldSend) {
        const fbClaimed = await db.runTransaction(async (tx) => {
          const freshSnap = await tx.get(remindersRef);
          const freshData = (freshSnap.data() || {}) as Partial<ReminderSettings>;
          if (freshData.lastFbPostDate === fbWindowCheck.cairoDateStr) {
            return false;
          }
          tx.set(
            remindersRef,
            {
              ...DEFAULT_REMINDER_SETTINGS,
              ...freshData,
              lastFbPostDate: fbWindowCheck.cairoDateStr,
            },
            { merge: true }
          );
          return true;
        });

        if (fbClaimed) {
          const tomorrowMeta = resolveTargetDayId(
            now,
            'tomorrow',
            'Africa/Cairo'
          );
          const [settingsSnap, schedSnap, pubSchedSnap] = await Promise.all([
            db.collection('settings').doc('center').get(),
            db.collection('schedules').doc(tomorrowMeta.dayId).get(),
            db.collection('publicSchedules').doc(tomorrowMeta.dayId).get(),
          ]);

          const centerSettings: CenterSettings = settingsSnap.exists
            ? {
                ...FALLBACK_CENTER_SETTINGS,
                ...(settingsSnap.data() as Partial<CenterSettings>),
              }
            : FALLBACK_CENTER_SETTINGS;

          let tomorrowRows: ScheduleRow[] = [];
          if (schedSnap.exists) {
            const sData = schedSnap.data() as DailyScheduleData;
            tomorrowRows = filterNonEmptyRows(
              sData.draftRows || sData.publishedRows || []
            );
          } else if (pubSchedSnap.exists) {
            const pData = pubSchedSnap.data() as PublicDailyScheduleData;
            tomorrowRows = filterNonEmptyRows(pData.publishedRows || []);
          }

          const fbMessage = formatFacebookSchedulePost({
            dayLabel: tomorrowMeta.dayLabel,
            rows: tomorrowRows,
            settings: centerSettings,
          });

          const fbPublish = await publishToFacebookPageGraphApi({
            pageId: process.env.FB_PAGE_ID,
            pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,
            message: fbMessage,
          });

          facebookAutoPostResult = {
            ok: fbPublish.ok,
            post_id: fbPublish.post_id,
            dayId: tomorrowMeta.dayId,
            dayLabel: tomorrowMeta.dayLabel,
            error: fbPublish.error,
          };
        }
      }
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

      const windowCheck = isWithinReminderWindow({
        now,
        scheduledTime: reminderConfig.time,
        lastSentDate: reminderConfig.lastSentDate,
        timeZone: 'Africa/Cairo',
        windowMinutes: 10,
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

      // Atomically claim today's send inside a Firestore transaction first to prevent duplicate sends
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

    // Load all FCM tokens and registered users
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
          // Send data-only message so src/sw.ts controls notification presentation & click handling
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
