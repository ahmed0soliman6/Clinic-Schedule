import type {
  CenterSettings,
  ClinicIconId,
  DailyScheduleData,
  DayId,
  ScheduleRow,
  UserProfile,
  UserRole,
} from '../types/schedule.js';

export const DAYS_LIST: { id: DayId; label: string; order: number }[] = [
  { id: 'saturday', label: 'السبت', order: 0 },
  { id: 'sunday', label: 'الأحد', order: 1 },
  { id: 'monday', label: 'الإثنين', order: 2 },
  { id: 'tuesday', label: 'الثلاثاء', order: 3 },
  { id: 'wednesday', label: 'الأربعاء', order: 4 },
  { id: 'thursday', label: 'الخميس', order: 5 },
  { id: 'friday', label: 'الجمعة', order: 6 },
];

export interface ClinicPresetItem {
  name: string;
  icon: ClinicIconId;
  color: string;
}

// The exact 18 specialty clinics requested by the user with "ال" prefix and dedicated icons & colors
export const CLINIC_PRESETS_LIST: ClinicPresetItem[] = [
  { name: 'الباطنة', icon: 'internal', color: '#0284c7' },
  { name: 'الجلدية', icon: 'dermatology', color: '#ec4899' },
  { name: 'النساء والتوليد', icon: 'gynecology', color: '#f43f5e' },
  { name: 'العظام', icon: 'bones', color: '#f59e0b' },
  { name: 'الأنف والأذن', icon: 'ear', color: '#0d9488' },
  { name: 'القلب', icon: 'heart', color: '#e11d48' },
  { name: 'الأطفال', icon: 'baby', color: '#ec4899' },
  { name: 'التخاطب', icon: 'speech', color: '#ec4899' },
  { name: 'التغذية العلاجية', icon: 'nutrition', color: '#4f46e5' },
  { name: 'المخ والأعصاب', icon: 'brain', color: '#2563eb' },
  { name: 'الجراحة العامة', icon: 'surgery', color: '#e11d48' },
  { name: 'العلاج الطبيعي', icon: 'physio', color: '#10b981' },
  { name: 'الصدر', icon: 'chest', color: '#0284c7' },
  { name: 'النفسية', icon: 'psych', color: '#16a34a' },
  { name: 'الأسنان', icon: 'tooth', color: '#f59e0b' },
  { name: 'العيون', icon: 'eye', color: '#15803d' },
  { name: 'الكلى', icon: 'kidney', color: '#9333ea' },
  { name: 'المسالك', icon: 'urology', color: '#0ea5e9' },
];

export const TIME_PRESETS_LIST: string[] = [
  '9:00 ص',
  '10:00 ص',
  '10:30 ص',
  '11:00 ص',
  '11:30 ص',
  '12:00 م',
  '12:30 م',
  '1:00 م',
  '1:30 م',
  '2:00 م',
  '2:30 م',
  '3:00 م',
  '3:30 م',
  '4:00 م',
  '4:30 م',
  '5:00 م',
  '5:30 م',
  '6:00 م',
  '6:30 م',
  '7:00 م',
  '7:30 م',
  '8:00 م',
  '8:30 م',
  '9:00 م',
  '9:30 م',
  '10:00 م',
  '10:30 م',
  '11:00 م',
];

export const CLINIC_ICONS_CATALOG: { id: ClinicIconId; label: string; defaultColor: string }[] = [
  { id: 'internal', label: 'الباطنة', defaultColor: '#0284c7' },
  { id: 'dermatology', label: 'الجلدية', defaultColor: '#ec4899' },
  { id: 'gynecology', label: 'النساء والتوليد', defaultColor: '#f43f5e' },
  { id: 'bones', label: 'العظام', defaultColor: '#f59e0b' },
  { id: 'ear', label: 'الأنف والأذن', defaultColor: '#0d9488' },
  { id: 'heart', label: 'القلب', defaultColor: '#e11d48' },
  { id: 'baby', label: 'الأطفال', defaultColor: '#ec4899' },
  { id: 'speech', label: 'التخاطب', defaultColor: '#ec4899' },
  { id: 'nutrition', label: 'التغذية العلاجية', defaultColor: '#4f46e5' },
  { id: 'brain', label: 'المخ والأعصاب', defaultColor: '#2563eb' },
  { id: 'surgery', label: 'الجراحة العامة', defaultColor: '#e11d48' },
  { id: 'physio', label: 'العلاج الطبيعي', defaultColor: '#10b981' },
  { id: 'chest', label: 'الصدر', defaultColor: '#0284c7' },
  { id: 'psych', label: 'النفسية', defaultColor: '#16a34a' },
  { id: 'tooth', label: 'الأسنان', defaultColor: '#f59e0b' },
  { id: 'eye', label: 'العيون', defaultColor: '#15803d' },
  { id: 'kidney', label: 'الكلى', defaultColor: '#9333ea' },
  { id: 'urology', label: 'المسالك', defaultColor: '#0ea5e9' },
  { id: 'stethoscope', label: 'عيادة عامة', defaultColor: '#7c3aed' },
];

export const CLINIC_COLOR_SWATCHES: { hex: string; name: string }[] = [
  { hex: '#ec4899', name: 'وردي' },
  { hex: '#f43f5e', name: 'أحمر مرجاني' },
  { hex: '#f59e0b', name: 'برتقالي ذهبي' },
  { hex: '#16a34a', name: 'أخضر طبي' },
  { hex: '#10b981', name: 'زمردي' },
  { hex: '#0d9488', name: 'فيروزي' },
  { hex: '#0ea5e9', name: 'أزرق سماوي' },
  { hex: '#2563eb', name: 'أزرق ملكي' },
  { hex: '#4f46e5', name: 'نيلي' },
  { hex: '#9333ea', name: 'بنفسجي' },
];

export const BLUEPRINT_LIMITS = {
  ID_MAX_LEN: 128,
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  CLINIC_NAME_MIN: 1,
  CLINIC_NAME_MAX: 120,
  DOCTOR_NAME_MIN: 1,
  DOCTOR_NAME_MAX: 120,
  TIME_MIN: 1,
  TIME_MAX: 40,
  MAX_ROWS_PER_DAY: 30,
  COMPLEX_NAME_MAX: 120,
  ASSOCIATION_NAME_MAX: 160,
  ADDRESS_MAX: 200,
  PHONE_MAX: 40,
  POST_TEMPLATE_MAX: 2000,
};

