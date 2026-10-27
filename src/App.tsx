import React, { useEffect, useRef, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Copy,
  Database,
  Edit3,
  Eye,
  History,
  LogIn,
  LogOut,
  Menu,
  RotateCcw,
  Settings,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  syncStoredFcmTokenWithUser,
} from './firebase';
import {
  AuditAction,
  AuditLogEntry,
  CenterSettings,
  ConflictInfo,
  DailyScheduleData,
  DayId,
  PublicDailyScheduleData,
  ReminderSettings,
  SaveStatus,
  ScheduleRow,
  UserProfile,
  UserRole,
} from './types/schedule';
import { DEFAULT_REMINDER_SETTINGS } from './utils/reminderLogic';
import {
  BLUEPRINT_LIMITS,
  DAYS_LIST,
  DEFAULT_POST_TEMPLATE,
  PRIMARY_ADMIN_EMAIL,
  addScheduleRow,
  applyDraftMutationToDay,
  canUserEditDay,
  copyFullDayRows,
  copyRowToDay,
  deleteScheduleRow,
  deleteUserFromList,
  detectConcurrentConflict,
  emailToDocId,
  executeWithRetry,
  filterNonEmptyRows,
  formatFirestoreCommitError,
  isCompletelyEmptyRow,
  isFictionalOrBlockedEmail,
  mergeConflictingRowsThreeWay,
  moveScheduleRow,
  resolveAuthorizedUserAccess,
  sanitizeRowForFirestore,
  sanitizeUsersList,
  shouldAcceptIncomingSnapshot,
  updateScheduleRow,
  upsertUserByEmail,
} from './utils/scheduleLogic';
import { SchedulePoster } from './components/SchedulePoster';
import { ShareAndExportBar } from './components/ShareAndExportBar';
import { CenterSettingsModal } from './components/CenterSettingsModal';
import { UsersAndAuditModal } from './components/UsersAndAuditModal';
import { ComplexBrandLogo } from './components/BrandLogos';
import {
  HeaderAccountAndNotificationsMenu,
  NotificationToggleButton,
  OfflineIndicator,
  PWAInstallButton,
} from './components/PWAInstallAndNotifications';

const FALLBACK_SETTINGS: CenterSettings = {
  complexName: 'مجمع ميت عزون الطبي',
  associationName: 'جمعية تنمية المجتمع المحلي',
  registrationNumber: 'مشهرة برقم 2406',
  rightLogoUrl: '/logos/complex-logo.svg',
  leftLogoUrl: '/logos/association-logo.svg',
  address: 'ميت عزون - بجوار المسجد الكبير',
  whatsappPhone: '01202027567',
  landlinePhone: '0502053187',
  dentalPhone: '01515674347',
  dentalLabel: 'عيادة الأسنان',
  bgStartColor: '#f3effb',
  bgEndColor: '#e8dff5',
  clinicHeaderColor: '#f59e0b',
  doctorHeaderColor: '#0d9456',
  fromHeaderColor: '#f59e0b',
  toHeaderColor: '#0088cc',
  footerBgColor: '#1e295b',
  postTemplate: DEFAULT_POST_TEMPLATE,
};

const STORAGE_KEY = 'meet_azzoun_medical_schedules_v9_live';

