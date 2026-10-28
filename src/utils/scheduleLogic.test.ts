import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLUEPRINT_LIMITS,
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
  filterNonEmptyRows,
  isCompletelyEmptyRow,
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
  shouldAcceptIncomingSnapshot,
  isRetryableFirestoreError,
  executeWithRetry,
  formatFirestoreCommitError,
  applyDraftMutationToDay,
  createPerDayScheduleSyncController,
} from './scheduleLogic';
import {
  addDaysToDateStr,
  buildLiveAutoPostPreviewLine,
  computeTokenDocId,
  evaluateFbAutoPostGate,
  filterEligibleReminderTokens,
  formatReminderMessage,
  isWithinReminderWindow,
  resolveTargetDayId,
  sanitizeFbAutoPostError,
  validateReminderSettings,
} from './reminderLogic';
import { DailyScheduleData, DayId, ScheduleRow, UserProfile } from '../types/schedule';
import fs from 'node:fs';
import path from 'node:path';

const INITIAL_SCHEDULES: Record<DayId, DailyScheduleData> = DAYS_LIST.reduce(
  (acc, day) => {
    acc[day.id] = {
      dayId: day.id,
      dayLabel: day.label,
      dayOrder: day.order,
      isPublic: true,
      hasUnpublishedChanges: false,
      version: 1,
      draftRows: [],
      publishedRows: [],
      updatedBy: 'system',
      updatedByEmail: PRIMARY_ADMIN_EMAIL,
      updatedByName: 'مدير النظام',
      publishedAt: '2026-01-01T00:00:00.000Z',
    };
    return acc;
  },
  {} as Record<DayId, DailyScheduleData>
);

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

  // Verify custom postTemplate controlled from Settings with {اليوم}, {العيادات}, {الواتساب}, {العنوان}
  const customPostText = buildDailySocialPostText(
    'السبت',
    {
      ...sampleSettings,
      postTemplate:
        'مواعيد {المجمع} ليوم {اليوم}:\n{العيادات}\nللحجز واتساب: {الواتساب} | العنوان: {العنوان}',
    },
    sampleRows
  );
  assert.ok(customPostText.includes('مواعيد مجمع ميت عزون الطبي ليوم السبت:'));
  assert.ok(customPostText.includes('• الجراحة العامة (أ.د/ هاني عبدالمؤمن)'));
  assert.ok(customPostText.includes('للحجز واتساب: 01202027567 | العنوان: ميت عزون - بجوار المسجد الكبير'));
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

