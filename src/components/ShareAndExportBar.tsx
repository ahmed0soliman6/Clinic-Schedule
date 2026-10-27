import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  MessageSquareText,
  Share2,
  Smartphone,
} from 'lucide-react';
import { CenterSettings, DayId, ScheduleRow } from '../types/schedule';
import {
  exportPosterAsPng,
  preparePosterExportAssets,
  triggerInstantPngDownload,
} from '../utils/exportPoster';
import {
  WHATSAPP_CHANNEL_FULL_URL,
  WHATSAPP_CHANNEL_SHORT_URL,
  buildDailySocialPostText,
} from '../utils/scheduleLogic';

interface ShareAndExportBarProps {
  dayId?: DayId;
  dayLabel: string;
  rows: ScheduleRow[];
  settings: CenterSettings;
  posterRef: React.RefObject<HTMLDivElement | null>;
}

function copyTextToClipboardSync(text: string): void {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch {
    // Fallback
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

export const ShareAndExportBar: React.FC<ShareAndExportBarProps> = ({
  dayLabel,
  rows,
  settings,
  posterRef,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [cachedPoster, setCachedPoster] = useState<{
    dataUrl: string;
    file: File;
    dayLabel: string;
  } | null>(null);
  const [postText, setPostText] = useState<string>(() =>
    buildDailySocialPostText(dayLabel, settings)
  );
  const [showPostBox, setShowPostBox] = useState<boolean>(false);
  const [copiedPost, setCopiedPost] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Update daily post text whenever the selected day or center settings change
  useEffect(() => {
    setPostText(buildDailySocialPostText(dayLabel, settings));
  }, [dayLabel, settings]);

  // Pre-render the 1440x1800 (4:5) high-res PNG in the background so clicking any share button
  // works synchronously with zero async delay
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const assets = await preparePosterExportAssets(
          dayLabel,
          rows,
          settings,
          posterRef.current
        );
        if (!cancelled) {
          setCachedPoster({ ...assets, dayLabel });
        }
      } catch {
        // Ignore background pre-render errors
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dayLabel, rows, settings, posterRef]);

  const handleCopyPostText = () => {
    copyTextToClipboardSync(postText);
    setCopiedPost(true);
    setStatusBanner(`تم نسخ نص بوست يوم ${dayLabel} إلى الحافظة بنجاح!`);
    setTimeout(() => setCopiedPost(false), 2500);
  };

  const handleDownload4x5Png = async () => {
    if (cachedPoster && cachedPoster.dayLabel === dayLabel) {
      triggerInstantPngDownload(cachedPoster.dataUrl, dayLabel);
      setStatusBanner(
        `✅ تم حفظ صورة جدول يوم ${dayLabel} بأبعاد (4:5) الثابتة.`
      );
      return;
    }

    setIsExporting(true);
    try {
      const assets = await exportPosterAsPng(
        dayLabel,
        rows,
        settings,
        posterRef.current
      );
      setCachedPoster({ ...assets, dayLabel });
      setStatusBanner(
        `✅ تم حفظ صورة جدول يوم ${dayLabel} بأبعاد (4:5) الثابتة.`
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Share ONLY the 4:5 PNG Image File WITHOUT post text
  const handleNativeShareImageOnly = async () => {
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    if (cachedPoster && cachedPoster.dayLabel === dayLabel) {
      if (
        typeof nav.share === 'function' &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [cachedPoster.file] })
      ) {
        try {
          await nav.share({
            files: [cachedPoster.file],
          });
          setStatusBanner(
            `✅ تمت مشاركة صورة جدول يوم ${dayLabel} (4:5) فقط بدون بوست!`
          );
          return;
        } catch {
          // Fallback to download if dismissed or blocked by iframe
        }
      }
      triggerInstantPngDownload(cachedPoster.dataUrl, dayLabel);
      setStatusBanner(
        `✅ تم حفظ صورة الجدول (4:5) — يمكنك إرفاقها مباشرة.`
      );
      return;
    }

    await handleDownload4x5Png();
  };

  // Share the 4:5 PNG Image File + Post Text together
  const handleNativeMobileShareWithPost = async () => {
    copyTextToClipboardSync(postText);
    setCopiedPost(true);
    setTimeout(() => setCopiedPost(false), 3000);

    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    if (cachedPoster && cachedPoster.dayLabel === dayLabel) {
      if (
        typeof nav.share === 'function' &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [cachedPoster.file] })
      ) {
        try {
          await nav.share({
            files: [cachedPoster.file],
            title: `جدول عيادات يوم ${dayLabel}`,
            text: postText,
          });
          setStatusBanner(
            `✅ تمت مشاركة صورة جدول يوم ${dayLabel} (4:5) مع البوست مباشرة!`
          );
          return;
        } catch {
          // Fallback to download if dismissed or blocked by iframe
        }
      }
      triggerInstantPngDownload(cachedPoster.dataUrl, dayLabel);
      setStatusBanner(
        `✅ تم حفظ صورة الجدول (4:5) ونسخ البوست تلقائيًا — يمكنك الآن إرفاقها في أي تطبيق.`
      );
      return;
    }

    await handleDownload4x5Png();
  };

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-[780px] rounded-2xl bg-white p-2.5 sm:p-3.5 shadow-sm border border-purple-100 space-y-2.5"
    >
      {/* 4 Compact Action Buttons in ONE Single Row: حفظ | مشاركة | مشاركة+بوست | بوست */}
      <div
        data-testid="share-buttons-grid"
        className="grid grid-cols-4 gap-1.5 sm:gap-2.5"
      >
        {/* Button 1: حفظ */}
        <button
          type="button"
          onClick={handleDownload4x5Png}
          disabled={isExporting}
          data-testid="export-png-btn"
          title="حفظ صورة الجدول PNG بأبعاد 4:5 ثابتة"
          className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-purple-700 px-1.5 sm:px-3 py-2.5 text-[11px] sm:text-sm font-black text-white whitespace-nowrap shadow-xs hover:bg-purple-800 disabled:opacity-60 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span>{isExporting ? '...' : 'حفظ'}</span>
        </button>

        {/* Button 2: مشاركة (صورة فقط بدون بوست) */}
        <button
          type="button"
          onClick={handleNativeShareImageOnly}
          data-testid="share-image-only-btn"
          title="مشاركة صورة الجدول فقط بدون نص البوست"
          className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-sky-600 px-1.5 sm:px-3 py-2.5 text-[11px] sm:text-sm font-black text-white whitespace-nowrap shadow-xs hover:bg-sky-700 transition cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span>مشاركة</span>
        </button>

        {/* Button 3: مشاركة+بوست */}
        <button
          type="button"
          onClick={handleNativeMobileShareWithPost}
          data-testid="share-native-btn"
          title="مشاركة ملف الصورة مع البوست مباشرة عبر تطبيقات الهاتف"
          className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-1 sm:px-3 py-2.5 text-[10px] xs:text-[11px] sm:text-sm font-black text-white whitespace-nowrap shadow-xs hover:bg-indigo-700 transition cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span>مشاركة+بوست</span>
        </button>

        {/* Button 4: بوست */}
        <button
          type="button"
          onClick={() => setShowPostBox((prev) => !prev)}
          data-testid="toggle-post-caption-btn"
          title={`عرض ونسخ النص الترويجي لبوست يوم ${dayLabel}`}
          className={`w-full inline-flex items-center justify-center gap-1 rounded-xl border-2 px-1.5 sm:px-3 py-2.5 text-[11px] sm:text-sm font-black whitespace-nowrap shadow-xs transition cursor-pointer ${
            showPostBox
              ? 'border-purple-600 bg-purple-100 text-purple-950'
              : 'border-purple-300 bg-purple-50 text-purple-950 hover:bg-purple-100'
          }`}
        >
          <MessageSquareText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-700 shrink-0" />
          <span>بوست</span>
        </button>
      </div>

      {/* Confirmation Banner when Image + Post are Prepared */}
      {statusBanner && (
        <div
          data-testid="share-status-banner"
          className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-900 flex items-center justify-between gap-2"
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 font-extrabold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Daily Post Text Box (Formatted cleanly in a single header row + full height textarea) */}
      {showPostBox && (
        <div
          data-testid="daily-post-box"
          className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] sm:text-xs font-extrabold text-slate-800 whitespace-nowrap">
                بوست يوم {dayLabel}:
              </span>
              <a
                href={WHATSAPP_CHANNEL_FULL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-emerald-700 underline hover:text-emerald-900 truncate"
              >
                قناة الواتساب ({WHATSAPP_CHANNEL_SHORT_URL})
              </a>
            </div>
            <button
              type="button"
              onClick={handleCopyPostText}
              data-testid="copy-post-text-btn"
              className="inline-flex items-center gap-1 rounded-lg bg-purple-700 px-2.5 py-1.5 text-[11px] sm:text-xs font-extrabold text-white whitespace-nowrap hover:bg-purple-800 transition cursor-pointer shrink-0"
            >
              {copiedPost ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>تم النسخ!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ البوست</span>
                </>
              )}
            </button>
          </div>
          <textarea
            rows={8}
            dir="rtl"
            aria-label="نص البوست اليومي"
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-900 leading-relaxed focus:outline-none focus:border-purple-600 resize-y"
          />
        </div>
      )}
    </div>
  );
};
