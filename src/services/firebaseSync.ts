import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  runTransaction,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  ADMIN_GOOGLE_EMAIL,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import type { Club, DtmMatchRule, H2HRecord, League, RegisteredUser, UserProfile, VirtualMatch } from '../types';

export interface CloudUserRecord {
  user: RegisteredUser;
  authUid?: string;
}

export interface CloudMatchRecord {
  id: string;
  league: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  homeClubId?: string;
  awayClubId?: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  startsInSeconds: number;
  isFeatured: boolean;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
}

export interface AdminCloudSnapshotState {
  users: CloudUserRecord[];
  deletedUserIds: string[];
  clubs: Club[];
  deletedClubIds: string[];
  leagues: League[];
  matches: CloudMatchRecord[];
  dtmRules: DtmMatchRule[];
  h2hRecords: H2HRecord[];
}

function sanitizeId(raw: string): string {
  const cleaned = raw.trim().replace(/^#/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
  return (cleaned || `id-${Date.now()}`).slice(0, 128);
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : fallback;
  return str.slice(0, maxLen);
}

export function isFirebaseAdminUser(fbUser: FirebaseUser | null | undefined): boolean {
  return Boolean(
    fbUser &&
      fbUser.emailVerified &&
      fbUser.email?.toLowerCase() === ADMIN_GOOGLE_EMAIL
  );
}

export async function signInWithGooglePopup(): Promise<FirebaseUser> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  if (auth.currentUser) {
    await signOut(auth);
  }
}

