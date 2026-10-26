# Security Specification - Meet Azzoun Medical Complex (`مجمع ميت عزون الطبي`)

## 1. Data Invariants
1. **Default Deny Catch-All**: Any path not explicitly matched (`/settings/{settingId}`, `/schedules/{dayId}`, `/users/{userId}`, `/auditLogs/{logId}`, `/admins/{adminId}`) is denied for all reads and writes.
2. **Role-Based Access Control (RBAC)**:
   - `ADMIN`: Verified primary owner (`ahmed0soliman6@gmail.com` with `email_verified == true`), or a user with a document in `/admins/{uid}`, or `/users/{uid}.data.role == 'ADMIN'`. Can manage settings, all schedules, user roles, and read all audit logs.
   - `EDITOR`: Authenticated verified user with `/users/{uid}.data.role == 'EDITOR'`. Can update daily schedules (for days included in `allowedDays`) and append audit log entries. Cannot elevate roles or alter global center settings unless Admin.
   - `VIEWER` / Public: Can read `/settings/center` and published `/schedules/{dayId}` where `isPublic == true`. Cannot write to schedules, settings, or audit logs.
3. **PII Isolation (`/users/{userId}`)**:
   - Reading user profiles (which contain `email`) is strictly restricted to the profile owner (`request.auth.uid == userId`) or an `ADMIN`. Blanket `isSignedIn()` reads are forbidden.
   - During self-registration (`create`), a non-admin user can only register themselves with `role == 'VIEWER'` (or `ADMIN` if they are the verified bootstrap admin email). Privilege escalation via self-assigning `ADMIN` or `EDITOR` is blocked.
4. **Strict Schema, Key Allowlists, & Volumetric Boundaries**:
   - Every `create` operation enforces `hasAll` and `hasOnly` on document keys.
   - Every `update` operation calls `isValid[Entity](incoming())` first and uses `incoming().diff(existing()).affectedKeys().hasOnly(...)` in action-based branches.
   - Every string field enforces `.size() >= min && .size() <= max`. Every array (`draftRows`, `publishedRows`, `allowedDays`) enforces `.size() <= MAX`.
5. **Temporal Integrity**:
   - `createdAt` and `updatedAt` must equal `request.time`.
   - `auditLogs` are append-only (`allow update, delete: if false;`).

## 2. The "Dirty Dozen" Payloads (Rejected with PERMISSION_DENIED)
1. **Unauthenticated Schedule Write**: `auth: null`, writing to `/schedules/saturday` -> Rejected by `isSignedIn()`.
2. **Unverified Admin Email Spoof**: `auth: { email: 'ahmed0soliman6@gmail.com', email_verified: false }` attempting to write `/settings/center` -> Rejected by `email_verified == true`.
3. **Self-Assigned Admin Privilege Escalation**: Standard user creating `/users/user123` with `{ role: 'ADMIN' }` -> Rejected by `incoming().role == 'VIEWER'`.
4. **Shadow Field Injection on Schedule**: Editor sending `{ ...validSchedule, isHacked: true }` to `/schedules/saturday` -> Rejected by `hasOnly()` in `isValidDailySchedule()`.
5. **Value Poisoning (1MB String)**: Editor sending a 10,000-char `dayLabel` to `/schedules/saturday` -> Rejected by `data.dayLabel.size() <= 30`.
6. **ID Poisoning**: Creating `/users/invalid$id!@#` -> Rejected by `isValidId(userId)`.
7. **PII Blanket Read**: Authenticated `userA` attempting `get` on `/users/userB` -> Rejected by `isOwner(userId) || isAdmin()`.
8. **Timestamp Forgery**: Client passing a past or future timestamp instead of `request.time` for `updatedAt` -> Rejected by `incoming().updatedAt == request.time`.
9. **Identity Spoofing in Audit Log**: Authenticated `userA` creating `/auditLogs/log1` with `userId: 'userB'` -> Rejected by `incoming().userId == request.auth.uid`.
10. **Audit Log Tampering / Deletion**: Admin or Editor attempting `update` or `delete` on `/auditLogs/log1` -> Rejected by `allow update, delete: if false`.
11. **Unbounded Array Exhaustion**: Editor submitting `draftRows` with 200 items -> Rejected by `data.draftRows.size() <= 60`.
12. **Immutable Field Mutation**: User updating `/users/userA` and changing `uid` or `createdAt` -> Rejected by `incoming().uid == existing().uid && incoming().createdAt == existing().createdAt`.
