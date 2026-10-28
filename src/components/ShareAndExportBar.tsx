import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Globe,
  MessageSquareText,
  Send,
  Share2,
  Smartphone,
  X,
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
import { buildLiveAutoPostPreviewLine } from '../utils/reminderLogic';

interface ShareAndExportBarProps {
  dayId?: DayId;
  dayLabel: string;
  rows: ScheduleRow[];
  settings: CenterSettings;
  posterRef: React.RefObject<HTMLDivElement | null>;
  canManageFacebook?: boolean;
  showFacebookCard?: boolean;
  onCloseFacebookCard?: () => void;
  fbAutoPostEnabled?: boolean;
  fbAutoPostTime?: string;
  fbTargetDay?: 'today' | 'tomorrow';
  onToggleFbAutoPost?: (
    enabled: boolean
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onChangeFbTargetDay?: (
    targetDay: 'today' | 'tomorrow'
  ) => Promise<{ ok: boolean; error?: string } | void> | void;
  onPublishFacebookNow?: (params: {
    dayId?: DayId;
    dayLabel: string;
    rows: ScheduleRow[];
    onStageChange?: (stage: 'preparing_image' | 'publishing') => void;
  }) => Promise<{ ok: boolean; message: string; post_id?: string }>;
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
  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

export const ShareAndExportBar: React.FC<ShareAndExportBarProps> = ({
  dayId,
  dayLabel,
  rows,
  settings,
  posterRef,
  canManageFacebook = false,
  showFacebookCard = false,
  onCloseFacebookCard,
  fbAutoPostEnabled = false,
  fbAutoPostTime = '20:00',
  fbTargetDay = 'tomorrow',
  onToggleFbAutoPost,
  onChangeFbTargetDay,
  onPublishFacebookNow,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [cachedPoster, setCachedPoster] = useState<{
    dataUrl: string;
    file: File;
    dayLabel: string;
  } | null>(null);
  const [postText, setPostText] = useState<string>(() =>
    buildDailySocialPostText(dayLabel, settings, rows)
  );
  const [showPostBox, setShowPostBox] = useState<boolean>(false);
  const [copiedPost, setCopiedPost] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [fbPublishStage, setFbPublishStage] = useState<
    'idle' | 'preparing_image' | 'publishing'
  >('idle');
  const [fbStatusBanner, setFbStatusBanner] = useState<{
    ok: boolean;
    message: string;
    post_id?: string;
  } | null>(null);

  // Update daily post text whenever the selected day, rows, or center settings change
  useEffect(() => {
    setPostText(buildDailySocialPostText(dayLabel, settings, rows));
  }, [dayLabel, settings, rows]);

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

  // Try copying image blob to clipboard if navigator.clipboard.write is supported
  const tryCopyImageToClipboard = async (file: File): Promise<boolean> => {
    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.write === 'function' &&
        window.ClipboardItem
      ) {
        const item = new ClipboardItem({ [file.type]: file });
        await navigator.clipboard.write([item]);
        return true;
      }
    } catch {
      // Ignore clipboard write failure
    }
    return false;
  };

  // Share ONLY the 4:5 PNG Image File WITHOUT post text
  const handleNativeShareImageOnly = async () => {
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    let assets = cachedPoster && cachedPoster.dayLabel === dayLabel ? cachedPoster : null;
    if (!assets) {
      setIsExporting(true);
      try {
        const prepared = await preparePosterExportAssets(dayLabel, rows, settings, posterRef.current);
        assets = { ...prepared, dayLabel };
        setCachedPoster(assets);
      } catch {
        setStatusBanner('حدث خطأ أثناء تجهيز صورة الجدول للمشاركة.');
        setIsExporting(false);
        return;
      } finally {
        setIsExporting(false);
      }
    }

    if (!assets) return;

    if (
      typeof nav.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [assets.file] })
    ) {
      try {
        await nav.share({
          files: [assets.file],
        });
        setStatusBanner(`✅ تمت مشاركة صورة جدول يوم ${dayLabel} (4:5)!`);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
      }
    }

