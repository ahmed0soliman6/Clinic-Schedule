import type { DayId, ReminderSettings, UserProfile } from '../types/schedule.js';
import {
  DAYS_LIST,
  PRIMARY_ADMIN_EMAIL,
  isFictionalOrBlockedEmail,
} from './scheduleLogic.js';

export const PUBLIC_SUBSCRIBER_EMAIL = 'public@subscriber.local';

export const DEFAULT_REMINDER_SETTINGS: Omit<
  ReminderSettings,
  'lastSentDate' | 'updatedBy' | 'updatedByEmail' | 'updatedAt'
> = {
  enabled: true,
  time: '19:00',
  timezone: 'Africa/Cairo',
  targetDay: 'tomorrow',
  title: 'تذكير جدول العيادات — مجمع ميت عزون الطبي',
  body: 'يرجى مراجعة وتجهيز جدول عيادات {اليوم} ومشاركته.',
};

const WEEKDAY_ORDER: DayId[] = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

const EN_WEEKDAY_TO_DAY_ID: Record<string, DayId> = {
  saturday: 'saturday',
  sunday: 'sunday',
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
};

/**
 * Computes a deterministic 64-character lowercase hex SHA-256 hash of an FCM token
 * for use as `fcmTokens/{docId}` in Firestore.
 */
export async function computeTokenDocId(token: string): Promise<string> {
  const clean = token.trim();
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    globalThis.crypto.subtle
  ) {
    const encoded = new TextEncoder().encode(clean);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic hex hash if SubtleCrypto is unavailable
  let h1 = 0xdeadbeef ^ clean.length;
  let h2 = 0x41c6ce57 ^ clean.length;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  ).repeat(4);
}

export function isValidTimeHHmm(time: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time.trim());
}

export interface CairoDateParts {
  dateStr: string; // YYYY-MM-DD in Africa/Cairo
  timeHHmm: string; // HH:mm in Africa/Cairo
  hour: number;
  minute: number;
  minutesOfDay: number;
  weekday: DayId;
}

/**
 * Extracts date, 24h time, and weekday in `Africa/Cairo` (or any IANA timezone)
 * using Intl.DateTimeFormat so Egyptian DST (UTC+2 / UTC+3) is handled accurately.
 */
