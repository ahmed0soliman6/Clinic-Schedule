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
  reorderScheduleRows,
  updateScheduleRow,
  validateCenterSettings,
  validateRowInput,
  PRIMARY_ADMIN_EMAIL,
  emailToDocId,
  isValidEmailAddress,
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

test('RBAC permissions, 4:5 export aspect ratio, and daily social post text work accurately', () => {
  assert.equal(canUserEditDay('ADMIN', [], 'friday'), true);
  assert.equal(canUserEditDay('EDITOR', ['saturday', 'monday'], 'monday'), true);
  assert.equal(canUserEditDay('EDITOR', ['saturday', 'monday'], 'wednesday'), false);
  assert.equal(canUserEditDay('VIEWER', ['saturday'], 'saturday'), false);
  assert.equal(areRowsEqual(sampleRows, [...sampleRows]), true);

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
});


