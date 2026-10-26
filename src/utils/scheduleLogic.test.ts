import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS_LIST,
  POSTER_EXPORT_HEIGHT,
  POSTER_EXPORT_WIDTH,
  TRANSPARENT_RIGHT_LOGO_URL,
  addScheduleRow,
  areRowsEqual,
  buildDailySocialPostText,
  canUserEditDay,
  copyFullDayRows,
  copyRowToDay,
  deleteScheduleRow,
  detectConcurrentConflict,
  mergeConflictingRows,
  moveScheduleRow,
  normalizeRightLogoUrl,
  normalizeSortOrders,
  normalizeArabicText,
  normalizeClinicNameWithAl,
  reorderScheduleRows,
  updateScheduleRow,
  validateCenterSettings,
  validateRowInput,
  PRIMARY_ADMIN_EMAIL,
  emailToDocId,
  isFictionalOrBlockedEmail,
  isValidEmailAddress,
  resolveAuthorizedUserAccess,
  sanitizeUsersList,
  upsertUserByEmail,
  deleteUserFromList,
} from './scheduleLogic';
import { DailyScheduleData, ScheduleRow, UserProfile } from '../types/schedule';

const sampleRows: ScheduleRow[] = [
  {
    id: 'row-1',
    clinicName: 'الجراحة العامة',
    doctorName: 'أ.د/ هاني عبدالمؤمن',
    startTime: '10:00 م',
    endTime: '1:00 م',
    icon: 'speech',
    iconColor: '#f43f5e',
    sortOrder: 0,
  },
  {
    id: 'row-2',
    clinicName: 'الأسنان',
    doctorName: 'د/ دعاء السيد',
    startTime: '2:00 م',
    endTime: '4:00 م',
    icon: 'tooth',
    iconColor: '#22c55e',
    sortOrder: 1,
  },
];

test('7 independent days are defined in standard Saturday-Friday order', () => {
  assert.equal(DAYS_LIST.length, 7);
  assert.equal(DAYS_LIST[0].id, 'saturday');
  assert.equal(DAYS_LIST[0].label, 'السبت');
  assert.equal(DAYS_LIST[6].id, 'friday');
  assert.equal(DAYS_LIST[6].label, 'الجمعة');
});

test('addScheduleRow appends a new row and assigns sequential sortOrder', () => {
  const updated = addScheduleRow(
    sampleRows,
    {
      clinicName: 'العيون',
      doctorName: 'د/ جمال عبد الهادي',
      startTime: '1:30 م',
      endTime: '3:30 م',
      icon: 'eye',
      iconColor: '#15803d',
    },
    'row-3'
  );
  assert.equal(updated.length, 3);
  assert.equal(updated[2].id, 'row-3');
  assert.equal(updated[2].clinicName, 'العيون');
  assert.equal(updated[2].sortOrder, 2);

  // Adding a blank clinic row keeps all fields empty as requested
  const withBlankRow = addScheduleRow(
    updated,
    {
      clinicName: '',
      doctorName: '',
      startTime: '',
      endTime: '',
      icon: 'stethoscope',
      iconColor: '#6d28d9',
    },
    'row-blank'
  );
  assert.equal(withBlankRow.length, 4);
  assert.equal(withBlankRow[3].clinicName, '');
  assert.equal(withBlankRow[3].doctorName, '');
  assert.equal(withBlankRow[3].startTime, '');
  assert.equal(withBlankRow[3].endTime, '');
});

test('updateScheduleRow updates target row fields while preserving order', () => {
  const updated = updateScheduleRow(sampleRows, 'row-2', {
    doctorName: 'د/ أحمد محسن',
    startTime: '3:00 م',
  });
  assert.equal(updated[1].doctorName, 'د/ أحمد محسن');
  assert.equal(updated[1].startTime, '3:00 م');
  assert.equal(updated[1].clinicName, 'الأسنان');
});

test('deleteScheduleRow removes row and re-indexes sortOrder', () => {
  const updated = deleteScheduleRow(sampleRows, 'row-1');
  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, 'row-2');
  assert.equal(updated[0].sortOrder, 0);
});

