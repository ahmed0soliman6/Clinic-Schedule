import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { ReminderSettings, UserProfile } from '../src/types/schedule.js';
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
import { emailToDocId, PRIMARY_ADMIN_EMAIL } from '../src/utils/scheduleLogic.js';

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
  const code = (err as { code?: string; errorInfo?: { code?: string } })?.code ||
    (err as { errorInfo?: { code?: string } })?.errorInfo?.code ||
    '';
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

export default async function handler(
  req: VercelRequestLike,
  res: VercelResponseLike
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const adminApp = getAdminApp();
    const db = getFirestore(adminApp);
    const messaging = getMessaging(adminApp);
    const adminAuth = getAuth(adminApp);

    const rawAction = req.query?.action;
    const action = Array.isArray(rawAction) ? rawAction[0] : rawAction;

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
      const rawDocId = typeof payload.docId === 'string' ? payload.docId.trim() : '';
      const rawToken = typeof payload.token === 'string' ? payload.token.trim() : '';
      const docId =
        rawDocId || (rawToken.length >= 10 ? await computeTokenDocId(rawToken) : '');
      if (docId && /^[a-zA-Z0-9_-]{1,128}$/.test(docId)) {
        await db.collection('fcmTokens').doc(docId).delete().catch(() => undefined);
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
        res.status(403).json({ error: 'الحساب لا يحتوي على بريد إلكتروني معتمد.' });
        return;
      }
      const isSuperAdmin = email === PRIMARY_ADMIN_EMAIL;
      let isAdminInUsers = isSuperAdmin;
      if (!isAdminInUsers) {
        const userSnap = await db.collection('users').doc(emailToDocId(email)).get();
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

    if (!isTestMode) {
      if (!reminderConfig.enabled) {
        res.status(200).json({
          ok: true,
          skipped: true,
          reason: 'disabled',
          message: 'الإشعار اليومي غير مفعّل حالياً.',
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
      : filterEligibleReminderTokens(allTokens, registeredUsers, targetDay.dayId);

    if (recipients.length === 0) {
      res.status(200).json({
        ok: true,
        sentCount: 0,
        targetDay: targetDay.dayId,
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
      message: `تم إرسال الإشعار بنجاح إلى ${sentCount} جهاز (${targetDay.dayLabel}).`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: `فشل تنفيذ خدمة الإشعارات: ${msg}`,
    });
  }
}
