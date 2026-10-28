import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Check,
  Clock,
  Globe,
  Image as ImageIcon,
  Play,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import {
  ClientEditableReminderSettings,
  DailyScheduleData,
  DayId,
  FacebookFallbackMode,
  PosterMetaData,
  ReminderSettings,
  ReminderTargetDay,
} from '../types/schedule';
import {
  DEFAULT_REMINDER_SETTINGS,
  buildLiveAutoPostPreviewLine,
  resolveTargetDayId,
  validateReminderSettings,
} from '../utils/reminderLogic';
import { DAYS_LIST } from '../utils/scheduleLogic';

export interface WeekPostersProgress {
  completed: number;
  total: number;
  results: Record<
    DayId,
    { status: 'pending' | 'running' | 'ok' | 'error'; message?: string }
  >;
}

interface RemindersAndAutoPostModalProps {
  reminderSettings?: ReminderSettings;
  schedulesByDay?: Record<DayId, DailyScheduleData>;
  posterMetaByDay?: Partial<Record<DayId, PosterMetaData>>;
  onSave: (
    updatedReminders: ClientEditableReminderSettings
  ) => Promise<{ ok: boolean; error?: string }> | void;
  onSendTestReminder?: () => Promise<{ ok: boolean; message: string }>;
  onPublishFacebookNow?: () => Promise<{
    ok: boolean;
    message: string;
    post_id?: string;
  }>;
  onPrepareAllWeekPosters?: (
    onProgress: (progress: WeekPostersProgress) => void
  ) => Promise<void>;
  onDryRunAutoPost?: () => Promise<Record<string, unknown>>;
  onRunAutoPostNow?: (
    force?: boolean
  ) => Promise<Record<string, unknown>>;
  onClose: () => void;
}

function formatMinutesAgo(isoString?: string): {
  text: string;
  isStaleOrMissing: boolean;
} {
  if (!isoString) {
    return {
      text: 'لم يعمل المجدول بعد (غير مسجل)',
      isStaleOrMissing: true,
    };
  }
  const timeMs = Date.parse(isoString);
  if (!Number.isFinite(timeMs)) {
    return {
      text: 'غير معروف',
      isStaleOrMissing: true,
    };
  }
  const diffMin = Math.max(0, Math.floor((Date.now() - timeMs) / 60000));
  if (diffMin === 0) {
    return { text: 'منذ أقل من دقيقة', isStaleOrMissing: false };
  }
  return {
    text: `منذ ${diffMin} دقيقة`,
    isStaleOrMissing: diffMin > 30,
  };
}

function formatArabicStatusLabel(status?: ReminderSettings['lastFbPostStatus']): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'success':
      return {
        label: 'نجح (صورة بوستر)',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    case 'success_text_fallback':
      return {
        label: 'نجح (نص بديل بسبب عدم حداثة الصورة)',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      };
    case 'skipped_no_clinics':
      return {
        label: 'تم التخطي (لا توجد عيادات في هذا اليوم)',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      };
    case 'failed':
      return {
        label: 'فشل النشر التلقائي',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      };
    default:
      return {
        label: 'لم يُنفَّذ بعد',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      };
  }
}