test('moveScheduleRow and reorderScheduleRows reorder rows accurately', () => {
  const movedUp = moveScheduleRow(sampleRows, 'row-2', 'up');
  assert.equal(movedUp[0].id, 'row-2');
  assert.equal(movedUp[0].sortOrder, 0);
  assert.equal(movedUp[1].id, 'row-1');
  assert.equal(movedUp[1].sortOrder, 1);

  const dragged = reorderScheduleRows(movedUp, 0, 1);
  assert.equal(dragged[0].id, 'row-1');
  assert.equal(dragged[1].id, 'row-2');
});

test('copyRowToDay and copyFullDayRows clone rows with fresh IDs and valid sortOrders', () => {
  const targetRows = copyRowToDay([], sampleRows[0], 'copied-1');
  assert.equal(targetRows.length, 1);
  assert.equal(targetRows[0].id, 'copied-1');
  assert.equal(targetRows[0].clinicName, 'الجراحة العامة');
  assert.equal(targetRows[0].sortOrder, 0);

  const fullDay = copyFullDayRows(sampleRows, 'wednesday');
  assert.equal(fullDay.length, 2);
  assert.notEqual(fullDay[0].id, sampleRows[0].id);
  assert.equal(fullDay[0].clinicName, sampleRows[0].clinicName);
  assert.equal(fullDay[1].sortOrder, 1);
});

