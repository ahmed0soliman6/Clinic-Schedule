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
  ListOrdered,
  LogIn,
  LogOut,
  Menu,
  RotateCcw,
  Send,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  showLocalNotification,
} from './firebase';
import {
  AuditAction,
  AuditLogEntry,
  CenterSettings,
  ConflictInfo,
  DailyScheduleData,
  DayId,
  PublicDailyScheduleData,
  SaveStatus,
  ScheduleRow,
  UserProfile,
  UserRole,
} from './types/schedule';
import {
  DAYS_LIST,
  PRIMARY_ADMIN_EMAIL,
  addScheduleRow,
  applyDraftMutationToDay,
  applyPublishToDay,
  areRowsEqual,
  canUserEditDay,
  copyFullDayRows,
  copyRowToDay,
  deleteScheduleRow,
  deleteUserFromList,
  detectConcurrentConflict,
  emailToDocId,
  executeWithRetry,
  formatFirestoreCommitError,
  isFictionalOrBlockedEmail,
  mergeConflictingRowsThreeWay,
  moveScheduleRow,
  normalizeSortOrders,
  reorderScheduleRows,
  resolveAuthorizedUserAccess,
  sanitizeRowForFirestore,
  sanitizeUsersList,
  shouldAcceptIncomingSnapshot,
  updateScheduleRow,
  upsertUserByEmail,
} from './utils/scheduleLogic';
import { SchedulePoster } from './components/SchedulePoster';
import { ScheduleEditorPanel } from './components/ScheduleEditorPanel';
import { ShareAndExportBar } from './components/ShareAndExportBar';
import { CenterSettingsModal } from './components/CenterSettingsModal';
import { UsersAndAuditModal } from './components/UsersAndAuditModal';
import { ComplexBrandLogo } from './components/BrandLogos';
import {
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

  const [viewMode, setViewMode] = useState<'public' | 'manage'>(
    isStrictPublicUrl ? 'public' : 'manage'
  );
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Copy full day confirmation modal state
  const [showCopyDayModal, setShowCopyDayModal] = useState(false);
  const [copyDayTarget, setCopyDayTarget] = useState<DayId>('sunday');

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
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

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
                    next[d.id] = {
                      ...next[d.id],
                      publishedRows: cached.publishedSchedules[d.id],
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
            const rows: ScheduleRow[] = normalizeSortOrders(dayData?.rows || []);
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
      // Visitor: Read public approved schedule ONLY from publicSchedules/{selectedDay}
      const publicRef = doc(db, 'publicSchedules', selectedDay);
      unsubSchedule = onSnapshot(
        publicRef,
        (snap) => {
          if (snap.exists()) {
            const pubData = snap.data() as PublicDailyScheduleData;
            setSchedules((prev) => {
              const current = prev[selectedDay];
              if (!current) return prev;
              const nextDay: DailyScheduleData = {
                ...current,
                publishedRows: pubData.publishedRows || [],
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
      // Staff / Editor / Admin: Read full draft schedule from schedules/{selectedDay}
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

          setSchedules((prev) => {
            const currentLocal = prev[selectedDay];
            const conflictCheck = detectConcurrentConflict({
              localBaseVersion: localVersionRef.current[selectedDay] || 1,
              incomingRemoteSchedule: remoteDoc,
              currentUserId: auth.currentUser?.uid,
              hasLocalUnsavedChanges: isDaySavingOrPending(selectedDay),
              localDraftRows: currentLocal?.draftRows || [],
            });

            if (conflictCheck.hasConflict) {
              setConflict({
                dayId: selectedDay,
                baseRows: confirmedSchedulesRef.current[selectedDay]?.draftRows,
                localRows: currentLocal?.draftRows || [],
                remoteSchedule: remoteDoc,
                detectedAt: new Date().toISOString(),
              });
              setSaveStatus('conflict');
              saveStatusRef.current = 'conflict';
              return prev;
            }

            const normalizedRemote: DailyScheduleData = {
              ...remoteDoc,
              hasUnpublishedChanges: !areRowsEqual(
                remoteDoc.draftRows || [],
                remoteDoc.publishedRows || []
              ),
            };

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

    return () => {
      unsubSettings();
      unsubSchedule();
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
   * Enqueues an atomic Firestore transaction for `schedules/{targetDayId}` onto the per-day promise queue.
   * - Never starts before the previous save for `targetDayId` finishes (Requirement 1).
   * - Writes ONLY `draftRows` and `hasUnpublishedChanges` without touching `publishedRows` or `publicSchedules` (Requirement 5).
   * - Uses `executeWithRetry` (up to 3 retries with exponential backoff on `aborted`/`unavailable`) and NO `setDoc` fallback (Requirement 3).
   * - Displays the real error in `authErrorBanner` (persistent until user closes) before rolling back to `confirmedSchedulesRef` (Requirement 3).
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

        const currentUser = firebaseUserRef.current;
        if (!currentUser) {
          committedGenRef.current[targetDayId] = currentGen;
          confirmedSchedulesRef.current = {
            ...confirmedSchedulesRef.current,
            [targetDayId]: latestDay,
          };
          return;
        }

        const sanitizedDraft = normalizeSortOrders(latestDay.draftRows || []).map(
          (r, i) => sanitizeRowForFirestore(r, i)
        );
        const baseVersion =
          localVersionRef.current[targetDayId] ||
          confirmedSchedulesRef.current[targetDayId]?.version ||
          1;
        const scheduleDocRef = doc(db, 'schedules', targetDayId);
        const auditMeta = pendingAuditMetaRef.current[targetDayId];

        try {
          let finalVersion = baseVersion + 1;
          let finalPublishedRows = latestDay.publishedRows || [];
          let finalPublishedAt =
            latestDay.publishedAt || new Date().toISOString();

          await executeWithRetry(
            async () => {
              await runTransaction(db, async (transaction) => {
                const remoteSnap = await transaction.get(scheduleDocRef);
                if (remoteSnap.exists()) {
                  const remoteData = remoteSnap.data() as DailyScheduleData;
                  const remoteVer = remoteData.version || 1;
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
                  finalPublishedRows = normalizeSortOrders(
                    remoteData.publishedRows || []
                  ).map((r, i) => sanitizeRowForFirestore(r, i));
                  finalPublishedAt =
                    remoteData.publishedAt || finalPublishedAt;
                } else {
                  finalVersion = 1;
                }

                const hasDiff = !areRowsEqual(
                  sanitizedDraft,
                  finalPublishedRows
                );

                transaction.set(scheduleDocRef, {
                  dayId: latestDay.dayId,
                  dayLabel: latestDay.dayLabel,
                  dayOrder: latestDay.dayOrder,
                  isPublic: true,
                  hasUnpublishedChanges: hasDiff,
                  version: finalVersion,
                  draftRows: sanitizedDraft,
                  publishedRows: finalPublishedRows,
                  updatedBy: currentUser.uid,
                  updatedByEmail: currentUser.email || PRIMARY_ADMIN_EMAIL,
                  updatedByName: (
                    latestDay.updatedByName ||
                    currentUser.displayName ||
                    'مدير النظام'
                  ).slice(0, 120),
                  updatedAt: serverTimestamp(),
                  publishedAt: finalPublishedAt,
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
            draftRows: sanitizedDraft,
            publishedRows: finalPublishedRows,
            hasUnpublishedChanges: !areRowsEqual(
              sanitizedDraft,
              finalPublishedRows
            ),
            version: finalVersion,
            publishedAt: finalPublishedAt,
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
                latestDay.dayLabel,
                auditMeta.details
              );
            } catch {
              // Non-blocking
            }
          }
        } catch (err: unknown) {
          console.error('Schedule commit failed:', err);
          committedGenRef.current[targetDayId] = dirtyGenRef.current[targetDayId];
          const errMsg = err instanceof Error ? err.message : String(err);

          if (errMsg.startsWith('CONCURRENT_CONFLICT:')) {
            const remoteData = JSON.parse(
              errMsg.slice('CONCURRENT_CONFLICT:'.length)
            ) as DailyScheduleData;
            setConflict({
              dayId: targetDayId,
              baseRows:
                confirmedSchedulesRef.current[targetDayId]?.draftRows || [],
              localRows: sanitizedDraft,
              remoteSchedule: remoteData,
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
   * Functional draft mutation handler (Requirements 1, 4, 5):
   * - Builds on `schedulesRef.current[targetDayId].draftRows` using `(prevRows) => nextRows` (never stale render state).
   * - Updates ONLY `draftRows` and `hasUnpublishedChanges` (never touches `publishedRows` or `publicSchedules`).
   * - Coalesces rapid consecutive edits with a 700ms debounce before enqueuing into `daySaveQueueRef`.
   */
  const mutateDayScheduleDraft = (
    targetDayId: DayId,
    updater: (prevRows: ScheduleRow[]) => ScheduleRow[],
    action: AuditAction,
    detailsOrBuilder: string | ((prevRows: ScheduleRow[], nextRows: ScheduleRow[]) => string),
    recordUndo = true
  ) => {
    const currentDay = schedulesRef.current[targetDayId];
    if (!currentDay) return;

    const prevDraftRows = currentDay.draftRows || [];

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

    pendingDebounceTimerRef.current[targetDayId] = setTimeout(() => {
      pendingDebounceTimerRef.current[targetDayId] = null;
      enqueueDayDraftCommit(targetDayId, dirtyGenRef.current[targetDayId]);
    }, 700);
  };

  /**
   * "اعتماد ونشر التعديلات" (Requirements 3 & 5):
   * - Cancels any pending debounce timer for `selectedDay` and chains onto `daySaveQueueRef.current[selectedDay]`.
   * - Copies `draftRows` to `publishedRows`, sets `hasUnpublishedChanges: false`,
   *   and writes BOTH `schedules/{selectedDay}` and `publicSchedules/{selectedDay}` atomically in ONE `runTransaction`.
   * - Retries up to 3 times on `aborted`/`unavailable` without any `setDoc` fallback.
   */
  const handlePublishDay = async () => {
    if (!userCanEditSelectedDay) return;
    const targetDayId = selectedDay;

    // Cancel any pending debounce timer so publish commits the latest draft in a single atomic transaction
    if (pendingDebounceTimerRef.current[targetDayId] !== null) {
      clearTimeout(pendingDebounceTimerRef.current[targetDayId]!);
      pendingDebounceTimerRef.current[targetDayId] = null;
    }

    const currentDay = schedulesRef.current[targetDayId];
    if (!currentDay) return;

    const publishTimestamp = new Date().toISOString();
    const baseVersion =
      localVersionRef.current[targetDayId] || currentDay.version || 1;
    const editorInfo = {
      uid: firebaseUserRef.current?.uid || 'local-staff',
      email: firebaseUserRef.current?.email || PRIMARY_ADMIN_EMAIL,
      displayName:
        firebaseUserRef.current?.displayName ||
        (activeRoleRef.current === 'ADMIN' ? 'مدير النظام' : 'محرر الجداول'),
    };

    const optimisticPublished = applyPublishToDay(
      currentDay,
      publishTimestamp,
      baseVersion + 1,
      editorInfo
    );

    dirtyGenRef.current[targetDayId] += 1;
    const publishGen = dirtyGenRef.current[targetDayId];

    setSaveStatus('saving');
    saveStatusRef.current = 'saving';
    setSchedules((prev) => ({
      ...prev,
      [targetDayId]: optimisticPublished,
    }));

    if (!firebaseUserRef.current) {
      committedGenRef.current[targetDayId] = publishGen;
      confirmedSchedulesRef.current = {
        ...confirmedSchedulesRef.current,
        [targetDayId]: optimisticPublished,
      };
      setSaveStatus('saved');
      saveStatusRef.current = 'saved';
      return;
    }

    inFlightCountRef.current[targetDayId] += 1;

    const nextPromise = daySaveQueueRef.current[targetDayId]
      .catch(() => {
        // Keep queue alive
      })
      .then(async () => {
        const latestDay = schedulesRef.current[targetDayId];
        const currentUser = firebaseUserRef.current;
        if (!latestDay || !currentUser) return;

        const sanitizedRows = normalizeSortOrders(
          latestDay.draftRows || []
        ).map((r, i) => sanitizeRowForFirestore(r, i));

        const scheduleDocRef = doc(db, 'schedules', targetDayId);
        const publicDocRef = doc(db, 'publicSchedules', targetDayId);
        let finalVersion =
          (localVersionRef.current[targetDayId] || baseVersion) + 1;

        try {
          await executeWithRetry(
            async () => {
              await runTransaction(db, async (transaction) => {
                const remoteSnap = await transaction.get(scheduleDocRef);
                if (remoteSnap.exists()) {
                  const remoteData = remoteSnap.data() as DailyScheduleData;
                  finalVersion = (remoteData.version || 1) + 1;
                } else {
                  finalVersion = 1;
                }

                transaction.set(scheduleDocRef, {
                  dayId: latestDay.dayId,
                  dayLabel: latestDay.dayLabel,
                  dayOrder: latestDay.dayOrder,
                  isPublic: true,
                  hasUnpublishedChanges: false,
                  version: finalVersion,
                  draftRows: sanitizedRows,
                  publishedRows: sanitizedRows,
                  updatedBy: currentUser.uid,
                  updatedByEmail: currentUser.email || PRIMARY_ADMIN_EMAIL,
                  updatedByName: editorInfo.displayName.slice(0, 120),
                  updatedAt: serverTimestamp(),
                  publishedAt: publishTimestamp,
                });

                transaction.set(publicDocRef, {
                  dayId: latestDay.dayId,
                  dayLabel: latestDay.dayLabel,
                  dayOrder: latestDay.dayOrder,
                  isPublic: true,
                  publishedRows: sanitizedRows,
                  publishedAt: publishTimestamp,
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
            publishGen
          );

          const confirmedPublished: DailyScheduleData = {
            ...latestDay,
            draftRows: sanitizedRows,
            publishedRows: sanitizedRows,
            hasUnpublishedChanges: false,
            version: finalVersion,
            publishedAt: publishTimestamp,
          };

          confirmedSchedulesRef.current = {
            ...confirmedSchedulesRef.current,
            [targetDayId]: confirmedPublished,
          };

          setSchedules((prev) => ({
            ...prev,
            [targetDayId]: confirmedPublished,
          }));

          await showLocalNotification(
            `تحديث جدول يوم ${latestDay.dayLabel}`,
            `تم اعتماد ونشر جدول عيادات يوم ${latestDay.dayLabel} (${sanitizedRows.length} عيادات) للجمهور بنجاح.`
          );

          try {
            await appendAuditLog(
              'PUBLISH_DAY',
              targetDayId,
              latestDay.dayLabel,
              `اعتماد ونشر جدول يوم ${latestDay.dayLabel} للجمهور (${sanitizedRows.length} عيادات)`
            );
          } catch {
            // Non-blocking
          }
        } catch (err: unknown) {
          console.error('Publish failed:', err);
          committedGenRef.current[targetDayId] = dirtyGenRef.current[targetDayId];
          const formatted = formatFirestoreCommitError(err, latestDay.dayLabel);
          setAuthErrorBanner(formatted.message);
          setSaveStatus('error');
          saveStatusRef.current = 'error';

          const rollbackDay =
            confirmedSchedulesRef.current[targetDayId] || currentDay;
          setSchedules((prev) => ({
            ...prev,
            [targetDayId]: rollbackDay,
          }));
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
    await nextPromise;
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
        const draftRows = normalizeSortOrders(daySched?.draftRows || []).map(
          (r, i) => sanitizeRowForFirestore(r, i)
        );

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

  const displayedRows =
    viewMode === 'public' || isStrictPublicUrl || !firebaseUser
      ? currentSchedule.publishedRows
      : currentSchedule.draftRows;

  // Functional row handlers building on schedulesRef.current (Requirement 1)
  const handleAddRow = (input: Omit<ScheduleRow, 'id' | 'sortOrder'>) => {
    if (!userCanEditSelectedDay) return;
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

  const handleReorderRows = (fromIndex: number, toIndex: number) => {
    if (!userCanEditSelectedDay) return;
    mutateDayScheduleDraft(
      selectedDay,
      (prevRows) => reorderScheduleRows(prevRows, fromIndex, toIndex),
      'REORDER_ROWS',
      `إعادة ترتيب الصفوف من #${fromIndex + 1} إلى #${toIndex + 1}`
    );
  };

  const handleCopyRowToDay = (row: ScheduleRow, targetDayId: DayId) => {
    if (!canUserEditDay(activeRole, allowedDays, targetDayId)) return;
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
    const sourceRows = schedulesRef.current[selectedDay]?.draftRows || [];
    const sourceLabel = schedulesRef.current[selectedDay]?.dayLabel || '';
    const targetLabel = schedulesRef.current[targetDayId]?.dayLabel || '';
    const copiedRows = copyFullDayRows(sourceRows, targetDayId);
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
    const previousRows = stack[stack.length - 1];
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
    if (!currentDay || currentDay.draftRows.length === 0) return;
    if (
      window.confirm(
        `هل تريد مسح جميع عيادات مسودة يوم ${currentDay.dayLabel} (${currentDay.draftRows.length} عيادات)؟ لن يتأثر الجدول المنشور للجمهور إلا بعد الضغط على «اعتماد ونشر»، ويمكنك التراجع باستخدام زر «تراجع».`
      )
    ) {
      mutateDayScheduleDraft(
        selectedDay,
        () => [],
        'DELETE_ROW',
        `مسح جميع عيادات مسودة يوم ${currentDay.dayLabel} (${currentDay.draftRows.length} عيادات)`
      );
    }
  };

  const handleSaveSettings = async (newSettings: CenterSettings) => {
    if (activeRole !== 'ADMIN') return;
    setSettings(newSettings);
    await appendAuditLog(
      'UPDATE_SETTINGS',
      'center',
      'إعدادات المركز',
      'تحديث إعدادات الهوية البصرية وأرقام التواصل للمركز'
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

      {/* Top Bar: Always Sticky & Visible while scrolling with Day Navigation + Undo + Login/Logout */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-purple-950 via-indigo-950 to-purple-950 text-white border-b-2 border-purple-800 shadow-lg backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-2.5 sm:px-6 py-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {/* Sidebar Menu Button — Shown ONLY when LOGGED IN as ADMIN */}
          {Boolean(firebaseUser) && activeRole === 'ADMIN' && !isStrictPublicUrl && (
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
            className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-start sm:justify-center overflow-x-auto no-scrollbar py-0.5"
          >
            {DAYS_LIST.map((day) => {
              const isSelected = selectedDay === day.id;
              const daySched = schedules[day.id];
              const rowCount =
                viewMode === 'public' || isStrictPublicUrl || !firebaseUser
                  ? daySched?.publishedRows?.length || 0
                  : daySched?.draftRows?.length || 0;
              const hasDraftDiff =
                viewMode === 'manage' &&
                Boolean(firebaseUser) &&
                daySched?.hasUnpublishedChanges;

              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day.id);
                    setSelectedRowId(null);
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
                  {hasDraftDiff && (
                    <span
                      title="توجد مسودة غير منشورة لهذا اليوم"
                      className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-purple-950"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Top Bar Controls: Header Undo + Login/Logout */}
          {!isStrictPublicUrl && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Persistent Header Undo Button — Shown ONLY when an edit/action has been performed */}
              {userCanEditSelectedDay && canUndo && (
                <button
                  type="button"
                  onClick={handleUndo}
                  data-testid="header-undo-btn"
                  title={`تراجع عن آخر تعديل في جدول ${currentSchedule.dayLabel} (${undoCount} متاح)`}
                  aria-label="تراجع عن آخر تعديل"
                  className="inline-flex items-center justify-center gap-1 rounded-xl p-2 sm:px-3 sm:py-1.5 text-xs font-black transition cursor-pointer bg-amber-400 text-slate-950 hover:bg-amber-300 ring-2 ring-amber-300/50 shadow-sm active:scale-95 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0 text-slate-950" />
                  <span className="font-black">{undoCount > 0 ? `تراجع (${undoCount})` : 'تراجع'}</span>
                </button>
              )}

              {firebaseUser ? (
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  data-testid="top-logout-btn"
                  title="تسجيل الخروج"
                  aria-label="تسجيل الخروج"
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-600/90 hover:bg-rose-600 border border-rose-400/40 p-2 sm:px-2.5 sm:py-1.5 text-xs font-extrabold text-white transition cursor-pointer shadow-xs shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">خروج</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  data-testid="top-login-btn"
                  title="تسجيل الدخول"
                  aria-label="تسجيل الدخول"
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 p-2 sm:px-2.5 sm:py-1.5 text-xs font-extrabold text-white transition cursor-pointer shadow-xs shrink-0"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">دخول</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Slide-Over RTL Sidebar Menu — Rendered ONLY when LOGGED IN as ADMIN */}
      {Boolean(firebaseUser) && activeRole === 'ADMIN' && !isStrictPublicUrl && (
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
              {/* 1. Official Complex Logo & Name */}
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

              {/* 2. Schedule Editing Controls */}
              <div className="space-y-3">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  التعديل وإدارة الجدول
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
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-2.5 space-y-2">
                    <div
                      data-testid="save-status-indicator"
                      className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>
                        {saveStatus === 'saving'
                          ? 'جارٍ الحفظ الفوري...'
                          : saveStatus === 'error'
                          ? 'تعذر الحفظ (راجع الاتصال)'
                          : 'حفظ فوري تلقائي على Firestore'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handlePublishDay();
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold text-white shadow-xs transition cursor-pointer ${
                        currentSchedule.hasUnpublishedChanges
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-purple-700 hover:bg-purple-800'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {currentSchedule.hasUnpublishedChanges
                          ? 'اعتماد ونشر التعديلات للجمهور'
                          : 'معتمد ومنشور للجمهور'}
                      </span>
                    </button>
                  </div>
                )}

                {userCanEditSelectedDay && (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdvancedPanel(!showAdvancedPanel);
                        setIsSidebarOpen(false);
                      }}
                      className="w-full inline-flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <ListOrdered className="w-4 h-4 text-purple-700" />
                        <span>
                          {showAdvancedPanel
                            ? 'إخفاء قائمة الصفوف المتقدمة'
                            : 'قائمة الصفوف (تحرير متقدم)'}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCopyDayTarget(
                          selectedDay === 'saturday' ? 'sunday' : 'saturday'
                        );
                        setShowCopyDayModal(true);
                        setIsSidebarOpen(false);
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-extrabold text-indigo-900 hover:bg-indigo-100 transition cursor-pointer"
                    >
                      <Copy className="w-4 h-4 shrink-0 text-indigo-700" />
                      <span>نسخ جدول اليوم بالكامل إلى يوم آخر</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Permissions & Account */}
              <div className="space-y-2.5 pt-3 border-t border-slate-200">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  الصلاحيات وإدارة المستخدمين
                </h2>

                <div className="flex items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Shield className="w-4 h-4 text-purple-700" />
                    <span>الدور الحالي:</span>
                  </span>
                  <select
                    id="role-switcher"
                    aria-label="تبديل دور الصلاحية"
                    value={activeRole || 'ADMIN'}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setActiveRole(nextRole);
                      if (nextRole === 'EDITOR') {
                        setViewMode('manage');
                        setIsSidebarOpen(false);
                      }
                    }}
                    className="bg-transparent text-xs font-black text-purple-950 focus:outline-none cursor-pointer"
                  >
                    <option value="ADMIN">ADMIN (مدير)</option>
                    <option value="EDITOR">EDITOR (محرر)</option>
                  </select>
                </div>

                {activeRole === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUsersAuditModal('users');
                      setIsSidebarOpen(false);
                    }}
                    data-testid="open-users-btn"
                    aria-label="إدارة البريد والصلاحيات"
                    className="w-full inline-flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50 px-3 py-2.5 text-xs font-extrabold text-purple-950 hover:bg-purple-100 transition cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-700" />
                      <span>إدارة البريد والصلاحيات (أدمن / محرر)</span>
                    </span>
                  </button>
                )}

                {(activeRole === 'ADMIN' || activeRole === 'EDITOR') && (
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
                      <span>سجل التدقيق والتعديلات</span>
                    </span>
                  </button>
                )}

                {activeRole === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(true);
                      setIsSidebarOpen(false);
                    }}
                    data-testid="open-settings-btn"
                    aria-label="إعدادات المركز"
                    className="w-full inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-extrabold text-slate-800 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Settings className="w-4 h-4 text-purple-700" />
                      <span>إعدادات المركز وأرقام التواصل</span>
                    </span>
                  </button>
                )}

                {/* Explicit Super Admin First-Time Database Seed Button (Requirement 1.2) */}
                {isSuperAdminUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSeedModal(true);
                      setIsSidebarOpen(false);
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
                )}
              </div>

              {/* 4. App & Account */}
              <div className="space-y-2.5 pt-3 border-t border-slate-200">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  التطبيق والحساب
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <PWAInstallButton />
                  <NotificationToggleButton />
                </div>

                {firebaseUser ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-bold text-slate-600 truncate">
                      مسجل باسم: {firebaseUser.email}
                    </div>
                    <button
                      type="button"
                      onClick={() => signOut(auth)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-extrabold text-rose-800 hover:bg-rose-100 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-extrabold text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>تسجيل الدخول بحساب جوجل</span>
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
        />

        {/* Main Workspace: Interactive Poster Table */}
        <div
          className={
            showAdvancedPanel && userCanEditSelectedDay
              ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
              : 'mx-auto max-w-[780px]'
          }
        >
          {showAdvancedPanel && userCanEditSelectedDay && (
            <div className="lg:col-span-5 order-2 lg:order-1">
              <ScheduleEditorPanel
                dayId={selectedDay}
                dayLabel={currentSchedule.dayLabel}
                draftRows={currentSchedule.draftRows}
                publishedRows={currentSchedule.publishedRows}
                hasUnpublishedChanges={currentSchedule.hasUnpublishedChanges}
                saveStatus={saveStatus}
                canUndo={canUndo}
                undoCount={undoCount}
                selectedRowId={selectedRowId}
                onSelectRow={setSelectedRowId}
                onAddRow={handleAddRow}
                onUpdateRow={handleUpdateRow}
                onDeleteRow={handleDeleteRow}
                onMoveRow={handleMoveRow}
                onReorderRows={handleReorderRows}
                onCopyRowToDay={handleCopyRowToDay}
                onCopyDayToDay={handleCopyDayToDay}
                onUndo={handleUndo}
                onPublishDay={handlePublishDay}
                conflict={conflict}
                onResolveConflict={handleResolveConflict}
              />
            </div>
          )}

          <div
            className={
              showAdvancedPanel && userCanEditSelectedDay
                ? 'lg:col-span-7 order-1 lg:order-2'
                : 'w-full'
            }
          >
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
              hasUnpublishedChanges={currentSchedule.hasUnpublishedChanges}
              onPublishDay={handlePublishDay}
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

      {/* Copy Full Day Confirmation Modal (Requirement 3.3) */}
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
                {currentSchedule.dayLabel} ({currentSchedule.draftRows.length} عيادات)
              </strong>{' '}
              إلى مسودة اليوم المختار أدناه، مع استبدال عياداته الحالية (
              {schedules[copyDayTarget]?.draftRows?.length || 0} عيادات):
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
                    {d.label} (حالياً {schedules[d.id]?.draftRows?.length || 0} عيادات)
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
          onSave={handleSaveSettings}
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