test('Requirement 1, 2 & 4: 6 rapid consecutive deletes with delayed/stale snapshots never resurrect a deleted row', async () => {
  const sixRows: ScheduleRow[] = Array.from({ length: 6 }, (_, i) => ({
    id: `clinic-row-${i + 1}`,
    clinicName: `عيادة ${i + 1}`,
    doctorName: `د/ طبيب ${i + 1}`,
    startTime: '4:00 م',
    endTime: '6:00 م',
    icon: 'stethoscope',
    iconColor: '#6d28d9',
    sortOrder: i,
  }));

  const initialSchedules = {
    ...INITIAL_SCHEDULES,
    saturday: {
      ...INITIAL_SCHEDULES.saturday,
      version: 10,
      draftRows: sixRows,
      publishedRows: sixRows,
      hasUnpublishedChanges: false,
    },
  };

  const committedPayloads: DailyScheduleData[] = [];

  const controller = createPerDayScheduleSyncController({
    initialSchedules,
    debounceMs: 30, // Fast debounce for unit test speed
    commitDraftToRemote: async ({ daySnapshot, baseVersion }) => {
      // Simulate network latency while stale snapshots try to arrive
      await new Promise((resolve) => setTimeout(resolve, 40));
      const nextVersion = baseVersion + 1;
      const serverDoc: DailyScheduleData = {
        ...daySnapshot,
        version: nextVersion,
      };
      committedPayloads.push(serverDoc);
      return { committedVersion: nextVersion, serverDoc };
    },
  });

  const editor = {
    uid: 'ahmed0soliman6_at_gmail_dot_com',
    email: PRIMARY_ADMIN_EMAIL,
    displayName: 'مدير النظام',
  };

  // Fire 6 rapid consecutive deletes without awaiting between clicks
  for (let i = 1; i <= 6; i++) {
    const targetId = `clinic-row-${i}`;
    controller.mutateDayDraft(
      'saturday',
      (prevRows) => deleteScheduleRow(prevRows, targetId),
      editor
    );

    // Simulate a stale/delayed onSnapshot arriving with old rows during rapid clicks
    const staleSnapshotAccepted = controller.receiveRemoteSnapshot(
      'saturday',
      {
        ...initialSchedules.saturday,
        version: 10,
        draftRows: sixRows.slice(i - 1), // Still contains rows that were just deleted
      },
      { hasPendingWrites: false }
    );
    assert.equal(
      staleSnapshotAccepted,
      false,
      'Stale snapshot during active debounce/save MUST be rejected'
    );
  }

  // Immediately after 6 rapid deletes, BOTH draftRows and publishedRows are empty and hasUnpublishedChanges is false
  assert.equal(controller.getDaySchedule('saturday').draftRows.length, 0);
  assert.equal(controller.getDaySchedule('saturday').publishedRows.length, 0);
  assert.equal(controller.getDaySchedule('saturday').hasUnpublishedChanges, false);

  // While the commit is in-flight, simulate another snapshot with hasPendingWrites = true
  await new Promise((resolve) => setTimeout(resolve, 45));
  const pendingWriteAccepted = controller.receiveRemoteSnapshot(
    'saturday',
    {
      ...initialSchedules.saturday,
      version: 11,
      draftRows: [sixRows[5]], // Bogus partial state
    },
    { hasPendingWrites: true }
  );
  assert.equal(pendingWriteAccepted, false);

  // Wait for the per-day queue and debounce to finish
  await controller.waitForDayIdle('saturday');

  // Verify all 6 rapid deletes coalesced into a single Firestore transaction write
  assert.equal(committedPayloads.length, 1);
  assert.equal(committedPayloads[0].draftRows.length, 0);
  assert.equal(committedPayloads[0].publishedRows.length, 0);
  assert.equal(committedPayloads[0].hasUnpublishedChanges, false);
  assert.equal(controller.getDaySchedule('saturday').draftRows.length, 0);
  assert.equal(controller.getDaySchedule('saturday').publishedRows.length, 0);
  assert.equal(controller.getLocalVersion('saturday'), 11);

  // Even after save completes, an older late-arriving snapshot (version 10 < localVersion 11) is rejected
  const lateOldSnapshotAccepted = controller.receiveRemoteSnapshot(
    'saturday',
    {
      ...initialSchedules.saturday,
      version: 10,
      draftRows: sixRows,
    },
    { hasPendingWrites: false }
  );
  assert.equal(lateOldSnapshotAccepted, false);
  assert.equal(controller.getDaySchedule('saturday').draftRows.length, 0);
});

test('Requirement 2: shouldAcceptIncomingSnapshot rejects busy, pending-write, and older-version snapshots', () => {
  // (a) Reject when save or debounce is active for the same day
  assert.equal(
    shouldAcceptIncomingSnapshot({
      isSavingOrPendingForDay: true,
      hasPendingWrites: false,
      remoteVersion: 5,
      localVersion: 4,
    }),
    false
  );

  // (b) Reject when snap.metadata.hasPendingWrites is true
  assert.equal(
    shouldAcceptIncomingSnapshot({
      isSavingOrPendingForDay: false,
      hasPendingWrites: true,
      remoteVersion: 5,
      localVersion: 4,
    }),
    false
  );

  // (c) Reject when remote.version < localVersion
  assert.equal(
    shouldAcceptIncomingSnapshot({
      isSavingOrPendingForDay: false,
      hasPendingWrites: false,
      remoteVersion: 3,
      localVersion: 4,
    }),
    false
  );

  // Accept when idle, confirmed from server, and version >= localVersion
  assert.equal(
    shouldAcceptIncomingSnapshot({
      isSavingOrPendingForDay: false,
      hasPendingWrites: false,
      remoteVersion: 4,
      localVersion: 4,
    }),
    true
  );
});

