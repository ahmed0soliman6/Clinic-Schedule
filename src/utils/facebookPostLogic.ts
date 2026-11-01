import {
  CenterSettings,
  FacebookPostMode,
  ScheduleRow,
} from '../types/schedule.js';
import {
  INSTAGRAM_OFFICIAL_URL,
  buildDailySocialPostText,
} from './scheduleLogic.js';

export const INSTAGRAM_PAGE_URL = INSTAGRAM_OFFICIAL_URL;

export interface ShortFacebookCaptionParams {
  dayLabel: string;
  settings: CenterSettings;
  rows?: ScheduleRow[];
}

/**
 * Builds the Facebook photo post caption directly from the user-editable
 * "صندوق البوست" template (`settings.postTemplate`, falling back to `DEFAULT_POST_TEMPLATE`).
 */
export function buildShortFacebookCaption(params: ShortFacebookCaptionParams): string {
  const { dayLabel, settings, rows } = params;
  return buildDailySocialPostText(dayLabel, settings, rows);
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
      action: 'skip_retry';
      reason: string;
      errorMessage: string;
    }
  | {
      action: 'reject_error';
      errorMessage: string;
    };

export interface PostDecisionInput {
  mode: FacebookPostMode;
  fallbackMode?: 'text' | 'skip';
  scheduleVersion: number;
  storedPosterImage: {
    dayId: string;
    version: number;
    imageBase64: string;
    mime: string;
  } | null;
  dayLabel: string;
  settings: CenterSettings;
  rows?: ScheduleRow[];
  isManualTrigger: boolean;
}

export type PosterImageFreshnessStatus =
  | 'up_to_date'
  | 'outdated'
  | 'missing'
  | 'invalid';

export function inspectStoredPosterImageStatus(
  scheduleVersion: number,
  storedPosterImage: {
    dayId: string;
    version: number;
    imageBase64: string;
    mime: string;
  } | null
): { status: PosterImageFreshnessStatus; posterVersion: number | null } {
  if (!storedPosterImage || !storedPosterImage.imageBase64) {
    return { status: 'missing', posterVersion: null };
  }
  if (storedPosterImage.version !== scheduleVersion) {
    return { status: 'outdated', posterVersion: storedPosterImage.version };
  }
  try {
    const buf = Buffer.from(storedPosterImage.imageBase64.trim(), 'base64');
    const valid = validateJpegBuffer(buf);
    if (!valid.valid) {
      return { status: 'invalid', posterVersion: storedPosterImage.version };
    }
    return { status: 'up_to_date', posterVersion: storedPosterImage.version };
  } catch {
    return { status: 'invalid', posterVersion: storedPosterImage.version };
  }
}

/**
 * Determines whether to publish a photo, fallback to text, or skip and retry,
 * strictly validating version matching and rejecting stale images on manual clicks.
 */
export function decideFacebookPublishPlan(input: PostDecisionInput): PostDecision {
  const {
    mode,
    fallbackMode = 'text',
    scheduleVersion,
    storedPosterImage,
    dayLabel,
    settings,
    rows,
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

    if (fallbackMode === 'skip') {
      return {
        action: 'skip_retry',
        reason: errorReason,
        errorMessage: `تم تأجيل النشر التلقائي لحين تحديث الصورة: ${errorReason}.`,
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
    if (fallbackMode === 'skip') {
      return {
        action: 'skip_retry',
        reason: 'فشل فك ترميز Base64 للصورة',
        errorMessage:
          'تم تأجيل النشر التلقائي: بيانات الصورة المحفوظة غير صالحة.',
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
    if (fallbackMode === 'skip') {
      return {
        action: 'skip_retry',
        reason: validation.error || 'فحص ملف JPEG فشل',
        errorMessage: `تم تأجيل النشر التلقائي: ${
          validation.error || 'فحص ملف JPEG فشل'
        }`,
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
      ? buildShortFacebookCaption({ dayLabel, settings, rows })
      : undefined;

  return {
    action: 'post_photo',
    jpegBuffer: buffer,
    caption,
  };
}

