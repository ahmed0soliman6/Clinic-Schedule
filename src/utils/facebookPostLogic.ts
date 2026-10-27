import { CenterSettings, FacebookPostMode } from '../types/schedule.js';
import { WHATSAPP_CHANNEL_SHORT_URL } from './scheduleLogic.js';

export const INSTAGRAM_PAGE_URL = 'https://www.instagram.com/mit.azzoun.medical';

export interface ShortFacebookCaptionParams {
  dayLabel: string;
  settings: CenterSettings;
}

/**
 * Builds a clean, short caption for Facebook photo posts.
 * It contains day title, address, contact numbers, and official channels,
 * and intentionally DOES NOT repeat the clinics list because the high-resolution
 * poster image already presents all clinics and doctors clearly.
 */
export function buildShortFacebookCaption(params: ShortFacebookCaptionParams): string {
  const { dayLabel, settings } = params;
  const cleanWa = (settings.whatsappPhone || '').replace(/\D/g, '');
  const waIntl = cleanWa.startsWith('2') ? cleanWa : `2${cleanWa}`;
  const waUrl = `https://wa.me/${waIntl}`;

  const complexName = (settings.complexName || 'مجمع ميت عزون الطبي').trim();
  const address = (settings.address || 'ميت عزون - بجوار المسجد الكبير').trim();
  const waPhone = (settings.whatsappPhone || '01202027567').trim();
  const landline = (settings.landlinePhone || '0502053187').trim();
  const dentalPhone = (settings.dentalPhone || '01515674347').trim();
  const dentalLabel = (settings.dentalLabel || 'عيادة الأسنان').trim();

  return [
    `جدول عيادات يوم ${dayLabel} — ${complexName}`,
    `📍 ${address}`,
    '',
    '📞 للحجز والاستفسار:',
    `• واتساب: ${waPhone} 👉 ${waUrl}`,
    `• هاتف أرضي: ${landline}`,
    `• ${dentalLabel}: ${dentalPhone}`,
    '',
    `📢 قناة الواتساب: ${WHATSAPP_CHANNEL_SHORT_URL}`,
    `📷 إنستغرام: ${INSTAGRAM_PAGE_URL}`,
  ].join('\n');
}

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB

export interface JpegValidationResult {
  valid: boolean;
  sizeBytes: number;
  error?: string;
}

/**
 * Validates a decoded JPEG buffer against JPEG magic bytes (FF D8 FF)
 * and maximum allowed file size (3MB).
 */
export function validateJpegBuffer(
  buffer: Uint8Array | Buffer
): JpegValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      sizeBytes: 0,
      error: 'بيانات الصورة فارغة تماماً.',
    };
  }

  if (buffer.length < 3) {
    return {
      valid: false,
      sizeBytes: buffer.length,
      error: 'حجم ملف الصورة أصغر من ترويسة JPEG القياسية.',
    };
  }

  // Magic bytes check for JPEG: FF D8 FF
  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  if (!isJpeg) {
    return {
      valid: false,
      sizeBytes: buffer.length,
      error: 'الملف ليس صورة JPEG صالحة (فشل فحص التوقيع الرقمي Magic Bytes FF D8 FF).',
    };
  }

  if (buffer.length > MAX_PHOTO_BYTES) {
    return {
      valid: false,
      sizeBytes: buffer.length,
      error: `حجم الصورة (${(buffer.length / (1024 * 1024)).toFixed(
        2
      )}MB) يتجاوز الحد الأقصى المسموح به (3MB).`,
    };
  }

  return {
    valid: true,
    sizeBytes: buffer.length,
  };
}

export type PostDecision =
  | {
      action: 'post_photo';
      jpegBuffer: Buffer;
      caption?: string;
    }
  | {
      action: 'post_text_only';
      reason: string;
      warning?: string;
    }
  | {
      action: 'reject_error';
      errorMessage: string;
    };

export interface PostDecisionInput {
  mode: FacebookPostMode;
  scheduleVersion: number;
  storedPosterImage: {
    dayId: string;
    version: number;
    imageBase64: string;
    mime: string;
  } | null;
  dayLabel: string;
  settings: CenterSettings;
  isManualTrigger: boolean;
}

/**
 * Determines whether to publish a photo or fallback to text,
 * strictly validating version matching and rejecting stale images on manual clicks.
 */
export function decideFacebookPublishPlan(input: PostDecisionInput): PostDecision {
  const {
    mode,
    scheduleVersion,
    storedPosterImage,
    dayLabel,
    settings,
    isManualTrigger,
  } = input;

  if (mode === 'text_only') {
    return {
      action: 'post_text_only',
      reason: 'نمط النشر محدد على «نص فقط» في الإعدادات.',
    };
  }

  // Version match check
  const isMissing = !storedPosterImage || !storedPosterImage.imageBase64;
  const isVersionMismatch =
    Boolean(storedPosterImage) &&
    storedPosterImage!.version !== scheduleVersion;

  if (isMissing || isVersionMismatch) {
    const errorReason = isMissing
      ? 'لم يتم العثور على صورة بوستر محفوظة لجدول هذا اليوم'
      : `إصدار الصورة المحفوظة (${storedPosterImage!.version}) لا يطابق إصدار الجدول المعتمد (${scheduleVersion})`;

    if (isManualTrigger) {
      return {
        action: 'reject_error',
        errorMessage:
          'صورة الجدول غير محدّثة، افتح اليوم وانتظر اكتمال الحفظ ثم أعد المحاولة.',
      };
    }

    return {
      action: 'post_text_only',
      reason: errorReason,
      warning: `تراجع النشر التلقائي إلى نص فقط: ${errorReason}.`,
    };
  }

  // Decode Base64 to Buffer
  let buffer: Buffer;
  try {
    buffer = Buffer.from(storedPosterImage.imageBase64.trim(), 'base64');
  } catch {
    if (isManualTrigger) {
      return {
        action: 'reject_error',
        errorMessage: 'فشل فك ترميز بيانات الصورة المحفوظة في السحابة.',
      };
    }
    return {
      action: 'post_text_only',
      reason: 'فشل فك ترميز Base64 للصورة',
      warning: 'تراجع النشر التلقائي إلى نص فقط: بيانات الصورة غير صالحة.',
    };
  }

  const validation = validateJpegBuffer(buffer);
  if (!validation.valid) {
    if (isManualTrigger) {
      return {
        action: 'reject_error',
        errorMessage:
          validation.error || 'صورة الجدول المخزنة تالفة أو غير صالحة.',
      };
    }
    return {
      action: 'post_text_only',
      reason: validation.error || 'فحص ملف JPEG فشل',
      warning: `تراجع النشر التلقائي إلى نص فقط: ${validation.error}`,
    };
  }

  const caption =
    mode === 'photo_with_caption'
      ? buildShortFacebookCaption({ dayLabel, settings })
      : undefined;

  return {
    action: 'post_photo',
    jpegBuffer: buffer,
    caption,
  };
}
