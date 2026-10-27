import type { CenterSettings, DayId, ScheduleRow } from '../types/schedule.js';
import {
  DAYS_LIST,
  DEFAULT_POST_TEMPLATE,
  WHATSAPP_CHANNEL_SHORT_URL,
  buildDailySocialPostText,
  filterNonEmptyRows,
} from './scheduleLogic.js';

export interface FacebookPostResult {
  ok: boolean;
  success: boolean;
  post_id?: string;
  dayId?: DayId;
  dayLabel?: string;
  message?: string;
  error?: string;
  statusCode?: number;
}

export function normalizeEnvSecret(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function normalizeFacebookPageId(raw?: string): string {
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
    // Ignore URL parse errors and return trimmed value
  }
  return clean;
}

/**
 * Formats a single clinic schedule row into a clean, readable Arabic line for Facebook posts.
 */
export function formatClinicRowForFacebook(row: ScheduleRow): string {
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

/**
 * Formats the complete daily clinic schedule post for Facebook.
 * - Uses the center's `postTemplate` from settings.
 * - Guarantees that the formatted list of clinics/doctors/times is included in the post
 *   even if `{العيادات}` was not explicitly placed in `settings.postTemplate`.
 */
export function formatFacebookSchedulePost(params: {
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

  // If the template already includes {العيادات}, replace it with our rich formatted clinic lines
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

  // Otherwise, build the base post text and inject the formatted clinics list right after the header line
  const baseText = buildDailySocialPostText(dayLabel, settings, cleanRows);
  const lines = baseText.split('\n');
  if (lines.length <= 1) {
    return `${baseText}\n\n${clinicsBlock}`;
  }

  const headerLine = lines[0];
  const footerLines = lines.slice(1).join('\n');
  return `${headerLine}\n\n${clinicsBlock}\n\n${footerLines}`;
}

/**
 * Publishes a text post to a Facebook Page via Meta Graph API v21.0
 * (`POST https://graph.facebook.com/v21.0/{FB_PAGE_ID}/feed`).
 */
export async function publishToFacebookPageGraphApi(params: {
  pageId?: string;
  pageAccessToken?: string;
  message: string;
  fetchImpl?: typeof fetch;
}): Promise<FacebookPostResult> {
  const cleanPageId = normalizeFacebookPageId(params.pageId);
  const cleanToken = normalizeEnvSecret(params.pageAccessToken);
  const cleanMessage = (params.message || '').trim();
  const fetchFn = params.fetchImpl || globalThis.fetch;

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
    const response = await fetchFn(graphUrl, {
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
        error_subcode?: number;
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
    if (!postId) {
      return {
        ok: false,
        success: false,
        statusCode: 502,
        error: 'استجاب خادم فيسبوك بدون إرجاع معرف المنشور (post_id).',
      };
    }

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

export function resolveDayMetaById(dayId?: string | null): {
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