export function isCompletelyEmptyRow(
  row:
    | Partial<Pick<ScheduleRow, 'clinicName' | 'doctorName' | 'startTime' | 'endTime'>>
    | null
    | undefined
): boolean {
  if (!row) return true;
  return (
    !(row.clinicName || '').trim() &&
    !(row.doctorName || '').trim() &&
    !(row.startTime || '').trim() &&
    !(row.endTime || '').trim()
  );
}

export function filterNonEmptyRows(rows: ScheduleRow[]): ScheduleRow[] {
  if (!Array.isArray(rows)) return [];
  return normalizeSortOrders(rows.filter((r) => !isCompletelyEmptyRow(r)));
}

export function normalizeArabicText(str: string): string {
  return str
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '');
}

export const CLINIC_NAME_AL_MAP = new Map<string, string>([
  ['باطنة', 'الباطنة'],
  ['باطنه', 'الباطنة'],
  ['جلدية', 'الجلدية'],
  ['جلديه', 'الجلدية'],
  ['نساء وتوليد', 'النساء والتوليد'],
  ['النساء', 'النساء والتوليد'],
  ['عظام', 'العظام'],
  ['أنف وأذن', 'الأنف والأذن'],
  ['انف واذن', 'الأنف والأذن'],
  ['قلب', 'القلب'],
  ['أطفال', 'الأطفال'],
  ['اطفال', 'الأطفال'],
  ['تخاطب', 'التخاطب'],
  ['تغذية علاجية', 'التغذية العلاجية'],
  ['تغذيه علاجيه', 'التغذية العلاجية'],
  ['مخ وأعصاب', 'المخ والأعصاب'],
  ['مخ واعصاب', 'المخ والأعصاب'],
  ['جراحة عامة', 'الجراحة العامة'],
  ['جراحه عامه', 'الجراحة العامة'],
  ['علاج طبيعى', 'العلاج الطبيعي'],
  ['علاج طبيعي', 'العلاج الطبيعي'],
  ['صدر', 'الصدر'],
  ['نفسية', 'النفسية'],
  ['نفسيه', 'النفسية'],
  ['أسنان', 'الأسنان'],
  ['اسنان', 'الأسنان'],
  ['عيون', 'العيون'],
  ['كلي', 'الكلى'],
  ['كلى', 'الكلى'],
  ['مسالك', 'المسالك'],
]);

export function normalizeClinicNameWithAl(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (CLINIC_NAME_AL_MAP.has(trimmed)) {
    return CLINIC_NAME_AL_MAP.get(trimmed)!;
  }
  const norm = normalizeArabicText(trimmed);
  for (const [key, val] of CLINIC_NAME_AL_MAP.entries()) {
    if (normalizeArabicText(key) === norm) {
      return val;
    }
  }
  return trimmed;
}

export function findClinicPresetByName(name: string): ClinicPresetItem | undefined {
  const normalized = normalizeClinicNameWithAl(name);
  return CLINIC_PRESETS_LIST.find(
    (p) => p.name === normalized || normalized.includes(p.name)
  );
}

export function normalizeSortOrders(rows: ScheduleRow[]): ScheduleRow[] {
  return [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row, idx) => ({
      ...row,
      sortOrder: idx,
    }));
}

