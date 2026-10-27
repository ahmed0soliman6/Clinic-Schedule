import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported as isMessagingSupported,
  onMessage,
} from 'firebase/messaging';
import firebaseAppletConfig from '../firebase-applet-config.json';
import { computeTokenDocId } from './utils/reminderLogic';

export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BAfoL-06-pPKxzS7IcRIKa4bxuSCcmo7o6PE7tWpf9Ov1AjCfBGQPMF0KiRPYQaVGBkhTIvfWvL7qqCayFIE0Y0';

export const FCM_TOKEN_STORAGE_KEY = 'meet_azzoun_fcm_token_v1';

const resolvedConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    firebaseAppletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    firebaseAppletConfig.messagingSenderId,
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    firebaseAppletConfig.appId ||
    '1:771790865724:web:a9ca5db6f5e3a2de440a39',
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
    firebaseAppletConfig.measurementId ||
    'G-5EFDKNM38Q',
};

export const app = initializeApp(resolvedConfig);

export const resolvedDatabaseId =
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  firebaseAppletConfig.firestoreDatabaseId ||
  '(default)';

// Primary provisioned Firestore database: connects to (default) shown in console
export const db =
  resolvedDatabaseId &&
  resolvedDatabaseId !== '(default)' &&
  resolvedDatabaseId !== 'default'
    ? getFirestore(app, resolvedDatabaseId)
    : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firebase Analytics safely in browser environments
if (typeof window !== 'undefined') {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    })
    .catch(() => {
      // Ignore analytics errors in restricted environments
    });
}

let foregroundMessageListenerRegistered = false;

function ensureForegroundMessageListenerOnce() {
  if (foregroundMessageListenerRegistered || typeof window === 'undefined') {
    return;
  }
  isMessagingSupported()
    .then((supported) => {
      if (!supported || foregroundMessageListenerRegistered) return;
      const messaging = getMessaging(app);
      foregroundMessageListenerRegistered = true;
      onMessage(messaging, (payload) => {
        const data = payload.data || {};
        const title =
          data.title ||
          payload.notification?.title ||
          'تذكير جدول العيادات — مجمع ميت عزون الطبي';
        const body =
          data.body ||
          payload.notification?.body ||
          'يرجى مراجعة وتجهيز جدول العيادات ومشاركته.';
        const url = data.url || '/';
        showLocalNotification(title, body, url);
      });
    })
    .catch(() => {
      // Ignore in unsupported environments
    });
}

/**
 * Request Web Push / FCM Notification permission, get token via navigator.serviceWorker.ready,
 * and persist in Firestore `fcmTokens/{sha256(token)}`.
 */
export async function enablePushNotifications(): Promise<{
  granted: boolean;
  blocked?: boolean;
  token?: string;
  docId?: string;
  message: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      message: 'هذا المتصفح لا يدعم إشعارات الويب المباشرة.',
    };
  }

  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    return {
      granted: false,
      message: 'يرجى تسجيل الدخول بحساب موظف معتمد لتفعيل الإشعارات.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') {
      return {
        granted: false,
        blocked: true,
        message:
          'الإشعارات محظورة من إعدادات المتصفح. افتح إعدادات الموقع في المتصفح واسمح بالإشعارات ثم أعد المحاولة.',
      };
    }
    if (permission !== 'granted') {
      return {
        granted: false,
        message: 'لم يتم منح إذن الإشعارات.',
      };
    }

    const supported = await isMessagingSupported().catch(() => false);
    if (!supported || !('serviceWorker' in navigator)) {
      return {
        granted: false,
        message: 'خدمة إشعارات الخلفية غير مدعومة في هذا المتصفح حالياً.',
      };
    }

    const swReg = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const fcmToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!fcmToken) {
      return {
        granted: false,
        message: 'تعذر استخراج رمز الإشعارات (FCM Token) من المتصفح.',
      };
    }

    ensureForegroundMessageListenerOnce();

    const docId = await computeTokenDocId(fcmToken);
    const cleanEmail = currentUser.email.trim().toLowerCase();
    const platform =
      (navigator.userAgent || 'web').slice(0, 120) || 'web';

    await setDoc(doc(db, 'fcmTokens', docId), {
      token: fcmToken,
      email: cleanEmail,
      uid: currentUser.uid,
      platform,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      localStorage.setItem(
        FCM_TOKEN_STORAGE_KEY,
        JSON.stringify({ token: fcmToken, docId, email: cleanEmail })
      );
    } catch {
      // Ignore storage error
    }

    return {
      granted: true,
      token: fcmToken,
      docId,
      message: 'تم تفعيل الإشعارات اليومية وحفظ جهازك بنجاح!',
    };
  } catch (err) {
    console.warn('Enable push notifications error:', err);
    return {
      granted: false,
      message:
        'تعذر تفعيل الإشعارات حالياً. تأكد من فتح التطبيق عبر رابط HTTPS الرسمي أو تثبيته.',
    };
  }
}

/**
 * Disables push notifications for this device: deletes `fcmTokens/{docId}` from Firestore
 * and calls `deleteToken(messaging)`.
 */
export async function disablePushNotifications(): Promise<{
  disabled: boolean;
  message: string;
}> {
  try {
    let savedDocId: string | null = null;
    try {
      const raw = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { token?: string; docId?: string };
        if (parsed.docId) {
          savedDocId = parsed.docId;
        } else if (parsed.token) {
          savedDocId = await computeTokenDocId(parsed.token);
        }
      }
    } catch {
      // Ignore
    }

    const supported = await isMessagingSupported().catch(() => false);
    if (supported && 'serviceWorker' in navigator) {
      try {
        const messaging = getMessaging(app);
        if (!savedDocId) {
          const swReg = await navigator.serviceWorker.ready;
          const currentToken = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: swReg,
          }).catch(() => '');
          if (currentToken) {
            savedDocId = await computeTokenDocId(currentToken);
          }
        }
        await deleteToken(messaging).catch(() => false);
      } catch {
        // Ignore messaging delete error
      }
    }

    if (savedDocId && auth.currentUser) {
      await deleteDoc(doc(db, 'fcmTokens', savedDocId)).catch(() => undefined);
    }

    try {
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore
    }

    return {
      disabled: true,
      message: 'تم إيقاف الإشعارات لهذا الجهاز وحذف رمز التنبيه.',
    };
  } catch {
    return {
      disabled: false,
      message: 'حدث خطأ أثناء إيقاف الإشعارات.',
    };
  }
}

export async function showLocalNotification(
  title: string,
  body: string,
  url = '/'
): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'ar',
          data: { url },
        });
        return;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'ar',
    });
  } catch {
    // Ignore notification display error
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch {
    // Ignore test connection error in preview environments or offline state
  }
}

testConnection();