function buildEditableDraftFromProps(
  reminderSettings?: ReminderSettings
): ClientEditableReminderSettings {
  return {
    enabled: reminderSettings?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
    time: reminderSettings?.time || DEFAULT_REMINDER_SETTINGS.time,
    timezone: 'Africa/Cairo',
    targetDay:
      reminderSettings?.targetDay === 'today' ||
      reminderSettings?.targetDay === 'tomorrow'
        ? reminderSettings.targetDay
        : DEFAULT_REMINDER_SETTINGS.targetDay,
    title: reminderSettings?.title || DEFAULT_REMINDER_SETTINGS.title,
    body: reminderSettings?.body || DEFAULT_REMINDER_SETTINGS.body,
    fbAutoPostEnabled:
      reminderSettings?.fbAutoPostEnabled ??
      DEFAULT_REMINDER_SETTINGS.fbAutoPostEnabled,
    fbAutoStoryEnabled:
      typeof reminderSettings?.fbAutoStoryEnabled === 'boolean'
        ? reminderSettings.fbAutoStoryEnabled
        : DEFAULT_REMINDER_SETTINGS.fbAutoStoryEnabled ?? false,
    fbAutoPostTime:
      reminderSettings?.fbAutoPostTime ||
      DEFAULT_REMINDER_SETTINGS.fbAutoPostTime ||
      '20:00',
    fbPostMode:
      reminderSettings?.fbPostMode ||
      DEFAULT_REMINDER_SETTINGS.fbPostMode ||
      'photo_with_caption',
    fbTargetDay:
      reminderSettings?.fbTargetDay === 'today' ||
      reminderSettings?.fbTargetDay === 'tomorrow'
        ? reminderSettings.fbTargetDay
        : DEFAULT_REMINDER_SETTINGS.fbTargetDay || 'tomorrow',
    fbFallbackMode:
      reminderSettings?.fbFallbackMode === 'skip'
        ? 'skip'
        : DEFAULT_REMINDER_SETTINGS.fbFallbackMode || 'text',
    fbSkipEmptyDay:
      typeof reminderSettings?.fbSkipEmptyDay === 'boolean'
        ? reminderSettings.fbSkipEmptyDay
        : DEFAULT_REMINDER_SETTINGS.fbSkipEmptyDay ?? true,
    showFacebookCard:
      typeof reminderSettings?.showFacebookCard === 'boolean'
        ? reminderSettings.showFacebookCard
        : DEFAULT_REMINDER_SETTINGS.showFacebookCard ?? false,
  };
}

export const RemindersAndAutoPostModal: React.FC<
  RemindersAndAutoPostModalProps
