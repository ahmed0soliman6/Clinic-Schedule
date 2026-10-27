import React, { useState } from 'react';
import {
  BellRing,
  Check,
  Database,
  Globe,
  MessageSquareText,
  Palette,
  RotateCcw,
  Send,
  Settings,
  X,
} from 'lucide-react';
import { CenterSettings, ReminderSettings } from '../types/schedule';
import {
  DEFAULT_POST_TEMPLATE,
  validateCenterSettings,
} from '../utils/scheduleLogic';
import {
  DEFAULT_REMINDER_SETTINGS,
  validateReminderSettings,
} from '../utils/reminderLogic';

interface CenterSettingsModalProps {
  settings: CenterSettings;
  defaultSettings: CenterSettings;
  reminderSettings?: ReminderSettings;
  isSuperAdminUser?: boolean;
  onOpenSeedModal?: () => void;
  onSave: (
    updated: CenterSettings,
    updatedReminders?: Omit<
      ReminderSettings,
      'lastSentDate' | 'lastFbPostDate' | 'updatedBy' | 'updatedByEmail' | 'updatedAt'
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

export const CenterSettingsModal: React.FC<CenterSettingsModalProps> = ({
  settings,
  defaultSettings,
  reminderSettings,
  isSuperAdminUser = false,
  onOpenSeedModal,
  onSave,
  onSendTestReminder,
  onPublishFacebookNow,
  onClose,
}) => {
  const [draft, setDraft] = useState<CenterSettings>({
    ...settings,
    postTemplate:
      typeof settings.postTemplate === 'string' &&
      settings.postTemplate.trim().length > 0
        ? settings.postTemplate
        : DEFAULT_POST_TEMPLATE,
  });
  const [reminderDraft, setReminderDraft] = useState<
    Omit<
      ReminderSettings,
      'lastSentDate' | 'lastFbPostDate' | 'updatedBy' | 'updatedByEmail' | 'updatedAt'
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
    const centerValidation = validateCenterSettings(draft);
    const reminderValidation = validateReminderSettings(reminderDraft);
    const allErrors = [
      ...centerValidation.errors,
      ...reminderValidation.errors,
    ];
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }
    onSave(draft, reminderValidation.sanitized);
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
      aria-label="إعدادات المركز والإشعارات"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-700" />
            <span>إعدادات المركز والإشعارات</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق إعدادات المركز"
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">
            {errors.map((err, i) => (
              <div key={i}>• {err}</div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identity & Logos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم المجمع الطبي
              </label>
              <input
                type="text"
                value={draft.complexName}
                onChange={(e) =>
                  setDraft({ ...draft, complexName: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الجمعية
              </label>
              <input
                type="text"
                value={draft.associationName}
                onChange={(e) =>
                  setDraft({ ...draft, associationName: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رابط شعار المجمع (أعلى اليمين)
              </label>
              <input
                type="text"
                value={draft.rightLogoUrl}
                onChange={(e) =>
                  setDraft({ ...draft, rightLogoUrl: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رابط شعار الجمعية (أعلى اليسار)
              </label>
              <input
                type="text"
                value={draft.leftLogoUrl}
                onChange={(e) =>
                  setDraft({ ...draft, leftLogoUrl: e.target.value })
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
              />
            </div>
          </div>

          {/* Footer Contact Info */}
          <div className="pt-3 border-t border-slate-200">
            <h4 className="text-xs font-extrabold text-slate-800 mb-2">
              بيانات الشريط السفلي (العنوان وأرقام التواصل)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  العنوان
                </label>
                <input
                  type="text"
                  value={draft.address}
                  onChange={(e) =>
                    setDraft({ ...draft, address: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الواتساب
                </label>
                <input
                  type="text"
                  value={draft.whatsappPhone}
                  onChange={(e) =>
                    setDraft({ ...draft, whatsappPhone: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف الأرضي
                </label>
                <input
                  type="text"
                  value={draft.landlinePhone}
                  onChange={(e) =>
                    setDraft({ ...draft, landlinePhone: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم عيادة الأسنان
                </label>
                <input
                  type="text"
                  value={draft.dentalPhone}
                  onChange={(e) =>
                    setDraft({ ...draft, dentalPhone: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تسمية الرقم الثالث
                </label>
                <input
                  type="text"
                  value={draft.dentalLabel}
                  onChange={(e) =>
                    setDraft({ ...draft, dentalLabel: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>
          </div>

          {/* Colors Customization */}
          <div className="pt-3 border-t border-slate-200">
            <h4 className="text-xs font-extrabold text-slate-800 mb-2 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-purple-600" />
              <span>ألوان التصميم وأعمدة الجدول</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  خلفية علوية
                </label>
                <input
                  type="color"
                  value={draft.bgStartColor}
                  onChange={(e) =>
                    setDraft({ ...draft, bgStartColor: e.target.value })
                  }
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 p-1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  خلفية سفلية
                </label>
                <input
                  type="color"
                  value={draft.bgEndColor}
                  onChange={(e) =>
                    setDraft({ ...draft, bgEndColor: e.target.value })
                  }
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 p-1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  عمود العيادة
                </label>
                <input
                  type="color"
                  value={draft.clinicHeaderColor}
                  onChange={(e) =>
                    setDraft({ ...draft, clinicHeaderColor: e.target.value })
                  }
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 p-1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  عمود الطبيب
                </label>
                <input
                  type="color"
                  value={draft.doctorHeaderColor}
                  onChange={(e) =>
                    setDraft({ ...draft, doctorHeaderColor: e.target.value })
                  }
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 p-1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  عمود (من)
                </label>
                <input
                  type="color"
                  value={draft.fromHeaderColor}
                  onChange={(e) =>
                    setDraft({ ...draft, fromHeaderColor: e.target.value })
                  }
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 p-1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  عمود (إلى)
                </label>
                <input
                  type="color"
                  value={draft.toHeaderColor}
                  onChange={(e) =>
                    setDraft({ ...draft, toHeaderColor: e.target.value })
                  }
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 p-1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  الشريط السفلي
                </label>
                <input
                  type="color"
                  value={draft.footerBgColor}
                  onChange={(e) =>
                    setDraft({ ...draft, footerBgColor: e.target.value })
                  }
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 p-1"
                />
              </div>
            </div>
          </div>

          {/* Post Box Template Section (صندوق البوست المرفق مع الصور عند النشر) */}
          <div className="pt-3 border-t border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <MessageSquareText className="w-4 h-4 text-purple-600" />
                <span>صندوق البوست (النص المرفق مع الصور أثناء النشر)</span>
              </h4>
              <button
                type="button"
                onClick={() =>
                  setDraft({ ...draft, postTemplate: DEFAULT_POST_TEMPLATE })
                }
                data-testid="reset-post-template-btn"
                className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline cursor-pointer"
              >
                استعادة نص البوست الافتراضي
              </button>
            </div>

            <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
              تحكم في الكتابة التي تظهر تلقائياً في «صندوق البوست» وعند الضغط على «مشاركة+بوست». يمكنك كتابة أي نص أو الضغط على المتغيرات لإدراجها:
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { token: '{اليوم}', label: 'اسم اليوم' },
                { token: '{العيادات}', label: 'قائمة عيادات اليوم' },
                { token: '{الواتساب}', label: 'رقم الواتساب' },
                { token: '{الأرضي}', label: 'الرقم الأرضي' },
                { token: '{الأسنان}', label: 'رقم الأسنان' },
                { token: '{رابط_الواتساب}', label: 'رابط محادثة واتساب' },
                { token: '{العنوان}', label: 'العنوان' },
              ].map((item) => (
                <button
                  key={item.token}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      postTemplate: `${draft.postTemplate || ''}${
                        draft.postTemplate?.endsWith('\n') || !draft.postTemplate
                          ? ''
                          : ' '
                      }${item.token}`,
                    })
                  }
                  className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-extrabold text-purple-900 hover:bg-purple-100 transition cursor-pointer"
                >
                  + {item.token} ({item.label})
                </button>
              ))}
            </div>

            <textarea
              rows={6}
              dir="rtl"
              maxLength={2000}
              data-testid="settings-post-template-input"
              aria-label="قالب نص البوست المرفق مع الصور أثناء النشر"
              value={draft.postTemplate ?? DEFAULT_POST_TEMPLATE}
              onChange={(e) =>
                setDraft({ ...draft, postTemplate: e.target.value })
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50/60 p-3 text-xs font-bold text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:border-purple-600 resize-y"
            />
          </div>

          {/* Daily Reminder Section (appConfig/reminders) */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <BellRing className="w-4 h-4 text-purple-600" />
                <span>الإشعار اليومي</span>
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
                <span>تفعيل الإشعار اليومي للموظفين</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وقت الإشعار اليومي (بتوقيت القاهرة Africa/Cairo)
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
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
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
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
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
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نص الإشعار (يمكنك استخدام &#123;اليوم&#125; لإدراج اسم اليوم تلقائياً)
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
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
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

          {/* Facebook Page Auto-Publish & Manual Publish Section (Meta Graph API v21.0) */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>النشر على صفحة فيسبوك (Meta Graph API v21.0)</span>
                </h4>
                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                  يستخدم متغيرات الخادم FB_PAGE_ID و FB_PAGE_ACCESS_TOKEN لنشر جدول عيادات اليوم التالي تلقائياً في موعد الإشعار اليومي أو فوراً بضغطة زر.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-800">
                  النشر التلقائي اليومي
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(reminderDraft.fbAutoPostEnabled)}
                  aria-label="تفعيل أو تعطيل النشر التلقائي اليومي على فيسبوك"
                  data-testid="settings-fb-auto-post-toggle"
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

            {onPublishFacebookNow && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={fbPublishing}
                  onClick={handlePublishFacebook}
                  data-testid="settings-publish-facebook-now-btn"
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
                    data-testid="settings-facebook-status"
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

          {isSuperAdminUser && onOpenSeedModal && (
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800">
                خيارات متقدمة
              </h4>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSeedModal();
                }}
                data-testid="open-seed-btn"
                aria-label="تهيئة قاعدة البيانات لأول مرة"
                className="w-full inline-flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-extrabold text-amber-950 hover:bg-amber-100 transition cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-600" />
                  <span>تهيئة قاعدة البيانات لأول مرة</span>
                </span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDraft({ ...defaultSettings })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>استعادة التصميم الأصلي</span>
            </button>

            <div className="flex items-center gap-2">
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
          </div>
        </form>
      </div>
    </div>
  );
};
