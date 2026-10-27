import React, { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Download,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import {
  disablePushNotifications,
  enablePushNotifications,
  FCM_TOKEN_STORAGE_KEY,
} from '../firebase';
import { ComplexBrandLogo } from './BrandLogos';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent;
    const isIOSDevice = /iphone|ipad|ipod/i.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>وضع عدم الاتصال — يتم عرض البيانات المحفوظة</span>
    </div>
  );
};

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-testid="pwa-install-btn"
        aria-label="تثبيت تطبيق مجمع ميت عزون الطبي"
        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-extrabold text-sky-900 hover:bg-sky-100 transition cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-sky-700 shrink-0" />
        <span>تثبيت التطبيق</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تثبيت تطبيق مجمع ميت عزون الطبي"
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-purple-200 text-center space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="إغلاق نافذة التثبيت"
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mx-auto w-24 h-24 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-center justify-center p-2 shadow-xs">
              <ComplexBrandLogo className="h-20 w-auto" idSuffix="pwa-modal" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              تثبيت تطبيق مجمع ميت عزون الطبي
            </h3>
            {isIOS ? (
              <p className="text-xs font-bold text-slate-600 leading-relaxed text-right bg-slate-50 p-3 rounded-xl border border-slate-200">
                1. اضغط على زر <strong>المشاركة (Share)</strong> في متصفح Safari بالأسفل.
                <br />
                2. اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
              </p>
            ) : (
              <p className="text-xs font-bold text-slate-600 leading-relaxed text-right bg-slate-50 p-3 rounded-xl border border-slate-200">
                1. افتح قائمة المتصفح العلوية <strong>(⋮)</strong> في Chrome أو Edge.
                <br />
                2. اختر <strong>تثبيت التطبيق (Install App)</strong> أو <strong>إضافة إلى الشاشة الرئيسية</strong> ليظهر بشعار مجمع ميت عزون الطبي.
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-xl bg-purple-700 py-2 text-xs font-extrabold text-white hover:bg-purple-800 transition"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
};

interface NotificationToggleButtonProps {
  isStaffAuthenticated?: boolean;
  onSaveTokenToFirestore?: (token: string) => void;
}

type NotificationState = 'enabled' | 'disabled' | 'blocked';

function resolveInitialNotificationState(): NotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'disabled';
  }
  if (Notification.permission === 'denied') {
    return 'blocked';
  }
  if (Notification.permission === 'granted') {
    try {
      const saved = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (saved) return 'enabled';
    } catch {
      // Fall through
    }
  }
  return 'disabled';
}

export const NotificationToggleButton: React.FC<
  NotificationToggleButtonProps
> = ({ isStaffAuthenticated = true, onSaveTokenToFirestore }) => {
  const { isInstalled, isIOS } = usePWAInstall();
  const [status, setStatus] = useState<NotificationState>(
    resolveInitialNotificationState
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [iosGuideMessage, setIosGuideMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStatus(resolveInitialNotificationState());
  }, []);

  if (!isStaffAuthenticated) {
    return null;
  }

  const handleToggle = async () => {
    setIosGuideMessage(null);

    // iOS check: Web Push on iOS requires PWA installed to Home Screen first
    if (isIOS && !isInstalled) {
      const msg =
        'ثبّت التطبيق من قائمة المشاركة ثم أضف إلى الشاشة الرئيسية لتفعيل الإشعارات';
      setIosGuideMessage(msg);
      setToastMsg(msg);
      return;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'denied') {
        setStatus('blocked');
        setToastMsg(
          'الإشعارات محظورة من إعدادات المتصفح. افتح إعدادات الموقع في المتصفح واسمح بالإشعارات.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      if (status === 'enabled') {
        const res = await disablePushNotifications();
        if (res.disabled) {
          setStatus('disabled');
        }
        setToastMsg(res.message);
      } else {
        const res = await enablePushNotifications();
        if (res.blocked) {
          setStatus('blocked');
        } else if (res.granted) {
          setStatus('enabled');
          if (res.token && onSaveTokenToFirestore) {
            onSaveTokenToFirestore(res.token);
          }
        } else {
          setStatus('disabled');
        }
        setToastMsg(res.message);
      }
    } finally {
      setLoading(false);
      setTimeout(() => {
        setToastMsg(null);
      }, 4500);
    }
  };

  return (
    <div className="w-full space-y-1.5">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        data-testid="notifications-toggle-btn"
        aria-label={
          status === 'enabled'
            ? 'الإشعارات مفعّلة'
            : status === 'blocked'
            ? 'محظورة من إعدادات المتصفح'
            : 'متوقفة'
        }
        className={`w-full inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
          status === 'enabled'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            : status === 'blocked'
            ? 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100'
            : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          {status === 'enabled' ? (
            <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : status === 'blocked' ? (
            <BellOff className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Bell className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>
            {loading
              ? 'جارٍ التحديث...'
              : status === 'enabled'
              ? 'الإشعارات مفعّلة'
              : status === 'blocked'
              ? 'محظورة من إعدادات المتصفح'
              : 'متوقفة'}
          </span>
        </span>
        <span className="text-[11px] font-bold opacity-80">
          {status === 'enabled' ? 'إيقاف' : 'تفعيل'}
        </span>
      </button>

      {status === 'blocked' && (
        <p
          data-testid="notifications-blocked-hint"
          className="text-[11px] font-bold text-rose-700 leading-relaxed bg-rose-50/70 rounded-lg px-2.5 py-1.5 border border-rose-200"
        >
          لإعادة التفعيل: افتح أيقونة القفل/الإعدادات بجانب عنوان الموقع في المتصفح واسمح بالإشعارات.
        </p>
      )}

      {iosGuideMessage && (
        <p
          data-testid="ios-notifications-hint"
          className="text-[11px] font-bold text-amber-900 leading-relaxed bg-amber-50 rounded-lg px-2.5 py-1.5 border border-amber-200"
        >
          {iosGuideMessage}
        </p>
      )}

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-xs rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white shadow-xl border border-purple-500/40 flex items-center gap-2"
        >
          <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
