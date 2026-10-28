import type {
  ClientEditableReminderSettings,
  DayId,
  FbPostAttemptsRecord,
  ReminderSettings,
  UserProfile,
} from '../types/schedule.js';
import {
  DAYS_LIST,
  PRIMARY_ADMIN_EMAIL,
  isFictionalOrBlockedEmail,
} from './scheduleLogic.js';

export const PUBLIC_SUBSCRIBER_EMAIL = 'public@subscriber.local';
export const DEFAULT_CATCH_UP_WINDOW_MINUTES = 180;
export const FB_POST_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_FB_POST_ATTEMPTS_PER_DATE = 4;

export const DEFAULT_REMINDER_SETTINGS: ClientEditableReminderSettings = {
  enabled: true,
  time: '19:00',
  timezone: 'Africa/Cairo',
  targetDay: 'tomorrow',
  title: 'تذكير جدول العيادات — مجمع ميت عزون الطبي',
  body: 'يرجى مراجعة وتجهيز جدول عيادات {اليوم} ومشاركته.',
  fbAutoPostEnabled: false,
  fbAutoStoryEnabled: false,
  fbAutoPostTime: '20:00',
  fbPostMode: 'photo_with_caption',
  fbTargetDay: 'tomorrow',
  fbFallbackMode: 'text',
  fbSkipEmptyDay: true,
  showFacebookCard: false,
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
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test((time || '').trim());
}

/**
 * Pure calendar date addition on YYYY-MM-DD strings (immune to DST hour shifts).
 */
export function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const parts = (dateStr || '').split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return dateStr;
  }
  const [year, month, day] = parts;
  const utcDate = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  const y = String(utcDate.getUTCFullYear()).padStart(4, '0');
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  scheduledMinutes?: number;
  upperLimitMinutes?: number;
}

/**
 * Checks whether `now` falls within the catch-up window
 * `[scheduledTime, min(scheduledTime + windowMinutes, 23:59 of the same day))`
 * in `Africa/Cairo` time (never crossing midnight), and ensures `lastSentDate`
 * does not already match the expected deduplication date.
 * Defaults to a 180-minute catch-up window to tolerate external cron delays.
 */
