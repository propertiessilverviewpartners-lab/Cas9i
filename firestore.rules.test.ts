/**
 * CAS9i Firestore Security Rules Verification Spec
 * Documents the 12 adversarial ("Dirty Dozen") payloads and expected PERMISSION_DENIED assertions
 * verified against firestore.rules.
 */

export interface SecurityTestCase {
  name: string;
  actor: { uid?: string; email?: string; email_verified?: boolean } | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    name: '1. Unauthenticated read on /users/100001',
    actor: null,
    operation: 'get',
    path: 'users/100001',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Email spoofing with email_verified=false for admin email',
    actor: { uid: 'spoof-1', email: 'info.mipodi@gmail.com', email_verified: false },
    operation: 'list',
    path: 'users',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Identity spoofing creating user with someone else authUid',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'create',
    path: 'users/100001',
    payload: {
      id: '100001',
      authUid: 'u2',
      username: 'Attacker',
      fullName: 'Attacker User',
      email: 'u1@example.com',
      avatar: '🦁',
      balance: 0,
      verified: true,
      createdAt: 1700000000000,
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Initial balance inflation on user registration',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'create',
    path: 'users/100001',
    payload: {
      id: '100001',
      authUid: 'u1',
      username: 'RichFake',
      fullName: 'Fake Balance',
      email: 'u1@example.com',
      avatar: '🦁',
      balance: 50000,
      verified: true,
      createdAt: 1700000000000,
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Self-assigned admin privilege escalation',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'create',
    path: 'admins/u1',
    payload: { uid: 'u1', email: 'u1@example.com', createdAt: 'REQUEST_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Shadow field injection on user creation',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'create',
    path: 'users/100001',
    payload: {
      id: '100001',
      authUid: 'u1',
      username: 'Shadow',
      fullName: 'Shadow Field',
      email: 'u1@example.com',
      avatar: '🦁',
      balance: 0,
      verified: true,
      isSuperAdmin: true,
      createdAt: 1700000000000,
      updatedAt: 'REQUEST_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. PII blanket get on another user profile',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'get',
    path: 'users/100002',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Immutable field tampering (createdAt) on user update',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'update',
    path: 'users/100001',
    payload: { createdAt: 9999999, updatedAt: 'REQUEST_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Account tier escalation by non-admin user',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'update',
    path: 'users/100001',
    payload: { accountTier: 'VIP', updatedAt: 'REQUEST_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Non-admin attempting to delete a user profile',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'delete',
    path: 'users/100002',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Counter jump (+50 instead of +1) by non-admin',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'update',
    path: 'meta/counters',
    payload: { nextUserNumericId: 100051, updatedAt: 'REQUEST_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Resource poisoning with oversized/invalid path ID',
    actor: { uid: 'u1', email: 'u1@example.com', email_verified: true },
    operation: 'create',
    path: `users/${'a'.repeat(200)}`,
    payload: { id: 'bad', username: 'x', fullName: 'x', email: 'x@y.z', avatar: '🦁', balance: 0, verified: true, createdAt: 1, updatedAt: 'REQUEST_TIME' },
    expected: 'PERMISSION_DENIED',
  },
];
