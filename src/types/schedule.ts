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
  postTemplate?: string;
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

export type FacebookPostMode =
  | 'photo_with_caption'
  | 'photo_only'
  | 'text_only';

export type FacebookFallbackMode = 'text' | 'skip';

export type FacebookAutoPostStatus =
  | 'success'
  | 'success_text_fallback'
  | 'skipped_no_clinics'
  | 'failed';

export interface PosterImageData {
  dayId: DayId;
  version: number;
  imageBase64: string;
  mime: 'image/jpeg';
  updatedAt?: unknown;
}

export interface PosterMetaData {
  dayId: DayId;
  version: number;
  updatedAt: string;
  bytes: number;
}

export interface FbPostAttemptsRecord {
  date: string;
  count: number;
}

export type ReminderTargetDay = 'tomorrow' | 'today';

export interface ReminderSettings {
  enabled: boolean;
  time: string;
  timezone: 'Africa/Cairo';
  targetDay: ReminderTargetDay;
  title: string;
  body: string;
  fbAutoPostEnabled?: boolean;
  fbAutoPostTime?: string;
  fbPostMode?: FacebookPostMode;
  fbTargetDay?: ReminderTargetDay;
  fbFallbackMode?: FacebookFallbackMode;
  fbSkipEmptyDay?: boolean;
  showFacebookCard?: boolean;
  lastSentDate?: string;
  lastFbPostDate?: string;
  lastFbPostTargetDate?: string;
  lastFbPostWarning?: string;
  lastFbPostStatus?: FacebookAutoPostStatus;
  lastFbPostAt?: string;
  lastFbPostId?: string;
  lastFbPostError?: string;
  fbPostAttempts?: FbPostAttemptsRecord;
  fbPostLockUntil?: number;
  lastCronRunAt?: string;
  updatedBy?: string;
  updatedByEmail?: string;
  updatedAt?: unknown;
}

export type ClientEditableReminderSettings = Omit<
  ReminderSettings,
  | 'lastSentDate'
  | 'lastFbPostDate'
  | 'lastFbPostTargetDate'
  | 'lastFbPostWarning'
  | 'lastFbPostStatus'
  | 'lastFbPostAt'
  | 'lastFbPostId'
  | 'lastFbPostError'
  | 'fbPostAttempts'
  | 'fbPostLockUntil'
  | 'lastCronRunAt'
  | 'updatedBy'
  | 'updatedByEmail'
  | 'updatedAt'
>;

export interface FcmTokenRecord {
  token: string;
  email: string;
  uid: string;
  platform: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}



