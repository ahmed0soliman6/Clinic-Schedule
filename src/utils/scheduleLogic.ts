import {
  CenterSettings,
  ClinicIconId,
  DailyScheduleData,
  DayId,
  ScheduleRow,
  UserProfile,
  UserRole,
} from '../types/schedule';

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
  MAX_ROWS_PER_DAY: 60,
  COMPLEX_NAME_MAX: 120,
  ASSOCIATION_NAME_MAX: 160,
  ADDRESS_MAX: 200,
  PHONE_MAX: 40,
};

const CLINIC_NAME_AL_MAP: Record<string, string> = {
  'باطنة': 'الباطنة',
  'باطنه': 'الباطنة',
  'جلدية': 'الجلدية',
  'جلديه': 'الجلدية',
  'نساء وتوليد': 'النساء والتوليد',
  'النساء': 'النساء والتوليد',
  'عظام': 'العظام',
  'أنف وأذن': 'الأنف والأذن',
  'انف واذن': 'الأنف والأذن',
  'قلب': 'القلب',
  'أطفال': 'الأطفال',
  'اطفال': 'الأطفال',
  'تخاطب': 'التخاطب',
  'تغذية علاجية': 'التغذية العلاجية',
  'مخ وأعصاب': 'المخ والأعصاب',
  'جراحة عامة': 'الجراحة العامة',
  'علاج طبيعى': 'العلاج الطبيعي',
  'علاج طبيعي': 'العلاج الطبيعي',
  'صدر': 'الصدر',
  'نفسية': 'النفسية',
  'أسنان': 'الأسنان',
  'اسنان': 'الأسنان',
  'عيون': 'العيون',
  'كلي': 'الكلى',
  'كلى': 'الكلى',
  'مسالك': 'المسالك',
};

export function normalizeClinicNameWithAl(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (CLINIC_NAME_AL_MAP[trimmed]) {
    return CLINIC_NAME_AL_MAP[trimmed];
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
      clinicName: normalizeClinicNameWithAl(row.clinicName),
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

export function sanitizeRowForFirestore(row: ScheduleRow, index: number): ScheduleRow {
  return {
    id: row.id.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80) || `row-${index}`,
    clinicName: row.clinicName.trim().slice(0, BLUEPRINT_LIMITS.CLINIC_NAME_MAX),
    doctorName: row.doctorName.trim().slice(0, BLUEPRINT_LIMITS.DOCTOR_NAME_MAX),
    startTime: row.startTime.trim().slice(0, BLUEPRINT_LIMITS.TIME_MAX),
    endTime: row.endTime.trim().slice(0, BLUEPRINT_LIMITS.TIME_MAX),
    icon: row.icon,
    iconColor: row.iconColor.trim().slice(0, 30) || '#0284c7',
    sortOrder: Math.max(0, Math.min(500, Math.floor(index))),
  };
}

export function addScheduleRow(
  rows: ScheduleRow[],
  input: Omit<ScheduleRow, 'id' | 'sortOrder'>,
  customId?: string
): ScheduleRow[] {
  const ordered = normalizeSortOrders(rows);
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
  const orderedSource = normalizeSortOrders(sourceRows);
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
  localRows: ScheduleRow[],
  remoteRows: ScheduleRow[]
): ScheduleRow[] {
  const mergedMap = new Map<string, ScheduleRow>();
  for (const r of normalizeSortOrders(remoteRows)) {
    mergedMap.set(r.id, r);
  }
  for (const l of normalizeSortOrders(localRows)) {
    mergedMap.set(l.id, l);
  }
  return normalizeSortOrders(Array.from(mergedMap.values())).slice(
    0,
    BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY
  );
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

export function buildDailySocialPostText(
  dayLabel: string,
  settings: CenterSettings
): string {
  const cleanWa = settings.whatsappPhone.replace(/\D/g, '');
  const waIntl = cleanWa.startsWith('2') ? cleanWa : `2${cleanWa}`;
  return [
    `جدول عيادات يوم ${dayLabel}`,
    `☎️ ${settings.landlinePhone} - 📲 ${settings.whatsappPhone}`,
    `عيادة الأسنان. ${settings.dentalPhone}`,
    `واتس أب للتواصل 👈 https://wa.me/${waIntl}`,
    `انستجرام https://www.instagram.com/mit.azzoun.medical`,
    `قناة الواتس آب ${WHATSAPP_CHANNEL_SHORT_URL}`,
  ].join('\n');
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
        : Array.isArray(u.allowedDays) && u.allowedDays.length > 0
        ? u.allowedDays.filter((d) => allDayIds.includes(d))
        : allDayIds;

    const existing = byEmail.get(cleanEmail);
    // Prefer emailToDocId for consistent lookup or keep non-placeholder uid
    const docId =
      existing?.uid ||
      (u.uid && !u.uid.includes('meetazzoun') ? u.uid : emailToDocId(cleanEmail));

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
      uid: params.uid || emailToDocId(PRIMARY_ADMIN_EMAIL),
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
      u.uid === emailDocId ||
      (params.uid && u.uid === params.uid)
  );

  if (!match) {
    return { authorized: false, role: null, allowedDays: [] };
  }

  const role: UserRole = match.role === 'ADMIN' ? 'ADMIN' : 'EDITOR';
  const allowedDays: DayId[] =
    role === 'ADMIN'
      ? allDayIds
      : Array.isArray(match.allowedDays) && match.allowedDays.length > 0
      ? match.allowedDays
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

  const docId = input.uid?.trim() || emailToDocId(cleanEmail);
  const effectiveRole: UserRole =
    cleanEmail === PRIMARY_ADMIN_EMAIL || input.role === 'ADMIN'
      ? 'ADMIN'
      : 'EDITOR';
  const effectiveDays: DayId[] =
    effectiveRole === 'ADMIN'
      ? DAYS_LIST.map((d) => d.id)
      : input.allowedDays && input.allowedDays.length > 0
      ? input.allowedDays
      : DAYS_LIST.map((d) => d.id);

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