export function validateRowInput(input: {
  clinicName?: string;
  doctorName?: string;
  startTime?: string;
  endTime?: string;
  icon?: string;
  iconColor?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (isCompletelyEmptyRow(input)) {
    errors.push('لا يمكن حفظ صف فارغ تماماً (العيادة والطبيب والوقت كلها فارغة)');
    return { valid: false, errors };
  }
  const clinic = (input.clinicName ?? '').trim();
  const doctor = (input.doctorName ?? '').trim();
  const start = (input.startTime ?? '').trim();
  const end = (input.endTime ?? '').trim();

  if (clinic.length < BLUEPRINT_LIMITS.CLINIC_NAME_MIN) {
    errors.push('يرجى اختيار أو إدخال اسم العيادة');
  } else if (clinic.length > BLUEPRINT_LIMITS.CLINIC_NAME_MAX) {
    errors.push(`اسم العيادة يجب ألا يتجاوز ${BLUEPRINT_LIMITS.CLINIC_NAME_MAX} حرفًا`);
  }

  if (doctor.length < BLUEPRINT_LIMITS.DOCTOR_NAME_MIN) {
    errors.push('يرجى إدخال اسم الطبيب');
  } else if (doctor.length > BLUEPRINT_LIMITS.DOCTOR_NAME_MAX) {
    errors.push(`اسم الطبيب يجب ألا يتجاوز ${BLUEPRINT_LIMITS.DOCTOR_NAME_MAX} حرفًا`);
  }

  if (start.length < BLUEPRINT_LIMITS.TIME_MIN) {
    errors.push('يرجى تحديد وقت البداية (من)');
  } else if (start.length > BLUEPRINT_LIMITS.TIME_MAX) {
    errors.push('وقت البداية طويل جدًا');
  }

  if (end.length < BLUEPRINT_LIMITS.TIME_MIN) {
    errors.push('يرجى تحديد وقت النهاية (إلى)');
  } else if (end.length > BLUEPRINT_LIMITS.TIME_MAX) {
    errors.push('وقت النهاية طويل جدًا');
  }

  if (input.icon && !CLINIC_ICONS_CATALOG.some((i) => i.id === input.icon)) {
    errors.push('الأيقونة المختارة غير صالحة');
  }

  if (input.iconColor && (input.iconColor.length < 4 || input.iconColor.length > 30)) {
    errors.push('لون الأيقونة غير صالح');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizeRowForFirestore(
  row: Partial<ScheduleRow> | undefined,
  index: number
): ScheduleRow {
  const safeId =
    typeof row?.id === 'string'
      ? row.id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80)
      : '';
  const safeClinic =
    typeof row?.clinicName === 'string'
      ? row.clinicName.trim().slice(0, BLUEPRINT_LIMITS.CLINIC_NAME_MAX)
      : '';
  const safeDoctor =
    typeof row?.doctorName === 'string'
      ? row.doctorName.trim().slice(0, BLUEPRINT_LIMITS.DOCTOR_NAME_MAX)
      : '';
  const safeStart =
    typeof row?.startTime === 'string'
      ? row.startTime.trim().slice(0, BLUEPRINT_LIMITS.TIME_MAX)
      : '';
  const safeEnd =
    typeof row?.endTime === 'string'
      ? row.endTime.trim().slice(0, BLUEPRINT_LIMITS.TIME_MAX)
      : '';
  const safeIcon: ClinicIconId =
    row?.icon && CLINIC_ICONS_CATALOG.some((i) => i.id === row.icon)
      ? row.icon
      : 'stethoscope';
  const safeColor =
    typeof row?.iconColor === 'string' && row.iconColor.trim().length >= 4
      ? row.iconColor.trim().slice(0, 30)
      : '#0284c7';

  return {
    id: safeId || `row-${index}`,
    clinicName: safeClinic,
    doctorName: safeDoctor,
    startTime: safeStart,
    endTime: safeEnd,
    icon: safeIcon,
    iconColor: safeColor,
    sortOrder: Math.max(0, Math.min(500, Math.floor(index))),
  };
}

export function addScheduleRow(
  rows: ScheduleRow[],
  input: Omit<ScheduleRow, 'id' | 'sortOrder'>,
  customId?: string
): ScheduleRow[] {
  const ordered = normalizeSortOrders(rows);
  if (ordered.length >= BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY) {
    return ordered;
  }
  const newId = customId || `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newRow: ScheduleRow = sanitizeRowForFirestore(
    {
      ...input,
      id: newId,
      sortOrder: ordered.length,
    },
    ordered.length
  );
  return [...ordered, newRow];
}

export function updateScheduleRow(
  rows: ScheduleRow[],
  rowId: string,
  patch: Partial<Omit<ScheduleRow, 'id' | 'sortOrder'>>
): ScheduleRow[] {
  const ordered = normalizeSortOrders(rows);
  return ordered.map((row, idx) => {
    if (row.id !== rowId) return row;
    return sanitizeRowForFirestore(
      {
        ...row,
        ...patch,
      },
      idx
    );
  });
}

export function deleteScheduleRow(rows: ScheduleRow[], rowId: string): ScheduleRow[] {
  const filtered = rows.filter((row) => row.id !== rowId);
  return normalizeSortOrders(filtered);
}

export function moveScheduleRow(
  rows: ScheduleRow[],
  rowId: string,
  direction: 'up' | 'down'
): ScheduleRow[] {
  const ordered = normalizeSortOrders(rows);
  const index = ordered.findIndex((r) => r.id === rowId);
  if (index === -1) return ordered;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return ordered;
  return reorderScheduleRows(ordered, index, targetIndex);
}

export function reorderScheduleRows(
  rows: ScheduleRow[],
  fromIndex: number,
  toIndex: number
): ScheduleRow[] {
  const ordered = normalizeSortOrders(rows);
  if (
    fromIndex < 0 ||
    fromIndex >= ordered.length ||
    toIndex < 0 ||
    toIndex >= ordered.length ||
    fromIndex === toIndex
  ) {
    return ordered;
  }
  const updated = [...ordered];
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);
  return updated.map((row, idx) => ({
    ...row,
    sortOrder: idx,
  }));
}

export function copyRowToDay(
  targetDayRows: ScheduleRow[],
  sourceRow: ScheduleRow,
  customNewId?: string
): ScheduleRow[] {
  const orderedTarget = normalizeSortOrders(targetDayRows);
  if (orderedTarget.length >= BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY) {
    return orderedTarget;
  }
  const newId =
    customNewId || `${sourceRow.id}-copy-${Date.now().toString(36)}-${orderedTarget.length}`;
  const copiedRow: ScheduleRow = sanitizeRowForFirestore(
    {
      ...sourceRow,
      id: newId,
      sortOrder: orderedTarget.length,
    },
    orderedTarget.length
  );
  return [...orderedTarget, copiedRow];
}

export function copyFullDayRows(sourceRows: ScheduleRow[], targetDayId: DayId): ScheduleRow[] {
  const orderedSource = normalizeSortOrders(sourceRows).slice(
    0,
    BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY
  );
  return orderedSource.map((row, idx) =>
    sanitizeRowForFirestore(
      {
        ...row,
        id: `${targetDayId.slice(0, 3)}-${idx + 1}-${Date.now().toString(36).slice(-4)}`,
        sortOrder: idx,
      },
      idx
    )
  );
}

export function areRowsEqual(a: ScheduleRow[], b: ScheduleRow[]): boolean {
  if (a.length !== b.length) return false;
  const normA = normalizeSortOrders(a);
  const normB = normalizeSortOrders(b);
  for (let i = 0; i < normA.length; i++) {
    const rA = normA[i];
    const rB = normB[i];
    if (
      rA.id !== rB.id ||
      rA.clinicName !== rB.clinicName ||
      rA.doctorName !== rB.doctorName ||
      rA.startTime !== rB.startTime ||
      rA.endTime !== rB.endTime ||
      rA.icon !== rB.icon ||
      rA.iconColor !== rB.iconColor ||
      rA.sortOrder !== rB.sortOrder
    ) {
      return false;
    }
  }
  return true;
}

export function detectConcurrentConflict(params: {
  localBaseVersion: number;
  incomingRemoteSchedule: DailyScheduleData;
  currentUserId?: string | null;
  hasLocalUnsavedChanges: boolean;
  localDraftRows: ScheduleRow[];
}): { hasConflict: boolean; reason?: string } {
  const {
    localBaseVersion,
    incomingRemoteSchedule,
    currentUserId,
    hasLocalUnsavedChanges,
    localDraftRows,
  } = params;

  if (!hasLocalUnsavedChanges) {
    return { hasConflict: false };
  }

  if (incomingRemoteSchedule.version > localBaseVersion) {
    const sameRows = areRowsEqual(localDraftRows, incomingRemoteSchedule.draftRows);
    if (!sameRows) {
      const editorLabel =
        incomingRemoteSchedule.updatedByName ||
        incomingRemoteSchedule.updatedByEmail ||
        'مستخدم آخر';
      if (!currentUserId || incomingRemoteSchedule.updatedBy !== currentUserId) {
        return {
          hasConflict: true,
          reason: `قام ${editorLabel} بتحديث جدول هذا اليوم (الإصدار ${incomingRemoteSchedule.version}) أثناء قيامك بالتعديل.`,
        };
      }
      return {
        hasConflict: true,
        reason: `تم تحديث هذا الجدول من نافذة أخرى (الإصدار ${incomingRemoteSchedule.version}) مع وجود تعديلات محلية غير محفوظة.`,
      };
    }
  }

  return { hasConflict: false };
}

export function canUserEditDay(
  role: UserRole | null,
  allowedDays: DayId[],
  dayId: DayId
): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (role === 'EDITOR') {
    return allowedDays.includes(dayId);
  }
  return false;
}

export function mergeConflictingRows(
  baseOrLocal: ScheduleRow[],
  localOrRemote: ScheduleRow[],
  maybeRemote?: ScheduleRow[]
): ScheduleRow[] {
  const isThreeWay = Array.isArray(maybeRemote);
  const baseRows = isThreeWay ? baseOrLocal : [];
  const localRows = isThreeWay ? localOrRemote : baseOrLocal;
  const remoteRows = isThreeWay ? maybeRemote : localOrRemote;

  const baseMap = new Map<string, ScheduleRow>(baseRows.map((r) => [r.id, r]));
  const localMap = new Map<string, ScheduleRow>(localRows.map((r) => [r.id, r]));
  const remoteMap = new Map<string, ScheduleRow>(remoteRows.map((r) => [r.id, r]));

  const areSingleRowsEqual = (r1: ScheduleRow, r2: ScheduleRow) => {
    return (
      r1.clinicName === r2.clinicName &&
      r1.doctorName === r2.doctorName &&
      r1.startTime === r2.startTime &&
      r1.endTime === r2.endTime &&
      r1.icon === r2.icon &&
      r1.iconColor === r2.iconColor
    );
  };

  const allIds = new Set<string>([
    ...baseMap.keys(),
    ...localMap.keys(),
    ...remoteMap.keys(),
  ]);

  const mergedRows: ScheduleRow[] = [];

  for (const id of allIds) {
    const base = baseMap.get(id);
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (isThreeWay && base) {
      const localChanged = !local || !areSingleRowsEqual(base, local);
      const remoteChanged = !remote || !areSingleRowsEqual(base, remote);

      if (!local && !remoteChanged) {
        // Deleted locally and unchanged remotely -> keep deleted
        continue;
      }
      if (!remote && !localChanged) {
        // Deleted remotely and unchanged locally -> keep deleted
        continue;
      }
      if (local && remote) {
        // Both exist: if local changed, local wins; otherwise keep remote
        mergedRows.push(localChanged ? local : remote);
      } else if (local) {
        // Remote deleted it, but local modified it -> local wins
        mergedRows.push(local);
      }
    } else {
      if (local) {
        mergedRows.push(local);
      } else if (remote) {
        mergedRows.push(remote);
      }
    }
  }

  return normalizeSortOrders(mergedRows).slice(0, BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY);
}

export function mergeConflictingRowsThreeWay(
  baseRows: ScheduleRow[],
  localRows: ScheduleRow[],
  remoteRows: ScheduleRow[]
): { success: boolean; rows: ScheduleRow[]; error?: string } {
  const baseMap = new Map<string, ScheduleRow>(baseRows.map((r) => [r.id, r]));
  const localMap = new Map<string, ScheduleRow>(localRows.map((r) => [r.id, r]));
  const remoteMap = new Map<string, ScheduleRow>(remoteRows.map((r) => [r.id, r]));

  const areSingleRowsEqual = (r1: ScheduleRow, r2: ScheduleRow) => {
    return (
      r1.clinicName === r2.clinicName &&
      r1.doctorName === r2.doctorName &&
      r1.startTime === r2.startTime &&
      r1.endTime === r2.endTime &&
      r1.icon === r2.icon &&
      r1.iconColor === r2.iconColor
    );
  };

  const allIds = new Set<string>([
    ...baseMap.keys(),
    ...localMap.keys(),
    ...remoteMap.keys(),
  ]);

  const mergedRows: ScheduleRow[] = [];

  for (const id of allIds) {
    const base = baseMap.get(id);
    const local = localMap.get(id);
    const remote = remoteMap.get(id);

    if (base) {
      const localChanged = !local || !areSingleRowsEqual(base, local);
      const remoteChanged = !remote || !areSingleRowsEqual(base, remote);

      if (!local && !remoteChanged) {
        continue;
      }
      if (!remote && !localChanged) {
        continue;
      }
      if (local && remote) {
        mergedRows.push(localChanged ? local : remote);
      } else if (local) {
        mergedRows.push(local);
      }
    } else {
      if (local) {
        mergedRows.push(local);
      } else if (remote) {
        mergedRows.push(remote);
      }
    }
  }

  if (mergedRows.length > BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY) {
    return {
      success: false,
      rows: [],
      error: `الحد الأقصى للعيادات في اليوم الواحد هو ${BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY} عيادة`,
    };
  }

  return {
    success: true,
    rows: normalizeSortOrders(mergedRows),
  };
}

export function validateCenterSettings(settings: CenterSettings): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!settings.complexName.trim() || settings.complexName.length > BLUEPRINT_LIMITS.COMPLEX_NAME_MAX) {
    errors.push('اسم المجمع الطبي غير صالح');
  }
  if (
    !settings.associationName.trim() ||
    settings.associationName.length > BLUEPRINT_LIMITS.ASSOCIATION_NAME_MAX
  ) {
    errors.push('اسم الجمعية غير صالح');
  }
  if (!settings.address.trim() || settings.address.length > BLUEPRINT_LIMITS.ADDRESS_MAX) {
    errors.push('العنوان غير صالح');
  }
  if (!settings.whatsappPhone.trim() || settings.whatsappPhone.length > BLUEPRINT_LIMITS.PHONE_MAX) {
    errors.push('رقم الواتساب غير صالح');
  }
  if (!settings.landlinePhone.trim() || settings.landlinePhone.length > BLUEPRINT_LIMITS.PHONE_MAX) {
    errors.push('الرقم الأرضي غير صالح');
  }
  if (!settings.dentalPhone.trim() || settings.dentalPhone.length > BLUEPRINT_LIMITS.PHONE_MAX) {
    errors.push('رقم عيادة الأسنان غير صالح');
  }
  if (
    typeof settings.postTemplate === 'string' &&
    settings.postTemplate.length > BLUEPRINT_LIMITS.POST_TEMPLATE_MAX
  ) {
    errors.push(`قالب نص البوست يجب ألا يتجاوز ${BLUEPRINT_LIMITS.POST_TEMPLATE_MAX} حرفاً`);
  }
  return { valid: errors.length === 0, errors };
}

export const TRANSPARENT_RIGHT_LOGO_URL = '/logos/complex-logo.svg';
export const ASSOCIATION_LEFT_LOGO_URL = '/logos/association-logo.svg';

export const POSTER_EXPORT_WIDTH = 1440;
export const POSTER_EXPORT_HEIGHT = 1800; // Exact 4:5 aspect ratio (1440 / 1800 = 0.8)

export function normalizeRightLogoUrl(url?: string): string {
  if (
    !url ||
    url.includes('Picsart_') ||
    url.includes('/assets/aistudio/') ||
    url.endsWith('.png')
  ) {
    return TRANSPARENT_RIGHT_LOGO_URL;
  }
  return url;
}

export function normalizeLeftLogoUrl(url?: string): string {
  if (
    !url ||
    url.includes('Picsart_') ||
    url.includes('/assets/aistudio/') ||
    url.endsWith('.png')
  ) {
    return ASSOCIATION_LEFT_LOGO_URL;
  }
  return url;
}

export const WHATSAPP_CHANNEL_FULL_URL =
  'https://whatsapp.com/channel/0029VbBQQMDLdQegbOa0DQ2l';
export const WHATSAPP_CHANNEL_SHORT_URL = 'https://is.gd/cDsyaR';

export const DEFAULT_POST_TEMPLATE = [
  'جدول عيادات يوم {اليوم}',
  '☎️ {الأرضي} - 📲 {الواتساب}',
  '{تسمية_الأسنان}. {الأسنان}',
  'واتس أب للتواصل 👈 {رابط_الواتساب}',
  'انستجرام https://www.instagram.com/mit.azzoun.medical',
  `قناة الواتس آب ${WHATSAPP_CHANNEL_SHORT_URL}`,
].join('\n');

export function buildDailySocialPostText(
  dayLabel: string,
  settings: CenterSettings,
  rows?: ScheduleRow[]
): string {
  const cleanWa = settings.whatsappPhone.replace(/\D/g, '');
  const waIntl = cleanWa.startsWith('2') ? cleanWa : `2${cleanWa}`;
  const waUrl = `https://wa.me/${waIntl}`;
  const dentalLabel = (settings.dentalLabel || 'عيادة الأسنان').trim();
  const cleanRows = Array.isArray(rows) ? filterNonEmptyRows(rows) : [];
  const clinicsText =
    cleanRows.length > 0
      ? cleanRows
          .map(
            (r) =>
              `• ${r.clinicName} (${r.doctorName}) — من ${r.startTime} إلى ${r.endTime}`
          )
          .join('\n')
      : 'لا توجد عيادات مسجلة لهذا اليوم';

  const rawTemplate =
    typeof settings.postTemplate === 'string' && settings.postTemplate.trim().length > 0
      ? settings.postTemplate
      : DEFAULT_POST_TEMPLATE;

  return rawTemplate
    .replace(/\{اليوم\}/g, dayLabel)
    .replace(/\{المجمع\}/g, settings.complexName)
    .replace(/\{الجمعية\}/g, settings.associationName)
    .replace(/\{العنوان\}/g, settings.address)
    .replace(/\{الواتساب\}/g, settings.whatsappPhone)
    .replace(/\{الأرضي\}/g, settings.landlinePhone)
    .replace(/\{الأسنان\}/g, settings.dentalPhone)
    .replace(/\{تسمية_الأسنان\}/g, dentalLabel)
    .replace(/\{رابط_الواتساب\}/g, waUrl)
    .replace(/\{قناة_الواتساب\}/g, WHATSAPP_CHANNEL_SHORT_URL)
    .replace(/\{العيادات\}/g, clinicsText);
}

export const PRIMARY_ADMIN_EMAIL = 'ahmed0soliman6@gmail.com';

export const BLOCKED_FICTIONAL_EMAILS = new Set([
  'editor@meetazzoun.org',
  'editor2@meetazzoun.org',
  'admin@meetazzoun.org',
]);

export function isFictionalOrBlockedEmail(email?: string | null): boolean {
  if (!email) return true;
  const clean = email.trim().toLowerCase();
  if (!clean) return true;
  if (BLOCKED_FICTIONAL_EMAILS.has(clean)) return true;
  if (clean.endsWith('@meetazzoun.org')) return true;
  return false;
}

export function isValidEmailAddress(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 160) return false;
  if (isFictionalOrBlockedEmail(trimmed)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function emailToDocId(email: string): string {
  const normalized = email
    .trim()
    .toLowerCase()
    .replace(/@/g, '_at_')
    .replace(/\./g, '_dot_')
    .replace(/\+/g, '_plus_')
    .replace(/[^a-z0-9_\-]/g, '_');
  return (normalized || 'user_email').slice(0, 120);
}

export function sanitizeUsersList(users: UserProfile[]): UserProfile[] {
  const allDayIds = DAYS_LIST.map((d) => d.id);
  const byEmail = new Map<string, UserProfile>();

  // Always guarantee the primary admin is present with full ADMIN access
  byEmail.set(PRIMARY_ADMIN_EMAIL, {
    uid: emailToDocId(PRIMARY_ADMIN_EMAIL),
    email: PRIMARY_ADMIN_EMAIL,
    displayName: 'مدير مجمع ميت عزون الطبي',
    role: 'ADMIN',
    allowedDays: allDayIds,
  });

  for (const u of users || []) {
    if (!u || !u.email) continue;
    const cleanEmail = u.email.trim().toLowerCase();
    if (!isValidEmailAddress(cleanEmail)) continue;

    const isPrimary = cleanEmail === PRIMARY_ADMIN_EMAIL;
    const validRole: UserRole =
      isPrimary || u.role === 'ADMIN' ? 'ADMIN' : 'EDITOR';
    const validDays: DayId[] =
      validRole === 'ADMIN'
        ? allDayIds
        : Array.isArray(u.allowedDays)
        ? u.allowedDays.filter((d) => allDayIds.includes(d))
        : [];

    const existing = byEmail.get(cleanEmail);
    const docId = emailToDocId(cleanEmail);

    byEmail.set(cleanEmail, {
      uid: docId,
      email: cleanEmail,
      displayName:
        (u.displayName || existing?.displayName || cleanEmail).slice(0, 120),
      role: validRole,
      allowedDays: validDays,
    });
  }

  return Array.from(byEmail.values());
}

/**
 * Strictly resolves whether a signed-in user is registered in the permissions list.
 * Any email NOT registered in `registeredUsers` (and not PRIMARY_ADMIN_EMAIL) is REJECTED
 * (`authorized: false`, `role: null`, `allowedDays: []`).
 */
export function resolveAuthorizedUserAccess(params: {
  email?: string | null;
  uid?: string | null;
  registeredUsers: UserProfile[];
}): {
  authorized: boolean;
  role: UserRole | null;
  allowedDays: DayId[];
  matchedProfile?: UserProfile;
} {
  const allDayIds = DAYS_LIST.map((d) => d.id);
  const cleanEmail = (params.email || '').trim().toLowerCase();
  if (!cleanEmail || isFictionalOrBlockedEmail(cleanEmail)) {
    return { authorized: false, role: null, allowedDays: [] };
  }

  if (cleanEmail === PRIMARY_ADMIN_EMAIL) {
    const adminProfile: UserProfile = {
      uid: emailToDocId(PRIMARY_ADMIN_EMAIL),
      email: PRIMARY_ADMIN_EMAIL,
      displayName: 'مدير مجمع ميت عزون الطبي',
      role: 'ADMIN',
      allowedDays: allDayIds,
    };
    return {
      authorized: true,
      role: 'ADMIN',
      allowedDays: allDayIds,
      matchedProfile: adminProfile,
    };
  }

  const sanitized = sanitizeUsersList(params.registeredUsers);
  const emailDocId = emailToDocId(cleanEmail);
  const match = sanitized.find(
    (u) =>
      u.email.trim().toLowerCase() === cleanEmail ||
      u.uid === emailDocId
  );

  if (!match) {
    return { authorized: false, role: null, allowedDays: [] };
  }

  const role: UserRole = match.role === 'ADMIN' ? 'ADMIN' : 'EDITOR';
  const allowedDays: DayId[] =
    role === 'ADMIN'
      ? allDayIds
      : Array.isArray(match.allowedDays)
      ? match.allowedDays.filter((d) => allDayIds.includes(d))
      : [];

  return {
    authorized: true,
    role,
    allowedDays,
    matchedProfile: match,
  };
}

export function upsertUserByEmail(
  users: UserProfile[],
  input: {
    email: string;
    displayName?: string;
    role: UserRole;
    allowedDays?: DayId[];
    uid?: string;
  }
): UserProfile[] {
  const cleanEmail = input.email.trim().toLowerCase();
  if (!isValidEmailAddress(cleanEmail)) return sanitizeUsersList(users);

  const docId = emailToDocId(cleanEmail);
  const effectiveRole: UserRole =
    cleanEmail === PRIMARY_ADMIN_EMAIL || input.role === 'ADMIN'
      ? 'ADMIN'
      : 'EDITOR';
  const effectiveDays: DayId[] =
    effectiveRole === 'ADMIN'
      ? DAYS_LIST.map((d) => d.id)
      : Array.isArray(input.allowedDays)
      ? input.allowedDays.filter((d) => DAYS_LIST.some((day) => day.id === d))
      : [];

  const defaultName =
    input.displayName?.trim() ||
    (effectiveRole === 'ADMIN'
      ? `مدير (${cleanEmail.split('@')[0]})`
      : `محرر (${cleanEmail.split('@')[0]})`);

  const sanitized = sanitizeUsersList(users);
  const existingIndex = sanitized.findIndex(
    (u) =>
      u.email.trim().toLowerCase() === cleanEmail || u.uid === docId
  );

  if (existingIndex >= 0) {
    return sanitized.map((u, idx) =>
      idx === existingIndex
        ? {
            ...u,
            email: cleanEmail,
            displayName: input.displayName?.trim() || u.displayName || defaultName,
            role: effectiveRole,
            allowedDays: effectiveDays,
          }
        : u
    );
  }

  return [
    ...sanitized,
    {
      uid: docId,
      email: cleanEmail,
      displayName: defaultName.slice(0, 120),
      role: effectiveRole,
      allowedDays: effectiveDays,
    },
  ];
}

export function deleteUserFromList(
  users: UserProfile[],
  targetUidOrEmail: string
): { updated: UserProfile[]; deleted?: UserProfile; error?: string } {
  const sanitized = sanitizeUsersList(users);
  const cleanTarget = targetUidOrEmail.trim().toLowerCase();
  const targetUser = sanitized.find(
    (u) =>
      u.uid.toLowerCase() === cleanTarget ||
      u.email.trim().toLowerCase() === cleanTarget
  );

  if (!targetUser) {
    return { updated: sanitized, error: 'المستخدم غير موجود' };
  }

  if (targetUser.email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL) {
    return {
      updated: sanitized,
      error: 'لا يمكن حذف البريد الأساسي لمالك النظام (Super Admin)',
    };
  }

  return {
    updated: sanitized.filter(
      (u) =>
        u.uid !== targetUser.uid &&
        u.email.trim().toLowerCase() !== targetUser.email.trim().toLowerCase()
    ),
    deleted: targetUser,
  };
}

/**
 * Snapshot guard (Requirement 2):
 * Rejects any incoming snapshot when:
 * (a) A save or debounced mutation is currently active for the same day
 * (b) snap.metadata.hasPendingWrites is true
 * (c) remote.version < localVersion for this day
 */
export function shouldAcceptIncomingSnapshot(params: {
  isSavingOrPendingForDay: boolean;
  hasPendingWrites: boolean;
  remoteVersion: number;
  localVersion: number;
}): boolean {
  if (params.isSavingOrPendingForDay) return false;
  if (params.hasPendingWrites) return false;
  const remoteVer = typeof params.remoteVersion === 'number' ? params.remoteVersion : 0;
  const localVer = typeof params.localVersion === 'number' ? params.localVersion : 1;
  if (remoteVer < localVer) return false;
  return true;
}

/**
 * Checks whether a Firestore transaction/commit error is transient (`aborted` or `unavailable`)
 * and should be retried with exponential backoff (Requirement 3).
 */
export function isRetryableFirestoreError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: string })?.code?.toLowerCase() || '';
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('concurrent_conflict:')) return false;
  if (
    code === 'aborted' ||
    code === 'unavailable' ||
    code === 'firestore/aborted' ||
    code === 'firestore/unavailable' ||
    msg.includes('aborted') ||
    msg.includes('unavailable') ||
    msg.includes('failed-precondition')
  ) {
    return true;
  }
  return false;
}