export function isWithinReminderWindow(params: {
  now: Date;
  scheduledTime: string;
  lastSentDate?: string | null;
  expectedTargetDate?: string | null;
  timeZone?: string;
  windowMinutes?: number;
}): ReminderWindowCheckResult {
  const {
    now,
    scheduledTime,
    lastSentDate,
    expectedTargetDate,
    timeZone = 'Africa/Cairo',
    windowMinutes = DEFAULT_CATCH_UP_WINDOW_MINUTES,
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

  const dedupDate = (expectedTargetDate || cairo.dateStr).trim();
  const cleanScheduledTime = scheduledTime.trim();
  const cleanLastSent = (lastSentDate || '').trim();
  if (
    cleanLastSent &&
    (cleanLastSent === dedupDate ||
      cleanLastSent === `${dedupDate}@${cleanScheduledTime}`)
  ) {
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
  const midnightCapMinutes = 23 * 60 + 59; // 23:59 of the same day (1439)
  const upperLimitMinutes = Math.min(
    scheduledMinutes + windowMinutes,
    midnightCapMinutes
  );

  if (
    cairo.minutesOfDay >= scheduledMinutes &&
    cairo.minutesOfDay < upperLimitMinutes
  ) {
    return {
      shouldSend: true,
      reason: 'in_window',
      cairoDateStr: cairo.dateStr,
      cairoTimeHHmm: cairo.timeHHmm,
      scheduledMinutes,
      upperLimitMinutes,
    };
  }

  return {
    shouldSend: false,
    reason: 'outside_window',
    cairoDateStr: cairo.dateStr,
    cairoTimeHHmm: cairo.timeHHmm,
    scheduledMinutes,
    upperLimitMinutes,
  };
}

export interface TargetDayResolution {
  dayId: DayId;
  dayLabel: string;
  targetDateStr: string;
  cairoDateStr: string;
}

/**
 * Resolves the target schedule day (`today` or `tomorrow`) and its exact calendar date (`YYYY-MM-DD`)
 * in `Africa/Cairo` timezone.
 */
export function resolveTargetDayId(
  now: Date,
  targetDay: 'today' | 'tomorrow',
  timeZone = 'Africa/Cairo'
): TargetDayResolution {
  const cairo = getCairoDateParts(now, timeZone);
  const currentIdx = WEEKDAY_ORDER.indexOf(cairo.weekday);
  const resolvedIdx =
    targetDay === 'tomorrow' ? (currentIdx + 1) % 7 : currentIdx;
  const dayId = WEEKDAY_ORDER[resolvedIdx] || 'saturday';
  const dayMeta = DAYS_LIST.find((d) => d.id === dayId) || DAYS_LIST[0];
  const targetDateStr =
    targetDay === 'tomorrow'
      ? addDaysToDateStr(cairo.dateStr, 1)
      : cairo.dateStr;

  return {
    dayId: dayMeta.id,
    dayLabel: dayMeta.label,
    targetDateStr,
    cairoDateStr: cairo.dateStr,
  };
}

export interface FbAutoPostCheckInput {
  now: Date;
  fbAutoPostEnabled?: boolean;
  fbAutoPostTime?: string;
  fbTargetDay?: 'today' | 'tomorrow';
  lastFbPostTargetDate?: string | null;
  fbPostLockUntil?: number | null;
  fbPostAttempts?: FbPostAttemptsRecord | null;
  maxAttempts?: number;
  windowMinutes?: number;
  timeZone?: string;
  ignoreTimeWindow?: boolean;
  forceRePost?: boolean;
}

export interface FbAutoPostCheckResult {
  shouldExecute: boolean;
  reason:
    | 'eligible'
    | 'disabled'
    | 'invalid_time'
    | 'outside_window'
    | 'already_posted_for_target_date'
    | 'locked'
    | 'max_attempts_reached';
  targetDayId: DayId;
  targetDayLabel: string;
  targetDateStr: string;
  cairoDateStr: string;
  cairoTimeHHmm: string;
  currentAttemptsCount: number;
}

/**
 * Pure decision function for Facebook automatic daily publishing:
 * - Resolves target day from `fbTargetDay` (completely independent of reminder `targetDay`).
 * - Deduplicates by `lastFbPostTargetDate` (target schedule's YYYY-MM-DD, not run date).
 * - Checks 5-minute transaction lock (`fbPostLockUntil`) and max attempts per target date (`4`).
 * - Uses the catch-up window `[fbAutoPostTime, min(fbAutoPostTime + 180m, 23:59))` unless `ignoreTimeWindow` is true.
 */
export function evaluateFbAutoPostGate(
  input: FbAutoPostCheckInput
): FbAutoPostCheckResult {
  const {
    now,
    fbAutoPostEnabled = false,
    fbAutoPostTime = '20:00',
    fbTargetDay = 'tomorrow',
    lastFbPostTargetDate,
    fbPostLockUntil,
    fbPostAttempts,
    maxAttempts = MAX_FB_POST_ATTEMPTS_PER_DATE,
    windowMinutes = DEFAULT_CATCH_UP_WINDOW_MINUTES,
    timeZone = 'Africa/Cairo',
    ignoreTimeWindow = false,
    forceRePost = false,
  } = input;

  const cleanTargetMode = fbTargetDay === 'today' ? 'today' : 'tomorrow';
  const targetMeta = resolveTargetDayId(now, cleanTargetMode, timeZone);
  const cairo = getCairoDateParts(now, timeZone);

  const currentAttemptsCount =
    fbPostAttempts && fbPostAttempts.date === targetMeta.targetDateStr
      ? Math.max(0, Math.floor(fbPostAttempts.count || 0))
      : 0;

  if (!ignoreTimeWindow && !fbAutoPostEnabled) {
    return {
      shouldExecute: false,
      reason: 'disabled',
      targetDayId: targetMeta.dayId,
      targetDayLabel: targetMeta.dayLabel,
      targetDateStr: targetMeta.targetDateStr,
      cairoDateStr: cairo.dateStr,
      cairoTimeHHmm: cairo.timeHHmm,
      currentAttemptsCount,
    };
  }

  if (
    typeof fbPostLockUntil === 'number' &&
    Number.isFinite(fbPostLockUntil) &&
    fbPostLockUntil > now.getTime()
  ) {
    return {
      shouldExecute: false,
      reason: 'locked',
      targetDayId: targetMeta.dayId,
      targetDayLabel: targetMeta.dayLabel,
      targetDateStr: targetMeta.targetDateStr,
      cairoDateStr: cairo.dateStr,
      cairoTimeHHmm: cairo.timeHHmm,
      currentAttemptsCount,
    };
  }

  if (
    !forceRePost &&
    lastFbPostTargetDate &&
    lastFbPostTargetDate.trim() === targetMeta.targetDateStr
  ) {
    return {
      shouldExecute: false,
      reason: 'already_posted_for_target_date',
      targetDayId: targetMeta.dayId,
      targetDayLabel: targetMeta.dayLabel,
      targetDateStr: targetMeta.targetDateStr,
      cairoDateStr: cairo.dateStr,
      cairoTimeHHmm: cairo.timeHHmm,
      currentAttemptsCount,
    };
  }

  if (!ignoreTimeWindow && currentAttemptsCount >= maxAttempts) {
    return {
      shouldExecute: false,
      reason: 'max_attempts_reached',
      targetDayId: targetMeta.dayId,
      targetDayLabel: targetMeta.dayLabel,
      targetDateStr: targetMeta.targetDateStr,
      cairoDateStr: cairo.dateStr,
      cairoTimeHHmm: cairo.timeHHmm,
      currentAttemptsCount,
    };
  }

  if (!ignoreTimeWindow) {
    const windowCheck = isWithinReminderWindow({
      now,
      scheduledTime: fbAutoPostTime,
      lastSentDate: forceRePost ? null : lastFbPostTargetDate,
      expectedTargetDate: targetMeta.targetDateStr,
      timeZone,
      windowMinutes,
    });

    if (!windowCheck.shouldSend) {
      const mappedReason =
        windowCheck.reason === 'invalid_time'
          ? 'invalid_time'
          : windowCheck.reason === 'already_sent_today'
          ? 'already_posted_for_target_date'
          : 'outside_window';
      return {
        shouldExecute: false,
        reason: mappedReason,
        targetDayId: targetMeta.dayId,
        targetDayLabel: targetMeta.dayLabel,
        targetDateStr: targetMeta.targetDateStr,
        cairoDateStr: cairo.dateStr,
        cairoTimeHHmm: cairo.timeHHmm,
        currentAttemptsCount,
      };
    }
  }

  return {
    shouldExecute: true,
    reason: 'eligible',
    targetDayId: targetMeta.dayId,
    targetDayLabel: targetMeta.dayLabel,
    targetDateStr: targetMeta.targetDateStr,
    cairoDateStr: cairo.dateStr,
    cairoTimeHHmm: cairo.timeHHmm,
    currentAttemptsCount,
  };
}

/**
 * Builds the live Arabic summary line showing which day and time will be auto-posted:
 * e.g. "سينشر تلقائياً جدول (الخميس / غداً) الساعة 09:41 بتوقيت القاهرة"
 */
export function buildLiveAutoPostPreviewLine(params: {
  now?: Date;
  fbTargetDay?: 'today' | 'tomorrow';
  fbAutoPostTime?: string;
  fbAutoStoryEnabled?: boolean;
  timeZone?: string;
}): string {
  const now = params.now || new Date();
  const mode = params.fbTargetDay === 'today' ? 'today' : 'tomorrow';
  const relWord = mode === 'today' ? 'اليوم' : 'غداً';
  const timeStr = (params.fbAutoPostTime || '20:00').trim() || '20:00';
  const resolved = resolveTargetDayId(
    now,
    mode,
    params.timeZone || 'Africa/Cairo'
  );
  const storySuffix = params.fbAutoStoryEnabled ? ' + ستوري الصفحة' : '';
  return `سينشر تلقائياً جدول (${resolved.dayLabel} / ${relWord})${storySuffix} الساعة ${timeStr} بتوقيت القاهرة`;
}

/**
 * Sanitizes any error string before storing in `appConfig/reminders.lastFbPostError`
 * so no token, secret, or credential can ever leak into client-readable Firestore documents.
 */
export function sanitizeFbAutoPostError(raw?: string | null): string {
  if (!raw) return '';
  const redacted = String(raw)
    .replace(/access_token=[^&\s]+/gi, 'access_token=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
    .replace(/EAA[A-Za-z0-9]+/g, '[REDACTED_TOKEN]')
    .trim();
  return redacted.slice(0, 240);
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
 * Strips all server-managed fields so the client never writes or modifies them.
 */
export function validateReminderSettings(input: Partial<ReminderSettings>): {
  valid: boolean;
  errors: string[];
  sanitized: ClientEditableReminderSettings;
} {
  const errors: string[] = [];
  const enabled = Boolean(input.enabled);
  const fbAutoPostEnabled = Boolean(input.fbAutoPostEnabled);
  const fbAutoStoryEnabled = Boolean(input.fbAutoStoryEnabled);
  const fbAutoPostTime = (
    input.fbAutoPostTime ??
    input.time ??
    DEFAULT_REMINDER_SETTINGS.fbAutoPostTime ??
    '20:00'
  ).trim();
  const fbPostMode =
    input.fbPostMode === 'photo_only' || input.fbPostMode === 'text_only'
      ? input.fbPostMode
      : 'photo_with_caption';
  const fbTargetDay =
    input.fbTargetDay === 'today' || input.fbTargetDay === 'tomorrow'
      ? input.fbTargetDay
      : 'tomorrow';
  const fbFallbackMode =
    input.fbFallbackMode === 'skip' || input.fbFallbackMode === 'text'
      ? input.fbFallbackMode
      : 'text';
  const fbSkipEmptyDay =
    typeof input.fbSkipEmptyDay === 'boolean' ? input.fbSkipEmptyDay : true;
  const showFacebookCard =
    typeof input.showFacebookCard === 'boolean'
      ? input.showFacebookCard
      : false;
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
  if (!isValidTimeHHmm(fbAutoPostTime)) {
    errors.push('وقت النشر التلقائي يجب أن يكون بصيغة HH:mm (مثال: 20:00).');
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
      fbAutoPostEnabled,
      fbAutoStoryEnabled,
      fbAutoPostTime,
      fbPostMode,
      fbTargetDay,
      fbFallbackMode,
      fbSkipEmptyDay,
      showFacebookCard,
    },
  };
}