export function getCairoDateParts(
  now: Date,
  timeZone = 'Africa/Cairo'
): CairoDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const year = map.year || '1970';
  const month = (map.month || '01').padStart(2, '0');
  const day = (map.day || '01').padStart(2, '0');
  const rawHour = parseInt(map.hour || '0', 10);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = parseInt(map.minute || '0', 10);
  const weekdayKey = (map.weekday || 'saturday').toLowerCase();
  const weekday: DayId = EN_WEEKDAY_TO_DAY_ID[weekdayKey] || 'saturday';

  const dateStr = `${year}-${month}-${day}`;
  const timeHHmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(
    2,
    '0'
  )}`;

  return {
    dateStr,
    timeHHmm,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    weekday,
  };
}

export interface ReminderWindowCheckResult {
  shouldSend: boolean;
  reason:
    | 'in_window'
    | 'outside_window'
    | 'already_sent_today'
    | 'invalid_time';
  cairoDateStr: string;
  cairoTimeHHmm: string;
}

/**
 * Checks whether `now` falls within the 10-minute reminder window `[scheduledTime, scheduledTime + 10 min)`
 * in `Africa/Cairo` time, and ensures `lastSentDate` does not already match today's Cairo date.
 */
export function isWithinReminderWindow(params: {
  now: Date;
  scheduledTime: string;
  lastSentDate?: string | null;
  timeZone?: string;
  windowMinutes?: number;
}): ReminderWindowCheckResult {
  const {
    now,
    scheduledTime,
    lastSentDate,
    timeZone = 'Africa/Cairo',
    windowMinutes = 10,
  } = params;

  const cairo = getCairoDateParts(now, timeZone);

  if (!isValidTimeHHmm(scheduledTime)) {
    return {
      shouldSend: false,
      reason: 'invalid_time',
      cairoDateStr: cairo.dateStr,
      cairoTimeHHmm: cairo.timeHHmm,
    };
  }

  if (lastSentDate && lastSentDate.trim() === cairo.dateStr) {
    return {
      shouldSend: false,
      reason: 'already_sent_today',
      cairoDateStr: cairo.dateStr,
      cairoTimeHHmm: cairo.timeHHmm,
    };
  }

  const [schedH, schedM] = scheduledTime
    .trim()
    .split(':')
    .map((n) => parseInt(n, 10));
  const scheduledMinutes = schedH * 60 + schedM;
  const diffMinutes = cairo.minutesOfDay - scheduledMinutes;

  if (diffMinutes >= 0 && diffMinutes < windowMinutes) {
    return {
      shouldSend: true,
      reason: 'in_window',
      cairoDateStr: cairo.dateStr,
      cairoTimeHHmm: cairo.timeHHmm,
    };
  }

  return {
    shouldSend: false,
    reason: 'outside_window',
    cairoDateStr: cairo.dateStr,
    cairoTimeHHmm: cairo.timeHHmm,
  };
}

/**
 * Resolves the target schedule day (`today` or `tomorrow`) in `Africa/Cairo` timezone.
 */
export function resolveTargetDayId(
  now: Date,
  targetDay: 'today' | 'tomorrow',
  timeZone = 'Africa/Cairo'
): { dayId: DayId; dayLabel: string } {
  const cairo = getCairoDateParts(now, timeZone);
  const currentIdx = WEEKDAY_ORDER.indexOf(cairo.weekday);
  const resolvedIdx =
    targetDay === 'tomorrow' ? (currentIdx + 1) % 7 : currentIdx;
  const dayId = WEEKDAY_ORDER[resolvedIdx] || 'saturday';
  const dayMeta = DAYS_LIST.find((d) => d.id === dayId) || DAYS_LIST[0];

  return {
    dayId: dayMeta.id,
    dayLabel: dayMeta.label,
  };
}

/**
 * Formats the reminder notification title and body, substituting `{اليوم}` with the Arabic day label.
 */
export function formatReminderMessage(
  settings: Pick<ReminderSettings, 'title' | 'body'>,
  dayLabel: string
): { title: string; body: string } {
  const rawTitle = (settings.title || DEFAULT_REMINDER_SETTINGS.title).trim();
  const rawBody = (settings.body || DEFAULT_REMINDER_SETTINGS.body).trim();

  const title = rawTitle.replace(/\{اليوم\}/g, dayLabel);
  const body = rawBody.includes('{اليوم}')
    ? rawBody.replace(/\{اليوم\}/g, dayLabel)
    : `${rawBody} (${dayLabel})`;

  return { title, body };
}

export interface StoredTokenEntry {
  docId: string;
  token: string;
  email: string;
  uid: string;
}

/**
 * Filters FCM tokens so reminders are ONLY sent to currently registered staff in `users/{emailDocId}`:
 * - ADMIN receives reminders for any `targetDayId`.
 * - EDITOR receives reminders ONLY if `targetDayId` is in their `allowedDays`.
 * - Deleted/unregistered users or invalid tokens are excluded.
 */
export function filterEligibleReminderTokens(
  tokens: StoredTokenEntry[],
  registeredUsers: UserProfile[],
  targetDayId: DayId
): StoredTokenEntry[] {
  const userByEmail = new Map<string, UserProfile>();
  for (const user of registeredUsers) {
    if (!user || !user.email) continue;
    const cleanEmail = user.email.trim().toLowerCase();
    if (!cleanEmail || isFictionalOrBlockedEmail(cleanEmail)) continue;
    userByEmail.set(cleanEmail, user);
  }

  const seenTokens = new Set<string>();
  const eligible: StoredTokenEntry[] = [];

  for (const entry of tokens) {
    if (!entry || typeof entry.token !== 'string' || entry.token.trim().length < 10) {
      continue;
    }
    const cleanEmail = (entry.email || '').trim().toLowerCase();
    if (!cleanEmail || isFictionalOrBlockedEmail(cleanEmail)) {
      continue;
    }

    const isPublicSubscriber = cleanEmail === PUBLIC_SUBSCRIBER_EMAIL;
    const isPrimaryAdmin = cleanEmail === PRIMARY_ADMIN_EMAIL;
    const userDoc = userByEmail.get(cleanEmail);

    if (!isPublicSubscriber && !isPrimaryAdmin && !userDoc) {
      // Staff user is no longer in users/{emailDocId} -> exclude
      continue;
    }

    if (!isPublicSubscriber) {
      const role = isPrimaryAdmin ? 'ADMIN' : userDoc!.role;
      if (role !== 'ADMIN' && role !== 'EDITOR') {
        continue;
      }

      if (role === 'EDITOR') {
        const allowed = Array.isArray(userDoc?.allowedDays)
          ? userDoc!.allowedDays
          : [];
        if (!allowed.includes(targetDayId)) {
          continue;
        }
      }
    }

    const cleanToken = entry.token.trim();
    if (seenTokens.has(cleanToken)) {
      continue;
    }
    seenTokens.add(cleanToken);
    eligible.push({
      ...entry,
      token: cleanToken,
      email: cleanEmail,
    });
  }

  return eligible;
}

/**
 * Validates and sanitizes ReminderSettings before client-side save to `appConfig/reminders`.
 * Strips `lastSentDate` so client never writes or modifies it.
 */
export function validateReminderSettings(input: Partial<ReminderSettings>): {
  valid: boolean;
  errors: string[];
  sanitized: Omit<
    ReminderSettings,
    'lastSentDate' | 'updatedBy' | 'updatedByEmail' | 'updatedAt'
  >;
} {
  const errors: string[] = [];
  const enabled = Boolean(input.enabled);
  const time = (input.time ?? DEFAULT_REMINDER_SETTINGS.time).trim();
  const targetDay =
    input.targetDay === 'today' || input.targetDay === 'tomorrow'
      ? input.targetDay
      : 'tomorrow';
  const title = (input.title ?? DEFAULT_REMINDER_SETTINGS.title).trim();
  const body = (input.body ?? DEFAULT_REMINDER_SETTINGS.body).trim();

  if (!isValidTimeHHmm(time)) {
    errors.push('وقت الإشعار يجب أن يكون بصيغة HH:mm (مثال: 19:00).');
  }
  if (!title || title.length > 160) {
    errors.push('عنوان الإشعار مطلوب ولا يتجاوز 160 حرفاً.');
  }
  if (!body || body.length > 500) {
    errors.push('نص الإشعار مطلوب ولا يتجاوز 500 حرف.');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      enabled,
      time,
      timezone: 'Africa/Cairo',
      targetDay,
      title: title.slice(0, 160),
      body: body.slice(0, 500),
    },
  };
}
