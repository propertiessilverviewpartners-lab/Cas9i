# CAS9i Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every path not explicitly matched is denied for both read and write.
2. **Verified Authentication**: All client Firestore reads/writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Permanent User Records & Admin Control**:
   - Registered user documents in `/users/{userId}` persist permanently until explicitly deleted by Admin (`isAdmin()`).
   - Non-admin self-registration (`create`) MUST enforce `authUid == request.auth.uid`, `balance == 0`, `verified == true`, `accountTier == 'Standard'`, and server timestamp `updatedAt == request.time`.
   - Non-admin users can NEVER elevate `balance` arbitrarily via spoofed `accountTier`, `verified`, `id`, or `createdAt` changes, and can ONLY read/query their own user document (`existing().authUid == request.auth.uid`).
4. **PII Isolation**: Emails, phone numbers, addresses, and KYC IDs in `/users/{userId}` are readable ONLY by the document owner (`authUid == request.auth.uid`) or Admin.
5. **Tombstone Integrity**: Deleted user IDs (`/deletedUsers/{userId}`) and deleted club IDs (`/deletedClubs/{clubId}`) can ONLY be created/modified/deleted by Admin, preventing stale devices from re-creating deleted records.
6. **Temporal Integrity & Path Hardening**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (<= 128 chars), every string has explicit `.size()` bounds, and server timestamps (`updatedAt` / `deletedAt`) must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated User Read/Write**: `auth = null` attempting `get(/users/100001)` or `create(/users/100001)` -> `PERMISSION_DENIED`.
2. **Email Spoofing (Unverified Email)**: `auth = { email: 'info.mipodi@gmail.com', email_verified: false }` attempting Admin read/write -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: Non-admin user (`uid: 'u1'`) creating `/users/100001` with `authUid: 'u2'` -> `PERMISSION_DENIED`.
4. **Initial Balance Inflation**: Non-admin user creating `/users/100001` with `balance: 50000` -> `PERMISSION_DENIED`.
5. **Privilege Escalation (Self-Admin)**: Non-admin user creating `/admins/u1` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection on Create**: Creating `/users/100001` with extra ghost field `isSuperAdmin: true` -> `PERMISSION_DENIED` (`hasOnly` check).
7. **PII Blanket Read / Scraping**: Non-admin user `'u1'` attempting `get(/users/100002)` owned by `'u2'` or listing `/users` without owning `authUid` -> `PERMISSION_DENIED`.
8. **Immutable Field Tampering**: Owner `'u1'` attempting to change `createdAt` or `id` on `/users/100001` -> `PERMISSION_DENIED`.
9. **Account Tier Escalation**: Owner `'u1'` attempting to update `accountTier: 'VIP'` on `/users/100001` -> `PERMISSION_DENIED`.
10. **Non-Admin User Deletion**: Non-admin user `'u1'` attempting `delete(/users/100002)` -> `PERMISSION_DENIED`.
11. **Counter Hijack**: Non-admin user updating `/meta/counters` by jumping `nextUserNumericId` by `+50` or `-1` instead of `+1` -> `PERMISSION_DENIED`.
12. **Resource Poisoning (Oversized ID / String)**: Sending a 500-char document ID or invalid characters (`../etc`) or 2000-char `username` -> `PERMISSION_DENIED`.