test('Requirement 3: executeWithRetry retries aborted/unavailable up to 3 times with backoff and formatFirestoreCommitError reports real causes', async () => {
  let attempts = 0;
  const result = await executeWithRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        const err = new Error('Transaction aborted due to contention') as Error & { code: string };
        err.code = 'aborted';
        throw err;
      }
      return 'committed-ok';
    },
    3,
    5
  );
  assert.equal(result, 'committed-ok');
  assert.equal(attempts, 3);

  // Non-retryable permission-denied fails immediately on first attempt without retrying
  let permAttempts = 0;
  await assert.rejects(
    async () => {
      await executeWithRetry(
        async () => {
          permAttempts += 1;
          const err = new Error('Missing or insufficient permissions.') as Error & { code: string };
          err.code = 'permission-denied';
          throw err;
        },
        3,
        5
      );
    },
    /Missing or insufficient permissions/
  );
  assert.equal(permAttempts, 1);
  assert.equal(isRetryableFirestoreError({ code: 'aborted' }), true);
  assert.equal(isRetryableFirestoreError({ code: 'unavailable' }), true);
  assert.equal(isRetryableFirestoreError({ code: 'permission-denied' }), false);

  const permFormatted = formatFirestoreCommitError(
    { code: 'permission-denied', message: 'Missing or insufficient permissions.' },
    'السبت'
  );
  assert.equal(permFormatted.code, 'permission-denied');
  assert.ok(permFormatted.message.includes('permission-denied'));

  const conflictFormatted = formatFirestoreCommitError(
    new Error('CONCURRENT_CONFLICT:5'),
    'السبت'
  );
  assert.equal(conflictFormatted.code, 'conflict');
  assert.ok(conflictFormatted.message.includes('conflict'));
});

test('No draft mode: every edit writes both draftRows and publishedRows identically with hasUnpublishedChanges=false, and clearing a day empties both', async () => {
  // Simulate legacy day where draftRows (2 rows) differed from publishedRows (1 row)
  const initialDay: DailyScheduleData = {
    ...INITIAL_SCHEDULES.saturday,
    version: 3,
    draftRows: sampleRows,
    publishedRows: [sampleRows[0]],
    hasUnpublishedChanges: true,
  };
  const editor = {
    uid: 'ahmed0soliman6_at_gmail_dot_com',
    email: PRIMARY_ADMIN_EMAIL,
    displayName: 'مدير النظام',
  };

  // Data migration + direct edit: adding a row uses draftRows as truth and sets publishedRows == draftRows and hasUnpublishedChanges == false
  const afterAdd = applyDraftMutationToDay(
    initialDay,
    (prev) =>
      addScheduleRow(
        prev,
        {
          clinicName: 'العيون',
          doctorName: 'د/ سامح',
          startTime: '5:00 م',
          endTime: '7:00 م',
          icon: 'eye',
          iconColor: '#15803d',
        },
        'new-eye-row'
      ),
    editor
  );
  assert.equal(afterAdd.draftRows.length, 3);
  assert.equal(afterAdd.publishedRows.length, 3);
  assert.deepEqual(afterAdd.publishedRows, afterAdd.draftRows);
  assert.equal(afterAdd.hasUnpublishedChanges, false);

  // Clearing a day empties both draftRows and publishedRows immediately
  const afterClear = applyDraftMutationToDay(afterAdd, () => [], editor);
  assert.equal(afterClear.draftRows.length, 0);
  assert.equal(afterClear.publishedRows.length, 0);
  assert.equal(afterClear.hasUnpublishedChanges, false);

  // Verify controller writes both schedules and publicSchedules in one atomic commit and supports flushAllPending
  const writtenSchedulesDocs: DailyScheduleData[] = [];
  const writtenPublicDocs: { dayId: DayId; publishedRows: ScheduleRow[] }[] = [];

  const controller = createPerDayScheduleSyncController({
    initialSchedules: {
      ...INITIAL_SCHEDULES,
      saturday: initialDay,
    },
    debounceMs: 700,
    commitDraftToRemote: async ({ dayId, daySnapshot, baseVersion }) => {
      const committedVersion = baseVersion + 1;
      const serverDoc: DailyScheduleData = {
        ...daySnapshot,
        version: committedVersion,
        hasUnpublishedChanges: false,
        publishedRows: daySnapshot.draftRows,
      };
      writtenSchedulesDocs.push(serverDoc);
      writtenPublicDocs.push({
        dayId,
        publishedRows: daySnapshot.draftRows,
      });
      return { committedVersion, serverDoc };
    },
  });

  // Perform clear day mutation
  controller.mutateDayDraft('saturday', () => [], editor);
  // Immediately flush before 700ms timer expires (simulating pagehide / visibilitychange)
  await controller.flushAllPending();
  await controller.waitForDayIdle('saturday');

  assert.equal(writtenSchedulesDocs.length, 1);
  assert.equal(writtenPublicDocs.length, 1);
  assert.deepEqual(writtenSchedulesDocs[0].draftRows, []);
  assert.deepEqual(writtenSchedulesDocs[0].publishedRows, []);
  assert.equal(writtenSchedulesDocs[0].hasUnpublishedChanges, false);
  assert.deepEqual(writtenPublicDocs[0].publishedRows, []);
});

