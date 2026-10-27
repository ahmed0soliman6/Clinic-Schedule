import React, { useState } from 'react';
import { BellRing, Check, Globe, Send, X } from 'lucide-react';
import { ReminderSettings } from '../types/schedule';
import {
  DEFAULT_REMINDER_SETTINGS,
  validateReminderSettings,
} from '../utils/reminderLogic';

interface RemindersAndAutoPostModalProps {
  reminderSettings?: ReminderSettings;
  onSave: (
    updatedReminders: Omit<
      ReminderSettings,
      'lastSentDate' | 'lastFbPostDate' | 'lastFbPostWarning' | 'updatedBy' | 'updatedByEmail' | 'updatedAt'
    >
  ) => void;
  onSendTestReminder?: () => Promise<{ ok: boolean; message: string }>;
  onPublishFacebookNow?: () => Promise<{
    ok: boolean;
    message: string;
    post_id?: string;
  }>;
  onClose: () => void;
}

export const RemindersAndAutoPostModal: React.FC<
  RemindersAndAutoPostModalProps
> = ({
  reminderSettings,
  onSave,
  onSendTestReminder,
  onPublishFacebookNow,
  onClose,
}) => {
  const [reminderDraft, setReminderDraft] = useState<
    Omit<
      ReminderSettings,
      'lastSentDate' | 'lastFbPostDate' | 'lastFbPostWarning' | 'updatedBy' | 'updatedByEmail' | 'updatedAt'
    >
  >({
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
    fbAutoPostTime:
      reminderSettings?.fbAutoPostTime ||
      DEFAULT_REMINDER_SETTINGS.fbAutoPostTime ||
      '20:00',
    fbPostMode:
      reminderSettings?.fbPostMode ||
      DEFAULT_REMINDER_SETTINGS.fbPostMode ||
      'photo_with_caption',
  });

  const [errors, setErrors] = useState<string[]>([]);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reminderValidation = validateReminderSettings(reminderDraft);
    if (!reminderValidation.valid) {
      setErrors(reminderValidation.errors);
      return;
    }
    onSave(reminderValidation.sanitized);
    onClose();
  };

  const handleSendTest = async () => {
    if (!onSendTestReminder) return;
    setTestSending(true);
    setTestStatusMsg(null);
    try {
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
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-purple-700" />
            <span>الإشعارات والنشر التلقائي</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700 space-y-1">
            {errors.map((err, i) => (
              <div key={i}>• {err}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Daily Push Reminder */}
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
                    setReminderDraft({
                      ...reminderDraft,
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
                    setReminderDraft({
                      ...reminderDraft,
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
                  اليوم المستهدف في التذكير
                </label>
                <select
                  value={reminderDraft.targetDay}
                  onChange={(e) =>
                    setReminderDraft({
                      ...reminderDraft,
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
                    setReminderDraft({
                      ...reminderDraft,
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
                    setReminderDraft({
                      ...reminderDraft,
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

          {/* Section 2: Facebook Auto-Post & Delay Control */}
          <div className="pt-4 border-t border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>النشر التلقائي اليومي على فيسبوك (Meta Graph API v21.0)</span>
                </h4>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  ينشر صورة بوستر الجدول (1080x1350) تلقائياً على صفحة فيسبوك في الموعد المحدد.
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
                    setReminderDraft({
                      ...reminderDraft,
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  وقت النشر التلقائي اليومي (Africa/Cairo)
                </label>
                <input
                  type="time"
                  value={reminderDraft.fbAutoPostTime}
                  onChange={(e) =>
                    setReminderDraft({
                      ...reminderDraft,
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
                  نمط النشر على فيسبوك
                </label>
                <select
                  value={reminderDraft.fbPostMode || 'photo_with_caption'}
                  onChange={(e) =>
                    setReminderDraft({
                      ...reminderDraft,
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
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  النمط المستخدم عند النشر التلقائي والنشر اليدوي المباشر.
                </p>
              </div>
            </div>

            {onPublishFacebookNow && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={fbPublishing}
                  onClick={handlePublishFacebook}
                  data-testid="modal-publish-facebook-now-btn"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5 text-white" />
                  <span>
                    {fbPublishing
                      ? 'جارٍ النشر على فيسبوك...'
                      : 'نشر جدول اليوم على فيسبوك الان'}
                  </span>
                </button>

                {fbStatusMsg && (
                  <span
                    data-testid="modal-facebook-status"
                    className={`text-xs font-bold ${
                      fbStatusMsg.ok ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {fbStatusMsg.message}
                  </span>
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2 text-xs font-extrabold text-white hover:bg-purple-800 shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>حفظ الإعدادات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
