import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  CenterSettings,
  ClinicIconId,
  DayId,
  ScheduleRow,
} from '../types/schedule';
import {
  CalendarBadgeIcon,
  ClinicMedicalIcon,
  ClockHeaderIcon,
  DoctorHeaderIcon,
  StethoscopeHeaderIcon,
} from './MedicalIcons';
import {
  CLINIC_COLOR_SWATCHES,
  CLINIC_PRESETS_LIST,
  DAYS_LIST,
  TIME_PRESETS_LIST,
  filterNonEmptyRows,
  isCompletelyEmptyRow,
  normalizeLeftLogoUrl,
  normalizeRightLogoUrl,
} from '../utils/scheduleLogic';
import { AssociationBrandLogo, ComplexBrandLogo } from './BrandLogos';

const PENDING_NEW_ROW_ID = '__pending_new_row__';

interface SchedulePosterProps {
  dayId?: DayId;
  dayLabel: string;
  rows: ScheduleRow[];
  settings: CenterSettings;
  posterRef?: React.RefObject<HTMLDivElement | null>;
  isEditable?: boolean;
  isExporting?: boolean;
  onUpdateRow?: (
    rowId: string,
    patch: Partial<Omit<ScheduleRow, 'id' | 'sortOrder'>>
  ) => void;
  onAddRow?: (input: Omit<ScheduleRow, 'id' | 'sortOrder'>) => void;
  onDeleteRow?: (rowId: string) => void;
  onMoveRow?: (rowId: string, direction: 'up' | 'down') => void;
  onCopyRowToDay?: (row: ScheduleRow, targetDayId: DayId) => void;
  onClearDay?: () => void;
  isSaving?: boolean;
}

type ActiveCellPopup =
  | { rowId: string; field: 'clinic' | 'doctor' | 'startTime' | 'endTime' | 'actions' }
  | null;

const formatTimeWithSmallSuffix = (timeStr: string) => {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(.*?)\s*([صم])$/);
  if (match) {
    const [, timeDigits, suffix] = match;
    return (
      <span className="inline-flex items-baseline justify-center gap-0.5">
        <span>{timeDigits}</span>
        <span className="text-[0.72em] font-bold opacity-90 mr-0.5">{suffix}</span>
      </span>
    );
  }
  return <span>{timeStr}</span>;
};