/**
 * Retries an async Firestore transaction up to `maxRetries` times (default 3)
 * with exponential backoff when `aborted` or `unavailable` occurs (Requirement 3).
 */
export async function executeWithRetry<T>(
  operation: (attempt: number) => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 150
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation(attempt);
    } catch (err: unknown) {
      if (attempt < maxRetries && isRetryableFirestoreError(err)) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Extracts the real Firestore error cause (permission-denied / offline / conflict / aborted)
 * for clear display in the persistent error banner (Requirement 3).
 */
export function formatFirestoreCommitError(
  err: unknown,
  dayLabel: string
): { code: string; message: string } {
  const rawCode = (err as { code?: string })?.code || '';
  let rawMsg = err instanceof Error ? err.message : String(err);

  // If wrapped in JSON by handleFirestoreError, unwrap error message
  if (rawMsg.startsWith('{') && rawMsg.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawMsg);
      if (parsed.error) rawMsg = String(parsed.error);
    } catch {
      // Keep original
    }
  }

  const lower = `${rawCode} ${rawMsg}`.toLowerCase();

  if (rawMsg.startsWith('CONCURRENT_CONFLICT:')) {
    return {
      code: 'conflict',
      message: `تعارض إصدارات متزامن (conflict) في جدول يوم ${dayLabel}: قام مستخدم آخر بتحديث الجدول في نفس الوقت.`,
    };
  }

  if (
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions')
  ) {
    return {
      code: 'permission-denied',
      message: `خطأ صلاحيات (permission-denied) أثناء حفظ جدول يوم ${dayLabel}: ليس لديك صلاحية الكتابة أو أن البيانات تخالف قواعد الأمان. تم إرجاع الجدول لآخر نسخة مؤكدة.`,
    };
  }

  if (
    lower.includes('unavailable') ||
    lower.includes('offline') ||
    lower.includes('network')
  ) {
    return {
      code: 'offline',
      message: `خطأ اتصال (offline / unavailable) أثناء حفظ جدول يوم ${dayLabel}: تعذر الوصول إلى خادم Firestore بعد عدة محاولات. تم إرجاع الجدول لآخر نسخة مؤكدة.`,
    };
  }

  if (lower.includes('aborted')) {
    return {
      code: 'aborted',
      message: `توقف المعاملة (aborted) أثناء حفظ جدول يوم ${dayLabel} بسبب تداخل العمليات بعد 3 محاولات. تم إرجاع الجدول لآخر نسخة مؤكدة.`,
    };
  }

  return {
    code: rawCode || 'unknown',
    message: `فشل حفظ جدول يوم ${dayLabel} (${rawCode || rawMsg}). تم إرجاع الجدول لآخر نسخة مؤكدة.`,
  };
}