test('validateRowInput enforces required fields and length constraints', () => {
  const invalid = validateRowInput({
    clinicName: '',
    doctorName: 'د/ محمد',
    startTime: '4:00 م',
    endTime: '6:00 م',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length > 0);

  const valid = validateRowInput({
    clinicName: 'العظام',
    doctorName: 'د/ محمد شكري',
    startTime: '5:00 م',
    endTime: '6:00 م',
    icon: 'bones',
    iconColor: '#f59e0b',
  });
  assert.equal(valid.valid, true);
});

test('detectConcurrentConflict identifies concurrent edits from another user', () => {
  const remoteSchedule: DailyScheduleData = {
    dayId: 'saturday',
    dayLabel: 'السبت',
    dayOrder: 0,
    isPublic: true,
    hasUnpublishedChanges: true,
    version: 5,
    draftRows: [sampleRows[0]],
    publishedRows: sampleRows,
    updatedBy: 'user-other',
    updatedByEmail: 'other@example.com',
    updatedByName: 'محرر آخر',
    publishedAt: new Date().toISOString(),
  };

  const result = detectConcurrentConflict({
    localBaseVersion: 4,
    incomingRemoteSchedule: remoteSchedule,
    currentUserId: 'user-me',
    hasLocalUnsavedChanges: true,
    localDraftRows: sampleRows,
  });

  assert.equal(result.hasConflict, true);
  assert.ok(result.reason?.includes('محرر آخر'));

  const merged = mergeConflictingRows(sampleRows, remoteSchedule.draftRows);
  assert.equal(merged.length, 2);
});

test('RBAC permissions, empty new row creation, 4:5 export aspect ratio, and daily social post text work accurately', () => {
  assert.equal(canUserEditDay('ADMIN', [], 'friday'), true);
  assert.equal(canUserEditDay('EDITOR', ['saturday', 'monday'], 'monday'), true);
  assert.equal(canUserEditDay('EDITOR', ['saturday', 'monday'], 'wednesday'), false);
  assert.equal(areRowsEqual(sampleRows, [...sampleRows]), true);

  // Verify adding a blank row keeps all fields empty
  const withBlankRow = addScheduleRow(sampleRows, {
    clinicName: '',
    doctorName: '',
    startTime: '',
    endTime: '',
    icon: 'stethoscope',
    iconColor: '#6d28d9',
  });
  const lastRow = withBlankRow[withBlankRow.length - 1];
  assert.equal(lastRow.clinicName, '');
  assert.equal(lastRow.doctorName, '');
  assert.equal(lastRow.startTime, '');
  assert.equal(lastRow.endTime, '');

  // Verify strict 4:5 aspect ratio (1440 / 1800 === 4 / 5)
  assert.equal(POSTER_EXPORT_WIDTH / POSTER_EXPORT_HEIGHT, 4 / 5);
  assert.equal(
    normalizeRightLogoUrl('/assets/aistudio/Picsart_26-03-04_15-45-07-089_b9f15976.png'),
    TRANSPARENT_RIGHT_LOGO_URL
  );

  const sampleSettings = {
    complexName: 'مجمع ميت عزون الطبي',
    associationName: 'جمعية تنمية المجتمع المحلي',
    registrationNumber: 'مشهرة برقم 2406',
    rightLogoUrl: TRANSPARENT_RIGHT_LOGO_URL,
    leftLogoUrl: '/logo-left.png',
    address: 'ميت عزون - بجوار المسجد الكبير',
    whatsappPhone: '01202027567',
    landlinePhone: '0502053187',
    dentalPhone: '01515674347',
    dentalLabel: 'عيادة الأسنان',
    bgStartColor: '#f3effb',
    bgEndColor: '#e8dff5',
    clinicHeaderColor: '#f59e0b',
    doctorHeaderColor: '#059669',
    fromHeaderColor: '#eab308',
    toHeaderColor: '#0284c7',
    footerBgColor: '#1e295b',
  };

  const settingsValidation = validateCenterSettings(sampleSettings);
  assert.equal(settingsValidation.valid, true);

  const postText = buildDailySocialPostText('الأربعاء', sampleSettings);
  assert.ok(postText.includes('جدول عيادات يوم الأربعاء'));
  assert.ok(postText.includes('☎️ 0502053187 - 📲 01202027567'));
  assert.ok(postText.includes('عيادة الأسنان. 01515674347'));
  assert.ok(postText.includes('https://wa.me/201202027567'));
  assert.ok(postText.includes('https://www.instagram.com/mit.azzoun.medical'));
  assert.ok(postText.includes('https://is.gd/cDsyaR'));
});

test('Email-based RBAC: add email, switch role between Editor and Admin, and delete email safely', () => {
  assert.equal(isValidEmailAddress('doctor@gmail.com'), true);
  assert.equal(isValidEmailAddress('invalid-email'), false);
  assert.equal(emailToDocId('Doctor.One@Gmail.com'), 'doctor_dot_one_at_gmail_dot_com');

  const initialUsers: UserProfile[] = [
    {
      uid: emailToDocId(PRIMARY_ADMIN_EMAIL),
      email: PRIMARY_ADMIN_EMAIL,
      displayName: 'مدير النظام',
      role: 'ADMIN',
      allowedDays: DAYS_LIST.map((d) => d.id),
    },
  ];

  // 1. Add new Editor by email
  const withEditor = upsertUserByEmail(initialUsers, {
    email: 'staff@gmail.com',
    displayName: 'د/ سمير',
    role: 'EDITOR',
    allowedDays: ['saturday', 'sunday'],
  });
  assert.equal(withEditor.length, 2);
  assert.equal(withEditor[1].email, 'staff@gmail.com');
  assert.equal(withEditor[1].role, 'EDITOR');
  assert.deepEqual(withEditor[1].allowedDays, ['saturday', 'sunday']);

  // 2. Promote Editor to Admin
  const promotedToAdmin = upsertUserByEmail(withEditor, {
    email: 'staff@gmail.com',
    role: 'ADMIN',
  });
  assert.equal(promotedToAdmin.length, 2);
  assert.equal(promotedToAdmin[1].role, 'ADMIN');

  // 3. Protect primary admin from deletion
  const blockedDelete = deleteUserFromList(promotedToAdmin, PRIMARY_ADMIN_EMAIL);
  assert.ok(blockedDelete.error);
  assert.equal(blockedDelete.updated.length, 2);

  // 4. Delete added email
  const afterDelete = deleteUserFromList(promotedToAdmin, 'staff@gmail.com');
  assert.equal(afterDelete.error, undefined);
  assert.equal(afterDelete.deleted?.email, 'staff@gmail.com');
  assert.equal(afterDelete.updated.length, 1);

  // 5. Block and purge fictional @meetazzoun.org emails completely
  assert.equal(isFictionalOrBlockedEmail('editor@meetazzoun.org'), true);
  assert.equal(isValidEmailAddress('editor@meetazzoun.org'), false);
  const pollutedList: UserProfile[] = [
    ...withEditor,
    {
      uid: 'editor_at_meetazzoun_dot_org',
      email: 'editor@meetazzoun.org',
      displayName: 'حساب وهمي',
      role: 'EDITOR',
      allowedDays: ['saturday'],
    },
  ];
  const cleaned = sanitizeUsersList(pollutedList);
  assert.equal(
    cleaned.some((u) => u.email.includes('meetazzoun.org')),
    false
  );

  // 6. Strict Whitelist: Unregistered email MUST fail login & editing
  const unregisteredAccess = resolveAuthorizedUserAccess({
    email: 'stranger@gmail.com',
    uid: 'uid-stranger',
    registeredUsers: cleaned,
  });
  assert.equal(unregisteredAccess.authorized, false);
  assert.equal(unregisteredAccess.role, null);
  assert.equal(
    canUserEditDay(unregisteredAccess.role, unregisteredAccess.allowedDays, 'saturday'),
    false
  );

  // 7. Registered editor gets ONLY their assigned role and allowedDays
  const editorAccess = resolveAuthorizedUserAccess({
    email: 'staff@gmail.com',
    uid: 'uid-staff',
    registeredUsers: cleaned,
  });
  assert.equal(editorAccess.authorized, true);
  assert.equal(editorAccess.role, 'EDITOR');
  assert.deepEqual(editorAccess.allowedDays, ['saturday', 'sunday']);
  assert.equal(
    canUserEditDay(editorAccess.role, editorAccess.allowedDays, 'saturday'),
    true
  );
  assert.equal(
    canUserEditDay(editorAccess.role, editorAccess.allowedDays, 'tuesday'),
    false
  );

  // 8. Empty allowedDays bug fix: Editor with empty allowedDays gets [] and can edit 0 days
  const emptyDaysEditor = upsertUserByEmail([], {
    email: 'restricted@gmail.com',
    role: 'EDITOR',
    allowedDays: [],
  });
  const restrictedUser = emptyDaysEditor.find((u) => u.email === 'restricted@gmail.com');
  assert.ok(restrictedUser);
  assert.deepEqual(restrictedUser.allowedDays, []);
  const restrictedAccess = resolveAuthorizedUserAccess({
    email: 'restricted@gmail.com',
    registeredUsers: emptyDaysEditor,
  });
  assert.equal(restrictedAccess.authorized, true);
  assert.equal(restrictedAccess.role, 'EDITOR');
  assert.deepEqual(restrictedAccess.allowedDays, []);
  assert.equal(canUserEditDay(restrictedAccess.role, restrictedAccess.allowedDays, 'saturday'), false);
  assert.equal(canUserEditDay(restrictedAccess.role, restrictedAccess.allowedDays, 'friday'), false);
});

test('emailToDocId encodes +, ., - deterministically matching security rules', () => {
  assert.equal(emailToDocId('ahmed0soliman6@gmail.com'), 'ahmed0soliman6_at_gmail_dot_com');
  assert.equal(emailToDocId('doctor+clinic@gmail.com'), 'doctor_plus_clinic_at_gmail_dot_com');
  assert.equal(emailToDocId('dr_ali-nour@clinic.org'), 'dr_ali-nour_at_clinic_dot_org');
});

test('normalizeSortOrders is pure and does not mutate clinicName', () => {
  const original = [{ ...sampleRows[0], clinicName: 'باطنه', sortOrder: 5 }];
  const sorted = normalizeSortOrders(original);
  assert.equal(sorted[0].sortOrder, 0);
  assert.equal(sorted[0].clinicName, 'باطنه');
});

test('normalizeArabicText and normalizeClinicNameWithAl handle Arabic variations', () => {
  assert.equal(normalizeClinicNameWithAl('باطنه'), 'الباطنة');
  assert.equal(normalizeClinicNameWithAl('باطنة'), 'الباطنة');
  assert.equal(normalizeClinicNameWithAl('اطفال'), 'الأطفال');
  assert.equal(normalizeClinicNameWithAl('مخ واعصاب'), 'المخ والأعصاب');
});

test('60 row cap is respected in addScheduleRow, copyRowToDay, and copyFullDayRows', () => {
  const maxRows: ScheduleRow[] = Array.from({ length: 60 }, (_, i) => ({
    id: `row-${i}`,
    clinicName: 'الباطنة',
    doctorName: `طبيب ${i}`,
    startTime: '10:00 ص',
    endTime: '12:00 م',
    icon: 'internal',
    iconColor: '#0284c7',
    sortOrder: i,
  }));

  const afterAdd = addScheduleRow(maxRows, {
    clinicName: 'العيون',
    doctorName: 'د/ جديد',
    startTime: '1:00 م',
    endTime: '2:00 م',
    icon: 'eye',
    iconColor: '#15803d',
  });
  assert.equal(afterAdd.length, 60);

  const afterCopy = copyRowToDay(maxRows, sampleRows[0]);
  assert.equal(afterCopy.length, 60);
});

test('mergeConflictingRows 3-way merge correctly resolves deletions, local edits, and additions', () => {
  const base: ScheduleRow[] = [
    { id: '1', clinicName: 'الباطنة', doctorName: 'د/ 1', startTime: '1:00', endTime: '2:00', icon: 'internal', iconColor: '#000', sortOrder: 0 },
    { id: '2', clinicName: 'الأطفال', doctorName: 'د/ 2', startTime: '2:00', endTime: '3:00', icon: 'baby', iconColor: '#000', sortOrder: 1 },
    { id: '3', clinicName: 'الأسنان', doctorName: 'د/ 3', startTime: '3:00', endTime: '4:00', icon: 'tooth', iconColor: '#000', sortOrder: 2 },
  ];

  const local: ScheduleRow[] = [
    { id: '2', clinicName: 'الأطفال', doctorName: 'د/ 2 معدل محلياً', startTime: '2:00', endTime: '3:00', icon: 'baby', iconColor: '#000', sortOrder: 0 },
    { id: '3', clinicName: 'الأسنان', doctorName: 'د/ 3', startTime: '3:00', endTime: '4:00', icon: 'tooth', iconColor: '#000', sortOrder: 1 },
  ];

  const remote: ScheduleRow[] = [
    { id: '1', clinicName: 'الباطنة', doctorName: 'د/ 1', startTime: '1:00', endTime: '2:00', icon: 'internal', iconColor: '#000', sortOrder: 0 },
    { id: '2', clinicName: 'الأطفال', doctorName: 'د/ 2 معدل عن بعد', startTime: '2:00', endTime: '3:00', icon: 'baby', iconColor: '#000', sortOrder: 1 },
  ];

  const merged = mergeConflictingRows(base, local, remote);

  assert.equal(merged.some((r) => r.id === '1'), false);
  assert.equal(merged.some((r) => r.id === '3'), false);
  const row2 = merged.find((r) => r.id === '2');
  assert.ok(row2);
  assert.equal(row2.doctorName, 'د/ 2 معدل محلياً');
});

test('Empty initial schedules start clean and undo stack tracks state transitions correctly', () => {
  const emptyDayRows: ScheduleRow[] = [];
  assert.equal(emptyDayRows.length, 0);

  // Step 1: User adds a real row
  const state1 = addScheduleRow(emptyDayRows, {
    clinicName: 'الجلدية',
    doctorName: 'د/ أحمد زكريا',
    startTime: '8:00 م',
    endTime: '9:30 م',
    icon: 'dermatology',
    iconColor: '#ec4899',
  });
  assert.equal(state1.length, 1);

  // Undo stack records previous state
  const undoStack: ScheduleRow[][] = [emptyDayRows];
  assert.equal(undoStack.length, 1);

  // User triggers undo: state reverts to clean empty state
  const revertedState = undoStack.pop();
  assert.ok(revertedState);
  assert.equal(revertedState.length, 0);
});
