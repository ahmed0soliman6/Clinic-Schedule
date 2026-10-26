import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  setDoc,
} from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  isSupported as isMessagingSupported,
  onMessage,
} from 'firebase/messaging';
import firebaseAppletConfig from '../firebase-applet-config.json';

export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BAfoL-06-pPKxzS7IcRIKa4bxuSCcmo7o6PE7tWpf9Ov1AjCfBGQPMF0KiRPYQaVGBkhTIvfWvL7qqCayFIE0Y0';

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
  'ai-studio-a7f07dfc-95fa-4891-9ea2-3134e232e78b';

// Primary provisioned Firestore database
export const db = getFirestore(app, resolvedDatabaseId);

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

/**
 * Request Web Push / FCM Notification permission and register with the VAPID key
 */
export async function enablePushNotifications(): Promise<{
  granted: boolean;
  token?: string;
  message: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      message: 'هذا المتصفح لا يدعم إشعارات الويب المباشرة.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        granted: false,
        message: 'يرجى السماح بالإشعارات من إعدادات المتصفح لتلقي تنبيهات المواعيد.',
      };
    }

    let fcmToken: string | undefined;
    const supported = await isMessagingSupported().catch(() => false);
    if (supported && 'serviceWorker' in navigator) {
      try {
        const swReg = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
          { scope: '/' }
        );
        const messaging = getMessaging(app);
        fcmToken = await getToken(messaging, {
          vapidKey: VAPID_PUBLIC_KEY,
          serviceWorkerRegistration: swReg,
        });

        onMessage(messaging, (payload) => {
          const title =
            payload.notification?.title || 'مجمع ميت عزون الطبي';
          const body =
            payload.notification?.body ||
            'تم تحديث جدول عيادات مجمع ميت عزون الطبي';
          showLocalNotification(title, body);
        });
      } catch {
        // Fallback to local Service Worker / Browser Notification if in preview iframe
      }
    }

    await showLocalNotification(
      'مجمع ميت عزون الطبي',
      'تم تفعيل إشعارات تحديث جداول العيادات الفورية بنجاح!'
    );

    return {
      granted: true,
      token: fcmToken,
      message: 'تم تفعيل الإشعارات الفورية بنجاح!',
    };
  } catch {
    return {
      granted: false,
      message: 'تعذر تفعيل الإشعارات في هذا المتصفح حالياً.',
    };
  }
}

export async function showLocalNotification(
  title: string,
  body: string
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