/**
 * Pure schedule mutation helper:
 * Makes `draftRows` the single source of truth, strips completely empty rows,
 * sets `publishedRows` equal to `draftRows`, and keeps `hasUnpublishedChanges = false` always.
 */
export function applyDraftMutationToDay(
  currentDay: DailyScheduleData,
  updater: (prevRows: ScheduleRow[]) => ScheduleRow[],
  editorInfo: { uid: string; email: string; displayName: string }
): DailyScheduleData {
  const baseRows = filterNonEmptyRows(currentDay.draftRows || []);
  const rawNextRows = updater(baseRows);
  const sanitizedRows = filterNonEmptyRows(rawNextRows)
    .slice(0, BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY)
    .map((r, i) => sanitizeRowForFirestore(r, i));

  return {
    ...currentDay,
    draftRows: sanitizedRows,
    publishedRows: sanitizedRows,
    hasUnpublishedChanges: false,
    isPublic: true,
    updatedBy: editorInfo.uid,
    updatedByEmail: editorInfo.email,
    updatedByName: editorInfo.displayName.slice(0, 120),
  };
}

/**
 * Per-Day Save Queue + 700ms Debounce + Snapshot Guard Controller.
 * Ensures:
 * - `draftRows` is the single source of truth (`publishedRows` always equals `draftRows`, `hasUnpublishedChanges = false`).
 * - Every mutation builds functionally `(prevRows) => nextRows` on the latest `schedulesByDay[dayId].draftRows`.
 * - Rapid mutations within `debounceMs` (700ms) coalesce into a single transaction write.
 * - `flushAllPending()` immediately triggers any pending debounced saves (e.g. on `pagehide` / `visibilitychange`).
 * - Per-day promise queue guarantees no commit starts before the previous commit for that day finishes.
 * - Incoming snapshots are ignored while a day has pending debounce or in-flight commit, or if `hasPendingWrites`, or if `remote.version < localVersion`.
 */
