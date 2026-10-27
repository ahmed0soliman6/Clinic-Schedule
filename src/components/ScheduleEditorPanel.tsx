import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Edit3,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  ClinicIconId,
  ConflictInfo,
  DayId,
  SaveStatus,
  ScheduleRow,
} from '../types/schedule';
import {
  CLINIC_COLOR_SWATCHES,
  CLINIC_ICONS_CATALOG,
  DAYS_LIST,
  filterNonEmptyRows,
  validateRowInput,
} from '../utils/scheduleLogic';
import { ClinicMedicalIcon } from './MedicalIcons';

interface ScheduleEditorPanelProps {
  dayId: DayId;
  dayLabel: string;
  draftRows: ScheduleRow[];
  saveStatus: SaveStatus;
  canUndo: boolean;
  undoCount: number;
  selectedRowId: string | null;
  onSelectRow: (id: string | null) => void;
  onAddRow: (input: Omit<ScheduleRow, 'id' | 'sortOrder'>) => void;
  onUpdateRow: (id: string, patch: Partial<Omit<ScheduleRow, 'id' | 'sortOrder'>>) => void;
  onDeleteRow: (id: string) => void;
  onMoveRow: (id: string, direction: 'up' | 'down') => void;
  onReorderRows: (fromIndex: number, toIndex: number) => void;
  onCopyRowToDay: (row: ScheduleRow, targetDayId: DayId) => void;
  onCopyDayToDay: (targetDayId: DayId) => void;
  onUndo: () => void;
  conflict: ConflictInfo | null;
  onResolveConflict: (resolution: 'merge' | 'remote' | 'local') => void;
}

