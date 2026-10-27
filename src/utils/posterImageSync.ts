import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CenterSettings, DayId, PosterImageData, ScheduleRow } from '../types/schedule';
import { generatePosterJpeg1080x1350 } from './exportPoster';

export interface SyncPosterResult {
  ok: boolean;
  sizeChars: number;
  qualityUsed: number;
  error?: string;
}

/**
 * Generates an exact 1080x1350 JPEG poster from the current day's poster DOM node
 * and saves it to Firestore at `posterImages/{dayId}`.
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

    const docPayload: PosterImageData = {
      dayId,
      version,
      imageBase64: base64,
      mime,
      updatedAt: serverTimestamp(),
    };

    const posterDocRef = doc(db, 'posterImages', dayId);
    await setDoc(posterDocRef, docPayload);

    return {
      ok: true,
      sizeChars: base64.length,
      qualityUsed,
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
