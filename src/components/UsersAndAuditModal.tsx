import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  CloudUpload,
  Copy,
  History,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AuditLogEntry, DayId, UserProfile, UserRole } from '../types/schedule';
import {
  DAYS_LIST,
  PRIMARY_ADMIN_EMAIL,
  isValidEmailAddress,
} from '../utils/scheduleLogic';

interface UsersAndAuditModalProps {
  initialTab?: 'audit' | 'users';
  auditLogs: AuditLogEntry[];
  users: UserProfile[];
  currentUserRole: UserRole;
  onAddOrUpdateUserByEmail: (input: {
    email: string;
    displayName?: string;
    role: UserRole;
    allowedDays: DayId[];
    uid?: string;
  }) => void;
  onDeleteUser: (uidOrEmail: string) => void;
  onSyncAllToFirestore?: () => Promise<void>;
  onClose: () => void;
}

export const UsersAndAuditModal: React.FC<UsersAndAuditModalProps> = ({
  initialTab = 'users',
  auditLogs,
  users,
  currentUserRole,
  onAddOrUpdateUserByEmail,
  onDeleteUser,
  onSyncAllToFirestore,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'users'>(initialTab);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('EDITOR');
  const [newAllowedDays, setNewAllowedDays] = useState<DayId[]>(
    DAYS_LIST.map((d) => d.id)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [syncingFirestore, setSyncingFirestore] = useState(false);
  const [copiedDomainHint, setCopiedDomainHint] = useState(false);

  const toggleAllowedDay = (day: DayId) => {
    setNewAllowedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleAddEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!isValidEmailAddress(cleanEmail)) {
      setFormError('يرجى إدخال بريد إلكتروني صحيح (مثال: doctor@gmail.com)');
      return;
    }

    if (newRole === 'EDITOR' && newAllowedDays.length === 0) {
      setFormError('يرجى اختيار يوم واحد على الأقل للمحرر');
      return;
    }

    onAddOrUpdateUserByEmail({
      email: cleanEmail,
      displayName: newName.trim() || undefined,
      role: newRole,
      allowedDays:
        newRole === 'ADMIN'
          ? DAYS_LIST.map((d) => d.id)
          : newAllowedDays,
    });

    setFormSuccess(
      `تمت إضافة/تحديث البريد (${cleanEmail}) بصلاحية ${
        newRole === 'ADMIN' ? 'أدمن (ADMIN)' : 'محرر (EDITOR)'
      } وحفظه في Firestore فوراً.`
    );
    setNewEmail('');
    setNewName('');
  };

  const handleSyncNow = async () => {
    if (!onSyncAllToFirestore) return;
    setSyncingFirestore(true);
    try {
      await onSyncAllToFirestore();
      setFormSuccess(
        'تمت مزامنة وإنشاء جميع جداول الأيام والإعدادات والمستخدمين على Firestore بنجاح!'
      );
    } finally {
      setSyncingFirestore(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إدارة البريد والصلاحيات وسجل التدقيق"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border border-slate-200 my-6 max-h-[92vh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              data-testid="tab-users-btn"
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>إدارة البريد والصلاحيات ({users.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              data-testid="tab-audit-btn"
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>سجل التدقيق ({auditLogs.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الصلاحيات"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="space-y-4">
            {/* Top Banner: Firestore Instant Sync & Vercel Domain Instructions */}
            <div className="rounded-xl bg-gradient-to-l from-purple-50 to-indigo-50 border border-purple-200 p-3.5 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-extrabold text-purple-950 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>
                    إدارة البريد والصلاحيات (الأدمن والمحررين) + الحفظ الفوري على Firestore
                  </span>
                </div>

                {onSyncAllToFirestore && currentUserRole === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={syncingFirestore}
                    data-testid="sync-firestore-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs cursor-pointer"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>
                      {syncingFirestore
                        ? 'جارٍ رفع البيانات...'
                        : 'إنشاء ومزامنة كل البيانات على Firestore الآن'}
                    </span>
                  </button>
                )}
              </div>

              <p className="text-purple-900 font-semibold leading-relaxed text-[11px]">
                • <strong>أدمن (ADMIN):</strong> صلاحية كاملة لتعديل جميع الأيام، الإعدادات، وإضافة أو حذف أي بريد إلكتروني.
                <br />• <strong>محرر (EDITOR):</strong> صلاحية تعديل ونشر جداول الأيام المحددة له فقط مع الحفظ الفوري.
                <br />• <strong>لتسجيل دخول جوجل على Vercel:</strong> أضف رابط موقعك على Vercel داخل{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 text-purple-950">
                  Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.hostname);
                    setCopiedDomainHint(true);
                    setTimeout(() => setCopiedDomainHint(false), 2000);
                  }}
                  className="mr-2 inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-extrabold text-purple-800 border border-purple-200 hover:bg-purple-100"
                >
                  {copiedDomainHint ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>تم نسخ النطاق</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ النطاق الحالي</span>
                    </>
                  )}
                </button>
              </p>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-extrabold text-rose-800"
              >
                {formError}
              </div>
            )}

            {formSuccess && (
              <div
                role="status"
                className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-extrabold text-emerald-800"
              >
                {formSuccess}
              </div>
            )}

            {/* Add Email Form (Admin Only) */}
            {currentUserRole === 'ADMIN' && (
              <form
                onSubmit={handleAddEmailSubmit}
                data-testid="add-email-role-form"
                className="rounded-2xl border-2 border-purple-200 bg-purple-50/30 p-4 space-y-3"
              >
                <h5 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-purple-700" />
                  <span>إضافة بريد إلكتروني جديد وتحديد صلاحيته (أدمن أو محرر)</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label
                      htmlFor="new-user-email"
                      className="block text-[11px] font-extrabold text-slate-700 mb-1"
                    >
                      البريد الإلكتروني (Gmail / Google) *
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="new-user-email"
                        data-testid="input-user-email"
                        type="email"
                        dir="ltr"
                        placeholder="example@gmail.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white pr-8 pl-3 py-2 text-xs font-bold text-slate-900 focus:border-purple-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="new-user-name"
                      className="block text-[11px] font-extrabold text-slate-700 mb-1"
                    >
                      الاسم التوضيحي (اختياري)
                    </label>
                    <input
                      id="new-user-name"
                      data-testid="input-user-name"
                      type="text"
                      placeholder="مثال: د/ محمد (محرر الجداول)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-purple-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-user-role"
                      className="block text-[11px] font-extrabold text-slate-700 mb-1"
                    >
                      نوع الصلاحية (أدمن / محرر)
                    </label>
                    <select
                      id="new-user-role"
                      data-testid="select-user-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-900 focus:border-purple-600 focus:outline-none"
                    >
                      <option value="EDITOR">محرر (EDITOR)</option>
                      <option value="ADMIN">أدمن (ADMIN)</option>
                    </select>
                  </div>
                </div>

                {newRole === 'EDITOR' && (
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="block text-[11px] font-extrabold text-slate-700">
                        الأيام المسموح للمحرر بتعديلها: *
                      </span>
                      {newAllowedDays.length === 0 && (
                        <span className="text-[11px] font-extrabold text-rose-600">
                          (يجب تحديد يوم واحد على الأقل)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS_LIST.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleAllowedDay(d.id)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-extrabold border transition cursor-pointer ${
                            newAllowedDays.includes(d.id)
                              ? 'bg-purple-700 text-white border-purple-700'
                              : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={newRole === 'EDITOR' && newAllowedDays.length === 0}
                    data-testid="submit-add-email-btn"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>إضافة البريد وحفظ الصلاحية</span>
                  </button>
                </div>
              </form>
            )}

            {/* Existing Users List with Role Switcher (Admin/Editor) & Delete Button */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-slate-800">
                قائمة البريد الإلكتروني المسجلة وصلاحياتها ({users.length})
              </h4>
              <div className="space-y-2">
                {users.map((u) => {
                  const isPrimaryOwner =
                    u.email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;

                  return (
                    <div
                      key={u.uid}
                      data-testid={`user-row-${u.email}`}
                      className="rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 hover:bg-white transition"
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs sm:text-sm text-slate-900 flex flex-wrap items-center gap-2">
                          <span>{u.displayName}</span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {u.role === 'ADMIN' ? 'أدمن (ADMIN)' : 'محرر (EDITOR)'}
                          </span>
                          {isPrimaryOwner && (
                            <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-black">
                              المالك الأساسي
                            </span>
                          )}
                        </div>
                        <div
                          dir="ltr"
                          className="text-xs font-bold text-slate-600 mt-0.5 text-right"
                        >
                          {u.email}
                        </div>
                      </div>

                      {currentUserRole === 'ADMIN' && (
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`تغيير صلاحية ${u.email}`}
                            data-testid={`role-select-${u.email}`}
                            disabled={isPrimaryOwner}
                            value={u.role}
                            onChange={(e) => {
                              const nextRole = e.target.value as UserRole;
                              onAddOrUpdateUserByEmail({
                                uid: u.uid,
                                email: u.email,
                                displayName: u.displayName,
                                role: nextRole,
                                allowedDays: u.allowedDays?.length
                                  ? u.allowedDays
                                  : DAYS_LIST.map((d) => d.id),
                              });
                            }}
                            className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-extrabold text-slate-900 disabled:opacity-60 cursor-pointer"
                          >
                            <option value="ADMIN">أدمن (ADMIN)</option>
                            <option value="EDITOR">محرر (EDITOR)</option>
                          </select>

                          {!isPrimaryOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteUser(u.email);
                                setFormSuccess(
                                  `تم حذف البريد (${u.email}) وإلغاء صلاحياته.`
                                );
                              }}
                              data-testid={`delete-user-${u.email}`}
                              aria-label={`حذف البريد ${u.email}`}
                              title="حذف هذا البريد من الصلاحيات"
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-extrabold text-rose-700 hover:bg-rose-600 hover:text-white transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <h4 className="text-sm font-extrabold text-slate-900">
                سجل التدقيق الزمني للتعديلات (Audit Log)
              </h4>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                يوثّق كل عملية إضافة أو تعديل أو حذف أو نسخ أو نشر مع البريد الإلكتروني والوقت.
              </p>
            </div>

            {auditLogs.length === 0 ? (
              <div className="py-10 text-center text-sm font-bold text-slate-500">
                لا توجد عمليات مسجلة في سجل التدقيق حتى الآن.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 hover:bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 font-extrabold text-purple-900">
                          {log.dayLabel}
                        </span>
                        <span className="font-extrabold text-slate-900">
                          {log.details}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-2">
                        <span>
                          المستخدم: {log.userName} ({log.userEmail})
                        </span>
                        <span>•</span>
                        <span>العملية: {log.action}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span dir="ltr">
                        {new Date(log.createdAtIso).toLocaleString('ar-EG')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
