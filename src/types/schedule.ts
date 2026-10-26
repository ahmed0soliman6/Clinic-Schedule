export type DayId =
  | 'saturday'
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday';

export type ClinicIconId =
  | 'speech'
  | 'eye'
  | 'baby'
  | 'nutrition'
  | 'gynecology'
  | 'bones'
  | 'tooth'
  | 'brain'
  | 'ear'
  | 'heart'
  | 'psych'
  | 'surgery'
  | 'stethoscope'
  | 'internal'
  | 'dermatology'
  | 'physio'
  | 'chest'
  | 'kidney'
  | 'urology';

export type UserRole = 'ADMIN' | 'EDITOR';

export type AuditAction =
  | 'CREATE_ROW'
  | 'UPDATE_ROW'
  | 'DELETE_ROW'
  | 'REORDER_ROWS'
  | 'COPY_ROW'
  | 'COPY_DAY'
  | 'PUBLISH_DAY'
  | 'UPDATE_SETTINGS'
  | 'UPDATE_ROLE'
  | 'DELETE_USER'
  | 'SEED_DATA'
  | 'UNDO';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';

export interface ScheduleRow {
  id: string;
  clinicName: string;
  doctorName: string;
  startTime: string;
  endTime: string;
  icon: ClinicIconId;
  iconColor: string;
  sortOrder: number;
}

export interface DailyScheduleData {
  dayId: DayId;
  dayLabel: string;
  dayOrder: number;
  isPublic: boolean;
  hasUnpublishedChanges: boolean;
  version: number;
  draftRows: ScheduleRow[];
  publishedRows: ScheduleRow[];
  updatedBy: string;
  updatedByEmail: string;
  updatedByName: string;
  updatedAt?: unknown;
  publishedAt: string;
}

export interface CenterSettings {
  complexName: string;
  associationName: string;
  registrationNumber: string;
  rightLogoUrl: string;
  leftLogoUrl: string;
  address: string;
  whatsappPhone: string;
  landlinePhone: string;
  dentalPhone: string;
  dentalLabel: string;
  bgStartColor: string;
  bgEndColor: string;
  clinicHeaderColor: string;
  doctorHeaderColor: string;
  fromHeaderColor: string;
  toHeaderColor: string;
  footerBgColor: string;
  updatedBy?: string;
  updatedByEmail?: string;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  allowedDays: DayId[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  dayId: string;
  dayLabel: string;
  details: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAtIso: string;
}

export interface ConflictInfo {
  dayId: DayId;
  baseRows?: ScheduleRow[];
  localRows: ScheduleRow[];
  remoteSchedule: DailyScheduleData;
  detectedAt: string;
}

export interface PublicDailyScheduleData {
  dayId: DayId;
  dayLabel: string;
  dayOrder: number;
  isPublic: boolean;
  publishedRows: ScheduleRow[];
  publishedAt: string;
}