export interface PerDaySyncControllerOptions {
  initialSchedules: Record<DayId, DailyScheduleData>;
  debounceMs?: number;
  commitDraftToRemote: (params: {
    dayId: DayId;
    daySnapshot: DailyScheduleData;
    baseVersion: number;
  }) => Promise<{ committedVersion: number; serverDoc?: DailyScheduleData }>;
  onSchedulesChange?: (schedules: Record<DayId, DailyScheduleData>) => void;
  onSaveStatusChange?: (dayId: DayId, status: 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict') => void;
  onError?: (dayId: DayId, err: unknown, rolledBackTo: DailyScheduleData) => void;
}

export function createPerDayScheduleSyncController(options: PerDaySyncControllerOptions) {
  const debounceMs = options.debounceMs ?? 700;

  const normalizeDayUnified = (day: DailyScheduleData): DailyScheduleData => {
    const cleanRows = filterNonEmptyRows(day.draftRows || [])
      .slice(0, BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY)
      .map((r, i) => sanitizeRowForFirestore(r, i));
    return {
      ...day,
      draftRows: cleanRows,
      publishedRows: cleanRows,
      hasUnpublishedChanges: false,
      isPublic: true,
    };
  };

  const schedulesByDay: Record<DayId, DailyScheduleData> = {
    saturday: normalizeDayUnified(options.initialSchedules.saturday),
    sunday: normalizeDayUnified(options.initialSchedules.sunday),
    monday: normalizeDayUnified(options.initialSchedules.monday),
    tuesday: normalizeDayUnified(options.initialSchedules.tuesday),
    wednesday: normalizeDayUnified(options.initialSchedules.wednesday),
    thursday: normalizeDayUnified(options.initialSchedules.thursday),
    friday: normalizeDayUnified(options.initialSchedules.friday),
  };
  const confirmedByDay: Record<DayId, DailyScheduleData> = {
    ...schedulesByDay,
  };
  const localVersionByDay: Record<DayId, number> = {
    saturday: schedulesByDay.saturday?.version || 1,
    sunday: schedulesByDay.sunday?.version || 1,
    monday: schedulesByDay.monday?.version || 1,
    tuesday: schedulesByDay.tuesday?.version || 1,
    wednesday: schedulesByDay.wednesday?.version || 1,
    thursday: schedulesByDay.thursday?.version || 1,
    friday: schedulesByDay.friday?.version || 1,
  };
  const inFlightCountByDay: Record<DayId, number> = {
    saturday: 0,
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
  };
  const pendingTimerByDay: Record<DayId, ReturnType<typeof setTimeout> | null> = {
    saturday: null,
    sunday: null,
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
  };
  const pendingFlushResolvers: Record<DayId, Array<() => void>> = {
    saturday: [],
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  };
  const queueByDay: Record<DayId, Promise<void>> = {
    saturday: Promise.resolve(),
    sunday: Promise.resolve(),
    monday: Promise.resolve(),
    tuesday: Promise.resolve(),
    wednesday: Promise.resolve(),
    thursday: Promise.resolve(),
    friday: Promise.resolve(),
  };
  const dirtyGenerationByDay: Record<DayId, number> = {
    saturday: 0,
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
  };
  const committedGenerationByDay: Record<DayId, number> = {
    saturday: 0,
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
  };

  function isDayBusy(dayId: DayId): boolean {
    return (
      inFlightCountByDay[dayId] > 0 ||
      pendingTimerByDay[dayId] !== null ||
      dirtyGenerationByDay[dayId] > committedGenerationByDay[dayId]
    );
  }

  function enqueueDayCommit(dayId: DayId, targetGen: number): Promise<void> {
    inFlightCountByDay[dayId] += 1;
    options.onSaveStatusChange?.(dayId, 'saving');

    const nextPromise = queueByDay[dayId]
      .catch(() => {
        // Keep queue alive after prior failure
      })
      .then(async () => {
        if (committedGenerationByDay[dayId] >= targetGen) {
          return;
        }
        const currentGen = dirtyGenerationByDay[dayId];
        const snapshotToCommit = normalizeDayUnified(schedulesByDay[dayId]);
        const baseVersion = localVersionByDay[dayId] || snapshotToCommit.version || 1;

        try {
          const result = await options.commitDraftToRemote({
            dayId,
            daySnapshot: snapshotToCommit,
            baseVersion,
          });

          localVersionByDay[dayId] = result.committedVersion;
          committedGenerationByDay[dayId] = Math.max(
            committedGenerationByDay[dayId],
            currentGen
          );

          const confirmedDoc: DailyScheduleData = normalizeDayUnified(
            result.serverDoc || {
              ...snapshotToCommit,
              version: result.committedVersion,
            }
          );
          confirmedByDay[dayId] = confirmedDoc;

          if (dirtyGenerationByDay[dayId] === currentGen) {
            schedulesByDay[dayId] = confirmedDoc;
            options.onSchedulesChange?.({ ...schedulesByDay });
          }
        } catch (err) {
          committedGenerationByDay[dayId] = dirtyGenerationByDay[dayId];
          const rollbackDoc = confirmedByDay[dayId];
          schedulesByDay[dayId] = rollbackDoc;
          options.onSchedulesChange?.({ ...schedulesByDay });
          options.onSaveStatusChange?.(dayId, 'error');
          options.onError?.(dayId, err, rollbackDoc);
        }
      })
      .finally(() => {
        inFlightCountByDay[dayId] = Math.max(0, inFlightCountByDay[dayId] - 1);
        if (!isDayBusy(dayId)) {
          options.onSaveStatusChange?.(dayId, 'saved');
          const resolvers = pendingFlushResolvers[dayId].splice(0);
          resolvers.forEach((r) => r());
        }
      });

    queueByDay[dayId] = nextPromise;
    return nextPromise;
  }

  function mutateDayDraft(
    dayId: DayId,
    updater: (prevRows: ScheduleRow[]) => ScheduleRow[],
    editorInfo: { uid: string; email: string; displayName: string }
  ): DailyScheduleData {
    const currentDay = schedulesByDay[dayId];
    const updatedDay = applyDraftMutationToDay(currentDay, updater, editorInfo);
    schedulesByDay[dayId] = updatedDay;
    dirtyGenerationByDay[dayId] += 1;
    const gen = dirtyGenerationByDay[dayId];

    options.onSchedulesChange?.({ ...schedulesByDay });
    options.onSaveStatusChange?.(dayId, 'saving');

    if (pendingTimerByDay[dayId] !== null) {
      clearTimeout(pendingTimerByDay[dayId]!);
      pendingTimerByDay[dayId] = null;
    }

    return new Promise<void>((resolve) => {
      pendingFlushResolvers[dayId].push(resolve);
      if (debounceMs <= 0) {
        enqueueDayCommit(dayId, gen);
      } else {
        pendingTimerByDay[dayId] = setTimeout(() => {
          pendingTimerByDay[dayId] = null;
          enqueueDayCommit(dayId, dirtyGenerationByDay[dayId]);
        }, debounceMs);
      }
    }) as unknown as DailyScheduleData & Promise<void>, updatedDay;
  }

  function flushAllPending(): Promise<void[]> {
    const promises: Promise<void>[] = [];
    for (const day of DAYS_LIST) {
      const dayId = day.id;
      if (pendingTimerByDay[dayId] !== null) {
        clearTimeout(pendingTimerByDay[dayId]!);
        pendingTimerByDay[dayId] = null;
        promises.push(enqueueDayCommit(dayId, dirtyGenerationByDay[dayId]));
      } else if (dirtyGenerationByDay[dayId] > committedGenerationByDay[dayId] && inFlightCountByDay[dayId] === 0) {
        promises.push(enqueueDayCommit(dayId, dirtyGenerationByDay[dayId]));
      }
    }
    return Promise.all(promises);
  }

  function receiveRemoteSnapshot(
    dayId: DayId,
    remoteDoc: DailyScheduleData,
    metadata: { hasPendingWrites: boolean }
  ): boolean {
    const accepted = shouldAcceptIncomingSnapshot({
      isSavingOrPendingForDay: isDayBusy(dayId),
      hasPendingWrites: metadata.hasPendingWrites,
      remoteVersion: remoteDoc.version || 1,
      localVersion: localVersionByDay[dayId] || 1,
    });

    if (!accepted) {
      return false;
    }

    const normalizedRemote = normalizeDayUnified(remoteDoc);
    localVersionByDay[dayId] = normalizedRemote.version || 1;
    confirmedByDay[dayId] = normalizedRemote;
    schedulesByDay[dayId] = normalizedRemote;
    options.onSchedulesChange?.({ ...schedulesByDay });
    return true;
  }

  async function waitForDayIdle(dayId: DayId): Promise<void> {
    if (!isDayBusy(dayId)) return;
    await new Promise<void>((resolve) => {
      pendingFlushResolvers[dayId].push(resolve);
    });
    await queueByDay[dayId];
  }

  return {
    getSchedules: () => ({ ...schedulesByDay }),
    getDaySchedule: (dayId: DayId) => schedulesByDay[dayId],
    getConfirmedDaySchedule: (dayId: DayId) => confirmedByDay[dayId],
    getLocalVersion: (dayId: DayId) => localVersionByDay[dayId],
    isDayBusy,
    mutateDayDraft,
    flushAllPending,
    receiveRemoteSnapshot,
    waitForDayIdle,
  };
}