export const ScheduleEditorPanel: React.FC<ScheduleEditorPanelProps> = ({
  dayId,
  dayLabel,
  draftRows,
  saveStatus,
  canUndo,
  undoCount,
  selectedRowId,
  onSelectRow,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
  onMoveRow,
  onReorderRows,
  onCopyRowToDay,
  onCopyDayToDay,
  onUndo,
  conflict,
  onResolveConflict,
}) => {
  const orderedRows = filterNonEmptyRows(draftRows);

  // Add New Row form state
  const [clinicName, setClinicName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [startTime, setStartTime] = useState('4:00 م');
  const [endTime, setEndTime] = useState('6:00 م');
  const [icon, setIcon] = useState<ClinicIconId>('stethoscope');
  const [iconColor, setIconColor] = useState('#ec4899');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Inline editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Omit<ScheduleRow, 'id' | 'sortOrder'> | null>(null);
  const [editErrors, setEditErrors] = useState<string[]>([]);

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Copy Row / Copy Day state
  const [copyingRowId, setCopyingRowId] = useState<string | null>(null);
  const [copyRowTargetDay, setCopyRowTargetDay] = useState<DayId>(
    dayId === 'saturday' ? 'sunday' : 'saturday'
  );
  const [showCopyDayModal, setShowCopyDayModal] = useState(false);
  const [copyDayTarget, setCopyDayTarget] = useState<DayId>(
    dayId === 'saturday' ? 'sunday' : 'saturday'
  );

  // Drag & Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Toast feedback message
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3200);
  };

  const handleCreateRow = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRowInput({
      clinicName,
      doctorName,
      startTime,
      endTime,
      icon,
      iconColor,
    });
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors([]);
    onAddRow({
      clinicName: clinicName.trim(),
      doctorName: doctorName.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      icon,
      iconColor,
    });
    setClinicName('');
    setDoctorName('');
    showToast('تمت إضافة العيادة وحفظها تلقائيًا');
  };

  const startEditingRow = (row: ScheduleRow) => {
    setEditingRowId(row.id);
    onSelectRow(row.id);
    setEditErrors([]);
    setEditDraft({
      clinicName: row.clinicName,
      doctorName: row.doctorName,
      startTime: row.startTime,
      endTime: row.endTime,
      icon: row.icon,
      iconColor: row.iconColor,
    });
  };

  const saveEditedRow = (rowId: string) => {
    if (!editDraft) return;
    const validation = validateRowInput(editDraft);
    if (!validation.valid) {
      setEditErrors(validation.errors);
      return;
    }
    onUpdateRow(rowId, editDraft);
    setEditingRowId(null);
    setEditDraft(null);
    setEditErrors([]);
    showToast('تم تحديث بيانات العيادة بنجاح');
  };

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Top Toolbar: Save Status, Undo, Copy Full Day, Publish */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-900">
                محرر جدول يوم {dayLabel}
              </h3>
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                {orderedRows.length} عيادة
              </span>
            </div>
            {/* Auto-save indicator */}
            <div className="flex items-center gap-2 mt-1 text-xs font-semibold">
              {saveStatus === 'saving' && (
                <span className="text-amber-600 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  جارٍ الحفظ التلقائي في السحابة...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-emerald-700 flex items-center gap-1" data-testid="save-status-indicator">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  تم الحفظ تلقائيًا (مزامنة فورية)
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="text-amber-700 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  تعديلات قيد الحفظ...
                </span>
              )}
              {saveStatus === 'conflict' && (
                <span className="text-rose-700 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  يوجد تعارض تعديلات متزامنة يحتاج للحل
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Undo Button */}
          <button
            type="button"
            onClick={() => {
              onUndo();
              showToast('تم التراجع عن آخر تعديل');
            }}
            disabled={!canUndo}
            aria-label="تراجع عن آخر تعديل"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>تراجع ({undoCount})</span>
          </button>

          {/* Copy Full Day Button */}
          <button
            type="button"
            onClick={() => setShowCopyDayModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition"
          >
            <Copy className="w-4 h-4" />
            <span>نسخ يوم {dayLabel} ليوم آخر</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-800 flex items-center justify-between"
        >
          <span>{feedbackMsg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            aria-label="إغلاق الإشعار"
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Concurrent Conflict Resolution Banner */}
      {conflict && (
        <div
          role="alert"
          data-testid="conflict-banner"
          className="rounded-2xl bg-rose-50 border-2 border-rose-300 p-4 text-rose-950 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-extrabold text-sm">
                تنبيه: تم اكتشاف تعديل متزامن على جدول يوم {dayLabel}!
              </h4>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                قام المستخدم{' '}
                <strong>
                  {conflict.remoteSchedule.updatedByName ||
                    conflict.remoteSchedule.updatedByEmail}
                </strong>{' '}
                بحفظ نسخة أحدث (الإصدار #{conflict.remoteSchedule.version}) أثناء عملك على
                الجدول. لم يتم استبدال تعديلاتك بصمت — اختر طريقة المعالجة:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => onResolveConflict('merge')}
                  className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800"
                >
                  دمج التعديلات معًا بدون فقدان
                </button>
                <button
                  type="button"
                  onClick={() => onResolveConflict('remote')}
                  className="rounded-lg bg-white border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100"
                >
                  اعتماد نسخة الزميل الأحدث
                </button>
                <button
                  type="button"
                  onClick={() => onResolveConflict('local')}
                  className="rounded-lg bg-white border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100"
                >
                  الاحتفاظ بتعديلاتي فقط
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Clinic Row Form */}
      <form
        onSubmit={handleCreateRow}
        className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-purple-700" />
            <span>إضافة عيادة / موعد جديد إلى يوم {dayLabel}</span>
          </h4>
        </div>

        {formErrors.length > 0 && (
          <div
            role="alert"
            className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700"
          >
            {formErrors.map((err, i) => (
              <div key={i}>• {err}</div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label
              htmlFor="new-clinic-name"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              اسم العيادة
            </label>
            <input
              id="new-clinic-name"
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="مثال: الجراحة العامة، الأسنان..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:border-purple-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="new-doctor-name"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              اسم الطبيب
            </label>
            <input
              id="new-doctor-name"
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="مثال: د/ محمد شكري"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:border-purple-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="new-start-time"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              من الساعة
            </label>
            <input
              id="new-start-time"
              type="text"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="4:00 م"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:border-purple-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="new-end-time"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              إلى الساعة
            </label>
            <input
              id="new-end-time"
              type="text"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              placeholder="6:00 م"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:border-purple-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Icon & Color Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 pt-2 border-t border-slate-100">
          <div>
            <span className="block text-xs font-bold text-slate-700 mb-1.5">
              الأيقونة الطبية للعيادة
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CLINIC_ICONS_CATALOG.map((item) => {
                const selected = icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setIcon(item.id);
                      setIconColor(item.defaultColor);
                    }}
                    title={item.label}
                    aria-label={`أيقونة ${item.label}`}
                    className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-200'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ClinicMedicalIcon
                      icon={item.id}
                      color={selected ? iconColor : item.defaultColor}
                      size={20}
                    />
                    <span className="text-[11px]">{item.label.split('/')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-700 mb-1.5">
              لون الأيقونة
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {CLINIC_COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => setIconColor(swatch.hex)}
                  aria-label={`لون ${swatch.name}`}
                  style={{ backgroundColor: swatch.hex }}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    iconColor === swatch.hex
                      ? 'border-slate-900 scale-110 shadow-sm'
                      : 'border-white hover:scale-105'
                  }`}
                />
              ))}
              <input
                type="color"
                aria-label="اختيار لون مخصص للأيقونة"
                value={iconColor}
                onChange={(e) => setIconColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-purple-800 transition"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة العيادة إلى جدول {dayLabel}</span>
        </button>
      </form>

      {/* Current Rows List (Drag-and-Drop + Up/Down + Edit + Copy + Delete) */}
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-extrabold text-slate-900">
            قائمة عيادات ومواعيد يوم {dayLabel} ({orderedRows.length})
          </h4>
          <span className="text-[11px] font-semibold text-slate-500">
            اسحب الصفوف أو استخدم أسهم الترتيب (أعلى / أسفل)
          </span>
        </div>

        {orderedRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm font-bold text-slate-500">
            لا توجد عيادات مضافة في هذا اليوم. استخدم النموذج أعلاه لإضافة أول عيادة.
          </div>
        ) : (
          <div className="space-y-2.5">
            {orderedRows.map((row, idx) => {
              const isEditing = editingRowId === row.id && editDraft !== null;
              const isConfirmingDelete = confirmDeleteId === row.id;
              const isCopyingRow = copyingRowId === row.id;

              return (
                <div
                  key={row.id}
                  draggable={!isEditing}
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIndex(idx);
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => {
                    if (draggedIndex !== null && draggedIndex !== idx) {
                      onReorderRows(draggedIndex, idx);
                      showToast('تم تحديث ترتيب العيادات');
                    }
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`rounded-xl border p-3 transition ${
                    dragOverIndex === idx
                      ? 'border-purple-600 bg-purple-50/70'
                      : selectedRowId === row.id
                      ? 'border-purple-400 bg-purple-50/30'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                  }`}
                >
                  {isEditing && editDraft ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-extrabold text-purple-800">
                          تعديل بيانات العيادة #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRowId(null);
                            setEditDraft(null);
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-800"
                        >
                          إلغاء
                        </button>
                      </div>

                      {editErrors.length > 0 && (
                        <div className="rounded-lg bg-rose-50 p-2 text-xs font-bold text-rose-700">
                          {editErrors.map((err, i) => (
                            <div key={i}>• {err}</div>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            اسم العيادة
                          </label>
                          <input
                            type="text"
                            aria-label="تعديل اسم العيادة"
                            value={editDraft.clinicName}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, clinicName: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            اسم الطبيب
                          </label>
                          <input
                            type="text"
                            aria-label="تعديل اسم الطبيب"
                            value={editDraft.doctorName}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, doctorName: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            من الساعة
                          </label>
                          <input
                            type="text"
                            aria-label="تعديل وقت البداية"
                            value={editDraft.startTime}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, startTime: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            إلى الساعة
                          </label>
                          <input
                            type="text"
                            aria-label="تعديل وقت النهاية"
                            value={editDraft.endTime}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, endTime: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {CLINIC_ICONS_CATALOG.map((ic) => (
                            <button
                              key={ic.id}
                              type="button"
                              onClick={() =>
                                setEditDraft({ ...editDraft, icon: ic.id })
                              }
                              title={ic.label}
                              className={`p-1 rounded-lg border ${
                                editDraft.icon === ic.id
                                  ? 'border-purple-600 bg-purple-100'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <ClinicMedicalIcon
                                icon={ic.id}
                                color={editDraft.iconColor}
                                size={18}
                              />
                            </button>
                          ))}
                          <input
                            type="color"
                            aria-label="تعديل لون الأيقونة"
                            value={editDraft.iconColor}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, iconColor: e.target.value })
                            }
                            className="h-7 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5 ml-1"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => saveEditedRow(row.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>حفظ التعديل</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Row Summary */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className="cursor-grab text-slate-400 hover:text-slate-600"
                          title="اسحب لإعادة الترتيب"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[11px] font-extrabold text-slate-700 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="shrink-0">
                          <ClinicMedicalIcon
                            icon={row.icon}
                            color={row.iconColor}
                            size={26}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900 text-sm truncate">
                            {row.clinicName}{' '}
                            <span className="text-slate-500 font-bold">
                              — {row.doctorName}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-purple-800 mt-0.5">
                            من {row.startTime} إلى {row.endTime}
                          </div>
                        </div>
                      </div>

                      {/* Row Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onMoveRow(row.id, 'up')}
                          disabled={idx === 0}
                          aria-label={`تحريك ${row.clinicName} لأعلى`}
                          title="تحريك لأعلى"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveRow(row.id, 'down')}
                          disabled={idx === orderedRows.length - 1}
                          aria-label={`تحريك ${row.clinicName} لأسفل`}
                          title="تحريك لأسفل"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingRow(row)}
                          aria-label={`تعديل ${row.clinicName}`}
                          title="تعديل"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-blue-700 hover:bg-blue-50"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCopyingRowId(isCopyingRow ? null : row.id)
                          }
                          aria-label={`نسخ موعد ${row.clinicName} إلى يوم آخر`}
                          title="نسخ الموعد إلى يوم آخر"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-indigo-700 hover:bg-indigo-50"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(row.id)}
                          aria-label={`حذف ${row.clinicName}`}
                          title="حذف"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Copy Single Row Bar */}
                  {isCopyingRow && (
                    <div className="mt-2.5 pt-2.5 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2 bg-indigo-50/60 p-2 rounded-lg">
                      <span className="text-xs font-bold text-indigo-900">
                        نسخ عيادة «{row.clinicName}» إلى يوم:
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="اختر اليوم لنسخ الموعد إليه"
                          value={copyRowTargetDay}
                          onChange={(e) => setCopyRowTargetDay(e.target.value as DayId)}
                          className="rounded-lg border border-indigo-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900"
                        >
                          {DAYS_LIST.filter((d) => d.id !== dayId).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            onCopyRowToDay(row, copyRowTargetDay);
                            setCopyingRowId(null);
                            const targetLabel = DAYS_LIST.find(
                              (d) => d.id === copyRowTargetDay
                            )?.label;
                            showToast(
                              `تم نسخ موعد «${row.clinicName}» إلى يوم ${targetLabel}`
                            );
                          }}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-700"
                        >
                          تأكيد النسخ
                        </button>
                        <button
                          type="button"
                          onClick={() => setCopyingRowId(null)}
                          className="text-xs font-bold text-slate-600 hover:text-slate-900 px-1"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Delete Confirmation Bar */}
                  {isConfirmingDelete && (
                    <div
                      role="alertdialog"
                      aria-label="تأكيد حذف الموعد"
                      className="mt-2.5 pt-2.5 border-t border-rose-200 flex flex-wrap items-center justify-between gap-2 bg-rose-50 p-2 rounded-lg"
                    >
                      <span className="text-xs font-extrabold text-rose-900">
                        هل أنت متأكد من حذف عيادة «{row.clinicName} - {row.doctorName}»؟
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteRow(row.id);
                            setConfirmDeleteId(null);
                            showToast(`تم حذف عيادة «${row.clinicName}»`);
                          }}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-700"
                        >
                          نعم، احذف
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg bg-white border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          تراجع
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Copy Full Day Schedule to Another Day */}
      {showCopyDayModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="نسخ جدول اليوم بالكامل إلى يوم آخر"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-extrabold text-slate-900">
                نسخ جدول يوم {dayLabel} بالكامل
              </h4>
              <button
                type="button"
                onClick={() => setShowCopyDayModal(false)}
                aria-label="إغلاق نافذة النسخ"
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs font-semibold text-slate-600 mb-4 leading-relaxed">
              سيتم نسخ جميع العيادات والمواعيد الحالية في يوم <strong>{dayLabel}</strong> (
              {orderedRows.length} عيادات) إلى جدول اليوم المختار أدناه:
            </p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اليوم المستهدف:
              </label>
              <select
                aria-label="اليوم المستهدف لنسخ الجدول"
                value={copyDayTarget}
                onChange={(e) => setCopyDayTarget(e.target.value as DayId)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900"
              >
                {DAYS_LIST.filter((d) => d.id !== dayId).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCopyDayModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  onCopyDayToDay(copyDayTarget);
                  setShowCopyDayModal(false);
                  const targetLabel = DAYS_LIST.find((d) => d.id === copyDayTarget)?.label;
                  showToast(`تم نسخ جدول يوم ${dayLabel} بالكامل إلى يوم ${targetLabel}`);
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700"
              >
                نسخ الجدول الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