    const copied = await tryCopyImageToClipboard(assets.file);
    if (copied) {
      setStatusBanner(`📋 تم نسخ صورة جدول يوم ${dayLabel} للحافظة! يمكنك لصقها (Ctrl+V) مباشرة.`);
    } else {
      setStatusBanner(`ℹ️ المشاركة المباشرة غير مدعومة في هذا المتصفح. يمكنك تنزيل الصورة عبر أيقونة التنزيل 📥.`);
    }
  };

  // Share the 4:5 PNG Image File + Post Text together
  const handleNativeMobileShareWithPost = async () => {
    copyTextToClipboardSync(postText);
    setCopiedPost(true);
    setTimeout(() => setCopiedPost(false), 3000);

    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    let assets = cachedPoster && cachedPoster.dayLabel === dayLabel ? cachedPoster : null;
    if (!assets) {
      setIsExporting(true);
      try {
        const prepared = await preparePosterExportAssets(dayLabel, rows, settings, posterRef.current);
        assets = { ...prepared, dayLabel };
        setCachedPoster(assets);
      } catch {
        setStatusBanner('حدث خطأ أثناء تجهيز صورة الجدول للمشاركة.');
        setIsExporting(false);
        return;
      } finally {
        setIsExporting(false);
      }
    }

    if (!assets) return;

    if (
      typeof nav.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [assets.file] })
    ) {
      try {
        await nav.share({
          files: [assets.file],
          title: `جدول عيادات يوم ${dayLabel}`,
          text: postText,
        });
        setStatusBanner(`✅ تمت مشاركة صورة جدول يوم ${dayLabel} مع النص مباشرة!`);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
      }
    }

    const copied = await tryCopyImageToClipboard(assets.file);
    if (copied) {
      setStatusBanner(`📋 تم نسخ نص البوست وصورة جدول يوم ${dayLabel} للحافظة بنجاح!`);
    } else {
      setStatusBanner(`📋 تم نسخ نص البوست! لتنزيل الصورة استخدم أيقونة التنزيل 📥.`);
    }
  };

  const handlePublishToFacebookClick = async () => {
    if (!onPublishFacebookNow) return;
    setFbPublishStage('preparing_image');
    setFbStatusBanner(null);
    try {
      const result = await onPublishFacebookNow({
        dayId,
        dayLabel,
        rows,
        onStageChange: (stage) => setFbPublishStage(stage),
      });
      setFbStatusBanner(result);
    } catch {
      setFbStatusBanner({
        ok: false,
        message: 'تعذر الاتصال بخدمة النشر على فيسبوك.',
      });
    } finally {
      setFbPublishStage('idle');
    }
  };

  const handleToggleAutoPostClick = async () => {
    if (!onToggleFbAutoPost) return;
    setFbStatusBanner(null);
    const res = await onToggleFbAutoPost(!fbAutoPostEnabled);
    if (res && !res.ok && res.error) {
      setFbStatusBanner({
        ok: false,
        message: res.error,
      });
    }
  };

  const handleTargetDaySelectChange = async (nextTarget: 'today' | 'tomorrow') => {
    if (!onChangeFbTargetDay) return;
    setFbStatusBanner(null);
    const res = await onChangeFbTargetDay(nextTarget);
    if (res && !res.ok && res.error) {
      setFbStatusBanner({
        ok: false,
        message: res.error,
      });
    }
  };

  const liveAutoPostLine = buildLiveAutoPostPreviewLine({
    fbTargetDay,
    fbAutoPostTime,
  });

  return (
    <div
      dir="rtl"
      className="mx-auto w-full max-w-[780px] rounded-2xl bg-white p-2.5 sm:p-3.5 shadow-sm border border-purple-100 space-y-2.5"
    >
      {/* 4 Action Buttons in ONE Single Row: مشاركة | مشاركة+بوست (مكبّر) | بوست | أيقونة التنزيل (مصغّر) */}
      <div
        data-testid="share-buttons-grid"
        className="grid grid-cols-[1fr_1.35fr_1fr_auto] gap-1.5 sm:gap-2.5 items-center"
      >
        {/* Button 1: مشاركة (صورة فقط بدون بوست) */}
        <button
          type="button"
          onClick={handleNativeShareImageOnly}
          data-testid="share-image-only-btn"
          title="مشاركة صورة الجدول فقط بدون نص البوست"
          className="w-full inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl bg-sky-600 px-1 sm:px-3 py-2.5 text-[11px] sm:text-xs md:text-sm font-black text-white whitespace-nowrap shadow-xs hover:bg-sky-700 transition cursor-pointer"
        >
          <Share2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span>مشاركة</span>
        </button>

        {/* Button 2: مشاركة+بوست (مكبّر ومتسق) */}
        <button
          type="button"
          onClick={handleNativeMobileShareWithPost}
          data-testid="share-native-btn"
          title="مشاركة ملف الصورة مع البوست مباشرة عبر تطبيقات الهاتف"
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-2 sm:px-3.5 py-2.5 text-xs sm:text-sm md:text-base font-black text-white whitespace-nowrap shadow-md hover:bg-indigo-700 transition cursor-pointer"
        >
          <Smartphone className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
          <span>مشاركة+بوست</span>
        </button>

        {/* Button 3: بوست */}
        <button
          type="button"
          onClick={() => setShowPostBox((prev) => !prev)}
          data-testid="toggle-post-caption-btn"
          title={`عرض ونسخ النص الترويجي لبوست يوم ${dayLabel}`}
          className={`w-full inline-flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl border-2 px-1 sm:px-3 py-2.5 text-[11px] sm:text-xs md:text-sm font-black whitespace-nowrap shadow-xs transition cursor-pointer ${
            showPostBox
              ? 'border-purple-600 bg-purple-100 text-purple-950'
              : 'border-purple-300 bg-purple-50 text-purple-950 hover:bg-purple-100'
          }`}
        >
          <MessageSquareText className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-purple-700 shrink-0" />
          <span>بوست</span>
        </button>

        {/* Button 4: تنزيل صورة الجدول (أيقونة تنزيل مصغّرة بدون كلمة حفظ) */}
        <button
          type="button"
          onClick={handleDownload4x5Png}
          disabled={isExporting}
          data-testid="export-png-btn"
          title="تنزيل صورة الجدول PNG بأبعاد 4:5 ثابتة"
          className="inline-flex items-center justify-center rounded-xl bg-purple-700 px-2.5 sm:px-3.5 py-2.5 text-white shadow-xs hover:bg-purple-800 disabled:opacity-60 transition cursor-pointer"
        >
          <Download className="w-4.5 h-4.5 sm:w-5 sm:h-5 shrink-0" />
        </button>
      </div>

      {/* Facebook Page Publishing Control Bar (Controlled via sidebar toggle, hidden by default) */}
      {showFacebookCard && canManageFacebook && onPublishFacebookNow && (
        <div
          data-testid="facebook-control-panel"
          className="relative rounded-xl bg-blue-50/70 border border-blue-200 p-3 flex flex-col gap-2.5 transition-all"
        >
          {onCloseFacebookCard && (
            <button
              type="button"
              onClick={onCloseFacebookCard}
              title="إخفاء بطاقة النشر على فيسبوك"
              aria-label="إخفاء بطاقة النشر على فيسبوك"
              className="absolute top-2 left-2 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-blue-100 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3 pl-7 sm:pl-0">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-700 shrink-0" />
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    النشر التلقائي اليومي على فيسبوك
                  </div>
                  <div
                    data-testid="sharebar-live-autopost-line"
                    className="text-[10px] font-bold text-blue-900"
                  >
                    {liveAutoPostLine}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onChangeFbTargetDay && (
                  <select
                    aria-label="جدول (اليوم/غداً) سيُنشر على فيسبوك"
                    data-testid="sharebar-fb-target-day-select"
                    value={fbTargetDay === 'today' ? 'today' : 'tomorrow'}
                    onChange={(e) =>
                      handleTargetDaySelectChange(
                        e.target.value === 'today' ? 'today' : 'tomorrow'
                      )
                    }
                    className="rounded-lg border border-blue-300 bg-white px-2 py-1 text-[11px] font-extrabold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="tomorrow">جدول غداً سيُنشر على فيسبوك</option>
                    <option value="today">جدول اليوم سيُنشر على فيسبوك</option>
                  </select>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={fbAutoPostEnabled}
                  aria-label="تفعيل أو تعطيل النشر التلقائي اليومي على فيسبوك"
                  data-testid="fb-auto-post-toggle"
                  onClick={handleToggleAutoPostClick}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    fbAutoPostEnabled ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      fbAutoPostEnabled ? '-translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={fbPublishStage !== 'idle'}
              onClick={handlePublishToFacebookClick}
              data-testid="publish-facebook-now-btn"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-3.5 py-2 text-xs font-black text-white shadow-xs transition cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>
                {fbPublishStage === 'preparing_image'
                  ? 'جارٍ تجهيز الصورة...'
                  : fbPublishStage === 'publishing'
                  ? 'جارٍ النشر على فيسبوك...'
                  : 'نشر جدول اليوم على فيسبوك الان'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Facebook Publish Status Feedback Banner */}
      {fbStatusBanner && (
        <div
          role="status"
          data-testid="facebook-status-banner"
          className={`rounded-xl border px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 ${
            fbStatusBanner.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{fbStatusBanner.message}</span>
          <button
            type="button"
            onClick={() => setFbStatusBanner(null)}
            aria-label="إغلاق رسالة حالة فيسبوك"
            className="font-extrabold px-1 hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

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