export function subscribeFirebaseAuth(
  callback: (fbUser: FirebaseUser | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function ensureBootstrappedAdminRecord(fbUser: FirebaseUser): Promise<void> {
  if (!isFirebaseAdminUser(fbUser)) return;
  const adminRef = doc(db, 'admins', fbUser.uid);
  try {
    const snap = await getDoc(adminRef);
    if (!snap.exists()) {
      await setDoc(adminRef, {
        uid: fbUser.uid,
        email: ADMIN_GOOGLE_EMAIL,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admins/${fbUser.uid}`);
  }
}

function docToRegisteredUser(id: string, data: DocumentData): RegisteredUser {
  return {
    id: typeof data.id === 'string' && data.id ? data.id : id,
    username: typeof data.username === 'string' ? data.username : 'Player',
    fullName: typeof data.fullName === 'string' ? data.fullName : 'Player',
    email: typeof data.email === 'string' ? data.email : '',
    avatar: typeof data.avatar === 'string' && data.avatar ? data.avatar : '🦁',
    balance: typeof data.balance === 'number' && Number.isFinite(data.balance) ? data.balance : 0,
    verified: Boolean(data.verified),
    createdAt: typeof data.createdAt === 'number' && data.createdAt > 0 ? data.createdAt : Date.now(),
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    country: typeof data.country === 'string' ? data.country : undefined,
    city: typeof data.city === 'string' ? data.city : undefined,
    address: typeof data.address === 'string' ? data.address : undefined,
    dateOfBirth: typeof data.dateOfBirth === 'string' ? data.dateOfBirth : undefined,
    kycIdNumber: typeof data.kycIdNumber === 'string' ? data.kycIdNumber : undefined,
    accountTier:
      data.accountTier === 'VIP' || data.accountTier === 'Suspended' || data.accountTier === 'Standard'
        ? data.accountTier
        : 'Standard',
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    lastDepositAt: typeof data.lastDepositAt === 'number' ? data.lastDepositAt : undefined,
    lastDepositAmount: typeof data.lastDepositAmount === 'number' ? data.lastDepositAmount : undefined,
    totalBetsPlaced: typeof data.totalBetsPlaced === 'number' ? data.totalBetsPlaced : 0,
    totalWon: typeof data.totalWon === 'number' ? data.totalWon : 0,
    placedBetsCount: typeof data.placedBetsCount === 'number' ? data.placedBetsCount : 0,
    fxPositionsCount: typeof data.fxPositionsCount === 'number' ? data.fxPositionsCount : 0,
  };
}

function buildAdminUserPayload(
  user: RegisteredUser,
  authUid: string | undefined,
  preservedCreatedAt?: number
): Record<string, unknown> {
  const cleanId = sanitizeId(user.id).slice(0, 64);
  const email = clampString(user.email, 160, `${cleanId}@cas9i.com`).toLowerCase();
  const payload: Record<string, unknown> = {
    id: cleanId,
    username: clampString(user.username, 64, `Player_${cleanId}`),
    fullName: clampString(user.fullName, 120, user.username || `Player ${cleanId}`),
    email: email.length >= 3 ? email : `${cleanId}@cas9i.com`,
    avatar: clampString(user.avatar, 16, '🦁') || '🦁',
    balance: Math.max(0, Math.round((Number(user.balance) || 0) * 100) / 100),
    verified: Boolean(user.verified),
    createdAt:
      typeof preservedCreatedAt === 'number' && preservedCreatedAt > 0
        ? preservedCreatedAt
        : typeof user.createdAt === 'number' && user.createdAt > 0
        ? user.createdAt
        : Date.now(),
    updatedAt: serverTimestamp(),
  };

  if (authUid && authUid.trim()) {
    payload.authUid = clampString(authUid, 128);
  }
  if (typeof user.phone === 'string') payload.phone = clampString(user.phone, 40);
  if (typeof user.country === 'string') payload.country = clampString(user.country, 80);
  if (typeof user.city === 'string') payload.city = clampString(user.city, 80);
  if (typeof user.address === 'string') payload.address = clampString(user.address, 200);
  if (typeof user.dateOfBirth === 'string') payload.dateOfBirth = clampString(user.dateOfBirth, 32);
  if (typeof user.kycIdNumber === 'string') payload.kycIdNumber = clampString(user.kycIdNumber, 64);
  if (
    user.accountTier === 'Standard' ||
    user.accountTier === 'VIP' ||
    user.accountTier === 'Suspended'
  ) {
    payload.accountTier = user.accountTier;
  }
  if (typeof user.notes === 'string') payload.notes = clampString(user.notes, 500);
  if (typeof user.lastDepositAt === 'number' && Number.isFinite(user.lastDepositAt)) {
    payload.lastDepositAt = user.lastDepositAt;
  }
  if (
    typeof user.lastDepositAmount === 'number' &&
    Number.isFinite(user.lastDepositAmount) &&
    user.lastDepositAmount >= 0
  ) {
    payload.lastDepositAmount = user.lastDepositAmount;
  }
  if (
    typeof user.totalBetsPlaced === 'number' &&
    Number.isFinite(user.totalBetsPlaced) &&
    user.totalBetsPlaced >= 0
  ) {
    payload.totalBetsPlaced = user.totalBetsPlaced;
  }
  if (
    typeof user.totalWon === 'number' &&
    Number.isFinite(user.totalWon) &&
    user.totalWon >= 0
  ) {
    payload.totalWon = user.totalWon;
  }
  if (
    typeof user.placedBetsCount === 'number' &&
    Number.isFinite(user.placedBetsCount) &&
    user.placedBetsCount >= 0
  ) {
    payload.placedBetsCount = user.placedBetsCount;
  }
  if (
    typeof user.fxPositionsCount === 'number' &&
    Number.isFinite(user.fxPositionsCount) &&
    user.fxPositionsCount >= 0
  ) {
    payload.fxPositionsCount = user.fxPositionsCount;
  }

  return payload;
}

export async function findOrCreateGoogleUser(
  fbUser: FirebaseUser,
  preferredAvatar = '🦁'
): Promise<{ user: RegisteredUser | null; deleted: boolean }> {
  const usersQuery = query(collection(db, 'users'), where('authUid', '==', fbUser.uid));
  try {
    const snap = await getDocs(usersQuery);
    if (!snap.empty) {
      const existingDoc = snap.docs[0];
      const existingUser = docToRegisteredUser(existingDoc.id, existingDoc.data());
      const tombSnap = await getDoc(doc(db, 'deletedUsers', existingUser.id));
      if (tombSnap.exists()) {
        return { user: null, deleted: true };
      }
      return { user: existingUser, deleted: false };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }

  const counterRef = doc(db, 'meta', 'counters');
  const rawEmail = (fbUser.email || '').trim().toLowerCase().slice(0, 160);
  const emailLocal = (rawEmail.split('@')[0] || 'player').replace(/[^a-zA-Z0-9_.-]/g, '');
  const displayName = (fbUser.displayName || '').trim();
  const safeFullName = (displayName || emailLocal || 'CAS9i Player').slice(0, 120);
  const safeUsernameBase = (emailLocal || displayName.replace(/\s+/g, '') || 'Player').slice(0, 56);
  const safeAvatar = clampString(preferredAvatar, 16, '🦁') || '🦁';
  const now = Date.now();

  try {
    const createdUser = await runTransaction(db, async transaction => {
      const counterSnap = await transaction.get(counterRef);
      let assignedNum = 100001;
      if (counterSnap.exists()) {
        const currentNext = Number(counterSnap.data()?.nextUserNumericId || 100001);
        assignedNum = Math.max(100001, Math.floor(currentNext));
      }
      const newId = String(assignedNum);
      const uniqueUsername = `${safeUsernameBase}_${newId.slice(-3)}`.slice(0, 64);
      const userRef = doc(db, 'users', newId);

      transaction.set(counterRef, {
        nextUserNumericId: assignedNum + 1,
        updatedAt: serverTimestamp(),
      });

      const docPayload = {
        id: newId,
        authUid: fbUser.uid,
        username: uniqueUsername,
        fullName: safeFullName,
        email: rawEmail.length >= 3 ? rawEmail : `player${newId}@cas9i.com`,
        avatar: safeAvatar,
        balance: 0,
        verified: true,
        accountTier: 'Standard' as const,
        createdAt: now,
        updatedAt: serverTimestamp(),
        totalBetsPlaced: 0,
        totalWon: 0,
        placedBetsCount: 0,
        fxPositionsCount: 0,
      };
      transaction.set(userRef, docPayload);

      return docToRegisteredUser(newId, { ...docPayload, updatedAt: now });
    });

    return { user: createdUser, deleted: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'meta/counters');
  }
}

export function subscribeOwnCloudUser(
  fbUser: FirebaseUser,
  expectedUserId: string,
  onUpdate: (user: RegisteredUser) => void,
  onDeleted: () => void
): Unsubscribe {
  const usersQuery = query(collection(db, 'users'), where('authUid', '==', fbUser.uid));
  return onSnapshot(
    usersQuery,
    async snap => {
      if (snap.empty) {
        if (expectedUserId && expectedUserId !== 'guest') {
          try {
            const tombSnap = await getDoc(doc(db, 'deletedUsers', sanitizeId(expectedUserId)));
            if (tombSnap.exists()) {
              onDeleted();
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `deletedUsers/${expectedUserId}`);
          }
        }
        return;
      }
      const docSnap = snap.docs[0];
      onUpdate(docToRegisteredUser(docSnap.id, docSnap.data()));
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  );
}

export async function syncOwnUserProfileToCloud(
  user: UserProfile,
  placedBetsCount: number,
  fxPositionsCount: number
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !user.isLoggedIn || user.isAdmin || !user.id || user.id === 'guest') {
    return;
  }
  const cleanId = sanitizeId(user.id);
  const userRef = doc(db, 'users', cleanId);
  const updates: Record<string, unknown> = {
    username: clampString(user.username, 64, `Player_${cleanId}`),
    fullName: clampString(user.fullName || user.username, 120, user.username || 'Player'),
    avatar: clampString(user.avatar, 16, '🦁') || '🦁',
    balance: Math.max(0, Math.round((Number(user.balance) || 0) * 100) / 100),
    totalBetsPlaced: Math.max(0, Number(user.totalBetsPlaced) || 0),
    totalWon: Math.max(0, Number(user.totalWon) || 0),
    placedBetsCount: Math.max(0, Number(placedBetsCount) || 0),
    fxPositionsCount: Math.max(0, Number(fxPositionsCount) || 0),
    updatedAt: serverTimestamp(),
  };

  if (typeof user.phone === 'string') updates.phone = clampString(user.phone, 40);
  if (typeof user.country === 'string') updates.country = clampString(user.country, 80);
  if (typeof user.city === 'string') updates.city = clampString(user.city, 80);
  if (typeof user.address === 'string') updates.address = clampString(user.address, 200);
  if (typeof user.dateOfBirth === 'string') updates.dateOfBirth = clampString(user.dateOfBirth, 32);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    if (snap.data()?.authUid !== fbUser.uid) return;
    await updateDoc(userRef, updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${cleanId}`);
  }
}

export async function upsertCloudUser(
  user: RegisteredUser,
  knownAuthUid?: string
): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(user.id).slice(0, 64);
  const userRef = doc(db, 'users', cleanId);
  try {
    const existingSnap = await getDoc(userRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : undefined;
    const preservedCreatedAt =
      typeof existingData?.createdAt === 'number' && existingData.createdAt > 0
        ? existingData.createdAt
        : undefined;
    const resolvedAuthUid =
      knownAuthUid ??
      (typeof existingData?.authUid === 'string' ? existingData.authUid : undefined);
    const payload = buildAdminUserPayload(user, resolvedAuthUid, preservedCreatedAt);
    await setDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${cleanId}`);
  }
}

export async function deleteCloudUserWithTombstone(userId: string): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(userId).slice(0, 64);
  const batch = writeBatch(db);
  batch.set(doc(db, 'deletedUsers', cleanId), {
    userId: cleanId,
    deletedAt: serverTimestamp(),
    deletedBy: clampString(auth.currentUser?.uid || ADMIN_GOOGLE_EMAIL, 128, ADMIN_GOOGLE_EMAIL),
  });
  batch.delete(doc(db, 'users', cleanId));
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${cleanId}`);
  }
}

export async function syncMetaCounterToAtLeast(minNextId: number): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const safeMin = Math.max(100001, Math.floor(minNextId));
  const counterRef = doc(db, 'meta', 'counters');
  try {
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(counterRef);
      const current = snap.exists() ? Number(snap.data()?.nextUserNumericId || 100001) : 100001;
      if (!snap.exists() || safeMin > current) {
        transaction.set(counterRef, {
          nextUserNumericId: Math.max(safeMin, current),
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'meta/counters');
  }
}

export async function upsertCloudClub(club: Club): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(club.id);
  try {
    await setDoc(doc(db, 'clubs', cleanId), {
      id: cleanId,
      name: clampString(club.name, 100, 'Club'),
      shortName: clampString(club.shortName, 10, 'CLB').toUpperCase(),
      country: clampString(club.country, 80, 'International'),
      league: clampString(club.league, 120, 'Virtual League'),
      crest: clampString(club.crest, 16, '🛡️') || '🛡️',
      attack: Math.max(1, Math.min(100, Number(club.attack) || 75)),
      defense: Math.max(1, Math.min(100, Number(club.defense) || 75)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clubs/${cleanId}`);
  }
}

export async function deleteCloudClubWithTombstone(clubId: string): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(clubId);
  const batch = writeBatch(db);
  batch.set(doc(db, 'deletedClubs', cleanId), {
    clubId: cleanId,
    deletedAt: serverTimestamp(),
    deletedBy: clampString(auth.currentUser?.uid || ADMIN_GOOGLE_EMAIL, 128, ADMIN_GOOGLE_EMAIL),
  });
  batch.delete(doc(db, 'clubs', cleanId));
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `clubs/${cleanId}`);
  }
}

export async function upsertCloudLeague(league: League): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(league.id);
  const leagueRef = doc(db, 'leagues', cleanId);
  try {
    const existingSnap = await getDoc(leagueRef);
    const preservedCreatedAt =
      existingSnap.exists() && typeof existingSnap.data()?.createdAt === 'number'
        ? existingSnap.data().createdAt
        : league.createdAt > 0
        ? league.createdAt
        : Date.now();
    await setDoc(leagueRef, {
      id: cleanId,
      name: clampString(league.name, 120, 'Virtual League'),
      country: clampString(league.country, 80, 'International'),
      icon: clampString(league.icon, 16, '🏆') || '🏆',
      isCustom: Boolean(league.isCustom),
      createdAt: preservedCreatedAt,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `leagues/${cleanId}`);
  }
}

export async function upsertCloudMatch(
  match: VirtualMatch,
  clubIds?: { homeClubId?: string; awayClubId?: string }
): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(match.id);
  const payload: Record<string, unknown> = {
    id: cleanId,
    league: clampString(match.league, 120, 'Virtual League'),
    country: clampString(match.country, 80, 'International'),
    homeTeam: clampString(match.homeTeam, 100, 'Home'),
    awayTeam: clampString(match.awayTeam, 100, 'Away'),
    homeScore: Math.max(0, Math.floor(Number(match.homeScore) || 0)),
    awayScore: Math.max(0, Math.floor(Number(match.awayScore) || 0)),
    minute: Math.max(0, Math.floor(Number(match.minute) || 0)),
    status:
      match.status === 'LIVE' || match.status === 'FINISHED' ? match.status : 'UPCOMING',
    startsInSeconds: Math.max(0, Math.floor(Number(match.startsInSeconds) || 0)),
    isFeatured: Boolean(match.isFeatured),
    homeOdds: Math.max(1.0, Number(match.odds?.home || 2.1)),
    drawOdds: Math.max(1.0, Number(match.odds?.draw || 3.2)),
    awayOdds: Math.max(1.0, Number(match.odds?.away || 3.3)),
    updatedAt: serverTimestamp(),
  };
  if (clubIds?.homeClubId) payload.homeClubId = sanitizeId(clubIds.homeClubId);
  if (clubIds?.awayClubId) payload.awayClubId = sanitizeId(clubIds.awayClubId);

  try {
    await setDoc(doc(db, 'matches', cleanId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `matches/${cleanId}`);
  }
}

export async function deleteCloudMatch(matchId: string): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(matchId);
  try {
    await deleteDoc(doc(db, 'matches', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `matches/${cleanId}`);
  }
}

function docToDtmRule(id: string, data: DocumentData): DtmMatchRule {
  const rule: DtmMatchRule = {
    id: typeof data.id === 'string' && data.id ? data.id : id,
    matchId: String(data.matchId || ''),
    homeTeam: String(data.homeTeam || ''),
    awayTeam: String(data.awayTeam || ''),
    league: String(data.league || 'Virtual League'),
    enabled: Boolean(data.enabled),
    updatedAtMs: typeof data.updatedAtMs === 'number' && data.updatedAtMs > 0 ? data.updatedAtMs : Date.now(),
  };

  if (data.winner1X2 === 'Home & O15' || data.winner1X2 === 'Draw' || data.winner1X2 === 'Away & O15') {
    rule.winner1X2 = data.winner1X2;
  }
  if (data.firstGoal === 'Home' || data.firstGoal === 'Away') {
    rule.firstGoal = data.firstGoal;
  }
  if (data.fiveMinGoal === 'Yes' || data.fiveMinGoal === 'No' || data.fiveMinGoal === 'Over 5 Goals') {
    rule.fiveMinGoal = data.fiveMinGoal;
  }
  if (data.oddEven === 'Odd' || data.oddEven === 'Even') {
    rule.oddEven = data.oddEven;
  }
  if (data.firstHalf === 'Home & O10' || data.firstHalf === 'X & O10' || data.firstHalf === 'Away & O10') {
    rule.firstHalf = data.firstHalf;
  }
  if (data.firstHalfOU15 === 'Over 15' || data.firstHalfOU15 === 'Under 15') {
    rule.firstHalfOU15 = data.firstHalfOU15;
  }
  if (data.secondHalf === 'Home & O15' || data.secondHalf === 'X & O15' || data.secondHalf === 'Away & O15') {
    rule.secondHalf = data.secondHalf;
  }
  if (typeof data.overUnderLine === 'number' && data.overUnderLine >= 15 && data.overUnderLine <= 30) {
    rule.overUnderLine = Math.floor(data.overUnderLine);
  }
  if (data.overUnderPick === 'Over' || data.overUnderPick === 'Under') {
    rule.overUnderPick = data.overUnderPick;
  }
  if (typeof data.overUnderTargetGoals === 'number' && data.overUnderTargetGoals >= 0) {
    rule.overUnderTargetGoals = Math.floor(data.overUnderTargetGoals);
  }
  if (typeof data.correctScoreHome === 'number' && typeof data.correctScoreAway === 'number') {
    rule.correctScoreHome = Math.max(0, Math.min(99, Math.floor(data.correctScoreHome)));
    rule.correctScoreAway = Math.max(0, Math.min(99, Math.floor(data.correctScoreAway)));
  }

  return rule;
}

export async function upsertCloudDtmRule(rule: DtmMatchRule): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(rule.id);
  const payload: Record<string, unknown> = {
    id: cleanId,
    matchId: clampString(rule.matchId, 128, cleanId),
    homeTeam: clampString(rule.homeTeam, 100, 'Home'),
    awayTeam: clampString(rule.awayTeam, 100, 'Away'),
    league: clampString(rule.league, 120, 'Virtual League') || 'Virtual League',
    enabled: Boolean(rule.enabled),
    updatedAtMs: typeof rule.updatedAtMs === 'number' && rule.updatedAtMs > 0 ? rule.updatedAtMs : Date.now(),
    updatedAt: serverTimestamp(),
  };

  if (rule.winner1X2 === 'Home & O15' || rule.winner1X2 === 'Draw' || rule.winner1X2 === 'Away & O15') {
    payload.winner1X2 = rule.winner1X2;
  }
  if (rule.firstGoal === 'Home' || rule.firstGoal === 'Away') {
    payload.firstGoal = rule.firstGoal;
  }
  if (rule.fiveMinGoal === 'Yes' || rule.fiveMinGoal === 'No' || rule.fiveMinGoal === 'Over 5 Goals') {
    payload.fiveMinGoal = rule.fiveMinGoal;
  }
  if (rule.oddEven === 'Odd' || rule.oddEven === 'Even') {
    payload.oddEven = rule.oddEven;
  }
  if (rule.firstHalf === 'Home & O10' || rule.firstHalf === 'X & O10' || rule.firstHalf === 'Away & O10') {
    payload.firstHalf = rule.firstHalf;
  }
  if (rule.firstHalfOU15 === 'Over 15' || rule.firstHalfOU15 === 'Under 15') {
    payload.firstHalfOU15 = rule.firstHalfOU15;
  }
  if (rule.secondHalf === 'Home & O15' || rule.secondHalf === 'X & O15' || rule.secondHalf === 'Away & O15') {
    payload.secondHalf = rule.secondHalf;
  }
  if (typeof rule.overUnderLine === 'number' && rule.overUnderLine >= 15 && rule.overUnderLine <= 30) {
    payload.overUnderLine = Math.floor(rule.overUnderLine);
  }
  if (rule.overUnderPick === 'Over' || rule.overUnderPick === 'Under') {
    payload.overUnderPick = rule.overUnderPick;
  }
  if (
    typeof rule.overUnderTargetGoals === 'number' &&
    Number.isFinite(rule.overUnderTargetGoals) &&
    rule.overUnderTargetGoals >= 0
  ) {
    payload.overUnderTargetGoals = Math.min(99, Math.floor(rule.overUnderTargetGoals));
  }
  if (
    typeof rule.correctScoreHome === 'number' &&
    Number.isFinite(rule.correctScoreHome) &&
    typeof rule.correctScoreAway === 'number' &&
    Number.isFinite(rule.correctScoreAway)
  ) {
    payload.correctScoreHome = Math.max(0, Math.min(99, Math.floor(rule.correctScoreHome)));
    payload.correctScoreAway = Math.max(0, Math.min(99, Math.floor(rule.correctScoreAway)));
  }

  try {
    await setDoc(doc(db, 'dtmRules', cleanId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `dtmRules/${cleanId}`);
  }
}

export async function deleteCloudDtmRule(ruleId: string): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(ruleId);
  try {
    await deleteDoc(doc(db, 'dtmRules', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `dtmRules/${cleanId}`);
  }
}

function docToH2HRecord(id: string, data: DocumentData): H2HRecord {
  return {
    id: typeof data.id === 'string' && data.id ? data.id : id,
    matchId: String(data.matchId || ''),
    roundNumber: Math.max(1, Math.floor(Number(data.roundNumber) || 1)),
    league: String(data.league || 'Virtual League'),
    homeTeam: String(data.homeTeam || 'Home'),
    awayTeam: String(data.awayTeam || 'Away'),
    homeScore: Math.max(0, Math.floor(Number(data.homeScore) || 0)),
    awayScore: Math.max(0, Math.floor(Number(data.awayScore) || 0)),
    firstHalfHomeScore: Math.max(0, Math.floor(Number(data.firstHalfHomeScore) || 0)),
    firstHalfAwayScore: Math.max(0, Math.floor(Number(data.firstHalfAwayScore) || 0)),
    firstGoalTeam:
      data.firstGoalTeam === 'home' || data.firstGoalTeam === 'away' ? data.firstGoalTeam : undefined,
    hadFiveMinGoal: Boolean(data.hadFiveMinGoal),
    isZoom: Boolean(data.isZoom),
    playedAt: typeof data.playedAt === 'number' && data.playedAt > 0 ? data.playedAt : Date.now(),
  };
}

export async function upsertCloudH2HRecord(record: H2HRecord): Promise<void> {
  if (!isFirebaseAdminUser(auth.currentUser)) return;
  const cleanId = sanitizeId(record.id);
  const payload: Record<string, unknown> = {
    id: cleanId,
    matchId: clampString(record.matchId, 128, cleanId) || cleanId,
    roundNumber: Math.max(1, Math.floor(Number(record.roundNumber) || 1)),
    league: clampString(record.league, 120, 'Virtual League') || 'Virtual League',
    homeTeam: clampString(record.homeTeam, 100, 'Home') || 'Home',
    awayTeam: clampString(record.awayTeam, 100, 'Away') || 'Away',
    homeScore: Math.max(0, Math.min(999, Math.floor(Number(record.homeScore) || 0))),
    awayScore: Math.max(0, Math.min(999, Math.floor(Number(record.awayScore) || 0))),
    firstHalfHomeScore: Math.max(0, Math.min(999, Math.floor(Number(record.firstHalfHomeScore) || 0))),
    firstHalfAwayScore: Math.max(0, Math.min(999, Math.floor(Number(record.firstHalfAwayScore) || 0))),
    hadFiveMinGoal: Boolean(record.hadFiveMinGoal),
    isZoom: Boolean(record.isZoom),
    playedAt: typeof record.playedAt === 'number' && record.playedAt > 0 ? record.playedAt : Date.now(),
    updatedAt: serverTimestamp(),
  };
  if (record.firstGoalTeam === 'home' || record.firstGoalTeam === 'away') {
    payload.firstGoalTeam = record.firstGoalTeam;
  }

  try {
    await setDoc(doc(db, 'h2hRecords', cleanId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `h2hRecords/${cleanId}`);
  }
}

export function subscribeAdminCloudCollections(
  onChange: (state: AdminCloudSnapshotState) => void
): Unsubscribe {
  const currentState: AdminCloudSnapshotState = {
    users: [],
    deletedUserIds: [],
    clubs: [],
    deletedClubIds: [],
    leagues: [],
    matches: [],
    dtmRules: [],
    h2hRecords: [],
  };

  let hydratedCount = 0;
  const seenSlices = new Set<string>();
  const emitIfReady = (sliceKey: string) => {
    if (!seenSlices.has(sliceKey)) {
      seenSlices.add(sliceKey);
      hydratedCount += 1;
    }
    if (hydratedCount >= 2) {
      onChange({
        users: [...currentState.users],
        deletedUserIds: [...currentState.deletedUserIds],
        clubs: [...currentState.clubs],
        deletedClubIds: [...currentState.deletedClubIds],
        leagues: [...currentState.leagues],
        matches: [...currentState.matches],
        dtmRules: [...currentState.dtmRules],
        h2hRecords: [...currentState.h2hRecords],
      });
    }
  };

  const unsubUsers = onSnapshot(
    collection(db, 'users'),
    snap => {
      currentState.users = snap.docs.map(d => {
        const data = d.data();
        return {
          user: docToRegisteredUser(d.id, data),
          authUid: typeof data.authUid === 'string' ? data.authUid : undefined,
        };
      });
      emitIfReady('users');
    },
    error => handleFirestoreError(error, OperationType.LIST, 'users')
  );

  const unsubDeletedUsers = onSnapshot(
    collection(db, 'deletedUsers'),
    snap => {
      currentState.deletedUserIds = snap.docs.map(d => d.id);
      emitIfReady('deletedUsers');
    },
    error => handleFirestoreError(error, OperationType.LIST, 'deletedUsers')
  );

  const unsubClubs = onSnapshot(
    collection(db, 'clubs'),
    snap => {
      currentState.clubs = snap.docs.map(d => {
        const data = d.data();
        return {
          id: typeof data.id === 'string' ? data.id : d.id,
          name: String(data.name || ''),
          shortName: String(data.shortName || ''),
          country: String(data.country || ''),
          league: String(data.league || ''),
          crest: String(data.crest || '🛡️'),
          attack: Number(data.attack) || 75,
          defense: Number(data.defense) || 75,
        };
      });
      emitIfReady('clubs');
    },
    error => handleFirestoreError(error, OperationType.LIST, 'clubs')
  );

  const unsubDeletedClubs = onSnapshot(
    collection(db, 'deletedClubs'),
    snap => {
      currentState.deletedClubIds = snap.docs.map(d => d.id);
      emitIfReady('deletedClubs');
    },
    error => handleFirestoreError(error, OperationType.LIST, 'deletedClubs')
  );

  const unsubLeagues = onSnapshot(
    collection(db, 'leagues'),
    snap => {
      currentState.leagues = snap.docs.map(d => {
        const data = d.data();
        return {
          id: typeof data.id === 'string' ? data.id : d.id,
          name: String(data.name || ''),
          country: String(data.country || ''),
          icon: String(data.icon || '🏆'),
          isCustom: Boolean(data.isCustom),
          createdAt: Number(data.createdAt) || Date.now(),
        };
      });
      emitIfReady('leagues');
    },
    error => handleFirestoreError(error, OperationType.LIST, 'leagues')
  );

  const unsubMatches = onSnapshot(
    collection(db, 'matches'),
    snap => {
      currentState.matches = snap.docs.map(d => {
        const data = d.data();
        return {
          id: typeof data.id === 'string' ? data.id : d.id,
          league: String(data.league || ''),
          country: String(data.country || ''),
          homeTeam: String(data.homeTeam || ''),
          awayTeam: String(data.awayTeam || ''),
          homeClubId: typeof data.homeClubId === 'string' ? data.homeClubId : undefined,
          awayClubId: typeof data.awayClubId === 'string' ? data.awayClubId : undefined,
          homeScore: Number(data.homeScore) || 0,
          awayScore: Number(data.awayScore) || 0,
          minute: Number(data.minute) || 0,
          status:
            data.status === 'LIVE' || data.status === 'FINISHED' ? data.status : 'UPCOMING',
          startsInSeconds: Number(data.startsInSeconds) || 0,
          isFeatured: Boolean(data.isFeatured),
          homeOdds: Number(data.homeOdds) || 2.1,
          drawOdds: Number(data.drawOdds) || 3.2,
          awayOdds: Number(data.awayOdds) || 3.3,
        };
      });
      emitIfReady('matches');
    },
    error => handleFirestoreError(error, OperationType.LIST, 'matches')
  );

  const unsubDtmRules = onSnapshot(
    collection(db, 'dtmRules'),
    snap => {
      currentState.dtmRules = snap.docs.map(d => docToDtmRule(d.id, d.data()));
      emitIfReady('dtmRules');
    },
    error => handleFirestoreError(error, OperationType.LIST, 'dtmRules')
  );

  const unsubH2HRecords = onSnapshot(
    collection(db, 'h2hRecords'),
    snap => {
      currentState.h2hRecords = snap.docs.map(d => docToH2HRecord(d.id, d.data()));
      emitIfReady('h2hRecords');
    },
    error => handleFirestoreError(error, OperationType.LIST, 'h2hRecords')
  );

  return () => {
    unsubUsers();
    unsubDeletedUsers();
    unsubClubs();
    unsubDeletedClubs();
    unsubLeagues();
    unsubMatches();
    unsubDtmRules();
    unsubH2HRecords();
  };
}
