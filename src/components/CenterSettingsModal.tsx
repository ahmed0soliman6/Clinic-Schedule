import React, { useState } from 'react';
import { Check, Palette, RotateCcw, Settings, X } from 'lucide-react';
import { CenterSettings } from '../types/schedule';
import { validateCenterSettings } from '../utils/scheduleLogic';

interface CenterSettingsModalProps {
  settings: CenterSettings;
  defaultSettings: CenterSettings;
  onSave: (updated: CenterSettings) => void;
  onClose: () => void;
}

export const CenterSettingsModal: React.FC<CenterSettingsModalProps> = ({
  settings,
  defaultSettings,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<CenterSettings>({ ...settings });
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCenterSettings(draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    onSave(draft);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إعدادات المركز والهوية البصرية"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-700" />
            <span>إعدادات المركز والشعارات والتذييل والألوان</span>
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
                onChange={(e) => setDraft({ ...draft, complexName: e.target.value })}
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
                onChange={(e) => setDraft({ ...draft, associationName: e.target.value })}
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
                onChange={(e) => setDraft({ ...draft, rightLogoUrl: e.target.value })}
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
                onChange={(e) => setDraft({ ...draft, leftLogoUrl: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, whatsappPhone: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, landlinePhone: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, dentalPhone: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, dentalLabel: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, bgStartColor: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, bgEndColor: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, fromHeaderColor: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, toHeaderColor: e.target.value })}
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
                  onChange={(e) => setDraft({ ...draft, footerBgColor: e.target.value })}
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-300 p-1"
                />
              </div>
            </div>
          </div>

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