export const SchedulePoster: React.FC<SchedulePosterProps> = ({
  dayId = 'saturday',
  dayLabel,
  rows,
  settings,
  posterRef,
  isEditable = false,
  isExporting = false,
  onUpdateRow,
  onAddRow,
  onDeleteRow,
  onMoveRow,
  onCopyRowToDay,
  onClearDay,
  isSaving = false,
}) => {
  const savedRows = filterNonEmptyRows(rows);
  const [pendingNewRow, setPendingNewRow] = useState<ScheduleRow | null>(null);
  const [activePopup, setActivePopup] = useState<ActiveCellPopup>(null);
  const [doctorDraft, setDoctorDraft] = useState('');
  const [customClinicDraft, setCustomClinicDraft] = useState('');
  const [customTimeDraft, setCustomTimeDraft] = useState('');
  const [copyTargetDay, setCopyTargetDay] = useState<DayId>(
    dayId === 'saturday' ? 'sunday' : 'saturday'
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPendingNewRow(null);
    setActivePopup(null);
  }, [dayId]);

  const showControls = isEditable && !isExporting;
  const orderedRows =
    showControls && pendingNewRow
      ? [...savedRows, { ...pendingNewRow, sortOrder: savedRows.length }]
      : savedRows;
  const rowCount = orderedRows.length;
  const isCompactExport = isExporting && rowCount >= 7;

  // Fully unified, bold, symmetrical font & icon configuration across all table boxes.
  // Enlarged prominently for social exports (WhatsApp / Facebook) so texts boldly fill the poster boxes.
  const getUnifiedFontConfig = (count: number) => {
    if (count <= 3) return { main: 34, time: 28, icon: 46 };
    if (count <= 5) return { main: 31, time: 26, icon: 42 };
    if (count <= 7) return { main: 29, time: 25, icon: 38 };
    if (count <= 9) return { main: 26, time: 22, icon: 34 };
    if (count <= 12) return { main: 22, time: 19, icon: 28 };
    if (count <= 15) return { main: 19, time: 16, icon: 24 };
    if (count <= 20) return { main: 16, time: 14, icon: 20 };
    return { main: 14, time: 12, icon: 16 };
  };

  const unifiedFontConfig = getUnifiedFontConfig(rowCount);

  // Exact same enlarged unified font size for ALL clinic boxes in the exported image, with smart scaling for long names
  const getExportClinicFontSize = (text: string): string => {
    const base = unifiedFontConfig.main;
    const len = (text || '').trim().length;
    if (len >= 20) return `${Math.max(11, Math.round(base * 0.58))}px`;
    if (len >= 15) return `${Math.max(12, Math.round(base * 0.68))}px`;
    if (len >= 11) return `${Math.max(13, Math.round(base * 0.80))}px`;
    return `${base}px`;
  };

  // Exact same enlarged unified font size for ALL doctor boxes in the exported image, with smart scaling
  const getExportDoctorFontSize = (text: string): string => {
    const base = unifiedFontConfig.main;
    const len = (text || '').trim().length;
    if (len >= 28) return `${Math.max(11, Math.round(base * 0.60))}px`;
    if (len >= 22) return `${Math.max(12, Math.round(base * 0.70))}px`;
    if (len >= 16) return `${Math.max(13, Math.round(base * 0.82))}px`;
    return `${base}px`;
  };

  // Exact same enlarged unified font size for ALL time boxes (من / إلى) in the exported image
  const getExportTimeFontSize = (text: string): string => {
    const base = unifiedFontConfig.time;
    const len = (text || '').trim().length;
    if (len >= 9) return `${Math.max(11, Math.round(base * 0.80))}px`;
    if (len >= 8) return `${Math.max(12, Math.round(base * 0.88))}px`;
    return `${base}px`;
  };

  const exportIconSize = unifiedFontConfig.icon;

  const activePopupRef = useRef<ActiveCellPopup>(null);
  const doctorDraftRef = useRef(doctorDraft);
  const doctorDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activePopupRef.current = activePopup;
  }, [activePopup]);

  useEffect(() => {
    doctorDraftRef.current = doctorDraft;
  }, [doctorDraft]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (activePopupRef.current?.field === 'doctor') {
          if (doctorDebounceTimerRef.current) {
            clearTimeout(doctorDebounceTimerRef.current);
            doctorDebounceTimerRef.current = null;
          }
          applyRowPatchOrCommitPending(activePopupRef.current.rowId, {
            doctorName: doctorDraftRef.current.trim(),
          });
        }
        setActivePopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openCellEditor = (
    row: ScheduleRow,
    field: 'clinic' | 'doctor' | 'startTime' | 'endTime' | 'actions'
  ) => {
    if (!showControls) return;
    if (activePopup?.rowId === row.id && activePopup?.field === field) {
      setActivePopup(null);
      return;
    }
    setDoctorDraft(row.doctorName);
    setCustomClinicDraft(row.clinicName);
    setCustomTimeDraft(field === 'startTime' ? row.startTime : row.endTime);
    setActivePopup({ rowId: row.id, field });
  };

  const applyRowPatchOrCommitPending = (
    rowId: string,
    patch: Partial<Omit<ScheduleRow, 'id' | 'sortOrder'>>
  ) => {
    if (rowId === PENDING_NEW_ROW_ID) {
      if (!pendingNewRow) return;
      const merged: Omit<ScheduleRow, 'id' | 'sortOrder'> = {
        clinicName: patch.clinicName ?? pendingNewRow.clinicName,
        doctorName: patch.doctorName ?? pendingNewRow.doctorName,
        startTime: patch.startTime ?? pendingNewRow.startTime,
        endTime: patch.endTime ?? pendingNewRow.endTime,
        icon: patch.icon ?? pendingNewRow.icon,
        iconColor: patch.iconColor ?? pendingNewRow.iconColor,
      };
      if (isCompletelyEmptyRow(merged)) {
        setPendingNewRow({ ...pendingNewRow, ...merged });
        return;
      }
      setPendingNewRow(null);
      onAddRow?.(merged);
      return;
    }
    onUpdateRow?.(rowId, patch);
  };

  const handleSelectClinicPreset = (
    rowId: string,
    name: string,
    icon: ClinicIconId,
    color: string
  ) => {
    applyRowPatchOrCommitPending(rowId, {
      clinicName: name,
      icon,
      iconColor: color,
    });
    setActivePopup(null);
  };

  const handleDoctorInputChange = (rowId: string, val: string) => {
    setDoctorDraft(val);
    doctorDraftRef.current = val;
    if (doctorDebounceTimerRef.current) {
      clearTimeout(doctorDebounceTimerRef.current);
    }
    doctorDebounceTimerRef.current = setTimeout(() => {
      applyRowPatchOrCommitPending(rowId, { doctorName: val.trim() });
    }, 350);
  };

  const handleDoctorBlur = (rowId: string) => {
    if (doctorDebounceTimerRef.current) {
      clearTimeout(doctorDebounceTimerRef.current);
      doctorDebounceTimerRef.current = null;
    }
    applyRowPatchOrCommitPending(rowId, { doctorName: doctorDraftRef.current.trim() });
  };

  const handleDoctorPrefixSelect = (rowId: string, prefix: string) => {
    const clean = doctorDraftRef.current.replace(/^(أ\.د\/|د\/|أ\/)\s*/, '');
    const updated = `${prefix}${clean}`;
    setDoctorDraft(updated);
    doctorDraftRef.current = updated;
    if (doctorDebounceTimerRef.current) {
      clearTimeout(doctorDebounceTimerRef.current);
      doctorDebounceTimerRef.current = null;
    }
    applyRowPatchOrCommitPending(rowId, { doctorName: updated.trim() });
  };

  const handleSaveDoctorName = (rowId: string) => {
    if (doctorDebounceTimerRef.current) {
      clearTimeout(doctorDebounceTimerRef.current);
      doctorDebounceTimerRef.current = null;
    }
    const trimmed = doctorDraftRef.current.trim();
    applyRowPatchOrCommitPending(rowId, { doctorName: trimmed });
    setActivePopup(null);
  };

  const handleSelectTime = (
    rowId: string,
    field: 'startTime' | 'endTime',
    timeValue: string
  ) => {
    const trimmed = timeValue.trim();
    applyRowPatchOrCommitPending(rowId, { [field]: trimmed });
    setActivePopup(null);
  };

  const handleQuickAddRow = () => {
    if (!onAddRow) return;
    if (pendingNewRow) {
      setActivePopup({ rowId: PENDING_NEW_ROW_ID, field: 'clinic' });
      return;
    }
    const blankRow: ScheduleRow = {
      id: PENDING_NEW_ROW_ID,
      clinicName: '',
      doctorName: '',
      startTime: '',
      endTime: '',
      icon: 'stethoscope',
      iconColor: '#6d28d9',
      sortOrder: savedRows.length,
    };
    setPendingNewRow(blankRow);
    setDoctorDraft('');
    setCustomClinicDraft('');
    setCustomTimeDraft('');
    setActivePopup({ rowId: PENDING_NEW_ROW_ID, field: 'clinic' });
  };

  return (
    <div ref={containerRef} className="w-full">
      <div
        ref={posterRef}
        id={isExporting ? 'schedule-poster-export-canvas' : 'schedule-poster-canvas'}
        data-testid={isExporting ? 'schedule-poster-export' : 'schedule-poster'}
        dir="rtl"
        style={{
          background: `radial-gradient(circle at 50% 25%, #ffffff 0%, ${settings.bgStartColor} 48%, ${settings.bgEndColor} 100%)`,
          fontFamily: "'Cairo', 'Tajawal', sans-serif",
          width: isExporting ? '780px' : undefined,
          height: isExporting ? '975px' : undefined, // Exact 4:5 aspect ratio (780 / 975 = 0.8)
        }}
        className={`relative mx-auto overflow-hidden rounded-[28px] shadow-xl border border-purple-200/70 select-none ${
          isExporting
            ? 'w-[780px] h-[975px] p-4 flex flex-col justify-between'
            : 'w-full max-w-[780px] p-2.5 sm:p-6'
        }`}
      >
        {/* Subtle Center Watermark Background of مجمع ميت عزون الطبي Logo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
        >
          <ComplexBrandLogo
            className="w-[420px] max-w-[75%] h-auto opacity-[0.045]"
            idSuffix={isExporting ? 'export-watermark' : 'view-watermark'}
          />
        </div>

        {/* Top Header: Right Transparent Logo - Center Day Banner - Left Association Logo */}
        <div
          className={`relative z-10 grid grid-cols-[1fr_1.45fr_1fr] items-center shrink-0 ${
            isExporting
              ? isCompactExport
                ? 'gap-3 mb-1.5'
                : 'gap-4 mb-3'
              : 'gap-1.5 sm:gap-4 mb-3.5 sm:mb-5'
          }`}
        >
          {/* Right side in RTL: Transparent Medical Complex Logo (مجمع ميت عزون الطبي) — Enlarged to match Day Banner */}
          <div className="flex flex-col items-center justify-center text-center">
            {settings.rightLogoUrl &&
            (settings.rightLogoUrl.startsWith('http') ||
              settings.rightLogoUrl.startsWith('data:')) ? (
              <img
                src={normalizeRightLogoUrl(settings.rightLogoUrl)}
                alt={settings.complexName}
                crossOrigin="anonymous"
                className={`w-auto object-contain drop-shadow-xs ${
                  isExporting
                    ? isCompactExport
                      ? 'h-32 sm:h-36 scale-105'
                      : 'h-40 sm:h-44 scale-105'
                    : 'h-28 sm:h-40 scale-105'
                }`}
              />
            ) : (
              <ComplexBrandLogo
                className={`w-auto object-contain drop-shadow-xs ${
                  isExporting
                    ? isCompactExport
                      ? 'h-32 sm:h-36 scale-105'
                      : 'h-40 sm:h-44 scale-105'
                    : 'h-28 sm:h-40 scale-105'
                }`}
                idSuffix={isExporting ? 'export-right' : 'view-right'}
              />
            )}
          </div>

          {/* Center: Day Banner with Calendar Icon Overlapping Top Edge, Cyan Accent Lines & Sparkles */}
          <div className="relative flex flex-col items-center justify-center pt-2 pb-1">
            <div className="relative z-20 flex items-center justify-center w-full -mb-5">
              <div
                className={`h-[3px] bg-sky-400 rounded-full mt-2 ${
                  isExporting ? 'w-14' : 'w-7 sm:w-14'
                }`}
              />
              <div className="mx-1.5 drop-shadow-sm">
                <CalendarBadgeIcon size={isExporting ? 48 : 44} />
              </div>
              <div
                className={`h-[3px] bg-sky-400 rounded-full mt-2 ${
                  isExporting ? 'w-14' : 'w-7 sm:w-14'
                }`}
              />
            </div>

            {/* Sparkles & Pill Box */}
            <div className="relative z-10 flex items-center justify-center w-full">
              {/* Right Sparkles */}
              <div
                aria-hidden="true"
                className={`flex flex-col items-center justify-between text-indigo-950 ${
                  isExporting ? 'h-16 mr-1.5' : 'h-12 sm:h-16 mr-1 sm:mr-1.5'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0L10.2 5.8L16 8L10.2 10.2L8 16L5.8 10.2L0 8L5.8 5.8L8 0Z" />
                </svg>
                <span className="w-2.5 h-[2.5px] bg-indigo-950 rounded-full my-1" />
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0L10.2 5.8L16 8L10.2 10.2L8 16L5.8 10.2L0 8L5.8 5.8L8 0Z" />
                </svg>
              </div>

              {/* Main Purple-Indigo Day Pill */}
              <div
                style={{
                  background:
                    'linear-gradient(135deg, #6d28d9 0%, #4c1d95 48%, #1e1b4b 100%)',
                }}
                className={`w-full max-w-[280px] rounded-full text-center shadow-lg border border-purple-400/30 ${
                  isExporting
                    ? 'px-6 pt-6 pb-3.5'
                    : 'px-3 sm:px-6 pt-4 pb-2 sm:pt-6 sm:pb-3.5'
                }`}
              >
                <h2
                  data-testid={isExporting ? undefined : 'poster-day-title'}
                  className={`font-black text-white tracking-wide leading-tight drop-shadow ${
                    isExporting
                      ? 'text-[50px] leading-tight'
                      : 'text-2xl sm:text-4xl md:text-[42px] leading-tight'
                  }`}
                >
                  {dayLabel}
                </h2>
              </div>

              {/* Left Sparkles */}
              <div
                aria-hidden="true"
                className={`flex flex-col items-center justify-between text-indigo-950 ${
                  isExporting ? 'h-16 ml-1.5' : 'h-12 sm:h-16 ml-1 sm:ml-1.5'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0L10.2 5.8L16 8L10.2 10.2L8 16L5.8 10.2L0 8L5.8 5.8L8 0Z" />
                </svg>
                <span className="w-2.5 h-[2.5px] bg-indigo-950 rounded-full my-1" />
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0L10.2 5.8L16 8L10.2 10.2L8 16L5.8 10.2L0 8L5.8 5.8L8 0Z" />
                </svg>
              </div>
            </div>

            {/* Bottom Cyan Accent Line */}
            <div
              className={`mt-2 h-[3px] bg-sky-400 rounded-full ${
                isExporting ? 'w-44' : 'w-24 sm:w-44'
              }`}
            />
          </div>

          {/* Left side in RTL: Community Development Association Logo (جمعية تنمية المجتمع المحلي بميت عزون) — Enlarged to match Right Complex Logo */}
          <div className="flex flex-col items-center justify-center text-center">
            {settings.leftLogoUrl &&
            (settings.leftLogoUrl.startsWith('http') ||
              settings.leftLogoUrl.startsWith('data:')) ? (
              <img
                src={normalizeLeftLogoUrl(settings.leftLogoUrl)}
                alt={settings.associationName}
                crossOrigin="anonymous"
                className={`w-auto object-contain drop-shadow-xs ${
                  isExporting
                    ? isCompactExport
                      ? 'h-32 sm:h-36 scale-105'
                      : 'h-40 sm:h-44 scale-105'
                    : 'h-28 sm:h-40 scale-105'
                }`}
              />
            ) : (
              <AssociationBrandLogo
                className={`w-auto object-contain drop-shadow-xs ${
                  isExporting
                    ? isCompactExport
                      ? 'h-32 sm:h-36 scale-105'
                      : 'h-40 sm:h-44 scale-105'
                    : 'h-28 sm:h-40 scale-105'
                }`}
                idSuffix={isExporting ? 'export-left' : 'view-left'}
              />
            )}
          </div>
        </div>

        {/* Main White Table Card — Stretches vertically in 4:5 export mode so 2 rows or 9 rows always fill the frame */}
        <div
          className={`relative z-20 rounded-[26px] bg-white shadow-md border border-purple-100 ${
            isExporting
              ? 'p-2 flex-1 flex flex-col min-h-0'
              : showControls
                ? 'p-1.5 pl-5 sm:p-3 sm:pl-6'
                : 'p-1.5 sm:p-3'
          }`}
        >
          {/* Table Column Headers (RTL order: العيادة 34% | الطبيب 42% | من 12% | إلى 12%) — Dynamically styled via settings */}
          <div className="grid grid-cols-[minmax(0,34%)_minmax(0,42%)_minmax(0,12%)_minmax(0,12%)] gap-[2px] overflow-hidden rounded-t-[20px] shrink-0">
            {/* Column 1: العيادة */}
            <div
              style={{
                backgroundColor: settings.clinicHeaderColor || '#f59e0b',
                background: `linear-gradient(135deg, ${settings.clinicHeaderColor || '#f59e0b'} 0%, ${settings.clinicHeaderColor || '#f59e0b'}ee 100%)`,
              }}
              className={`min-w-0 overflow-hidden flex items-center justify-center gap-1.5 px-1.5 text-white ${
                isExporting ? 'py-2.5 text-[28px] font-black' : 'py-2 sm:py-2.5 text-xs sm:text-base font-bold'
              }`}
            >
              <span>العيادة</span>
              <StethoscopeHeaderIcon size={isExporting ? 30 : 16} />
            </div>

            {/* Column 2: الطبيب */}
            <div
              style={{
                backgroundColor: settings.doctorHeaderColor || '#0d9456',
                background: `linear-gradient(135deg, ${settings.doctorHeaderColor || '#0d9456'} 0%, ${settings.doctorHeaderColor || '#0d9456'}ee 100%)`,
              }}
              className={`min-w-0 overflow-hidden flex items-center justify-center gap-1.5 px-1.5 text-white ${
                isExporting ? 'py-2.5 text-[28px] font-black' : 'py-2 sm:py-2.5 text-xs sm:text-base font-bold'
              }`}
            >
              <span>الطبيب</span>
              <DoctorHeaderIcon size={isExporting ? 30 : 16} />
            </div>

            {/* Column 3: من */}
            <div
              style={{
                backgroundColor: settings.fromHeaderColor || '#f59e0b',
                background: `linear-gradient(135deg, ${settings.fromHeaderColor || '#f59e0b'} 0%, ${settings.fromHeaderColor || '#f59e0b'}ee 100%)`,
              }}
              className={`min-w-0 overflow-hidden flex items-center justify-center gap-1 px-1 text-white ${
                isExporting ? 'py-2.5 text-[28px] font-black' : 'py-2 sm:py-2.5 text-xs sm:text-base font-bold'
              }`}
            >
              <span>من</span>
              <ClockHeaderIcon size={isExporting ? 26 : 15} />
            </div>

            {/* Column 4: إلى */}
            <div
              style={{
                backgroundColor: settings.toHeaderColor || '#0088cc',
                background: `linear-gradient(135deg, ${settings.toHeaderColor || '#0088cc'} 0%, ${settings.toHeaderColor || '#0088cc'}ee 100%)`,
              }}
              className={`min-w-0 overflow-hidden flex items-center justify-center gap-1 px-1 text-white ${
                isExporting ? 'py-2.5 text-[28px] font-black' : 'py-2 sm:py-2.5 text-xs sm:text-base font-bold'
              }`}
            >
              <span>إلى</span>
              <ClockHeaderIcon size={isExporting ? 26 : 15} />
            </div>
          </div>

          {/* Table Body Rows */}
          <div
            className={`divide-y-[2px] divide-white bg-white rounded-b-[18px] ${
              isExporting ? 'flex-1 flex flex-col min-h-0' : ''
            }`}
          >
            {orderedRows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 font-bold text-base bg-slate-50 rounded-b-[18px] flex-1 flex items-center justify-center">
                لا توجد عيادات مسجلة في هذا اليوم حاليًا
              </div>
            ) : (
              orderedRows.map((row, idx) => {
                const isClinicOpen =
                  activePopup?.rowId === row.id && activePopup?.field === 'clinic';
                const isDoctorOpen =
                  activePopup?.rowId === row.id && activePopup?.field === 'doctor';
                const isStartOpen =
                  activePopup?.rowId === row.id && activePopup?.field === 'startTime';
                const isEndOpen =
                  activePopup?.rowId === row.id && activePopup?.field === 'endTime';

                return (
                  <div
                    key={row.id}
                    data-testid={isExporting ? undefined : `poster-row-${row.id}`}
                    className={`relative grid grid-cols-[minmax(0,34%)_minmax(0,42%)_minmax(0,12%)_minmax(0,12%)] gap-[2px] group ${
                      isExporting ? 'flex-1 min-h-0' : ''
                    }`}
                  >
                    {/* CELL 1: CLINIC NAME + ICON */}
                    <div
                      data-testid={isExporting ? undefined : `cell-clinic-${idx}`}
                      onClick={() => openCellEditor(row, 'clinic')}
                      role={showControls ? 'button' : undefined}
                      tabIndex={showControls ? 0 : undefined}
                      aria-label={
                        showControls
                          ? `اختيار نوع العيادة: ${row.clinicName || 'اختر العيادة'}`
                          : undefined
                      }
                      className={`min-w-0 overflow-hidden bg-[#fdf8f3] flex items-center justify-between gap-1 relative ${
                        isExporting
                          ? 'px-2 py-0.5 h-full'
                          : 'px-1 sm:px-2 py-1.5 sm:py-2 min-h-[42px] sm:min-h-[50px]'
                      } ${
                        showControls
                          ? 'cursor-pointer hover:bg-amber-50/90 hover:ring-2 hover:ring-inset hover:ring-amber-400 transition'
                          : ''
                      } ${
                        isClinicOpen
                          ? 'ring-2 ring-inset ring-purple-600 bg-purple-50/40'
                          : ''
                      }`}
                    >
                      {row.clinicName ? (
                        <div className="shrink-0 flex items-center justify-center">
                          <ClinicMedicalIcon
                            icon={row.icon}
                            color={row.iconColor}
                            size={isExporting ? exportIconSize : 18}
                            className={
                              isExporting ? undefined : 'w-4 h-4 sm:w-5 sm:h-5'
                            }
                          />
                        </div>
                      ) : null}
                      <div
                        style={
                          isExporting
                            ? { fontSize: getExportClinicFontSize(row.clinicName) }
                            : undefined
                        }
                        className={`min-w-0 flex-1 text-center text-slate-950 flex items-center justify-center ${
                          isExporting
                            ? 'font-black leading-normal tracking-tight whitespace-nowrap overflow-hidden py-1'
                            : 'font-bold text-[11px] sm:text-sm md:text-base leading-snug'
                        }`}
                      >
                        {row.clinicName ? (
                          <span className={isExporting ? 'whitespace-nowrap leading-normal py-0.5' : 'leading-snug text-center'}>
                            {row.clinicName}
                          </span>
                        ) : showControls ? (
                          <span className="text-slate-300 text-xs font-bold">
                            &nbsp;
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* CELL 2: DOCTOR NAME */}
                    <div
                      data-testid={isExporting ? undefined : `cell-doctor-${idx}`}
                      onClick={() => {
                        if (!isDoctorOpen) openCellEditor(row, 'doctor');
                      }}
                      role={showControls ? 'button' : undefined}
                      tabIndex={showControls ? 0 : undefined}
                      aria-label={
                        showControls
                          ? `تعديل اسم الطبيب: ${row.doctorName || 'اكتب اسم الطبيب'}`
                          : undefined
                      }
                      style={
                        isExporting
                          ? { fontSize: getExportDoctorFontSize(row.doctorName) }
                          : undefined
                      }
                      className={`min-w-0 overflow-hidden bg-[#f1f5f2] flex items-center justify-center text-center text-slate-950 relative ${
                        isExporting
                          ? 'px-2 py-0.5 h-full font-black leading-normal tracking-tight whitespace-nowrap'
                          : 'px-1 sm:px-2 py-1.5 sm:py-2 font-bold text-[11px] sm:text-sm md:text-base leading-snug'
                      } ${
                        showControls
                          ? 'cursor-pointer hover:bg-emerald-50/90 hover:ring-2 hover:ring-inset hover:ring-emerald-500 transition'
                          : ''
                      } ${
                        isDoctorOpen ? 'ring-2 ring-inset ring-emerald-600 bg-white' : ''
                      }`}
                    >
                      {isDoctorOpen && showControls ? (
                        <div
                          data-export-ignore="true"
                          onClick={(e) => e.stopPropagation()}
                          className="w-full flex flex-col gap-1.5 p-0.5"
                        >
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              autoFocus
                              aria-label="كتابة اسم الطبيب"
                              placeholder="اسم الطبيب (حفظ تلقائي)"
                              value={doctorDraft}
                              onChange={(e) => handleDoctorInputChange(row.id, e.target.value)}
                              onBlur={() => handleDoctorBlur(row.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveDoctorName(row.id);
                                }
                                if (e.key === 'Escape') setActivePopup(null);
                              }}
                              className="w-full rounded-lg border-2 border-emerald-500 bg-white px-2 py-1.5 text-xs sm:text-sm font-extrabold text-slate-900 text-center shadow-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <div className="flex items-center gap-1">
                              {['د/ ', 'أ.د/ ', 'أ/ '].map((prefix) => (
                                <button
                                  key={prefix}
                                  type="button"
                                  onClick={() => handleDoctorPrefixSelect(row.id, prefix)}
                                  className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-900 hover:bg-emerald-200 transition active:scale-95 cursor-pointer"
                                >
                                  {prefix.trim()}
                                </button>
                              ))}
                            </div>
                            <span className="text-[9px] font-bold text-emerald-700 flex items-center gap-1 select-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                              حفظ تلقائي
                            </span>
                          </div>
                        </div>
                      ) : row.doctorName ? (
                        <span className={isExporting ? 'whitespace-nowrap leading-normal' : 'leading-snug text-center'}>
                          {row.doctorName}
                        </span>
                      ) : showControls ? (
                        <span className="text-slate-300 text-xs font-bold">
                          &nbsp;
                        </span>
                      ) : null}
                    </div>

                    {/* CELL 3: START TIME (من) */}
                    <div
                      data-testid={isExporting ? undefined : `cell-start-${idx}`}
                      onClick={() => openCellEditor(row, 'startTime')}
                      role={showControls ? 'button' : undefined}
                      tabIndex={showControls ? 0 : undefined}
                      aria-label={
                        showControls
                          ? `اختيار وقت البدء من: ${row.startTime || 'من'}`
                          : undefined
                      }
                      style={
                        isExporting
                          ? { fontSize: getExportTimeFontSize(row.startTime) }
                          : undefined
                      }
                      className={`min-w-0 overflow-hidden bg-[#fdf9f2] flex items-center justify-center px-0.5 sm:px-1 text-center text-slate-950 tracking-tight whitespace-nowrap relative ${
                        isExporting
                          ? 'py-0.5 h-full font-black leading-normal'
                          : 'py-1.5 sm:py-2 font-semibold text-[10px] sm:text-xs md:text-sm leading-snug'
                      } ${
                        showControls
                          ? 'cursor-pointer hover:bg-amber-50/90 hover:ring-2 hover:ring-inset hover:ring-amber-400 transition'
                          : ''
                      } ${
                        isStartOpen ? 'ring-2 ring-inset ring-amber-500 bg-amber-50' : ''
                      }`}
                    >
                      {row.startTime ? (
                        formatTimeWithSmallSuffix(row.startTime)
                      ) : showControls ? (
                        <span className="text-slate-300 text-xs font-bold">
                          &nbsp;
                        </span>
                      ) : null}
                    </div>

                    {/* CELL 4: END TIME (إلى) — Clean full-width box without inside buttons */}
                    <div
                      data-testid={isExporting ? undefined : `cell-end-${idx}`}
                      onClick={() => openCellEditor(row, 'endTime')}
                      role={showControls ? 'button' : undefined}
                      tabIndex={showControls ? 0 : undefined}
                      aria-label={
                        showControls
                          ? `اختيار وقت النهاية إلى: ${row.endTime || 'إلى'}`
                          : undefined
                      }
                      style={
                        isExporting
                          ? { fontSize: getExportTimeFontSize(row.endTime) }
                          : undefined
                      }
                      className={`min-w-0 overflow-hidden bg-[#eef6fc] flex items-center justify-center px-0.5 sm:px-1 text-center text-slate-950 tracking-tight whitespace-nowrap relative ${
                        isExporting
                          ? 'py-0.5 h-full font-black leading-normal'
                          : 'py-1.5 sm:py-2 font-semibold text-[10px] sm:text-xs md:text-sm leading-snug'
                      } ${
                        showControls
                          ? 'cursor-pointer hover:bg-sky-50/90 hover:ring-2 hover:ring-inset hover:ring-sky-400 transition'
                          : ''
                      } ${
                        isEndOpen ? 'ring-2 ring-inset ring-sky-500 bg-sky-50' : ''
                      }`}
                    >
                      {row.endTime ? (
                        formatTimeWithSmallSuffix(row.endTime)
                      ) : showControls ? (
                        <span className="text-slate-300 text-xs font-bold">
                          &nbsp;
                        </span>
                      ) : null}
                    </div>

                    {/* Row Actions Trigger Button (×) Positioned Outside the Left Edge of the Row Box */}
                    {showControls && (
                      <button
                        type="button"
                        data-export-ignore="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activePopup?.rowId === row.id && activePopup?.field === 'actions') {
                            setActivePopup(null);
                          } else {
                            openCellEditor(row, 'actions');
                          }
                        }}
                        data-testid={`row-actions-btn-${idx}`}
                        title="إجراءات الصف"
                        aria-label={`خيارات صف ${row.clinicName || idx + 1}`}
                        className={`absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 z-20 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black leading-none transition cursor-pointer shadow-xs border ${
                          activePopup?.rowId === row.id && activePopup?.field === 'actions'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white'
                        }`}
                      >
                        ×
                      </button>
                    )}

                    {/* POPOVER 1: 18 SPECIALTY CLINICS SELECTOR */}
                    {isClinicOpen && showControls && (
                      <div
                        data-export-ignore="true"
                        onClick={(e) => e.stopPropagation()}
                        className="col-span-4 z-30 mt-1 rounded-2xl bg-white p-3.5 shadow-2xl border-2 border-purple-500"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                          <span className="text-xs font-black text-purple-950">
                            اختر نوع العيادة (تتغير الأيقونة تلقائيًا):
                          </span>
                          <button
                            type="button"
                            onClick={() => setActivePopup(null)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 mb-3">
                          {CLINIC_PRESETS_LIST.map((preset) => {
                            const isCurrent = row.clinicName === preset.name;
                            return (
                              <button
                                key={preset.name}
                                type="button"
                                data-testid={`preset-clinic-${preset.icon}`}
                                onClick={() =>
                                  handleSelectClinicPreset(
                                    row.id,
                                    preset.name,
                                    preset.icon,
                                    preset.color
                                  )
                                }
                                className={`flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-extrabold transition ${
                                  isCurrent
                                    ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-200'
                                    : 'border-slate-200 bg-slate-50/70 text-slate-800 hover:bg-purple-50/50 hover:border-purple-300'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <ClinicMedicalIcon
                                    icon={preset.icon}
                                    color={preset.color}
                                    size={20}
                                  />
                                  <span className="truncate">{preset.name}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ✕
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-600">
                            أو اسم مخصص:
                          </span>
                          <input
                            type="text"
                            value={customClinicDraft}
                            onChange={(e) => setCustomClinicDraft(e.target.value)}
                            placeholder="مثال: التخاطب وتعديل السلوك"
                            className="flex-1 min-w-[150px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold"
                          />
                          <div className="flex items-center gap-1">
                            {CLINIC_COLOR_SWATCHES.slice(0, 6).map((sw) => (
                              <button
                                key={sw.hex}
                                type="button"
                                onClick={() =>
                                  applyRowPatchOrCommitPending(row.id, { iconColor: sw.hex })
                                }
                                style={{ backgroundColor: sw.hex }}
                                className="h-5 w-5 rounded-full border border-white shadow-2xs"
                              />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (customClinicDraft.trim()) {
                                applyRowPatchOrCommitPending(row.id, {
                                  clinicName: customClinicDraft.trim(),
                                });
                              }
                              setActivePopup(null);
                            }}
                            className="rounded-lg bg-purple-700 px-3 py-1 text-xs font-extrabold text-white hover:bg-purple-800"
                          >
                            اعتماد
                          </button>
                        </div>
                      </div>
                    )}

                    {/* POPOVER 2: START / END TIME PICKER */}
                    {(isStartOpen || isEndOpen) && showControls && (
                      <div
                        data-export-ignore="true"
                        onClick={(e) => e.stopPropagation()}
                        className="col-span-4 z-30 mt-1 rounded-2xl bg-white p-3.5 shadow-2xl border-2 border-sky-500"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                          <span className="text-xs font-black text-slate-900">
                            اختر الموعد ({isStartOpen ? 'من الساعة' : 'إلى الساعة'}):
                          </span>
                          <button
                            type="button"
                            onClick={() => setActivePopup(null)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mb-3">
                          {TIME_PRESETS_LIST.map((t) => {
                            const currentVal = isStartOpen
                              ? row.startTime
                              : row.endTime;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() =>
                                  handleSelectTime(
                                    row.id,
                                    isStartOpen ? 'startTime' : 'endTime',
                                    t
                                  )
                                }
                                className={`rounded-lg border py-1.5 px-2 text-xs font-extrabold transition ${
                                  currentVal === t
                                    ? 'border-sky-600 bg-sky-600 text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-sky-50 hover:border-sky-300'
                                }`}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-600">
                            موعد مخصص:
                          </span>
                          <input
                            type="text"
                            value={customTimeDraft}
                            onChange={(e) => setCustomTimeDraft(e.target.value)}
                            placeholder="مثال: 4:15 م"
                            className="w-36 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-center"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectTime(
                                row.id,
                                isStartOpen ? 'startTime' : 'endTime',
                                customTimeDraft
                              )
                            }
                            className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-extrabold text-white hover:bg-sky-700"
                          >
                            تأكيد الموعد
                          </button>
                        </div>
                      </div>
                    )}

                    {/* POPOVER 3: ROW ACTIONS (Compact Icons: 🔼 🔽, حذف + icon, ×) */}
                    {activePopup?.rowId === row.id &&
                      activePopup?.field === 'actions' &&
                      showControls && (
                        <div
                          data-export-ignore="true"
                          onClick={(e) => e.stopPropagation()}
                          className="col-span-4 z-30 mt-1 rounded-xl bg-slate-900 px-2.5 py-2 text-white flex flex-wrap items-center justify-between gap-1.5 shadow-lg"
                        >
                          <span className="text-[11px] font-bold truncate max-w-[140px] sm:max-w-none">
                            إجراءات الصف:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                onMoveRow && onMoveRow(row.id, 'up');
                                setActivePopup(null);
                              }}
                              title="تحريك لأعلى"
                              aria-label="تحريك لأعلى"
                              className="inline-flex items-center justify-center rounded-lg bg-white/15 px-2 py-1 text-xs font-bold hover:bg-white/25 disabled:opacity-30 cursor-pointer"
                            >
                              🔼
                            </button>
                            <button
                              type="button"
                              disabled={idx === orderedRows.length - 1}
                              onClick={() => {
                                onMoveRow && onMoveRow(row.id, 'down');
                                setActivePopup(null);
                              }}
                              title="تحريك لأسفل"
                              aria-label="تحريك لأسفل"
                              className="inline-flex items-center justify-center rounded-lg bg-white/15 px-2 py-1 text-xs font-bold hover:bg-white/25 disabled:opacity-30 cursor-pointer"
                            >
                              🔽
                            </button>

                            {onCopyRowToDay && (
                              <div className="inline-flex items-center gap-1 bg-white/10 rounded-lg px-2 py-0.5">
                                <select
                                  value={copyTargetDay}
                                  onChange={(e) =>
                                    setCopyTargetDay(e.target.value as DayId)
                                  }
                                  className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                                >
                                  {DAYS_LIST.filter((d) => d.id !== dayId).map(
                                    (d) => (
                                      <option
                                        key={d.id}
                                        value={d.id}
                                        className="text-slate-900"
                                      >
                                        {d.label}
                                      </option>
                                    )
                                  )}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onCopyRowToDay(row, copyTargetDay);
                                    setActivePopup(null);
                                  }}
                                  className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-bold cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>نسخ</span>
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (row.id === PENDING_NEW_ROW_ID) {
                                  setPendingNewRow(null);
                                } else {
                                  onDeleteRow && onDeleteRow(row.id);
                                }
                                setActivePopup(null);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold hover:bg-rose-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setActivePopup(null)}
                              title="إغلاق"
                              aria-label="إغلاق"
                              className="inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-sm font-black leading-none cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Controls at Bottom of Table (Hidden on Export) */}
          {showControls && (
            <div data-export-ignore="true" className="mt-2 pt-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickAddRow}
                  data-testid="quick-add-row-btn"
                  className="flex-1 min-w-[180px] rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/50 py-2.5 text-xs font-extrabold text-purple-800 hover:bg-purple-100/70 hover:border-purple-400 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة عيادة جديدة إلى جدول يوم {dayLabel}</span>
                </button>

                {savedRows.length > 0 && onClearDay && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={onClearDay}
                    data-testid="quick-clear-day-btn"
                    title={
                      isSaving
                        ? 'جارٍ الحفظ... يرجى الانتظار'
                        : `مسح عيادات يوم ${dayLabel}`
                    }
                    className="rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 disabled:opacity-45 disabled:cursor-not-allowed px-3 py-2.5 text-xs font-extrabold text-rose-700 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>
                      {isSaving
                        ? 'جارٍ الحفظ...'
                        : `مسح عيادات اليوم (${savedRows.length})`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Dark-Blue Footer Bar — EXACT MATCH TO REFERENCE ATTACHMENT #2 ON ALL VIEWPORTS AND EXPORT */}
        <div
          style={{ backgroundColor: settings.footerBgColor }}
          className={`relative z-10 rounded-[24px] text-white shadow-lg shrink-0 ${
            isExporting
              ? isCompactExport
                ? 'mt-2 px-6 py-2.5'
                : 'mt-3 px-6 py-4'
              : 'mt-3.5 px-2.5 sm:px-6 py-3 sm:py-4'
          }`}
        >
          {/* Top Line: [Line] ميت عزون - بجوار المسجد الكبير [Line] [Purple Pin Circle on Left] */}
          <div
            dir="rtl"
            className={`flex items-center justify-center ${
              isExporting ? 'gap-3 mb-3' : 'gap-2 sm:gap-3 mb-2 sm:mb-3'
            }`}
          >
            <div
              className={`h-[1px] bg-indigo-200/60 ${
                isExporting ? 'w-14' : 'w-8 sm:w-14'
              }`}
            />
            <span
              className={`font-bold tracking-wide whitespace-nowrap ${
                isExporting ? 'text-xl' : 'text-xs sm:text-xl'
              }`}
            >
              {settings.address}
            </span>
            <div
              className={`h-[1px] bg-indigo-200/60 ${
                isExporting ? 'w-14' : 'w-8 sm:w-14'
              }`}
            />
            <span
              className={`inline-flex items-center justify-center rounded-full bg-[#6d28d9] border-[2px] border-white shadow-xs shrink-0 ${
                isExporting ? 'h-8 w-8' : 'h-6 w-6 sm:h-8 sm:w-8'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="white"
                aria-hidden="true"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </span>
          </div>

          {/* Bottom Line: ALWAYS 3 Horizontal Columns Side-by-Side (Left: WhatsApp | Center: Landline | Right: Dental) */}
          <div
            dir="ltr"
            className="grid grid-cols-3 items-center gap-0.5 sm:gap-0 pt-0.5"
          >
            {/* Left Column: Green WhatsApp Icon + Number */}
            <div
              className={`flex items-center justify-center border-r border-indigo-200/40 py-0.5 px-1 ${
                isExporting ? 'gap-2.5' : 'gap-1.5 sm:gap-2.5'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center rounded-full bg-[#22c55e] border-[2px] border-white shadow-xs shrink-0 ${
                  isExporting ? 'h-11 w-11' : 'h-7 w-7 sm:h-11 sm:w-11'
                }`}
              >
                <svg
                  className={isExporting ? 'w-6 h-6' : 'w-4 h-4 sm:w-6 sm:h-6'}
                  viewBox="0 0 24 24"
                  fill="white"
                  aria-hidden="true"
                >
                  <path d="M16.75 13.96c.25.13.41.2.46.3.06.11.04.61-.21 1.18-.2.56-1.24 1.1-1.7 1.12-.46.02-.47.36-2.96-.73-2.49-1.09-3.99-3.75-4.11-3.92-.12-.17-.96-1.38-.92-2.61.05-1.22.69-1.8.95-2.04.24-.26.51-.29.68-.26h.47c.15 0 .36-.06.55.45l.69 1.87c.06.13.1.28.01.44l-.27.41-.39.42c-.12.12-.26.25-.12.5.12.26.62 1.09 1.32 1.78.91.88 1.71 1.17 1.95 1.3.24.14.39.12.54-.04l.81-.94c.19-.25.35-.19.58-.11l1.67.88zM12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10c-1.97 0-3.8-.57-5.35-1.55L2 22l1.55-4.65A9.969 9.969 0 0 1 2 12 10 10 0 0 1 12 2z" />
                </svg>
              </span>
              <span
                className={`font-bold tracking-wider whitespace-nowrap ${
                  isExporting ? 'text-xl' : 'text-[11px] sm:text-xl'
                }`}
              >
                {settings.whatsappPhone}
              </span>
            </div>

            {/* Center Column: Red Rotary/Keypad Landline Icon + Number */}
            <div
              className={`flex items-center justify-center border-r border-indigo-200/40 py-0.5 px-1 ${
                isExporting ? 'gap-2.5' : 'gap-1.5 sm:gap-2.5'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center shrink-0 ${
                  isExporting ? 'h-10 w-10' : 'h-7 w-7 sm:h-10 sm:w-10'
                }`}
              >
                <svg
                  className={isExporting ? 'w-8 h-8' : 'w-5 h-5 sm:w-8 sm:h-8'}
                  viewBox="0 0 24 24"
                  fill="#ff2626"
                  aria-hidden="true"
                >
                  <path d="M20 9.5c-1.2-1.8-4.5-3-8-3s-6.8 1.2-8 3c-.6.9-.3 2.1.7 2.5l2.3.8c.8.3 1.7-.2 1.9-1l.3-1.3c.9-.2 1.8-.3 2.8-.3s1.9.1 2.8.3l.3 1.3c.2.8 1.1 1.3 1.9 1l2.3-.8c1-.4 1.3-1.6.7-2.5zM6 14l-2 5c-.3.8.3 1.7 1.2 1.7h13.6c.9 0 1.5-.9 1.2-1.7l-2-5H6zm4 2h1v1h-1v-1zm2 0h1v1h-1v-1zm2 0h1v1h-1v-1zm-4 2h1v1h-1v-1zm2 0h1v1h-1v-1zm2 0h1v1h-1v-1z" />
                </svg>
              </span>
              <span
                className={`font-bold tracking-wider whitespace-nowrap ${
                  isExporting ? 'text-xl' : 'text-[11px] sm:text-xl'
                }`}
              >
                {settings.landlinePhone}
              </span>
            </div>

            {/* Right Column: Dental Phone + Label on Left, White Handset Circle on Right */}
            <div
              className={`flex items-center justify-center py-0.5 px-1 ${
                isExporting ? 'gap-2.5' : 'gap-1.5 sm:gap-2.5'
              }`}
            >
              <div className="flex flex-col items-center leading-tight">
                <span
                  className={`font-bold tracking-wider whitespace-nowrap ${
                    isExporting ? 'text-xl' : 'text-[11px] sm:text-xl'
                  }`}
                >
                  {settings.dentalPhone}
                </span>
                <div
                  dir="rtl"
                  className={`flex items-center gap-1 text-indigo-100 font-semibold mt-0.5 whitespace-nowrap ${
                    isExporting ? 'text-sm' : 'text-[9px] sm:text-sm'
                  }`}
                >
                  <span>{settings.dentalLabel}</span>
                  <svg
                    className={
                      isExporting ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5 sm:w-3.5 sm:h-3.5'
                    }
                    viewBox="0 0 24 24"
                    fill="white"
                    aria-hidden="true"
                  >
                    <path d="M7 3C4.5 3 3 5.5 3.5 9c.5 3.5 2 6.5 2.5 10.5.4 2.2 1.8 2.5 2.6 1L10.5 15c.5-1.2 2.5-1.2 3 0l1.9 5.5c.8 1.5 2.2 1.2 2.6-1 .5-4 2-7 2.5-10.5C21 5.5 19.5 3 17 3c-2 0-3.5 1.2-5 1.2S9 3 7 3z" />
                  </svg>
                </div>
              </div>
              <span
                className={`inline-flex items-center justify-center rounded-full bg-white text-[#1e295b] shadow-xs shrink-0 ${
                  isExporting ? 'h-11 w-11' : 'h-7 w-7 sm:h-11 sm:w-11'
                }`}
              >
                <svg
                  className={isExporting ? 'w-6 h-6' : 'w-4 h-4 sm:w-6 sm:h-6'}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
