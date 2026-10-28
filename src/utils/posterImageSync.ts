import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  CenterSettings,
  DayId,
  PosterImageData,
  PosterMetaData,
  ScheduleRow,
} from '../types/schedule';
import { generatePosterJpeg1080x1350 } from './exportPoster';

export interface SyncPosterResult {
  ok: boolean;
  sizeChars: number;
  qualityUsed: number;
  meta?: PosterMetaData;
  error?: string;
}

/**
 * Generates an exact 1080x1350 JPEG poster from the current day's poster DOM node
 * and saves it to Firestore at `posterImages/{dayId}` and `posterMeta/{dayId}` in a single batch.
 * Strictly checks that base64 size is < 900,000 characters to comply with Firestore limits and security rules.
 */
export async function syncPosterImageToFirestore(params: {
  dayId: DayId;
  version: number;
  dayLabel: string;
  rows: ScheduleRow[];
  settings: CenterSettings;
  domNode?: HTMLElement | null;
}): Promise<SyncPosterResult> {
  const { dayId, version, dayLabel, rows, settings, domNode } = params;

  try {
    const { base64, mime, qualityUsed } = await generatePosterJpeg1080x1350(
      dayLabel,
      rows,
      settings,
      domNode
    );

    if (!base64 || base64.length === 0) {
      return {
        ok: false,
        sizeChars: 0,
        qualityUsed,
        error: 'فشل في توليد صورة البوستر.',
      };
    }

    if (base64.length >= 900000) {
      return {
        ok: false,
        sizeChars: base64.length,
        qualityUsed,
        error: `حجم صورة البوستر (${base64.length} حرف) يتجاوز الحد الأقصى المسموح به في قاعدة البيانات (900KB).`,
      };
    }

    const safeVersion = Math.max(1, Math.floor(version || 1));
    const nowIso = new Date().toISOString();

    const docPayload: PosterImageData = {
      dayId,
      version: safeVersion,
      imageBase64: base64,
      mime,
      updatedAt: serverTimestamp(),
    };

    const metaPayload: PosterMetaData = {
      dayId,
      version: safeVersion,
      updatedAt: nowIso,
      bytes: base64.length,
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'posterImages', dayId), docPayload);
    batch.set(doc(db, 'posterMeta', dayId), metaPayload);
    await batch.commit();

    return {
      ok: true,
      sizeChars: base64.length,
      qualityUsed,
      meta: metaPayload,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      sizeChars: 0,
      qualityUsed: 0,
      error: `تعذر حفظ صورة البوستر في السحابة: ${msg}`,
    };
  }
}