test('Empty row prevention and 30-row cap enforcement', () => {
  // Completely empty row is detected and rejected
  assert.equal(
    isCompletelyEmptyRow({
      clinicName: '   ',
      doctorName: '',
      startTime: ' ',
      endTime: '',
    }),
    true
  );
  assert.equal(
    isCompletelyEmptyRow({
      clinicName: 'الباطنة',
      doctorName: '',
      startTime: '',
      endTime: '',
    }),
    false
  );

  const emptyValidation = validateRowInput({
    clinicName: ' ',
    doctorName: '',
    startTime: '',
    endTime: '',
  });
  assert.equal(emptyValidation.valid, false);
  assert.ok(emptyValidation.errors[0].includes('فارغ'));

  // filterNonEmptyRows strips blank rows from Saturday schedule and normalizes sortOrders
  const dirtySaturdayRows: ScheduleRow[] = [
    sampleRows[0],
    {
      id: 'empty-1',
      clinicName: '',
      doctorName: '',
      startTime: '',
      endTime: '',
      icon: 'stethoscope',
      iconColor: '#6d28d9',
      sortOrder: 1,
    },
    sampleRows[1],
    {
      id: 'empty-2',
      clinicName: '  ',
      doctorName: ' ',
      startTime: '',
      endTime: '',
      icon: 'stethoscope',
      iconColor: '#6d28d9',
      sortOrder: 3,
    },
  ];
  const cleaned = filterNonEmptyRows(dirtySaturdayRows);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].id, 'row-1');
  assert.equal(cleaned[0].sortOrder, 0);
  assert.equal(cleaned[1].id, 'row-2');
  assert.equal(cleaned[1].sortOrder, 1);

  // Enforce 30-row maximum cap per day
  assert.equal(BLUEPRINT_LIMITS.MAX_ROWS_PER_DAY, 30);
  const thirtyFiveRows: ScheduleRow[] = Array.from({ length: 35 }, (_, idx) => ({
    id: `r-${idx + 1}`,
    clinicName: `عيادة ${idx + 1}`,
    doctorName: `د/ طبيب ${idx + 1}`,
    startTime: '4:00 م',
    endTime: '6:00 م',
    icon: 'internal',
    iconColor: '#0284c7',
    sortOrder: idx,
  }));

  const editor = {
    uid: 'ahmed0soliman6_at_gmail_dot_com',
    email: PRIMARY_ADMIN_EMAIL,
    displayName: 'مدير النظام',
  };
  const cappedDay = applyDraftMutationToDay(
    INITIAL_SCHEDULES.saturday,
    () => thirtyFiveRows,
    editor
  );
  assert.equal(cappedDay.draftRows.length, 30);
  assert.equal(cappedDay.publishedRows.length, 30);
  assert.equal(cappedDay.hasUnpublishedChanges, false);
});