const DEFAULT_USERS_LIST: UserProfile[] = [
  {
    uid: emailToDocId(PRIMARY_ADMIN_EMAIL),
    email: PRIMARY_ADMIN_EMAIL,
    displayName: 'مدير مجمع ميت عزون الطبي',
    role: 'ADMIN',
    allowedDays: DAYS_LIST.map((d) => d.id),
  },
];

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialDayParam = urlParams.get('day') as DayId | null;
  const isStrictPublicUrl = urlParams.get('view') === 'public';

  const [selectedDay, setSelectedDay] = useState<DayId>(
    initialDayParam && DAYS_LIST.some((d) => d.id === initialDayParam)
      ? initialDayParam
      : 'saturday'
  );

  // Sync selectedDay when ?day=<dayId> changes via popstate or Service Worker notificationclick
  useEffect(() => {
    const syncDayFromUrl = (rawUrlOrSearch?: string) => {
      try {
        const search = rawUrlOrSearch
          ? new URL(rawUrlOrSearch, window.location.origin).search
          : window.location.search;
        const params = new URLSearchParams(search);
        const dayParam = params.get('day') as DayId | null;
        if (dayParam && DAYS_LIST.some((d) => d.id === dayParam)) {
          setSelectedDay(dayParam);
        }
      } catch {
        // Ignore URL parse error
      }
    };

    const handlePopState = () => syncDayFromUrl();
    const handleSwMessage = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.type === 'NOTIFICATION_CLICK_NAVIGATE' &&
        typeof event.data.url === 'string'
      ) {
        syncDayFromUrl(event.data.url);
      }
    };

    window.addEventListener('popstate', handlePopState);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);

  const [viewMode, setViewMode] = useState<'public' | 'manage'>(
    isStrictPublicUrl ? 'public' : 'manage'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Copy full day confirmation modal state
  const [showCopyDayModal, setShowCopyDayModal] = useState(false);
  const [copyDayTarget, setCopyDayTarget] = useState<DayId>('sunday');

  // Clear day confirmation modal state (states row count clearly)
  const [confirmClearDayModal, setConfirmClearDayModal] = useState<{
    dayId: DayId;
    dayLabel: string;
    rowCount: number;
  } | null>(null);

  // Super Admin explicit database seed modal
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);

  // Auth & RBAC state — Strictly null until verified against registered emails
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [allowedDays, setAllowedDays] = useState<DayId[]>([]);
  const [authErrorBanner, setAuthErrorBanner] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<UserProfile[]>(DEFAULT_USERS_LIST);
  const usersListRef = useRef<UserProfile[]>(DEFAULT_USERS_LIST);

  useEffect(() => {
    usersListRef.current = usersList;
  }, [usersList]);

  const [settings, setSettings] = useState<CenterSettings>(FALLBACK_SETTINGS);
  const [defaultSettings, setDefaultSettings] =
    useState<CenterSettings>(FALLBACK_SETTINGS);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    ...DEFAULT_REMINDER_SETTINGS,
  });
  const [schedules, setSchedulesState] = useState<Record<DayId, DailyScheduleData>>(
    () => {
      const emptyMap = {} as Record<DayId, DailyScheduleData>;
      DAYS_LIST.forEach((d) => {
        emptyMap[d.id] = {
          dayId: d.id,
          dayLabel: d.label,
          dayOrder: d.order,
          isPublic: true,
          hasUnpublishedChanges: false,
          version: 1,
          draftRows: [],
          publishedRows: [],
          updatedBy: 'system',
          updatedByEmail: PRIMARY_ADMIN_EMAIL,
          updatedByName: 'إدارة المجمع',
          publishedAt: new Date().toISOString(),
        };
      });
      return emptyMap;
    }
  );
  const schedulesRef = useRef<Record<DayId, DailyScheduleData>>(schedules);
  const confirmedSchedulesRef = useRef<Record<DayId, DailyScheduleData>>(schedules);

  // Synchronously update schedulesRef with every state transition (Requirement 1)
  const setSchedules = (
    updater:
      | Record<DayId, DailyScheduleData>
      | ((prev: Record<DayId, DailyScheduleData>) => Record<DayId, DailyScheduleData>)
  ) => {
    const next =
      typeof updater === 'function' ? updater(schedulesRef.current) : updater;
    schedulesRef.current = next;
    setSchedulesState(next);
  };

  const firebaseUserRef = useRef<FirebaseUser | null>(null);
  const activeRoleRef = useRef<UserRole | null>(null);
  useEffect(() => {
    firebaseUserRef.current = firebaseUser;
    activeRoleRef.current = activeRole;
  }, [firebaseUser, activeRole]);

  const [isLoaded, setIsLoaded] = useState(false);

  const [undoStacks, setUndoStacks] = useState<Record<DayId, ScheduleRow[][]>>({
    saturday: [],
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveStatusRef = useRef<SaveStatus>('saved');
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showUsersAuditModal, setShowUsersAuditModal] = useState<
    'audit' | 'users' | null
  >(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const posterRef = useRef<HTMLDivElement | null>(null);
  const exportPosterRef = useRef<HTMLDivElement | null>(null);
  const localVersionRef = useRef<Record<DayId, number>>({
    saturday: 1,
    sunday: 1,
    monday: 1,
    tuesday: 1,
    wednesday: 1,
    thursday: 1,
    friday: 1,
  });

  // Per-Day Save Queue, In-Flight Counter, Debounce Timer, and Generation Tracking (Requirements 1, 2, 4)
  const daySaveQueueRef = useRef<Record<DayId, Promise<void>>>({
    saturday: Promise.resolve(),
    sunday: Promise.resolve(),
    monday: Promise.resolve(),
    tuesday: Promise.resolve(),
    wednesday: Promise.resolve(),
    thursday: Promise.resolve(),
    friday: Promise.resolve(),
  });
  const inFlightCountRef = useRef<Record<DayId, number>>({
    saturday: 0,
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
  });
  const pendingDebounceTimerRef = useRef<
    Record<DayId, ReturnType<typeof setTimeout> | null>
  >({
    saturday: null,
    sunday: null,
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
  });
  const dirtyGenRef = useRef<Record<DayId, number>>({
    saturday: 0,
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
  });
  const committedGenRef = useRef<Record<DayId, number>>({
    saturday: 0,
    sunday: 0,
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
  });
  const pendingAuditMetaRef = useRef<
    Record<DayId, { action: AuditAction; details: string } | null>
  >({
    saturday: null,
    sunday: null,
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
  });

  const isDaySavingOrPending = (dayId: DayId): boolean => {
    return (
      inFlightCountRef.current[dayId] > 0 ||
      pendingDebounceTimerRef.current[dayId] !== null ||
      dirtyGenRef.current[dayId] > committedGenRef.current[dayId]
    );
  };

  // Handle redirect result on mount if user signed in via redirect fallback
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.warn('Redirect sign-in result:', err);
    });
  }, []);

  // 1. Load initial schedules from external JSON or offline public cache
  useEffect(() => {
    let mounted = true;
    async function loadInitialJson() {
      try {
        const res = await fetch('/data/initial-schedules.json');
        const json = await res.json();
        if (!mounted) return;

        if (json.settings) {
          setDefaultSettings(json.settings);
        }

        // Only settings and publishedRows are cached locally for public visitors
        const cachedRaw = localStorage.getItem(STORAGE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            if (cached.settings) setSettings(cached.settings);
            if (cached.publishedSchedules) {
              setSchedules((prev) => {
                const next = { ...prev };
                DAYS_LIST.forEach((d) => {
                  if (Array.isArray(cached.publishedSchedules[d.id])) {
                    const cleanRows = filterNonEmptyRows(cached.publishedSchedules[d.id]);
                    next[d.id] = {
                      ...next[d.id],
                      draftRows: cleanRows,
                      publishedRows: cleanRows,
                      hasUnpublishedChanges: false,
                    };
                  }
                });
                return next;
              });
              setIsLoaded(true);
              return;
            }
          } catch {
            // Fall through
          }
        }

        if (json.settings) {
          setSettings(json.settings);
        }
        if (json.schedules) {
          const built = {} as Record<DayId, DailyScheduleData>;
          DAYS_LIST.forEach((d) => {
            const dayData = json.schedules[d.id];
            const rows: ScheduleRow[] = filterNonEmptyRows(dayData?.rows || []);
            built[d.id] = {
              dayId: d.id,
              dayLabel: d.label,
              dayOrder: d.order,
              isPublic: true,
              hasUnpublishedChanges: false,
              version: 1,
              draftRows: rows,
              publishedRows: rows,
              updatedBy: 'system',
              updatedByEmail: PRIMARY_ADMIN_EMAIL,
              updatedByName: 'إدارة مجمع ميت عزون',
              publishedAt: new Date().toISOString(),
            };
          });
          setSchedules(built);
        }
        setIsLoaded(true);
      } catch (err) {
        console.error('Error loading initial schedules JSON:', err);
        setIsLoaded(true);
      }
    }
    loadInitialJson();
    return () => {
      mounted = false;
    };
  }, []);

  // Cache ONLY settings and publishedRows locally for visitor offline support
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const publicCache: Record<string, ScheduleRow[]> = {};
      DAYS_LIST.forEach((d) => {
        publicCache[d.id] = schedules[d.id]?.publishedRows || [];
      });
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          settings,
          publishedSchedules: publicCache,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [settings, schedules, isLoaded]);

  // 2. Strict Whitelist Firebase Authentication listener & users/{emailDocId} Role Resolution
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || !user.email) {
        setFirebaseUser(null);
        setActiveRole(null);
        setAllowedDays([]);
        setIsSidebarOpen(false);
        setAuthReady(true);
        return;
      }

      const cleanEmail = user.email.trim().toLowerCase();
      const isPrimaryAdmin = cleanEmail === PRIMARY_ADMIN_EMAIL;
      const emailDocId = emailToDocId(cleanEmail);

      let remoteUserDoc: UserProfile | null = null;
      try {
        const snap = await getDoc(doc(db, 'users', emailDocId));
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          if (data && data.email && !isFictionalOrBlockedEmail(data.email)) {
            remoteUserDoc = {
              uid: emailDocId,
              email: data.email.trim().toLowerCase(),
              displayName: data.displayName || data.email,
              role: data.role === 'ADMIN' ? 'ADMIN' : 'EDITOR',
              allowedDays:
                Array.isArray(data.allowedDays) && data.allowedDays.length > 0
                  ? data.allowedDays
                  : isPrimaryAdmin
                  ? DAYS_LIST.map((d) => d.id)
                  : [],
            };
          }
        } else if (isPrimaryAdmin) {
          const adminDoc: UserProfile = {
            uid: emailDocId,
            email: PRIMARY_ADMIN_EMAIL,
            displayName: (user.displayName || 'مدير مجمع ميت عزون الطبي').slice(0, 120),
            role: 'ADMIN',
            allowedDays: DAYS_LIST.map((d) => d.id),
          };
          remoteUserDoc = adminDoc;
          await setDoc(doc(db, 'users', emailDocId), {
            ...adminDoc,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Unregistered or permission denied
      }

      const candidateProfiles = remoteUserDoc
        ? upsertUserByEmail(usersListRef.current, remoteUserDoc)
        : usersListRef.current;

      const access = resolveAuthorizedUserAccess({
        email: cleanEmail,
        uid: user.uid,
        registeredUsers: candidateProfiles,
      });

      // STRICT GATE: If email is NOT registered, reject login immediately
      // Do NOT call deleteUser (per Rule 3.5), simply signOut and show Arabic error banner
      if (!access.authorized || !access.role) {
        setFirebaseUser(null);
        setActiveRole(null);
        setAllowedDays([]);
        setIsSidebarOpen(false);
        setAuthErrorBanner(
          `⛔ تم رفض تسجيل الدخول: البريد الإلكتروني (${cleanEmail}) غير مسجل في «إدارة البريد والصلاحيات». لا يُسمح بتسجيل الدخول أو تعديل الجداول إلا للحسابات المعتمدة مسبقاً من مدير المجمع.`
        );
        try {
          await signOut(auth);
        } catch {
          // Ignore
        }
        setAuthReady(true);
        return;
      }

      // User IS authorized!
      setAuthErrorBanner(null);
      setFirebaseUser(user);
      setActiveRole(access.role);
      setAllowedDays(access.allowedDays);
      syncStoredFcmTokenWithUser(cleanEmail, user.uid).catch(() => undefined);

      // If Admin, load full users list and audit logs from Firestore
      if (isPrimaryAdmin || access.role === 'ADMIN') {
        try {
          const snap = await getDocs(collection(db, 'users'));
          const remoteUsers: UserProfile[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as UserProfile;
            if (!data || !data.email) return;
            if (isFictionalOrBlockedEmail(data.email)) return;
            remoteUsers.push({
              uid: docSnap.id,
              email: data.email.trim().toLowerCase(),
              displayName: data.displayName || data.email,
              role:
                data.email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL ||
                data.role === 'ADMIN'
                  ? 'ADMIN'
                  : 'EDITOR',
              allowedDays: Array.isArray(data.allowedDays) ? data.allowedDays : [],
            });
          });
          if (remoteUsers.length > 0) {
            setUsersList(sanitizeUsersList(remoteUsers));
          }
        } catch {
          // Ignore
        }

        try {
          const logsSnap = await getDocs(collection(db, 'auditLogs'));
          const logs: AuditLogEntry[] = [];
          logsSnap.forEach((d) => {
            const data = d.data();
            logs.push({
              id: d.id,
              action: data.action,
              dayId: data.dayId,
              dayLabel: data.dayLabel,
              details: data.details,
              userId: data.userId,
              userEmail: data.userEmail,
              userName: data.userName,
              createdAtIso:
                data.createdAt && typeof data.createdAt.toDate === 'function'
                  ? data.createdAt.toDate().toISOString()
                  : new Date().toISOString(),
            });
          });
          logs.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
          setAuditLogs(logs.slice(0, 100));
        } catch {
          // Non-blocking
        }
      }

      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // 3. Firestore Real-Time Subscriptions (Requirements 2 & 5):
  // - Public Visitors: Subscribe ONLY to publicSchedules/{selectedDay} & settings/center
  // - Authenticated Staff: Subscribe to schedules/{selectedDay} & settings/center
  // - Does NOT re-subscribe when firebaseUser object reference changes (uses boolean isStaffAuthenticated)
  const isStaffAuthenticated = Boolean(firebaseUser && activeRole);

  useEffect(() => {
    if (!authReady || !isLoaded) return;

    // Center Settings Listener (readable by all)
    const settingsRef = doc(db, 'settings', 'center');
    const unsubSettings = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          const remoteSettings = snap.data() as CenterSettings;
          setSettings((prev) => ({ ...prev, ...remoteSettings }));
        }
      },
      () => {
        // Handled
      }
    );

    // Schedule listener depending on staff authentication boolean
    let unsubSchedule: () => void;

    if (!isStaffAuthenticated) {
      // Visitor: Read schedule from publicSchedules/{selectedDay}
      const publicRef = doc(db, 'publicSchedules', selectedDay);
      unsubSchedule = onSnapshot(
        publicRef,
        (snap) => {
          if (snap.exists()) {
            const pubData = snap.data() as PublicDailyScheduleData;
            const cleanRows = filterNonEmptyRows(pubData.publishedRows || [])
              .slice(0, BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY)
              .map((r, i) => sanitizeRowForFirestore(r, i));
            setSchedules((prev) => {
              const current = prev[selectedDay];
              if (!current) return prev;
              const nextDay: DailyScheduleData = {
                ...current,
                draftRows: cleanRows,
                publishedRows: cleanRows,
                hasUnpublishedChanges: false,
                publishedAt: pubData.publishedAt || current.publishedAt,
                isPublic: pubData.isPublic ?? true,
              };
              confirmedSchedulesRef.current = {
                ...confirmedSchedulesRef.current,
                [selectedDay]: nextDay,
              };
              return {
                ...prev,
                [selectedDay]: nextDay,
              };
            });
          }
        },
        () => {
          // Handled
        }
      );
    } else {
      // Staff / Editor / Admin: Read schedule from schedules/{selectedDay}
      // Protected against active saves, pending writes, and older versions (Requirement 2)
      const scheduleRef = doc(db, 'schedules', selectedDay);
      unsubSchedule = onSnapshot(
        scheduleRef,
        (snap) => {
          if (!snap.exists()) return;

          const remoteDoc = snap.data() as DailyScheduleData;
          const accepted = shouldAcceptIncomingSnapshot({
            isSavingOrPendingForDay: isDaySavingOrPending(selectedDay),
            hasPendingWrites: snap.metadata.hasPendingWrites,
            remoteVersion: remoteDoc.version || 1,
            localVersion: localVersionRef.current[selectedDay] || 1,
          });

          if (!accepted) {
            return;
          }

          const rawSourceRows = Array.isArray(remoteDoc.draftRows)
            ? remoteDoc.draftRows
            : Array.isArray(remoteDoc.publishedRows)
            ? remoteDoc.publishedRows
            : [];
          const hadEmptyRowsInRemote = rawSourceRows.some((r) =>
            isCompletelyEmptyRow(r)
          );
          const cleanRows = filterNonEmptyRows(rawSourceRows)
            .slice(0, BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY)
            .map((r, i) => sanitizeRowForFirestore(r, i));

          const normalizedRemote: DailyScheduleData = {
            ...remoteDoc,
            draftRows: cleanRows,
            publishedRows: cleanRows,
            hasUnpublishedChanges: false,
            isPublic: true,
          };

          setSchedules((prev) => {
            const currentLocal = prev[selectedDay];
            const conflictCheck = detectConcurrentConflict({
              localBaseVersion: localVersionRef.current[selectedDay] || 1,
              incomingRemoteSchedule: normalizedRemote,
              currentUserId: auth.currentUser?.uid,
              hasLocalUnsavedChanges: isDaySavingOrPending(selectedDay),
              localDraftRows: currentLocal?.draftRows || [],
            });

            if (conflictCheck.hasConflict) {
              setConflict({
                dayId: selectedDay,
                baseRows: confirmedSchedulesRef.current[selectedDay]?.draftRows,
                localRows: currentLocal?.draftRows || [],
                remoteSchedule: normalizedRemote,
                detectedAt: new Date().toISOString(),
              });
              setSaveStatus('conflict');
              saveStatusRef.current = 'conflict';
              return prev;
            }

            localVersionRef.current[selectedDay] = normalizedRemote.version || 1;
            confirmedSchedulesRef.current = {
              ...confirmedSchedulesRef.current,
              [selectedDay]: normalizedRemote,
            };
            return {
              ...prev,
              [selectedDay]: normalizedRemote,
            };
          });

          // If legacy remote document had completely empty rows (e.g. Saturday), silently clean them in Firestore
          if (
            hadEmptyRowsInRemote &&
            canUserEditDay(activeRoleRef.current, allowedDays, selectedDay)
          ) {
            dirtyGenRef.current[selectedDay] += 1;
            enqueueDayDraftCommit(selectedDay, dirtyGenRef.current[selectedDay]);
          }
        },
        (error) => {
          if (auth.currentUser) {
            try {
              handleFirestoreError(
                error,
                OperationType.GET,
                `schedules/${selectedDay}`
              );
            } catch {
              // Handled
            }
          }
        }
      );
    }

    let unsubReminders: (() => void) | null = null;
    if (isStaffAuthenticated) {
      const remindersRef = doc(db, 'appConfig', 'reminders');
      unsubReminders = onSnapshot(
        remindersRef,
        (snap) => {
          if (snap.exists()) {
            const remoteReminders = snap.data() as ReminderSettings;
            setReminderSettings((prev) => ({
              ...prev,
              ...remoteReminders,
              timezone: 'Africa/Cairo',
            }));
          }
        },
        () => {
          // Handled
        }
      );
    }

    return () => {
      unsubSettings();
      unsubSchedule();
      if (unsubReminders) unsubReminders();
    };
  }, [authReady, isLoaded, isStaffAuthenticated, selectedDay]);

  // Non-blocking audit log append
  const appendAuditLog = async (
    action: AuditAction,
    dayId: string,
    dayLabel: string,
    details: string
  ) => {
    const userId = firebaseUser?.uid || 'local-admin';
    const userEmail = firebaseUser?.email || PRIMARY_ADMIN_EMAIL;
    const userName =
      firebaseUser?.displayName ||
      (activeRole === 'ADMIN' ? 'مدير النظام' : 'محرر الجداول');

    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action,
      dayId,
      dayLabel,
      details: details.slice(0, 500),
      userId,
      userEmail,
      userName,
      createdAtIso: new Date().toISOString(),
    };

    setAuditLogs((prev) => [newEntry, ...prev.slice(0, 99)]);

    if (firebaseUser) {
      try {
        await setDoc(doc(collection(db, 'auditLogs'), newEntry.id), {
          action: newEntry.action,
          dayId: newEntry.dayId,
          dayLabel: newEntry.dayLabel,
          details: newEntry.details,
          userId: firebaseUser.uid,
          userEmail: firebaseUser.email || PRIMARY_ADMIN_EMAIL,
          userName: newEntry.userName.slice(0, 120),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Non-blocking audit log error:', err);
      }
    }
  };

  /**
   * Enqueues an atomic Firestore transaction for BOTH `schedules/{targetDayId}` AND `publicSchedules/{targetDayId}`
   * onto the per-day promise queue (`daySaveQueueRef`).
   * - Never starts before the previous save for `targetDayId` finishes.
   * - Makes `draftRows` the single source of truth: writes `draftRows` and `publishedRows` with the exact same rows,
   *   `hasUnpublishedChanges: false` always, and `publicSchedules/{targetDayId}.publishedRows` with the exact same rows
   *   inside the SAME `runTransaction`.
   * - Silently migrates any day where `draftRows` previously differed from `publishedRows` by taking `draftRows` as truth.
   * - Uses `executeWithRetry` (up to 3 retries with exponential backoff on `aborted`/`unavailable`) and NO `setDoc` fallback.
   * - Displays the real error in `authErrorBanner` (persistent until user closes) before rolling back to `confirmedSchedulesRef`.
   */
  const enqueueDayDraftCommit = (targetDayId: DayId, targetGen: number) => {
    inFlightCountRef.current[targetDayId] += 1;
    setSaveStatus('saving');
    saveStatusRef.current = 'saving';

    const nextPromise = daySaveQueueRef.current[targetDayId]
      .catch(() => {
        // Keep per-day queue alive after any prior error
      })
      .then(async () => {
        // If already committed by a newer flush cycle, skip redundant transaction
        if (committedGenRef.current[targetDayId] >= targetGen) {
          return;
        }

        const currentGen = dirtyGenRef.current[targetDayId];
        const latestDay = schedulesRef.current[targetDayId];
        if (!latestDay) return;

        const sanitizedRows = filterNonEmptyRows(latestDay.draftRows || [])
          .slice(0, BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY)
          .map((r, i) => sanitizeRowForFirestore(r, i));

        const currentUser = firebaseUserRef.current;
        if (!currentUser) {
          committedGenRef.current[targetDayId] = currentGen;
          const localUnified: DailyScheduleData = {
            ...latestDay,
            draftRows: sanitizedRows,
            publishedRows: sanitizedRows,
            hasUnpublishedChanges: false,
            isPublic: true,
          };
          confirmedSchedulesRef.current = {
            ...confirmedSchedulesRef.current,
            [targetDayId]: localUnified,
          };
          return;
        }

        const baseVersion =
          localVersionRef.current[targetDayId] ||
          confirmedSchedulesRef.current[targetDayId]?.version ||
          1;
        const scheduleDocRef = doc(db, 'schedules', targetDayId);
        const publicDocRef = doc(db, 'publicSchedules', targetDayId);
        const auditMeta = pendingAuditMetaRef.current[targetDayId];
        const dayMeta =
          DAYS_LIST.find((d) => d.id === targetDayId) || DAYS_LIST[0];
        const commitIso = new Date().toISOString();

        try {
          let finalVersion = Math.max(1, Math.floor(baseVersion)) + 1;

          await executeWithRetry(
            async () => {
              await runTransaction(db, async (transaction) => {
                const remoteSnap = await transaction.get(scheduleDocRef);
                if (remoteSnap.exists()) {
                  const remoteData = remoteSnap.data() as DailyScheduleData;
                  const remoteVer =
                    typeof remoteData.version === 'number' &&
                    Number.isFinite(remoteData.version)
                      ? Math.max(1, Math.floor(remoteData.version))
                      : 1;
                  if (
                    remoteVer > baseVersion &&
                    remoteData.updatedByEmail &&
                    remoteData.updatedByEmail !== currentUser.email
                  ) {
                    throw new Error(
                      `CONCURRENT_CONFLICT:${JSON.stringify(remoteData)}`
                    );
                  }
                  finalVersion = remoteVer + 1;
                } else {
                  finalVersion = 1;
                }

                const safeUpdatedBy =
                  (currentUser.uid || 'admin').slice(0, 128) || 'admin';
                const safeUpdatedByEmail = (
                  currentUser.email || PRIMARY_ADMIN_EMAIL
                )
                  .trim()
                  .toLowerCase()
                  .slice(0, 160);
                const safeUpdatedByName = (
                  latestDay.updatedByName?.trim() ||
                  currentUser.displayName?.trim() ||
                  'مدير النظام'
                ).slice(0, 120);

                // Write BOTH schedules/{day} and publicSchedules/{day} atomically in the same transaction
                transaction.set(scheduleDocRef, {
                  dayId: dayMeta.id,
                  dayLabel: dayMeta.label,
                  dayOrder: dayMeta.order,
                  isPublic: true,
                  hasUnpublishedChanges: false,
                  version: finalVersion,
                  draftRows: sanitizedRows,
                  publishedRows: sanitizedRows,
                  updatedBy: safeUpdatedBy,
                  updatedByEmail: safeUpdatedByEmail,
                  updatedByName: safeUpdatedByName,
                  updatedAt: serverTimestamp(),
                  publishedAt: commitIso,
                });

                transaction.set(publicDocRef, {
                  dayId: dayMeta.id,
                  dayLabel: dayMeta.label,
                  dayOrder: dayMeta.order,
                  isPublic: true,
                  version: finalVersion,
                  publishedRows: sanitizedRows,
                  publishedAt: commitIso,
                  updatedAt: serverTimestamp(),
                });
              });
            },
            3,
            150
          );

          localVersionRef.current[targetDayId] = finalVersion;
          committedGenRef.current[targetDayId] = Math.max(
            committedGenRef.current[targetDayId],
            currentGen
          );

          const confirmedDay: DailyScheduleData = {
            ...latestDay,
            dayId: dayMeta.id,
            dayLabel: dayMeta.label,
            dayOrder: dayMeta.order,
            draftRows: sanitizedRows,
            publishedRows: sanitizedRows,
            hasUnpublishedChanges: false,
            isPublic: true,
            version: finalVersion,
            publishedAt: commitIso,
          };

          confirmedSchedulesRef.current = {
            ...confirmedSchedulesRef.current,
            [targetDayId]: confirmedDay,
          };

          // Apply confirmed state if no newer local edits happened while in-flight
          if (dirtyGenRef.current[targetDayId] === currentGen) {
            setSchedules((prev) => ({
              ...prev,
              [targetDayId]: confirmedDay,
            }));
          }

          if (auditMeta) {
            pendingAuditMetaRef.current[targetDayId] = null;
            try {
              await appendAuditLog(
                auditMeta.action,
                targetDayId,
                dayMeta.label,
                auditMeta.details
              );
            } catch {
              // Non-blocking
            }
          }
        } catch (err: unknown) {
          console.warn('Schedule commit error:', err);
          committedGenRef.current[targetDayId] = dirtyGenRef.current[targetDayId];
          const errMsg = err instanceof Error ? err.message : String(err);

          if (errMsg.startsWith('CONCURRENT_CONFLICT:')) {
            const remoteData = JSON.parse(
              errMsg.slice('CONCURRENT_CONFLICT:'.length)
            ) as DailyScheduleData;
            const cleanRemoteRows = filterNonEmptyRows(
              remoteData.draftRows || remoteData.publishedRows || []
            );
            setConflict({
              dayId: targetDayId,
              baseRows:
                confirmedSchedulesRef.current[targetDayId]?.draftRows || [],
              localRows: sanitizedRows,
              remoteSchedule: {
                ...remoteData,
                draftRows: cleanRemoteRows,
                publishedRows: cleanRemoteRows,
                hasUnpublishedChanges: false,
              },
              detectedAt: new Date().toISOString(),
            });
            setSaveStatus('conflict');
            saveStatusRef.current = 'conflict';
            setAuthErrorBanner(
              formatFirestoreCommitError(err, latestDay.dayLabel).message
            );
          } else {
            const formatted = formatFirestoreCommitError(
              err,
              latestDay.dayLabel
            );
            // 1. Show persistent real error banner clearly first (does not auto-dismiss)
            setAuthErrorBanner(formatted.message);
            setSaveStatus('error');
            saveStatusRef.current = 'error';

            // 2. Rollback local state to last confirmed schedule for this day
            const rollbackDay =
              confirmedSchedulesRef.current[targetDayId] || latestDay;
            setSchedules((prev) => ({
              ...prev,
              [targetDayId]: rollbackDay,
            }));
          }
        }
      })
      .finally(() => {
        inFlightCountRef.current[targetDayId] = Math.max(
          0,
          inFlightCountRef.current[targetDayId] - 1
        );
        if (!isDaySavingOrPending(targetDayId)) {
          if (
            saveStatusRef.current !== 'error' &&
            saveStatusRef.current !== 'conflict'
          ) {
            setSaveStatus('saved');
            saveStatusRef.current = 'saved';
          }
        }
      });

    daySaveQueueRef.current[targetDayId] = nextPromise;
    return nextPromise;
  };

  /**
   * Immediately flushes any pending debounced saves across all days without waiting 700ms.
   * Triggered on `pagehide` and `visibilitychange` (when document becomes hidden).
   */
  const flushAllPendingDebouncedSaves = () => {
    DAYS_LIST.forEach((d) => {
      const dayId = d.id;
      if (pendingDebounceTimerRef.current[dayId] !== null) {
        clearTimeout(pendingDebounceTimerRef.current[dayId]!);
        pendingDebounceTimerRef.current[dayId] = null;
        enqueueDayDraftCommit(dayId, dirtyGenRef.current[dayId]);
      }
    });
  };

  useEffect(() => {
    const handlePageHide = () => {
      flushAllPendingDebouncedSaves();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAllPendingDebouncedSaves();
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Functional schedule mutation handler:
   * - Builds on `schedulesRef.current[targetDayId].draftRows` using `(prevRows) => nextRows` (never stale render state).
   * - Synchronizes `draftRows` and `publishedRows` with `hasUnpublishedChanges = false`.
   * - Coalesces rapid consecutive edits with a 700ms debounce before enqueuing into `daySaveQueueRef`.
   */
  const mutateDayScheduleDraft = (
    targetDayId: DayId,
    updater: (prevRows: ScheduleRow[]) => ScheduleRow[],
    action: AuditAction,
    detailsOrBuilder: string | ((prevRows: ScheduleRow[], nextRows: ScheduleRow[]) => string),
    recordUndo = true,
    immediateFlush = false
  ) => {
    const currentDay = schedulesRef.current[targetDayId];
    if (!currentDay) return;

    const prevDraftRows = filterNonEmptyRows(currentDay.draftRows || []);

    if (recordUndo) {
      setUndoStacks((prev) => ({
        ...prev,
        [targetDayId]: [...(prev[targetDayId] || []).slice(-19), prevDraftRows],
      }));
    }

    const editorInfo = {
      uid: firebaseUserRef.current?.uid || 'local-staff',
      email: firebaseUserRef.current?.email || PRIMARY_ADMIN_EMAIL,
      displayName:
        firebaseUserRef.current?.displayName ||
        (activeRoleRef.current === 'ADMIN' ? 'مدير النظام' : 'محرر الجداول'),
    };

    const updatedDay = applyDraftMutationToDay(currentDay, updater, editorInfo);
    const resolvedDetails =
      typeof detailsOrBuilder === 'function'
        ? detailsOrBuilder(prevDraftRows, updatedDay.draftRows)
        : detailsOrBuilder;

    pendingAuditMetaRef.current[targetDayId] = {
      action,
      details: resolvedDetails,
    };

    dirtyGenRef.current[targetDayId] += 1;
    setSaveStatus('saving');
    saveStatusRef.current = 'saving';

    setSchedules((prev) => ({
      ...prev,
      [targetDayId]: updatedDay,
    }));

    if (pendingDebounceTimerRef.current[targetDayId] !== null) {
      clearTimeout(pendingDebounceTimerRef.current[targetDayId]!);
      pendingDebounceTimerRef.current[targetDayId] = null;
    }

    if (immediateFlush) {
      enqueueDayDraftCommit(targetDayId, dirtyGenRef.current[targetDayId]);
    } else {
      pendingDebounceTimerRef.current[targetDayId] = setTimeout(() => {
        pendingDebounceTimerRef.current[targetDayId] = null;
        enqueueDayDraftCommit(targetDayId, dirtyGenRef.current[targetDayId]);
      }, 700);
    }
  };

  /**
   * Super Admin Explicit First-Time Database Seeding (Requirement 1.2):
   * Checks existence using getDoc first and never overwrites existing documents.
   */
  const handleSeedDatabaseFirstTime = async () => {
    if (
      !firebaseUser ||
      firebaseUser.email?.trim().toLowerCase() !== PRIMARY_ADMIN_EMAIL
    ) {
      return;
    }

    setSeedLoading(true);
    setSeedSuccessMessage(null);

    try {
      const userEmail = firebaseUser.email.trim().toLowerCase();
      const userName = firebaseUser.displayName || 'مدير مجمع ميت عزون الطبي';

      // 1. Settings
      const settingsSnap = await getDoc(doc(db, 'settings', 'center'));
      if (!settingsSnap.exists()) {
        await setDoc(doc(db, 'settings', 'center'), {
          ...settings,
          updatedBy: firebaseUser.uid,
          updatedByEmail: userEmail,
          updatedAt: serverTimestamp(),
        });
      }

      // 2. Primary Admin User
      const adminDocId = emailToDocId(PRIMARY_ADMIN_EMAIL);
      const userSnap = await getDoc(doc(db, 'users', adminDocId));
      if (!userSnap.exists()) {
        await setDoc(doc(db, 'users', adminDocId), {
          uid: adminDocId,
          email: PRIMARY_ADMIN_EMAIL,
          displayName: userName.slice(0, 120),
          role: 'ADMIN',
          allowedDays: DAYS_LIST.map((d) => d.id),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 3. Schedules & PublicSchedules for all 7 days
      for (const day of DAYS_LIST) {
        const scheduleSnap = await getDoc(doc(db, 'schedules', day.id));
        const daySched = schedulesRef.current[day.id];
        const draftRows = filterNonEmptyRows(daySched?.draftRows || [])
          .slice(0, BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY)
          .map((r, i) => sanitizeRowForFirestore(r, i));

        if (!scheduleSnap.exists()) {
          await setDoc(doc(db, 'schedules', day.id), {
            dayId: day.id,
            dayLabel: day.label,
            dayOrder: day.order,
            isPublic: true,
            hasUnpublishedChanges: false,
            version: 1,
            draftRows,
            publishedRows: draftRows,
            updatedBy: firebaseUser.uid,
            updatedByEmail: userEmail,
            updatedByName: userName.slice(0, 120),
            updatedAt: serverTimestamp(),
            publishedAt: new Date().toISOString(),
          });
        }

        const publicSnap = await getDoc(doc(db, 'publicSchedules', day.id));
        if (!publicSnap.exists()) {
          await setDoc(doc(db, 'publicSchedules', day.id), {
            dayId: day.id,
            dayLabel: day.label,
            dayOrder: day.order,
            isPublic: true,
            version: 1,
            publishedRows: draftRows,
            publishedAt: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await appendAuditLog(
        'SEED_DATA',
        'system',
        'قاعدة البيانات',
        'تهيئة قاعدة البيانات لأول مرة بنجاح والتحقق من سلامة الجداول'
      );

      setSeedSuccessMessage('تمت تهيئة وفحص قاعدة البيانات بنجاح!');
    } catch (err) {
      console.error('Seed database error:', err);
      setAuthErrorBanner('حدث خطأ أثناء تهيئة قاعدة البيانات.');
    } finally {
      setSeedLoading(false);
    }
  };

  const currentSchedule = schedules[selectedDay];

  // Strictly require authenticated user login to edit
  const userCanEditSelectedDay =
    Boolean(firebaseUser) &&
    !isStrictPublicUrl &&
    viewMode === 'manage' &&
    canUserEditDay(activeRole, allowedDays, selectedDay);

  // Staff and visitors see the exact same rows (draftRows is the single source of truth)
  const displayedRows = filterNonEmptyRows(
    currentSchedule.draftRows || currentSchedule.publishedRows || []
  );

  // Functional row handlers building on schedulesRef.current
  const handleAddRow = (input: Omit<ScheduleRow, 'id' | 'sortOrder'>) => {
    if (!userCanEditSelectedDay) return;
    if (isCompletelyEmptyRow(input)) {
      setAuthErrorBanner(
        'لا يمكن حفظ صف فارغ تماماً (العيادة والطبيب والوقت كلها فارغة).'
      );
      return;
    }
    const currentRows = filterNonEmptyRows(
      schedulesRef.current[selectedDay]?.draftRows || []
    );
    if (currentRows.length >= BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY) {
      setAuthErrorBanner(
        `لا يمكن إضافة المزيد: الحد الأقصى المسموح به هو ${BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY} عيادة في اليوم الواحد.`
      );
      return;
    }
    mutateDayScheduleDraft(
      selectedDay,
      (prevRows) => addScheduleRow(prevRows, input),
      'CREATE_ROW',
      `إضافة عيادة «${input.clinicName}» (${input.doctorName})`
    );
  };

  const handleUpdateRow = (
    rowId: string,
    patch: Partial<Omit<ScheduleRow, 'id' | 'sortOrder'>>
  ) => {
    if (!userCanEditSelectedDay) return;
    const existingRow = (schedulesRef.current[selectedDay]?.draftRows || []).find(
      (r) => r.id === rowId
    );
    if (existingRow) {
      const candidate = { ...existingRow, ...patch };
      if (isCompletelyEmptyRow(candidate)) {
        setAuthErrorBanner(
          'لا يمكن حفظ صف فارغ تماماً (العيادة والطبيب والوقت كلها فارغة).'
        );
        return;
      }
    }
    mutateDayScheduleDraft(
      selectedDay,
      (prevRows) => updateScheduleRow(prevRows, rowId, patch),
      'UPDATE_ROW',
      `تعديل بيانات عيادة في يوم ${schedulesRef.current[selectedDay]?.dayLabel || ''}`
    );
  };

  const handleDeleteRow = (rowId: string) => {
    if (!userCanEditSelectedDay) return;
    mutateDayScheduleDraft(
      selectedDay,
      (prevRows) => deleteScheduleRow(prevRows, rowId),
      'DELETE_ROW',
      (prevRows) => {
        const target = prevRows.find((r) => r.id === rowId);
        return `حذف عيادة «${target?.clinicName || rowId}»`;
      }
    );
  };

  const handleMoveRow = (rowId: string, direction: 'up' | 'down') => {
    if (!userCanEditSelectedDay) return;
    mutateDayScheduleDraft(
      selectedDay,
      (prevRows) => moveScheduleRow(prevRows, rowId, direction),
      'REORDER_ROWS',
      `تحريك موعد ${direction === 'up' ? 'لأعلى' : 'لأسفل'}`
    );
  };

  const handleCopyRowToDay = (row: ScheduleRow, targetDayId: DayId) => {
    if (!canUserEditDay(activeRole, allowedDays, targetDayId)) return;
    if (isCompletelyEmptyRow(row)) return;
    const targetRows = filterNonEmptyRows(
      schedulesRef.current[targetDayId]?.draftRows || []
    );
    if (targetRows.length >= BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY) {
      setAuthErrorBanner(
        `لا يمكن نسخ العيادة: الحد الأقصى المسموح به هو ${BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY} عيادة في اليوم الواحد.`
      );
      return;
    }
    const sourceLabel = schedulesRef.current[selectedDay]?.dayLabel || '';
    const targetLabel = schedulesRef.current[targetDayId]?.dayLabel || '';
    mutateDayScheduleDraft(
      targetDayId,
      (prevTargetRows) => copyRowToDay(prevTargetRows, row),
      'COPY_ROW',
      `نسخ عيادة «${row.clinicName}» من يوم ${sourceLabel} إلى يوم ${targetLabel}`
    );
  };

  const handleCopyDayToDay = (targetDayId: DayId) => {
    if (!canUserEditDay(activeRole, allowedDays, targetDayId)) return;
    const sourceRows = filterNonEmptyRows(
      schedulesRef.current[selectedDay]?.draftRows || []
    );
    if (sourceRows.length > BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY) {
      setAuthErrorBanner(
        `الحد الأقصى للعيادات في اليوم الواحد هو ${BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY} عيادة.`
      );
    }
    const sourceLabel = schedulesRef.current[selectedDay]?.dayLabel || '';
    const targetLabel = schedulesRef.current[targetDayId]?.dayLabel || '';
    const copiedRows = copyFullDayRows(sourceRows, targetDayId).slice(
      0,
      BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY
    );
    mutateDayScheduleDraft(
      targetDayId,
      () => copiedRows,
      'COPY_DAY',
      `نسخ جدول يوم ${sourceLabel} بالكامل (${copiedRows.length} عيادات) إلى يوم ${targetLabel}`
    );
  };

  const handleUndo = () => {
    const stack = undoStacks[selectedDay] || [];
    if (stack.length === 0) return;
    const previousRows = filterNonEmptyRows(stack[stack.length - 1]);
    setUndoStacks((prev) => ({
      ...prev,
      [selectedDay]: prev[selectedDay].slice(0, -1),
    }));
    mutateDayScheduleDraft(
      selectedDay,
      () => previousRows,
      'UNDO',
      `التراجع عن آخر تعديل في جدول يوم ${schedulesRef.current[selectedDay]?.dayLabel || ''}`,
      false
    );
  };

  const handleClearDay = () => {
    if (!userCanEditSelectedDay) return;
    if (isDaySavingOrPending(selectedDay)) return;
    const currentDay = schedulesRef.current[selectedDay];
    const cleanRows = filterNonEmptyRows(currentDay?.draftRows || []);
    if (!currentDay || cleanRows.length === 0) return;
    setConfirmClearDayModal({
      dayId: selectedDay,
      dayLabel: currentDay.dayLabel,
      rowCount: cleanRows.length,
    });
  };

  const executeConfirmedClearDay = () => {
    if (!confirmClearDayModal) return;
    const { dayId, dayLabel, rowCount } = confirmClearDayModal;
    setConfirmClearDayModal(null);
    if (!canUserEditDay(activeRole, allowedDays, dayId)) return;
    if (isDaySavingOrPending(dayId)) return;
    mutateDayScheduleDraft(
      dayId,
      () => [],
      'DELETE_ROW',
      `مسح جميع عيادات يوم ${dayLabel} (${rowCount} عيادات)`,
      true,
      true
    );
  };

  const handleSaveSettings = async (
    newSettings: CenterSettings,
    updatedReminders?: Omit<
      ReminderSettings,
      'lastSentDate' | 'lastFbPostDate' | 'updatedBy' | 'updatedByEmail' | 'updatedAt'
    >
  ) => {
    if (activeRole !== 'ADMIN') return;
    setSettings(newSettings);
    if (updatedReminders) {
      setReminderSettings((prev) => ({
        ...prev,
        ...updatedReminders,
      }));
    }

    await appendAuditLog(
      'UPDATE_SETTINGS',
      'center',
      'إعدادات المركز',
      'تحديث إعدادات الهوية البصرية والإشعار اليومي والنشر على فيسبوك للمركز'
    );

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'settings', 'center'), {
          ...newSettings,
          updatedBy: firebaseUser.uid,
          updatedByEmail: firebaseUser.email || PRIMARY_ADMIN_EMAIL,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, 'settings/center');
        } catch {
          // Handled
        }
      }

      if (updatedReminders) {
        try {
          const reminderRef = doc(db, 'appConfig', 'reminders');
          const existingSnap = await getDoc(reminderRef);
          const reminderPayload = {
            enabled: updatedReminders.enabled,
            time: updatedReminders.time,
            timezone: 'Africa/Cairo' as const,
            targetDay: updatedReminders.targetDay,
            title: updatedReminders.title,
            body: updatedReminders.body,
            fbAutoPostEnabled: Boolean(updatedReminders.fbAutoPostEnabled),
            updatedBy: firebaseUser.uid,
            updatedByEmail: firebaseUser.email || PRIMARY_ADMIN_EMAIL,
            updatedAt: serverTimestamp(),
          };
          if (existingSnap.exists()) {
            await updateDoc(reminderRef, reminderPayload);
          } else {
            await setDoc(reminderRef, reminderPayload);
          }
        } catch (err) {
          try {
            handleFirestoreError(
              err,
              OperationType.WRITE,
              'appConfig/reminders'
            );
          } catch {
            // Handled
          }
        }
      }
    }
  };

  const handleToggleFbAutoPost = async (nextEnabled: boolean) => {
    setReminderSettings((prev) => ({
      ...prev,
      fbAutoPostEnabled: nextEnabled,
    }));

    if (!firebaseUser || activeRole !== 'ADMIN') return;

    try {
      const reminderRef = doc(db, 'appConfig', 'reminders');
      const existingSnap = await getDoc(reminderRef);
      const reminderPayload = {
        enabled: reminderSettings.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
        time: reminderSettings.time || DEFAULT_REMINDER_SETTINGS.time,
        timezone: 'Africa/Cairo' as const,
        targetDay:
          reminderSettings.targetDay === 'today' ? ('today' as const) : ('tomorrow' as const),
        title: reminderSettings.title || DEFAULT_REMINDER_SETTINGS.title,
        body: reminderSettings.body || DEFAULT_REMINDER_SETTINGS.body,
        fbAutoPostEnabled: nextEnabled,
        updatedBy: firebaseUser.uid,
        updatedByEmail: firebaseUser.email || PRIMARY_ADMIN_EMAIL,
        updatedAt: serverTimestamp(),
      };
      if (existingSnap.exists()) {
        await updateDoc(reminderRef, reminderPayload);
      } else {
        await setDoc(reminderRef, reminderPayload);
      }
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, 'appConfig/reminders');
      } catch {
        // Handled
      }
    }
  };

  const handlePublishFacebookNow = async (params?: {
    dayId?: DayId;
    dayLabel?: string;
    rows?: ScheduleRow[];
  }): Promise<{ ok: boolean; message: string; post_id?: string }> => {
    const targetDayId = params?.dayId || selectedDay;
    const targetSched = schedulesRef.current[targetDayId];
    const targetDayLabel =
      params?.dayLabel || targetSched?.dayLabel || currentSchedule.dayLabel;
    const targetRows =
      params?.rows ||
      filterNonEmptyRows(
        targetSched?.draftRows || targetSched?.publishedRows || []
      );

    try {
      const idToken = firebaseUser
        ? await firebaseUser.getIdToken()
        : 'local-preview-token';

      const response = await fetch(
        `/api/send-reminders?action=facebook-post&dayId=${encodeURIComponent(
          targetDayId
        )}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dayId: targetDayId,
            dayLabel: targetDayLabel,
            rows: targetRows,
            settings,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        const isLocalOrAiStudioPreview =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' ||
            window.location.hostname.includes('run.app'));

        if (response.status === 404 && isLocalOrAiStudioPreview && !data.error) {
          return {
            ok: false,
            message:
              'تنبيه: أنت تضغط الزر من داخل معاينة AI Studio (حيث لا تعمل دوال Vercel Serverless). بعد رفع الكود إلى GitHub، افتح رابط موقعك على Vercel (mitazoun-schedule.vercel.app) واضغط الزر هناك ليتم النشر الفوري.',
          };
        }

        return {
          ok: false,
          message:
            data.error ||
            `تعذر النشر على فيسبوك (HTTP ${response.status}). تأكد من رفع آخر تحديث لملف api/send-reminders.ts إلى GitHub وعمل Redeploy على Vercel بعد إضافة FB_PAGE_ID و FB_PAGE_ACCESS_TOKEN.`,
        };
      }

      return {
        ok: true,
        post_id: data.post_id,
        message:
          data.message ||
          `✅ تم نشر جدول عيادات يوم ${targetDayLabel} على صفحة فيسبوك بنجاح! (post_id: ${data.post_id})`,
      };
    } catch {
      return {
        ok: false,
        message:
          'تعذر الوصول إلى خادم النشر (/api/send-reminders). يعمل النشر على فيسبوك على رابط موقعك في Vercel بعد ضبط FB_PAGE_ID و FB_PAGE_ACCESS_TOKEN.',
      };
    }
  };

  const handleSendTestReminder = async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    if (!firebaseUser || activeRole !== 'ADMIN') {
      return { ok: false, message: 'غير مصرح بإرسال إشعار تجريبي.' };
    }
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/send-reminders?test=1', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          ok: false,
          message:
            data.error ||
            `تعذر الإرسال (${response.status}). تأكد من إعداد متغيرات الخادم وتفعيل الإشعارات على جهازك.`,
        };
      }
      return {
        ok: true,
        message:
          data.message ||
          `تم إرسال الإشعار التجريبي بنجاح (${data.sentCount ?? 0} جهاز).`,
      };
    } catch {
      return {
        ok: false,
        message:
          'تعذر الوصول إلى نقطة /api/send-reminders (تعمل عند الاستضافة على Vercel مع إعداد المفاتيح).',
      };
    }
  };

  // Add or update permissions in users/{emailDocId} only (Requirement 1.3)
  const handleAddOrUpdateUserByEmail = async (input: {
    email: string;
    displayName?: string;
    role: UserRole;
    allowedDays: DayId[];
    uid?: string;
  }) => {
    if (activeRole !== 'ADMIN') return;

    const cleanEmail = input.email.trim().toLowerCase();
    const docId = emailToDocId(cleanEmail);

    const existingUser = usersList.find(
      (u) => u.email.trim().toLowerCase() === cleanEmail
    );

    const updatedList = upsertUserByEmail(usersList, {
      ...input,
      email: cleanEmail,
      uid: docId,
    });
    setUsersList(updatedList);

    await appendAuditLog(
      'UPDATE_ROLE',
      'users',
      'الصلاحيات',
      `تعيين صلاحية البريد (${cleanEmail}) إلى ${
        input.role === 'ADMIN' ? 'أدمن (ADMIN)' : 'محرر (EDITOR)'
      }`
    );

    if (firebaseUser) {
      try {
        if (existingUser) {
          // Do not touch createdAt on update
          await updateDoc(doc(db, 'users', docId), {
            email: cleanEmail,
            displayName: (input.displayName || cleanEmail).slice(0, 120),
            role: input.role,
            allowedDays: input.allowedDays,
            updatedAt: serverTimestamp(),
          });
        } else {
          // New user
          await setDoc(doc(db, 'users', docId), {
            uid: docId,
            email: cleanEmail,
            displayName: (input.displayName || cleanEmail).slice(0, 120),
            role: input.role,
            allowedDays: input.allowedDays,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${docId}`);
        } catch {
          // Handled
        }
      }
    }
  };

  // Delete user from users/{emailDocId} only (Requirement 1.3)
  const handleDeleteUser = async (uidOrEmail: string) => {
    if (activeRole !== 'ADMIN') return;
    const result = deleteUserFromList(usersList, uidOrEmail);
    if (result.error || !result.deleted) return;

    setUsersList(result.updated);

    const deletedUser = result.deleted;
    const emailDocIdVal = emailToDocId(deletedUser.email);

    await appendAuditLog(
      'DELETE_USER',
      'users',
      'الصلاحيات',
      `حذف البريد الإلكتروني (${deletedUser.email}) وإلغاء صلاحيته`
    );

    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'users', emailDocIdVal));
      } catch (err) {
        try {
          handleFirestoreError(
            err,
            OperationType.DELETE,
            `users/${emailDocIdVal}`
          );
        } catch {
          // Handled
        }
      }
    }
  };

  const handleResolveConflict = (resolution: 'merge' | 'remote' | 'local') => {
    if (!conflict) return;
    let resolvedRows: ScheduleRow[] = schedulesRef.current[selectedDay]?.draftRows || [];
    if (resolution === 'merge') {
      const mergeResult = mergeConflictingRowsThreeWay(
        conflict.baseRows || [],
        conflict.localRows,
        conflict.remoteSchedule.draftRows
      );
      resolvedRows = mergeResult.success ? mergeResult.rows : conflict.localRows;
    } else if (resolution === 'remote') {
      resolvedRows = conflict.remoteSchedule.draftRows;
    } else {
      resolvedRows = conflict.localRows;
    }
    localVersionRef.current[selectedDay] =
      conflict.remoteSchedule.version || localVersionRef.current[selectedDay];
    setConflict(null);
    mutateDayScheduleDraft(
      selectedDay,
      () => resolvedRows,
      'UPDATE_ROW',
      `حل تعارض التعديلات المتزامنة`
    );
  };

  // Google sign in with popup blocked fallback (Requirement 3.5)
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (popupErr: unknown) {
      const err = popupErr as { code?: string };
      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr) {
          console.error('Redirect sign-in error:', redirectErr);
        }
      }
    }
  };

  const canUndo = (undoStacks[selectedDay]?.length || 0) > 0;
  const undoCount = undoStacks[selectedDay]?.length || 0;

  const isSuperAdminUser =
    Boolean(firebaseUser) &&
    firebaseUser?.email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;

  return (
    <div
      className="relative min-h-screen bg-gradient-to-b from-[#f3effb] via-slate-50 to-[#e8dff5] text-slate-900 flex flex-col overflow-x-clip"
      dir="rtl"
    >
      {/* App Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      >
        <ComplexBrandLogo
          className="w-[540px] max-w-[85vw] h-auto opacity-[0.04]"
          idSuffix="app-watermark"
        />
      </div>

      <OfflineIndicator />

      {/* Top Bar: Always Sticky & Visible while scrolling with Day Navigation + Undo + Compact Notifications/Auth Dropdown */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 text-white border-b-2 border-purple-800 shadow-lg backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-2 sm:px-6 py-2 flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Sidebar Menu Button — Shown when LOGGED IN as authorized staff */}
          {isStaffAuthenticated && !isStrictPublicUrl && (
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              data-testid="toggle-sidebar-btn"
              aria-label="فتح القائمة الجانبية للتعديل والصلاحيات"
              className="inline-flex items-center gap-1 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 p-2 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-black text-white shrink-0 transition cursor-pointer shadow-xs"
            >
              <Menu className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">القائمة</span>
            </button>
          )}

          {/* 7-Day Navigation Tabs */}
          <nav
            aria-label="اختيار يوم الجدول"
            className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 justify-start sm:justify-center overflow-x-auto no-scrollbar py-0.5"
          >
            {DAYS_LIST.map((day) => {
              const isSelected = selectedDay === day.id;
              const daySched = schedules[day.id];
              const rowCount = filterNonEmptyRows(
                daySched?.draftRows || daySched?.publishedRows || []
              ).length;

              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day.id);
                  }}
                  data-testid={`day-tab-${day.id}`}
                  aria-current={isSelected ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-extrabold transition shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span>{day.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                      isSelected
                        ? 'bg-slate-950/15 text-slate-950'
                        : 'bg-white/15 text-purple-100'
                    }`}
                  >
                    {rowCount}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Top Bar Controls: Header Undo + Compact Dropdown (Notifications + Login/Logout) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isStrictPublicUrl && userCanEditSelectedDay && canUndo && (
              <button
                type="button"
                onClick={handleUndo}
                data-testid="header-undo-btn"
                title={`تراجع عن آخر تعديل في جدول ${currentSchedule.dayLabel} (${undoCount} متاح)`}
                aria-label="تراجع عن آخر تعديل"
                className="inline-flex items-center justify-center gap-1 rounded-xl p-2 sm:px-3 sm:py-1.5 text-xs font-black transition cursor-pointer bg-amber-400 text-slate-950 hover:bg-amber-300 ring-2 ring-amber-300/50 shadow-sm active:scale-95 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0 text-slate-950" />
                <span className="font-black">
                  {undoCount > 0 ? `تراجع (${undoCount})` : 'تراجع'}
                </span>
              </button>
            )}

            <HeaderAccountAndNotificationsMenu
              isLoggedIn={Boolean(firebaseUser)}
              userEmail={firebaseUser?.email}
              hideAuthAction={isStrictPublicUrl}
              onLogin={handleGoogleSignIn}
              onLogout={() => signOut(auth)}
            />
          </div>
        </div>
      </header>

      {/* Slide-Over RTL Sidebar Menu — Rendered when LOGGED IN as authorized staff */}
      {isStaffAuthenticated && !isStrictPublicUrl && (
        <div
          aria-hidden={!isSidebarOpen}
          className={`fixed inset-0 z-50 transition-opacity duration-200 ${
            isSidebarOpen
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
          />

          <aside
            data-testid="app-sidebar"
            aria-label="القائمة الجانبية للتعديل والصلاحيات"
            className={`absolute top-0 right-0 h-full w-[320px] max-w-[88vw] bg-white shadow-2xl border-l border-purple-200 flex flex-col justify-between overflow-y-auto transition-transform duration-200 ${
              isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-4 space-y-5">
              {/* 1) الرأس: الشعار واسم المجمع وزر الإغلاق */}
              <div className="flex items-start justify-between gap-2 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-purple-50 p-1.5 border border-purple-200 flex items-center justify-center shrink-0 shadow-xs">
                    <ComplexBrandLogo
                      className="h-full w-auto object-contain"
                      idSuffix="sidebar-logo"
                    />
                  </div>
                  <div>
                    <h1 className="text-base font-black text-slate-950 leading-snug">
                      {settings.complexName}
                    </h1>
                    <p className="text-xs font-bold text-purple-700 mt-0.5">
                      {settings.associationName} • {settings.registrationNumber}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  data-testid="close-sidebar-btn"
                  aria-label="إغلاق القائمة الجانبية"
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2) قسم "الجدول" */}
              <div className="space-y-3">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  الجدول
                </h2>

                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode('manage')}
                    data-testid="mode-manage-btn"
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-extrabold transition cursor-pointer ${
                      viewMode === 'manage'
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>التعديل السريع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('public')}
                    data-testid="mode-public-btn"
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-extrabold transition cursor-pointer ${
                      viewMode === 'public'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>العرض العام</span>
                  </button>
                </div>

                {userCanEditSelectedDay && (
                  <button
                    type="button"
                    onClick={() => {
                      setCopyDayTarget(
                        selectedDay === 'saturday' ? 'sunday' : 'saturday'
                      );
                      setShowCopyDayModal(true);
                      setIsSidebarOpen(false);
                    }}
                    data-testid="sidebar-copy-day-btn"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-extrabold text-indigo-900 hover:bg-indigo-100 transition cursor-pointer"
                  >
                    <Copy className="w-4 h-4 shrink-0 text-indigo-700" />
                    <span>نسخ جدول اليوم إلى يوم آخر</span>
                  </button>
                )}
              </div>

              {/* 3) قسم "الإدارة" (للمدير ADMIN فقط) */}
              {activeRole === 'ADMIN' && (
                <div className="space-y-2.5 pt-3 border-t border-slate-200">
                  <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                    الإدارة
                  </h2>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUsersAuditModal('users');
                      setIsSidebarOpen(false);
                    }}
                    data-testid="open-users-btn"
                    aria-label="إدارة المستخدمين والصلاحيات"
                    className="w-full inline-flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50 px-3 py-2.5 text-xs font-extrabold text-purple-950 hover:bg-purple-100 transition cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-700" />
                      <span>إدارة المستخدمين والصلاحيات</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(true);
                      setIsSidebarOpen(false);
                    }}
                    data-testid="open-settings-btn"
                    aria-label="إعدادات المركز والإشعارات"
                    className="w-full inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Settings className="w-4 h-4 text-purple-700" />
                      <span>إعدادات المركز والإشعارات</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUsersAuditModal('audit');
                      setIsSidebarOpen(false);
                    }}
                    data-testid="open-audit-btn"
                    aria-label="سجل التدقيق"
                    className="w-full inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <History className="w-4 h-4 text-purple-700" />
                      <span>سجل التدقيق</span>
                    </span>
                  </button>
                </div>
              )}

              {/* 4) قسم "حسابي" */}
              <div className="space-y-2.5 pt-3 border-t border-slate-200">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  حسابي
                </h2>

                {firebaseUser && (
                  <div className="text-[11px] font-bold text-slate-600 truncate">
                    {firebaseUser.email}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <PWAInstallButton />
                  <NotificationToggleButton />
                </div>

                {firebaseUser && (
                  <button
                    type="button"
                    onClick={() => signOut(auth)}
                    data-testid="sidebar-logout-btn"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-extrabold text-rose-800 hover:bg-rose-100 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-2 sm:px-6 py-3 sm:py-5 space-y-3">
        {/* Error Banner */}
        {authErrorBanner && (
          <div
            role="alert"
            data-testid="auth-error-banner"
            className="mx-auto max-w-[780px] rounded-2xl bg-rose-50 border-2 border-rose-400 p-3.5 text-rose-950 shadow-sm flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs sm:text-sm font-extrabold leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{authErrorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setAuthErrorBanner(null)}
              aria-label="إغلاق تنبيه الخطأ"
              className="rounded-lg p-1 text-rose-600 hover:bg-rose-100 shrink-0"
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
            className="mx-auto max-w-[780px] rounded-2xl bg-rose-50 border-2 border-rose-300 p-4 text-rose-950 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-extrabold text-sm">
                  تنبيه: تم اكتشاف تعديل متزامن على جدول يوم {currentSchedule.dayLabel}!
                </h4>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  قام المستخدم{' '}
                  <strong>
                    {conflict.remoteSchedule.updatedByName ||
                      conflict.remoteSchedule.updatedByEmail}
                  </strong>{' '}
                  بحفظ نسخة أحدث أثناء عملك على الجدول. اختر طريقة المعالجة:
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => handleResolveConflict('merge')}
                    className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800 cursor-pointer"
                  >
                    دمج التعديلات معًا بدون فقدان
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveConflict('remote')}
                    className="rounded-lg bg-white border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100 cursor-pointer"
                  >
                    اعتماد نسخة الزميل الأحدث
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveConflict('local')}
                    className="rounded-lg bg-white border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 hover:bg-rose-100 cursor-pointer"
                  >
                    الاحتفاظ بتعديلاتي فقط
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export & Share Bar directly above the Schedule Poster */}
        <ShareAndExportBar
          dayId={selectedDay}
          dayLabel={currentSchedule.dayLabel}
          rows={displayedRows}
          settings={settings}
          posterRef={exportPosterRef}
          canManageFacebook={isStaffAuthenticated && !isStrictPublicUrl}
          fbAutoPostEnabled={Boolean(reminderSettings.fbAutoPostEnabled)}
          onToggleFbAutoPost={handleToggleFbAutoPost}
          onPublishFacebookNow={handlePublishFacebookNow}
        />

        {/* Main Workspace: Interactive Poster Table */}
        <div className="mx-auto max-w-[780px]">
          <div className="w-full">
            <SchedulePoster
              dayId={selectedDay}
              dayLabel={currentSchedule.dayLabel}
              rows={displayedRows}
              settings={settings}
              posterRef={posterRef}
              isEditable={userCanEditSelectedDay}
              isExporting={false}
              onUpdateRow={handleUpdateRow}
              onAddRow={handleAddRow}
              onDeleteRow={handleDeleteRow}
              onMoveRow={handleMoveRow}
              onCopyRowToDay={handleCopyRowToDay}
              onClearDay={handleClearDay}
              isSaving={saveStatus === 'saving'}
            />
          </div>
        </div>

        {/* Dedicated 780x975 (4:5) Pure Export Poster Node */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: '780px',
            pointerEvents: 'none',
            zIndex: -50,
          }}
        >
          <SchedulePoster
            dayId={selectedDay}
            dayLabel={currentSchedule.dayLabel}
            rows={displayedRows}
            settings={settings}
            posterRef={exportPosterRef}
            isEditable={false}
            isExporting={true}
          />
        </div>
      </main>

      {/* Clear Day Confirmation Modal stating the number of rows */}
      {confirmClearDayModal && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="confirm-clear-day-modal"
          aria-label="تأكيد مسح عيادات اليوم"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-rose-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-extrabold text-rose-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <span>تأكيد مسح عيادات يوم {confirmClearDayModal.dayLabel}</span>
              </h4>
              <button
                type="button"
                onClick={() => setConfirmClearDayModal(null)}
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-700 mb-4 leading-relaxed">
              هل أنت متأكد من مسح جميع عيادات يوم{' '}
              <strong className="text-rose-700">
                {confirmClearDayModal.dayLabel} ({confirmClearDayModal.rowCount} عيادات)
              </strong>
              ؟ سيتم تفريغ الجدول بالكامل وحفظ التعديل مباشرة للجميع، ويمكنك التراجع باستخدام زر «تراجع».
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearDayModal(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={saveStatus === 'saving'}
                onClick={executeConfirmedClearDay}
                data-testid="confirm-clear-day-submit-btn"
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                نعم، مسح ({confirmClearDayModal.rowCount}) عيادات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Full Day Confirmation Modal */}
      {showCopyDayModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد نسخ جدول اليوم"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Copy className="w-5 h-5 text-indigo-600" />
                <span>تأكيد نسخ جدول يوم {currentSchedule.dayLabel}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowCopyDayModal(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-600 mb-4 leading-relaxed">
              سيتم نسخ جميع عيادات ومواعيد يوم{' '}
              <strong className="text-slate-900">
                {currentSchedule.dayLabel} ({displayedRows.length} عيادات)
              </strong>{' '}
              إلى جدول اليوم المختار أدناه، مع استبدال عياداته الحالية (
              {filterNonEmptyRows(schedules[copyDayTarget]?.draftRows || []).length} عيادات):
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اختر اليوم المستهدف للنسخ إليه:
              </label>
              <select
                aria-label="اليوم المستهدف لنسخ الجدول"
                value={copyDayTarget}
                onChange={(e) => setCopyDayTarget(e.target.value as DayId)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900"
              >
                {DAYS_LIST.filter((d) => d.id !== selectedDay).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} (حالياً {filterNonEmptyRows(schedules[d.id]?.draftRows || []).length} عيادات)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCopyDayModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCopyDayToDay(copyDayTarget);
                  setShowCopyDayModal(false);
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
              >
                تأكيد النسخ الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Database Initial Seed Confirmation Modal (Requirement 1.2) */}
      {showSeedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد تهيئة قاعدة البيانات لأول مرة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-600" />
                <span>تهيئة قاعدة البيانات لأول مرة</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowSeedModal(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-600 mb-4 leading-relaxed">
              هذا الإجراء مخصص لمدير المجمع الأعلى لتهيئة وفحص مجموعات Firestore لأول مرة.
              يقوم الإجراء بفحص وجود المستندات الحالية (الإعدادات، أيام الأسبوع السبعة، وحساب المدير) ولا يقوم بالكتابة فوق أي مستند موجود بالفعل.
            </p>

            {seedSuccessMessage && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs font-bold text-emerald-900">
                {seedSuccessMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSeedModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                إغلاق
              </button>
              {!seedSuccessMessage && (
                <button
                  type="button"
                  disabled={seedLoading}
                  onClick={handleSeedDatabaseFirstTime}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {seedLoading ? 'جارٍ الفحص والتهيئة...' : 'تأكيد التهيئة'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && activeRole === 'ADMIN' && (
        <CenterSettingsModal
          settings={settings}
          defaultSettings={defaultSettings}
          reminderSettings={reminderSettings}
          isSuperAdminUser={isSuperAdminUser}
          onOpenSeedModal={() => setShowSeedModal(true)}
          onSave={handleSaveSettings}
          onSendTestReminder={handleSendTestReminder}
          onPublishFacebookNow={() =>
            handlePublishFacebookNow({
              dayId: selectedDay,
              dayLabel: currentSchedule.dayLabel,
              rows: displayedRows,
            })
          }
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showUsersAuditModal && activeRole && (
        <UsersAndAuditModal
          initialTab={showUsersAuditModal}
          auditLogs={auditLogs}
          users={sanitizeUsersList(usersList)}
          currentUserRole={activeRole}
          onAddOrUpdateUserByEmail={handleAddOrUpdateUserByEmail}
          onDeleteUser={handleDeleteUser}
          onClose={() => setShowUsersAuditModal(null)}
        />
      )}
    </div>
  );
}