> = ({
  reminderSettings,
  schedulesByDay,
  posterMetaByDay,
  onSave,
  onSendTestReminder,
  onPublishFacebookNow,
  onPrepareAllWeekPosters,
  onDryRunAutoPost,
  onRunAutoPostNow,
  onClose,
}) => {
  const [reminderDraft, setReminderDraft] =
    useState<ClientEditableReminderSettings>(() =>
      buildEditableDraftFromProps(reminderSettings)
    );
  const reminderDraftRef = useRef<ClientEditableReminderSettings>(reminderDraft);
  const hasUnsavedLocalEditRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [errors, setErrors] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    'idle' | 'saving' | 'saved'
  >('idle');
  const [testSending, setTestSending] = useState(false);
  const [testStatusMsg, setTestStatusMsg] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [fbPublishing, setFbPublishing] = useState(false);
  const [fbStatusMsg, setFbStatusMsg] = useState<{
    ok: boolean;
    message: string;
    post_id?: string;
  } | null>(null);

  // Prepare all week posters state
  const [preparingWeek, setPreparingWeek] = useState(false);
  const [weekProgress, setWeekProgress] = useState<WeekPostersProgress | null>(
    null
  );

  // Admin dry-run & run-now state
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [runNowConfirmStep, setRunNowConfirmStep] = useState<
    'idle' | 'confirm' | 'confirm_force'
  >('idle');
  const [runNowResult, setRunNowResult] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Sync draft when remote Firestore reminderSettings arrive (as long as user isn't mid-edit)
  useEffect(() => {
    if (!reminderSettings || hasUnsavedLocalEditRef.current) return;
    const nextDraft = buildEditableDraftFromProps(reminderSettings);
    reminderDraftRef.current = nextDraft;
    setReminderDraft(nextDraft);
  }, [
    reminderSettings?.enabled,
    reminderSettings?.time,
    reminderSettings?.targetDay,
    reminderSettings?.title,
    reminderSettings?.body,
    reminderSettings?.fbAutoPostEnabled,
    reminderSettings?.fbAutoStoryEnabled,
    reminderSettings?.fbAutoPostTime,
    reminderSettings?.fbPostMode,
    reminderSettings?.fbTargetDay,
    reminderSettings?.fbFallbackMode,
    reminderSettings?.fbSkipEmptyDay,
    reminderSettings?.showFacebookCard,
  ]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const flushPendingDraftSave = async (
    draftToSave = reminderDraftRef.current
  ): Promise<boolean> => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const validation = validateReminderSettings(draftToSave);
    if (!validation.valid) {
      setErrors(validation.errors);
      return false;
    }
    setErrors([]);
    setAutoSaveStatus('saving');
    try {
      const res = await onSave(validation.sanitized);
      if (res && res.ok === false) {
        setErrors([
          res.error ||
            'تعذر حفظ الإعدادات في قاعدة البيانات. تم التراجع عن التغيير.',
        ]);
        setAutoSaveStatus('idle');
        return false;
      }
      hasUnsavedLocalEditRef.current = false;
      setAutoSaveStatus('saved');
      return true;
    } catch {
      setAutoSaveStatus('idle');
      return false;
    }
  };

  const updateDraft = (patch: Partial<ClientEditableReminderSettings>) => {
    hasUnsavedLocalEditRef.current = true;
    const next: ClientEditableReminderSettings = {
      ...reminderDraftRef.current,
      ...patch,
    };
    reminderDraftRef.current = next;
    setReminderDraft(next);

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      flushPendingDraftSave(next).catch(() => undefined);
    }, 350);
  };

  const handleModalClose = async () => {
    if (hasUnsavedLocalEditRef.current) {
      await flushPendingDraftSave(reminderDraftRef.current);
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSavingSettings(true);
    try {
      const ok = await flushPendingDraftSave(reminderDraftRef.current);
      if (!ok) return;
      onClose();
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTest = async () => {
    if (!onSendTestReminder) return;
    setTestSending(true);
    setTestStatusMsg(null);
    try {
      if (hasUnsavedLocalEditRef.current) {
        await flushPendingDraftSave(reminderDraftRef.current);
      }
      const result = await onSendTestReminder();
      setTestStatusMsg(result);
    } catch {
      setTestStatusMsg({
        ok: false,
        message: 'تعذر الاتصال بخادم الإشعارات التجريبية.',
      });
    } finally {
      setTestSending(false);
    }
  };

  const handlePublishFacebook = async () => {
    if (!onPublishFacebookNow) return;
    setFbPublishing(true);
    setFbStatusMsg(null);
    try {
      if (hasUnsavedLocalEditRef.current) {
        await flushPendingDraftSave(reminderDraftRef.current);
      }
      const result = await onPublishFacebookNow();
      setFbStatusMsg(result);
    } catch {
      setFbStatusMsg({
        ok: false,
        message: 'تعذر الاتصال بخدمة النشر على فيسبوك.',
      });
    } finally {
      setFbPublishing(false);
    }
  };

  const handlePrepareWeekClick = async () => {
    if (!onPrepareAllWeekPosters || preparingWeek) return;
    setPreparingWeek(true);
    try {
      await onPrepareAllWeekPosters((progress) => {
        setWeekProgress({ ...progress, results: { ...progress.results } });
      });
    } finally {
      setPreparingWeek(false);
    }
  };

  const handleDryRunClick = async () => {
    if (!onDryRunAutoPost || dryRunLoading) return;
    setDryRunLoading(true);
    setDryRunResult(null);
    try {
      if (hasUnsavedLocalEditRef.current) {
        await flushPendingDraftSave(reminderDraftRef.current);
      }
      const res = await onDryRunAutoPost();
      setDryRunResult(res);
    } catch {
      setDryRunResult({
        ok: false,
        error: 'تعذر الاتصال بخادم الفحص التجريبي.',
      });
    } finally {
      setDryRunLoading(false);
    }
  };

  const handleRunAutoNowClick = async (force = false) => {
    if (!onRunAutoPostNow || runNowLoading) return;
    setRunNowLoading(true);
    setRunNowResult(null);
    try {
      if (hasUnsavedLocalEditRef.current) {
        await flushPendingDraftSave(reminderDraftRef.current);
      }
      const res = await onRunAutoPostNow(force);
      if (res && res.needsForceConfirm) {
        setRunNowConfirmStep('confirm_force');
        setRunNowResult(res);
      } else {
        setRunNowConfirmStep('idle');
        setRunNowResult(res);
      }
    } catch {
      setRunNowConfirmStep('idle');
      setRunNowResult({
        ok: false,
        error: 'تعذر الاتصال بخادم النشر التلقائي.',
      });
    } finally {
      setRunNowLoading(false);
    }
  };

  const liveAutoPostLine = buildLiveAutoPostPreviewLine({
    fbTargetDay: reminderDraft.fbTargetDay || 'tomorrow',
    fbAutoPostTime: reminderDraft.fbAutoPostTime || '20:00',
    fbAutoStoryEnabled: Boolean(reminderDraft.fbAutoStoryEnabled),
    timeZone: 'Africa/Cairo',
  });

  const cronHealth = formatMinutesAgo(reminderSettings?.lastCronRunAt);
  const lastPostStatusBadge = formatArabicStatusLabel(
    reminderSettings?.lastFbPostStatus
  );

  // Check if current target date is already published
  const currentResolvedTarget = resolveTargetDayId(
    new Date(),
    reminderDraft.fbTargetDay || 'tomorrow',
    'Africa/Cairo'
  );
  const isTargetDateAlreadyPublished =
    Boolean(reminderSettings?.lastFbPostTargetDate) &&
    reminderSettings?.lastFbPostTargetDate ===
      currentResolvedTarget.targetDateStr;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="الإشعارات والنشر التلقائي"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <BellRing className="w-5 h-5 text-purple-700" />
              <span>الإشعارات والنشر التلقائي</span>
            </h3>
            {autoSaveStatus === 'saving' && (
              <span className="rounded-lg bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-extrabold text-purple-800">
                جارٍ الحفظ التلقائي...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800">
                تم الحفظ تلقائياً ✓
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            aria-label="إغلاق النافذة"
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            data-testid="modal-save-errors"
            className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700 space-y-1"
          >
            {errors.map((err, i) => (
              <div key={i}>• {err}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Daily Push Reminder (Independent from Facebook Target Day) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-purple-100 pb-2">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-purple-600" />
                <span>الإشعار اليومي للموظفين</span>
              </h4>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderDraft.enabled}
                  onChange={(e) =>
                    updateDraft({
                      enabled: e.target.checked,
                    })
                  }
                  data-testid="reminder-enabled-checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-purple-700 focus:ring-purple-600"
                />
                <span>تفعيل الإشعار اليومي</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وقت الإشعار اليومي (Africa/Cairo)
                </label>
                <input
                  type="time"
                  value={reminderDraft.time}
                  onChange={(e) =>
                    updateDraft({
                      time: e.target.value || '19:00',
                    })
                  }
                  data-testid="reminder-time-input"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
                <p className="text-[10px] font-semibold text-slate-500 mt-1">
                  الوقت الذي يُمكِّن الموظفين من تذكر مراجعة الجدول.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اليوم الذي يُذكَّر الموظفون بتجهيزه
                </label>
                <select
                  value={reminderDraft.targetDay}
                  onChange={(e) =>
                    updateDraft({
                      targetDay:
                        e.target.value === 'today' ? 'today' : 'tomorrow',
                    })
                  }
                  data-testid="reminder-target-day-select"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                >
                  <option value="tomorrow">جدول الغد (tomorrow)</option>
                  <option value="today">جدول اليوم (today)</option>
                </select>
                <p className="text-[10px] font-semibold text-slate-500 mt-1">
                  خاص بإشعار تذكير الموظفين فقط ولا يؤثر على يوم النشر على فيسبوك.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان الإشعار
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={reminderDraft.title}
                  onChange={(e) =>
                    updateDraft({
                      title: e.target.value,
                    })
                  }
                  data-testid="reminder-title-input"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نص الإشعار (استخدم &#123;اليوم&#125; لإدراج اسم اليوم تلقائياً)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={reminderDraft.body}
                  onChange={(e) =>
                    updateDraft({
                      body: e.target.value,
                    })
                  }
                  data-testid="reminder-body-input"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            {onSendTestReminder && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={testSending}
                  onClick={handleSendTest}
                  data-testid="send-test-reminder-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50 px-3.5 py-2 text-xs font-extrabold text-purple-900 hover:bg-purple-100 disabled:opacity-50 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-purple-700" />
                  <span>
                    {testSending
                      ? 'جارٍ إرسال الإشعار التجريبي...'
                      : 'إرسال إشعار تجريبي الآن'}
                  </span>
                </button>

                {testStatusMsg && (
                  <span
                    data-testid="test-reminder-status"
                    className={`text-xs font-bold ${
                      testStatusMsg.ok ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {testStatusMsg.message}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Facebook Auto-Post & Separate Target Day */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>النشر التلقائي اليومي على فيسبوك (Meta Graph API v21.0)</span>
                </h4>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  ينشر صورة بوستر الجدول (1080x1350) تلقائياً على صفحة فيسبوك في الموعد المحدد مع نافذة تعويض ذكية.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-800">
                  تفعيل النشر التلقائي
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(reminderDraft.fbAutoPostEnabled)}
                  aria-label="تفعيل أو تعطيل النشر التلقائي اليومي على فيسبوك"
                  data-testid="modal-fb-auto-post-toggle"
                  onClick={() =>
                    updateDraft({
                      fbAutoPostEnabled: !reminderDraft.fbAutoPostEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    reminderDraft.fbAutoPostEnabled
                      ? 'bg-blue-600'
                      : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      reminderDraft.fbAutoPostEnabled
                        ? '-translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Live summary banner */}
            <div
              data-testid="modal-live-autopost-line"
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-extrabold flex items-center gap-2 ${
                reminderDraft.fbAutoPostEnabled
                  ? 'bg-blue-50 border-blue-200 text-blue-950'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{liveAutoPostLine}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  وقت النشر التلقائي اليومي (Africa/Cairo)
                </label>
                <input
                  type="time"
                  value={reminderDraft.fbAutoPostTime}
                  onChange={(e) =>
                    updateDraft({
                      fbAutoPostTime: e.target.value || '20:00',
                    })
                  }
                  data-testid="fb-auto-post-time-input"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <p className="text-[10px] font-bold text-blue-900 mt-1 leading-relaxed">
                  يُستحسن ضبط وقت النشر (مثلاً 20:00) بعد وقت الإشعار (مثلاً 19:00) لتمنح نفسك وقتاً لمراجعة وتحديث الجدول قبل النشر.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  جدول (اليوم/غداً) سيُنشر على فيسبوك
                </label>
                <select
                  value={reminderDraft.fbTargetDay || 'tomorrow'}
                  onChange={(e) =>
                    updateDraft({
                      fbTargetDay: (e.target.value === 'today'
                        ? 'today'
                        : 'tomorrow') as ReminderTargetDay,
                    })
                  }
                  data-testid="fb-target-day-select"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="tomorrow">جدول غداً (tomorrow)</option>
                  <option value="today">جدول اليوم (today)</option>
                </select>
                <p className="text-[10px] font-bold text-slate-600 mt-1">
                  منفصل تماماً عن يوم تذكير الموظفين؛ يحدد أي يوم سيُنشر تلقائياً على صفحة فيسبوك.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  نمط النشر على فيسبوك
                </label>
                <select
                  value={reminderDraft.fbPostMode || 'photo_with_caption'}
                  onChange={(e) =>
                    updateDraft({
                      fbPostMode: e.target.value as
                        | 'photo_with_caption'
                        | 'photo_only'
                        | 'text_only',
                    })
                  }
                  data-testid="fb-post-mode-select"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="photo_with_caption">
                    صورة مع كابشن (افتراضي — بوستر 4:5 مع نص ملخص)
                  </option>
                  <option value="photo_only">
                    صورة فقط (بوستر 4:5 عالي الدقة بدون نص)
                  </option>
                  <option value="text_only">
                    نص فقط (تفاصيل العيادات كنص بدون صورة)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  عند عدم توفر صورة محدّثة وقت النشر
                </label>
                <select
                  value={reminderDraft.fbFallbackMode || 'text'}
                  onChange={(e) =>
                    updateDraft({
                      fbFallbackMode: (e.target.value === 'skip'
                        ? 'skip'
                        : 'text') as FacebookFallbackMode,
                    })
                  }
                  data-testid="fb-fallback-mode-select"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="text">
                    نشر النص كبديل مع تسجيل تنبيه (افتراضي)
                  </option>
                  <option value="skip">
                    عدم النشر وإعادة المحاولة لحين تحديث الصورة (skip)
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-1 space-y-2.5">
                {/* Facebook Page Story Toggle */}
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-blue-200 px-3 py-2.5 shadow-2xs">
                  <div>
                    <div className="text-xs font-extrabold text-slate-900">
                      نشر البوستر في ستوري الصفحة أيضاً (Facebook Story)
                    </div>
                    <p className="text-[10px] font-bold text-slate-600 mt-0.5">
                      عند التفعيل، تُنشر صورة بوستر الجدول تلقائياً في قصص الصفحة (Story لمدة 24 ساعة) بالتزامن مع منشور الصفحة، ويمكنك تشغيلها أو إيقافها في أي وقت.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(reminderDraft.fbAutoStoryEnabled)}
                    aria-label="تفعيل أو إيقاف نشر البوستر في ستوري صفحة فيسبوك"
                    data-testid="modal-fb-auto-story-toggle"
                    onClick={() =>
                      updateDraft({
                        fbAutoStoryEnabled: !reminderDraft.fbAutoStoryEnabled,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      reminderDraft.fbAutoStoryEnabled
                        ? 'bg-indigo-600'
                        : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        reminderDraft.fbAutoStoryEnabled
                          ? '-translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(reminderDraft.fbSkipEmptyDay)}
                    onChange={(e) =>
                      updateDraft({
                        fbSkipEmptyDay: e.target.checked,
                      })
                    }
                    data-testid="fb-skip-empty-day-checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>
                    تخطي النشر التلقائي إذا كان جدول اليوم المستهدف فارغاً من العيادات (يسجّل skipped_no_clinics)
                  </span>
                </label>
              </div>
            </div>

            {/* Section 2.1: Visible Status Log & Scheduler Health */}
            <div
              data-testid="autopost-status-log-box"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <span className="text-xs font-extrabold text-slate-800">
                  حالة المجدول وآخر نشر تلقائي
                </span>
                <span
                  data-testid="cron-last-run-badge"
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] font-extrabold ${
                    cronHealth.isStaleOrMissing
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {cronHealth.isStaleOrMissing && (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                  )}
                  <span>آخر تشغيل للمجدول: {cronHealth.text}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold text-slate-600">آخر نشر تلقائي:</span>
                  <span
                    data-testid="last-fb-post-status-badge"
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-extrabold ${lastPostStatusBadge.badgeClass}`}
                  >
                    {lastPostStatusBadge.label}
                  </span>
                </div>

                <div className="text-[11px] font-bold text-slate-600">
                  <span>تاريخ الجدول المنشور: </span>
                  <span className="text-slate-900 font-extrabold">
                    {reminderSettings?.lastFbPostTargetDate ||
                      reminderSettings?.lastFbPostDate ||
                      '—'}
                  </span>
                  {reminderSettings?.lastFbPostAt && (
                    <span className="mr-2 text-slate-500">
                      ({new Date(reminderSettings.lastFbPostAt).toLocaleString('ar-EG')})
                    </span>
                  )}
                </div>
              </div>

              {reminderSettings?.lastFbPostId && (
                <div className="text-[11px] font-bold text-slate-600">
                  <span>معرّف المنشور (Post ID): </span>
                  <code className="rounded bg-white px-1.5 py-0.5 text-slate-800 border border-slate-200">
                    {reminderSettings.lastFbPostId}
                  </code>
                </div>
              )}

              {(reminderSettings?.lastFbPostError ||
                reminderSettings?.lastFbPostWarning) && (
                <div
                  data-testid="last-fb-post-reason"
                  className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-950"
                >
                  <span>السبب / التنبيه: </span>
                  <span>
                    {reminderSettings.lastFbPostError ||
                      reminderSettings.lastFbPostWarning}
                  </span>
                </div>
              )}

              {reminderSettings?.fbPostAttempts &&
                reminderSettings.fbPostAttempts.count > 0 && (
                  <div className="text-[11px] font-bold text-slate-600">
                    عدد المحاولات المسجلة لتاريخ{' '}
                    <span className="font-extrabold">
                      {reminderSettings.fbPostAttempts.date}
                    </span>
                    : {reminderSettings.fbPostAttempts.count} / 4
                  </div>
                )}
            </div>

            {/* Section 2.2: Per-Day Poster Freshness & Prepare All Week Button */}
            {schedulesByDay && (
              <div
                data-testid="week-posters-freshness-box"
                className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-indigo-600" />
                      <span>حالة صور البوستر لأيام الأسبوع السبعة</span>
                    </h5>
                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                      يقارن الخادم إصدار صورة البوستر بإصدار الجدول قبل النشر التلقائي لضمان عدم نشر صورة قديمة أبداً.
                    </p>
                  </div>

                  {onPrepareAllWeekPosters && (
                    <button
                      type="button"
                      disabled={preparingWeek}
                      onClick={handlePrepareWeekClick}
                      data-testid="prepare-all-week-posters-btn"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer shadow-xs"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          preparingWeek ? 'animate-spin' : ''
                        }`}
                      />
                      <span>
                        {preparingWeek && weekProgress
                          ? `جارٍ تجهيز الصور (${weekProgress.completed}/${weekProgress.total})...`
                          : 'تجهيز صور الأسبوع كله'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DAYS_LIST.map((d) => {
                    const schedVer = schedulesByDay[d.id]?.version || 1;
                    const meta = posterMetaByDay?.[d.id];
                    const isUpToDate =
                      Boolean(meta) && meta?.version === schedVer;
                    const isOutdated =
                      Boolean(meta) && meta?.version !== schedVer;
                    const progressItem = weekProgress?.results?.[d.id];

                    return (
                      <div
                        key={d.id}
                        data-testid={`poster-status-${d.id}`}
                        className={`rounded-xl border px-2.5 py-2 text-[11px] font-bold flex flex-col gap-0.5 ${
                          isUpToDate
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : isOutdated
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : 'bg-rose-50/60 border-rose-200 text-rose-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold">{d.label}</span>
                          <span>
                            {isUpToDate
                              ? 'محدّثة ✓'
                              : isOutdated
                              ? 'قديمة ⚠'
                              : 'غير موجودة ✗'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          إصدار الجدول: v{schedVer} | الصورة:{' '}
                          {meta?.version ? `v${meta.version}` : '—'}
                        </div>
                        {progressItem && progressItem.status !== 'pending' && (
                          <div
                            className={`text-[10px] font-extrabold mt-0.5 ${
                              progressItem.status === 'ok'
                                ? 'text-emerald-700'
                                : progressItem.status === 'error'
                                ? 'text-rose-700'
                                : 'text-indigo-700'
                            }`}
                          >
                            {progressItem.status === 'running'
                              ? 'جارٍ التوليد...'
                              : progressItem.status === 'ok'
                              ? 'تم التحديث ✓'
                              : `✗ ${progressItem.message || 'فشل'}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2.3: Admin Testing Tools (Dry Run & Run Auto-Post Now) */}
            {(onDryRunAutoPost || onRunAutoPostNow || onPublishFacebookNow) && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-3">
                <h5 className="text-xs font-extrabold text-slate-800">
                  أدوات الفحص والتشغيل الفوري للمدير
                </h5>

                <div className="flex flex-wrap items-center gap-2">
                  {onDryRunAutoPost && (
                    <button
                      type="button"
                      disabled={dryRunLoading}
                      onClick={handleDryRunClick}
                      data-testid="dry-run-autopost-btn"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-extrabold text-blue-900 hover:bg-blue-50 disabled:opacity-50 transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-blue-700" />
                      <span>
                        {dryRunLoading
                          ? 'جارٍ فحص النشر التلقائي...'
                          : 'تجربة النشر التلقائي (بدون نشر)'}
                      </span>
                    </button>
                  )}

                  {onRunAutoPostNow && runNowConfirmStep === 'idle' && (
                    <button
                      type="button"
                      disabled={runNowLoading}
                      onClick={() =>
                        setRunNowConfirmStep(
                          isTargetDateAlreadyPublished
                            ? 'confirm_force'
                            : 'confirm'
                        )
                      }
                      data-testid="run-autopost-now-btn"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-blue-800 disabled:opacity-50 transition cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5 text-white" />
                      <span>تشغيل النشر التلقائي الآن</span>
                    </button>
                  )}

                  {onPublishFacebookNow && (
                    <button
                      type="button"
                      disabled={fbPublishing}
                      onClick={handlePublishFacebook}
                      data-testid="modal-publish-facebook-now-btn"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {fbPublishing
                          ? 'جارٍ النشر...'
                          : 'نشر اليوم المعروض حالياً'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Inline Confirmation for Run Auto-Post Now */}
                {runNowConfirmStep !== 'idle' && (
                  <div
                    data-testid="run-autopost-confirm-box"
                    className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2 text-xs"
                  >
                    <p className="font-extrabold text-amber-950">
                      {runNowConfirmStep === 'confirm_force'
                        ? `تنبيه: تم نشر جدول هذا التاريخ (${currentResolvedTarget.targetDateStr} — ${currentResolvedTarget.dayLabel}) مسبقاً. هل تريد تأكيد إعادة النشر التلقائي على فيسبوك الآن؟`
                        : `هل أنت متأكد من تشغيل مسار النشر التلقائي الفعلي الآن لجدول يوم ${currentResolvedTarget.dayLabel} (${currentResolvedTarget.targetDateStr})؟`}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={runNowLoading}
                        onClick={() =>
                          handleRunAutoNowClick(
                            runNowConfirmStep === 'confirm_force'
                          )
                        }
                        data-testid="confirm-run-autopost-now-btn"
                        className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                      >
                        {runNowLoading
                          ? 'جارٍ التنفيذ...'
                          : runNowConfirmStep === 'confirm_force'
                          ? 'نعم، أعد النشر الآن (Force)'
                          : 'نعم، انشر الآن'}
                      </button>
                      <button
                        type="button"
                        disabled={runNowLoading}
                        onClick={() => setRunNowConfirmStep('idle')}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {/* Dry Run Result Display */}
                {dryRunResult && (
                  <div
                    data-testid="dry-run-result-box"
                    className="rounded-xl border border-blue-200 bg-white p-3 text-xs space-y-1 font-bold text-slate-800"
                  >
                    <div className="font-extrabold text-blue-950">
                      نتيجة الفحص التجريبي (بدون نشر فعلي):
                    </div>
                    {dryRunResult.error ? (
                      <div className="text-rose-700">
                        {String(dryRunResult.error)}
                      </div>
                    ) : (
                      <>
                        <div>
                          • اليوم المستهدف:{' '}
                          <span className="text-blue-900 font-extrabold">
                            {String(dryRunResult.targetDayLabel || '')} (
                            {String(dryRunResult.targetDateStr || '')})
                          </span>
                        </div>
                        <div>
                          • عدد العيادات غير الفارغة:{' '}
                          <span className="font-extrabold">
                            {String(dryRunResult.nonEmptyRowsCount ?? 0)}
                          </span>
                        </div>
                        <div>
                          • حالة صورة البوستر في السحابة:{' '}
                          <span className="font-extrabold">
                            {dryRunResult.imageStatus === 'up_to_date'
                              ? 'محدّثة ومطابقة ✓'
                              : dryRunResult.imageStatus === 'outdated'
                              ? `قديمة ⚠ (إصدار الصورة v${String(
                                  dryRunResult.posterVersion ?? '؟'
                                )} مقابل الجدول v${String(
                                  dryRunResult.scheduleVersion ?? '؟'
                                )})`
                              : 'غير موجودة ✗'}
                          </span>
                        </div>
                        <div>
                          • القرار المتوقع وقت النشر:{' '}
                          <span className="text-indigo-900 font-extrabold">
                            {dryRunResult.wouldSkipEmpty
                              ? 'سيتم التخطي لعدم وجود عيادات (skipped_no_clinics)'
                              : dryRunResult.plannedAction === 'post_photo'
                              ? 'سينشر صورة البوستر عالية الدقة ✓'
                              : dryRunResult.plannedAction === 'post_text_only'
                              ? 'سينشر نصاً بديلاً'
                              : 'لن ينشر وسيعيد المحاولة لحين تحديث الصورة (skip_retry)'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Run Now Result Display */}
                {runNowResult && !runNowResult.needsForceConfirm && (
                  <div
                    data-testid="run-now-result-box"
                    className={`rounded-xl border p-3 text-xs font-bold ${
                      runNowResult.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {String(
                      runNowResult.message ||
                        runNowResult.error ||
                        (runNowResult.ok
                          ? 'تم تنفيذ النشر التلقائي بنجاح.'
                          : 'تعذر تنفيذ النشر التلقائي.')
                    )}
                  </div>
                )}

                {fbStatusMsg && (
                  <div
                    data-testid="modal-facebook-status"
                    className={`text-xs font-bold ${
                      fbStatusMsg.ok ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {fbStatusMsg.message}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2 text-xs font-extrabold text-white hover:bg-purple-800 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{savingSettings ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
