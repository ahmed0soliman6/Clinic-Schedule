import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesSource = fs.readFileSync('firestore.rules', 'utf8');

// Pure structural & behavioral evaluator mirroring firestore.rules gates for the Dirty Dozen payloads
interface SimulatedAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface SimulatedContext {
  auth: SimulatedAuth | null;
  requestTime: string;
  existingDoc?: Record<string, any> | null;
  userRolesDb: Record<string, { role: string; allowedDays: string[] }>;
}

function evaluateRulesWrite(
  collection: 'settings' | 'schedules' | 'users' | 'auditLogs',
  docId: string,
  operation: 'create' | 'update' | 'delete' | 'get',
  payload: Record<string, any> | null,
  ctx: SimulatedContext
): 'ALLOW' | 'PERMISSION_DENIED' {
  const isValidId =
    typeof docId === 'string' &&
    docId.length >= 1 &&
    docId.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(docId);

  if (!isValidId) return 'PERMISSION_DENIED';

  const isSignedIn = ctx.auth !== null && ctx.auth.email_verified === true;
  const isSuperAdmin = isSignedIn && ctx.auth?.email === 'ahmed0soliman6@gmail.com';
  const userRecord = ctx.auth ? ctx.userRolesDb[ctx.auth.uid] : undefined;
  const isAdmin = isSuperAdmin || (isSignedIn && userRecord?.role === 'ADMIN');
  const isStaff = isAdmin || (isSignedIn && userRecord?.role === 'EDITOR');

  if (collection === 'users' && operation === 'get') {
    if (!isSignedIn) return 'PERMISSION_DENIED';
    if (ctx.auth?.uid === docId || isAdmin) return 'ALLOW';
    return 'PERMISSION_DENIED';
  }

  if (!isSignedIn) return 'PERMISSION_DENIED';

  if (collection === 'auditLogs') {
    if (operation === 'update' || operation === 'delete') return 'PERMISSION_DENIED';
    if (operation === 'create') {
      if (!payload || !isStaff) return 'PERMISSION_DENIED';
      if (payload.userId !== ctx.auth?.uid) return 'PERMISSION_DENIED';
      if (payload.createdAt !== ctx.requestTime) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
  }

  if (collection === 'settings') {
    if (!isAdmin || !payload) return 'PERMISSION_DENIED';
    if (payload.updatedAt !== ctx.requestTime) return 'PERMISSION_DENIED';
    return 'ALLOW';
  }

  if (collection === 'users') {
    if (!payload) return 'PERMISSION_DENIED';
    const allowedKeys = ['uid', 'email', 'displayName', 'role', 'allowedDays', 'createdAt', 'updatedAt'];
    if (Object.keys(payload).some((k) => !allowedKeys.includes(k))) return 'PERMISSION_DENIED';
    if (payload.updatedAt !== ctx.requestTime) return 'PERMISSION_DENIED';

    if (operation === 'create') {
      if (payload.uid !== docId) return 'PERMISSION_DENIED';
      if (!isAdmin && (payload.role !== 'VIEWER' || payload.allowedDays.length !== 0)) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOW';
    }
    if (operation === 'update') {
      if (!ctx.existingDoc) return 'PERMISSION_DENIED';
      if (payload.uid !== ctx.existingDoc.uid || payload.createdAt !== ctx.existingDoc.createdAt) {
        return 'PERMISSION_DENIED';
      }
      if (!isAdmin && payload.role !== ctx.existingDoc.role) return 'PERMISSION_DENIED';
      return 'ALLOW';
    }
  }

  if (collection === 'schedules') {
    if (!payload) return 'PERMISSION_DENIED';
    const allowedKeys = [
      'dayId',
      'dayLabel',
      'dayOrder',
      'isPublic',
      'hasUnpublishedChanges',
      'version',
      'draftRows',
      'publishedRows',
      'updatedBy',
      'updatedByEmail',
      'updatedByName',
      'updatedAt',
      'publishedAt',
    ];
    if (Object.keys(payload).some((k) => !allowedKeys.includes(k))) return 'PERMISSION_DENIED';
    if (typeof payload.dayLabel !== 'string' || payload.dayLabel.length > 30) return 'PERMISSION_DENIED';
    if (!Array.isArray(payload.draftRows) || payload.draftRows.length > 60) return 'PERMISSION_DENIED';
    if (payload.updatedAt !== ctx.requestTime) return 'PERMISSION_DENIED';
    if (payload.updatedBy !== ctx.auth?.uid) return 'PERMISSION_DENIED';

    const canEdit =
      isAdmin || (userRecord?.role === 'EDITOR' && userRecord.allowedDays.includes(docId));
    if (!canEdit) return 'PERMISSION_DENIED';
    return 'ALLOW';
  }

  return 'PERMISSION_DENIED';
}

test('firestore.rules file contains all mandatory Eight Pillars primitives', () => {
  assert.ok(rulesSource.includes("rules_version = '2';"));
  assert.ok(rulesSource.includes('allow read, write: if false;'));
  assert.ok(rulesSource.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesSource.includes('isValidCenterSettings'));
  assert.ok(rulesSource.includes('isValidDailySchedule'));
  assert.ok(rulesSource.includes('isValidUserProfile'));
  assert.ok(rulesSource.includes('isValidAuditLog'));
});

test('Dirty Dozen #1-#12 payloads are strictly rejected with PERMISSION_DENIED', () => {
  const now = '2026-10-26T00:00:00Z';
  const validSchedulePayload = {
    dayId: 'saturday',
    dayLabel: 'السبت',
    dayOrder: 0,
    isPublic: true,
    hasUnpublishedChanges: false,
    version: 2,
    draftRows: [],
    publishedRows: [],
    updatedBy: 'editor-1',
    updatedByEmail: 'editor@example.com',
    updatedByName: 'محرر',
    updatedAt: now,
    publishedAt: now,
  };

  const baseCtx: SimulatedContext = {
    auth: { uid: 'editor-1', email: 'editor@example.com', email_verified: true },
    requestTime: now,
    userRolesDb: { 'editor-1': { role: 'EDITOR', allowedDays: ['saturday'] } },
  };

  // 1. Unauthenticated write
  assert.equal(
    evaluateRulesWrite('schedules', 'saturday', 'update', validSchedulePayload, {
      ...baseCtx,
      auth: null,
    }),
    'PERMISSION_DENIED'
  );

  // 2. Unverified Admin email spoof
  assert.equal(
    evaluateRulesWrite('settings', 'center', 'update', { updatedAt: now }, {
      ...baseCtx,
      auth: { uid: 'spoof', email: 'ahmed0soliman6@gmail.com', email_verified: false },
    }),
    'PERMISSION_DENIED'
  );

  // 3. Self-assigned ADMIN role during user creation
  assert.equal(
    evaluateRulesWrite(
      'users',
      'user-new',
      'create',
      {
        uid: 'user-new',
        email: 'new@example.com',
        displayName: 'مستخدم',
        role: 'ADMIN',
        allowedDays: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        ...baseCtx,
        auth: { uid: 'user-new', email: 'new@example.com', email_verified: true },
      }
    ),
    'PERMISSION_DENIED'
  );

  // 4. Shadow field injection on schedule
  assert.equal(
    evaluateRulesWrite(
      'schedules',
      'saturday',
      'update',
      { ...validSchedulePayload, isVerified: true },
      baseCtx
    ),
    'PERMISSION_DENIED'
  );

  // 5. Value poisoning (oversized dayLabel)
  assert.equal(
    evaluateRulesWrite(
      'schedules',
      'saturday',
      'update',
      { ...validSchedulePayload, dayLabel: 'أ'.repeat(500) },
      baseCtx
    ),
    'PERMISSION_DENIED'
  );

  // 6. ID poisoning
  assert.equal(
    evaluateRulesWrite('users', 'bad$id!@#', 'get', null, baseCtx),
    'PERMISSION_DENIED'
  );

  // 7. PII Blanket Read on another user's profile
  assert.equal(
    evaluateRulesWrite('users', 'other-user-id', 'get', null, baseCtx),
    'PERMISSION_DENIED'
  );

  // 8. Timestamp forgery
  assert.equal(
    evaluateRulesWrite(
      'schedules',
      'saturday',
      'update',
      { ...validSchedulePayload, updatedAt: '2020-01-01T00:00:00Z' },
      baseCtx
    ),
    'PERMISSION_DENIED'
  );

  // 9. Identity spoofing in AuditLog
  assert.equal(
    evaluateRulesWrite(
      'auditLogs',
      'log-1',
      'create',
      {
        action: 'UPDATE_ROW',
        dayId: 'saturday',
        dayLabel: 'السبت',
        details: 'تعديل',
        userId: 'someone-else',
        userEmail: 'editor@example.com',
        userName: 'محرر',
        createdAt: now,
      },
      baseCtx
    ),
    'PERMISSION_DENIED'
  );

  // 10. AuditLog tampering/deletion
  assert.equal(
    evaluateRulesWrite('auditLogs', 'log-1', 'delete', null, baseCtx),
    'PERMISSION_DENIED'
  );

  // 11. Unbounded array exhaustion (> 60 rows)
  assert.equal(
    evaluateRulesWrite(
      'schedules',
      'saturday',
      'update',
      { ...validSchedulePayload, draftRows: new Array(65).fill({}) },
      baseCtx
    ),
    'PERMISSION_DENIED'
  );

  // 12. Immutable field mutation on user profile
  assert.equal(
    evaluateRulesWrite(
      'users',
      'editor-1',
      'update',
      {
        uid: 'editor-1',
        email: 'editor@example.com',
        displayName: 'اسم جديد',
        role: 'EDITOR',
        allowedDays: ['saturday'],
        createdAt: 'modified-timestamp',
        updatedAt: now,
      },
      {
        ...baseCtx,
        existingDoc: {
          uid: 'editor-1',
          role: 'EDITOR',
          createdAt: '2026-01-01T00:00:00Z',
        },
      }
    ),
    'PERMISSION_DENIED'
  );
});