test('Requirement 6: firestore.rules enforces 30-row cap, draftRows == publishedRows, hasUnpublishedChanges == false, lightweight first-row check on publicSchedules, and < 600 expression budget', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  // (a) schedules/{dayId} get & list restricted to isStaff() only
  assert.match(
    rulesContent,
    /match\s+\/schedules\/\{dayId\}\s*\{[\s\S]*?allow\s+get:\s+if\s+isValidId\(dayId\)\s+&&\s+isStaff\(\);/
  );
  assert.match(
    rulesContent,
    /match\s+\/schedules\/\{dayId\}\s*\{[\s\S]*?allow\s+list:\s+if\s+isStaff\(\);/
  );

  // (b) 30-row cap and Total Array Guard (Pillar 5)
  assert.ok(rulesContent.includes('rows.size() <= 30'));
  assert.ok(
    rulesContent.includes('(rows.size() == 0 || isValidRowItem(rows[0]))')
  );
  assert.ok(rulesContent.includes('isValidRowList(data.draftRows)'));
  assert.ok(rulesContent.includes('isValidRowList(data.publishedRows)'));

  // (c) schedules/{dayId} enforces hasUnpublishedChanges == false
  assert.ok(rulesContent.includes('data.hasUnpublishedChanges == false'));

  // (d) publicSchedules/{dayId} uses lightweight first-row check
  assert.ok(rulesContent.includes('isValidRowList(data.publishedRows)'));

  // (e) Lightweight per-row check has length bounds on the 4 fields
  assert.ok(
    rulesContent.includes('row.clinicName is string && row.clinicName.size() <= 120')
  );
  assert.ok(
    rulesContent.includes('row.doctorName is string && row.doctorName.size() <= 120')
  );
  assert.ok(
    rulesContent.includes('row.startTime is string && row.startTime.size() <= 40')
  );
  assert.ok(
    rulesContent.includes('row.endTime is string && row.endTime.size() <= 40')
  );

  // (f) Version increment check incoming().version == existing().version + 1 on schedules update
  assert.ok(
    rulesContent.includes('incoming().version == existing().version + 1'),
    'Expected firestore.rules to enforce version + 1 on schedule updates'
  );

  // (g) fcmTokens/{tokenId} and appConfig/{id} rules
  assert.match(
    rulesContent,
    /match\s+\/fcmTokens\/\{tokenId\}\s*\{[\s\S]*?allow\s+get,\s*list:\s+if\s+false;/
  );
  assert.ok(
    rulesContent.includes('request.auth.token.email.lower() == incoming().email.lower()')
  );
  assert.ok(
    rulesContent.includes('incoming().token.size() >= 10') &&
      rulesContent.includes('incoming().token.size() <= 4096')
  );
  assert.match(
    rulesContent,
    /match\s+\/appConfig\/\{id\}\s*\{[\s\S]*?allow\s+get,\s*list:\s+if\s+isStaff\(\);/
  );
  assert.ok(rulesContent.includes("!('lastSentDate' in incoming())"));
});

test('Daily Reminder Pure Logic: 10-minute Cairo window, lastSentDate duplicate guard, DST handling, targetDay resolution, and recipient filtering', async () => {
  // 1) SHA-256 deterministic 64-char hex docId for FCM tokens
  const docIdA = await computeTokenDocId('sample-fcm-token-1234567890');
  const docIdB = await computeTokenDocId('sample-fcm-token-1234567890');
  assert.equal(docIdA, docIdB);
  assert.match(docIdA, /^[a-f0-9]{64}$/);

  // 2) Cairo 10-minute window check (Winter UTC+2: 2026-01-17 is Saturday, 17:05 UTC = 19:05 Africa/Cairo)
  const winterInWindow = new Date('2026-01-17T17:05:00Z');
  const check1 = isWithinReminderWindow({
    now: winterInWindow,
    scheduledTime: '19:00',
    lastSentDate: null,
    timeZone: 'Africa/Cairo',
    windowMinutes: 10,
  });
  assert.equal(check1.shouldSend, true);
  assert.equal(check1.reason, 'in_window');
  assert.equal(check1.cairoDateStr, '2026-01-17');
  assert.equal(check1.cairoTimeHHmm, '19:05');

  // Duplicate send prevented on the same Cairo date
  const checkDuplicate = isWithinReminderWindow({
    now: winterInWindow,
    scheduledTime: '19:00',
    lastSentDate: '2026-01-17',
    timeZone: 'Africa/Cairo',
    windowMinutes: 10,
  });
  assert.equal(checkDuplicate.shouldSend, false);
  assert.equal(checkDuplicate.reason, 'already_sent_today');

  // Outside 10-minute window (17:10 UTC = 19:10 Cairo -> outside [19:00, 19:10))
  const winterOutside = new Date('2026-01-17T17:10:00Z');
  const checkOutside = isWithinReminderWindow({
    now: winterOutside,
    scheduledTime: '19:00',
    lastSentDate: '2026-01-16',
    timeZone: 'Africa/Cairo',
    windowMinutes: 10,
  });
  assert.equal(checkOutside.shouldSend, false);
  assert.equal(checkOutside.reason, 'outside_window');

  // Summer DST in Egypt (UTC+3: 2026-07-18 is Saturday, 16:03 UTC = 19:03 Africa/Cairo)
  const summerInWindow = new Date('2026-07-18T16:03:00Z');
  const checkSummer = isWithinReminderWindow({
    now: summerInWindow,
    scheduledTime: '19:00',
    lastSentDate: null,
    timeZone: 'Africa/Cairo',
    windowMinutes: 10,
  });
  assert.equal(checkSummer.shouldSend, true);
  assert.equal(checkSummer.cairoDateStr, '2026-07-18');
  assert.equal(checkSummer.cairoTimeHHmm, '19:03');

  // 3) Target day calculation (Saturday -> today = saturday, tomorrow = sunday)
  const todayTarget = resolveTargetDayId(winterInWindow, 'today', 'Africa/Cairo');
  const tomorrowTarget = resolveTargetDayId(winterInWindow, 'tomorrow', 'Africa/Cairo');
  assert.equal(todayTarget.dayId, 'saturday');
  assert.equal(todayTarget.dayLabel, 'السبت');
  assert.equal(tomorrowTarget.dayId, 'sunday');
  assert.equal(tomorrowTarget.dayLabel, 'الأحد');

  // Friday -> tomorrow wraps around to Saturday
  const fridayCairo = new Date('2026-01-16T17:00:00Z');
  assert.equal(resolveTargetDayId(fridayCairo, 'today', 'Africa/Cairo').dayId, 'friday');
  assert.equal(resolveTargetDayId(fridayCairo, 'tomorrow', 'Africa/Cairo').dayId, 'saturday');

  // 4) Recipient filtering by active users/{emailDocId}, role, and allowedDays
  const registeredUsers: UserProfile[] = [
    {
      uid: emailToDocId(PRIMARY_ADMIN_EMAIL),
      email: PRIMARY_ADMIN_EMAIL,
      displayName: 'المدير العام',
      role: 'ADMIN',
      allowedDays: DAYS_LIST.map((d) => d.id),
    },
    {
      uid: emailToDocId('sunday.editor@gmail.com'),
      email: 'sunday.editor@gmail.com',
      displayName: 'محرر الأحد',
      role: 'EDITOR',
      allowedDays: ['sunday', 'monday'],
    },
    {
      uid: emailToDocId('thursday.editor@gmail.com'),
      email: 'thursday.editor@gmail.com',
      displayName: 'محرر الخميس',
      role: 'EDITOR',
      allowedDays: ['thursday'],
    },
  ];

  const candidateTokens = [
    {
      docId: 'doc-admin',
      token: 'valid-token-admin-0001',
      email: PRIMARY_ADMIN_EMAIL,
      uid: 'u1',
    },
    {
      docId: 'doc-sun-editor',
      token: 'valid-token-sunday-editor-0002',
      email: 'sunday.editor@gmail.com',
      uid: 'u2',
    },
    {
      docId: 'doc-thu-editor',
      token: 'valid-token-thursday-editor-0003',
      email: 'thursday.editor@gmail.com',
      uid: 'u3',
    },
    {
      docId: 'doc-removed-user',
      token: 'valid-token-deleted-staff-0004',
      email: 'deleted.staff@gmail.com',
      uid: 'u4',
    },
  ];

  const sundayRecipients = filterEligibleReminderTokens(
    candidateTokens,
    registeredUsers,
    'sunday'
  );
  assert.deepEqual(
    sundayRecipients.map((r) => r.email),
    [PRIMARY_ADMIN_EMAIL, 'sunday.editor@gmail.com']
  );

  const thursdayRecipients = filterEligibleReminderTokens(
    candidateTokens,
    registeredUsers,
    'thursday'
  );
  assert.deepEqual(
    thursdayRecipients.map((r) => r.email),
    [PRIMARY_ADMIN_EMAIL, 'thursday.editor@gmail.com']
  );

  // 5) Reminder message formatting & validation
  const msg = formatReminderMessage(
    {
      title: 'تذكير جدول {اليوم}',
      body: 'يرجى مراجعة جدول {اليوم} ومشاركته.',
    },
    'الأحد'
  );
  assert.equal(msg.title, 'تذكير جدول الأحد');
  assert.equal(msg.body, 'يرجى مراجعة جدول الأحد ومشاركته.');

  const validated = validateReminderSettings({
    enabled: true,
    time: '19:00',
    targetDay: 'tomorrow',
    title: 'عنوان التذكير',
    body: 'نص التذكير',
    lastSentDate: '2026-01-17',
  });
  assert.equal(validated.valid, true);
  assert.equal('lastSentDate' in validated.sanitized, false);

  // 6) External subscribers from outside (public@subscriber.local) receive reminders without requiring login
  const withExternalSubscriber = filterEligibleReminderTokens(
    [
      ...candidateTokens,
      {
        docId: 'doc-public-1',
        token: 'valid-token-public-subscriber-0005',
        email: 'public@subscriber.local',
        uid: 'public',
      },
    ],
    registeredUsers,
    'thursday'
  );
  assert.deepEqual(
    withExternalSubscriber.map((r) => r.email),
    [PRIMARY_ADMIN_EMAIL, 'thursday.editor@gmail.com', 'public@subscriber.local']
  );
});

test('Catch-up timing window, lock, targetDate deduplication, max 4 attempts, and fbTargetDay independence', () => {
  // 1) Catch-up window (default 180 minutes, never crossing midnight 23:59):
  // Scheduled at 09:41 Cairo time (2026-01-17 is Winter UTC+2 -> 07:41 UTC)
  // a) Before scheduled time (09:40 Cairo = 07:40 UTC)
  const beforeTime = new Date('2026-01-17T07:40:00Z');
  const gateBefore = evaluateFbAutoPostGate({
    now: beforeTime,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateBefore.shouldExecute, false);
  assert.equal(gateBefore.reason, 'outside_window');
  assert.equal(gateBefore.targetDayId, 'sunday');
  assert.equal(gateBefore.targetDateStr, '2026-01-18');

  // b) 1 minute after scheduled time (09:42 Cairo = 07:42 UTC)
  const oneMinAfter = new Date('2026-01-17T07:42:00Z');
  const gateOneMin = evaluateFbAutoPostGate({
    now: oneMinAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateOneMin.shouldExecute, true);
  assert.equal(gateOneMin.reason, 'eligible');
  assert.equal(gateOneMin.cairoTimeHHmm, '09:42');
  assert.equal(gateOneMin.targetDateStr, '2026-01-18');

  // c) 2 hours (120 minutes) after scheduled time (11:41 Cairo = 09:41 UTC) — still inside 180m catch-up window!
  const twoHoursAfter = new Date('2026-01-17T09:41:00Z');
  const gateTwoHours = evaluateFbAutoPostGate({
    now: twoHoursAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateTwoHours.shouldExecute, true);
  assert.equal(gateTwoHours.reason, 'eligible');

  // d) 3 hours + 1 minute (181 minutes) after scheduled time (12:42 Cairo = 10:42 UTC) — outside 180m window
  const afterWindow = new Date('2026-01-17T10:42:00Z');
  const gateAfterWindow = evaluateFbAutoPostGate({
    now: afterWindow,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateAfterWindow.shouldExecute, false);
  assert.equal(gateAfterWindow.reason, 'outside_window');

  // e) Minutes before midnight: scheduled at 23:30 Cairo (21:30 UTC), checked at 23:55 Cairo (21:55 UTC)
  const beforeMidnight = new Date('2026-01-17T21:55:00Z');
  const windowBeforeMidnight = isWithinReminderWindow({
    now: beforeMidnight,
    scheduledTime: '23:30',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(windowBeforeMidnight.shouldSend, true);
  assert.equal(windowBeforeMidnight.upperLimitMinutes, 1439); // Capped at 23:59 (1439)

  const gateBeforeMidnight = evaluateFbAutoPostGate({
    now: beforeMidnight,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '23:30',
    fbTargetDay: 'tomorrow',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateBeforeMidnight.shouldExecute, true);
  assert.equal(gateBeforeMidnight.reason, 'eligible');

  // f) New day after midnight (00:05 Cairo on 2026-01-18 = 22:05 UTC on 2026-01-17):
  // Never spills over midnight into the next day!
  const afterMidnightNewDay = new Date('2026-01-17T22:05:00Z');
  const gateAfterMidnight = evaluateFbAutoPostGate({
    now: afterMidnightNewDay,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '23:30',
    fbTargetDay: 'tomorrow',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateAfterMidnight.shouldExecute, false);
  assert.equal(gateAfterMidnight.reason, 'outside_window');
  assert.equal(gateAfterMidnight.cairoDateStr, '2026-01-18');
  assert.equal(gateAfterMidnight.targetDateStr, '2026-01-19');

  // g) DST Summer transition in Cairo (UTC+3: 2026-07-18 06:45 UTC = 09:45 Cairo)
  const summerTime = new Date('2026-07-18T06:45:00Z');
  const gateSummer = evaluateFbAutoPostGate({
    now: summerTime,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'today',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateSummer.shouldExecute, true);
  assert.equal(gateSummer.cairoTimeHHmm, '09:45');
  assert.equal(gateSummer.targetDayId, 'saturday');
  assert.equal(gateSummer.targetDateStr, '2026-07-18');

  // 2) Independence of fbTargetDay from reminder targetDay:
  // On Saturday 2026-01-17, if reminder targetDay is 'today' (saturday) and fbTargetDay is 'tomorrow' (sunday),
  // resolveTargetDayId resolves them independently.
  const reminderResolved = resolveTargetDayId(oneMinAfter, 'today', 'Africa/Cairo');
  const fbResolved = resolveTargetDayId(oneMinAfter, 'tomorrow', 'Africa/Cairo');
  assert.equal(reminderResolved.dayId, 'saturday');
  assert.equal(reminderResolved.targetDateStr, '2026-01-17');
  assert.equal(fbResolved.dayId, 'sunday');
  assert.equal(fbResolved.targetDateStr, '2026-01-18');

  // 3) Deduplication by targetDateStr (lastFbPostTargetDate):
  const gateAlreadyPosted = evaluateFbAutoPostGate({
    now: oneMinAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    lastFbPostTargetDate: '2026-01-18',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateAlreadyPosted.shouldExecute, false);
  assert.equal(gateAlreadyPosted.reason, 'already_posted_for_target_date');

  // If lastFbPostTargetDate was for a previous date ('2026-01-17'), it SHOULD run for '2026-01-18'
  const gatePrevPosted = evaluateFbAutoPostGate({
    now: oneMinAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    lastFbPostTargetDate: '2026-01-17',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gatePrevPosted.shouldExecute, true);

  // 4) Lock check (fbPostLockUntil = now + 5 minutes):
  const gateLocked = evaluateFbAutoPostGate({
    now: oneMinAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    fbPostLockUntil: oneMinAfter.getTime() + 60_000,
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateLocked.shouldExecute, false);
  assert.equal(gateLocked.reason, 'locked');

  // Expired lock allows execution
  const gateExpiredLock = evaluateFbAutoPostGate({
    now: oneMinAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    fbPostLockUntil: oneMinAfter.getTime() - 1000,
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateExpiredLock.shouldExecute, true);

  // 5) Retry & Max 4 attempts per target date:
  const gateAttempt3 = evaluateFbAutoPostGate({
    now: oneMinAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    fbPostAttempts: { date: '2026-01-18', count: 3 },
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateAttempt3.shouldExecute, true);
  assert.equal(gateAttempt3.currentAttemptsCount, 3);

  const gateAttempt4 = evaluateFbAutoPostGate({
    now: oneMinAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    fbPostAttempts: { date: '2026-01-18', count: 4 },
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateAttempt4.shouldExecute, false);
  assert.equal(gateAttempt4.reason, 'max_attempts_reached');

  // If the 4 attempts were for an older target date ('2026-01-17'), attempts reset to 0 for '2026-01-18'
  const gateOldAttempts = evaluateFbAutoPostGate({
    now: oneMinAfter,
    fbAutoPostEnabled: true,
    fbAutoPostTime: '09:41',
    fbTargetDay: 'tomorrow',
    fbPostAttempts: { date: '2026-01-17', count: 4 },
    timeZone: 'Africa/Cairo',
  });
  assert.equal(gateOldAttempts.shouldExecute, true);
  assert.equal(gateOldAttempts.currentAttemptsCount, 0);

  // 6) Live preview line & error sanitizer
  const previewLine = buildLiveAutoPostPreviewLine({
    now: new Date('2026-01-15T10:00:00Z'), // Thursday in Cairo
    fbTargetDay: 'today',
    fbAutoPostTime: '09:41',
    timeZone: 'Africa/Cairo',
  });
  assert.equal(
    previewLine,
    'سينشر تلقائياً جدول (الخميس / اليوم) الساعة 09:41 بتوقيت القاهرة'
  );

  const sanitizedErr = sanitizeFbAutoPostError(
    'Error with access_token=EAABsbCS1234567890SECRET'
  );
  assert.equal(sanitizedErr.includes('EAABsbCS1234567890SECRET'), false);
  assert.ok(sanitizedErr.includes('[REDACTED]'));
  assert.equal(addDaysToDateStr('2026-01-31', 1), '2026-02-01');
});

test('firestore.rules includes new reminder fields, server-only field protections, and posterMeta collection rules', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  assert.ok(
    rulesContent.includes("data.fbTargetDay in ['today', 'tomorrow']"),
    'Expected fbTargetDay validation in firestore.rules'
  );
  assert.ok(
    rulesContent.includes("data.fbFallbackMode in ['text', 'skip']"),
    'Expected fbFallbackMode validation in firestore.rules'
  );
  assert.ok(
    rulesContent.includes('data.fbSkipEmptyDay is bool'),
    'Expected fbSkipEmptyDay validation in firestore.rules'
  );
  assert.ok(
    rulesContent.includes("'lastFbPostTargetDate'") &&
      rulesContent.includes("'lastFbPostStatus'") &&
      rulesContent.includes("'fbPostLockUntil'") &&
      rulesContent.includes("'lastCronRunAt'"),
    'Expected server-only fields to be protected from client writes in firestore.rules'
  );
  assert.match(
    rulesContent,
    /match\s+\/posterMeta\/\{dayId\}\s*\{[\s\S]*?allow\s+get,\s*list:\s+if\s+isStaff\(\);/
  );
});





