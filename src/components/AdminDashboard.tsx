import React, { useState, useEffect, useRef } from 'react';
import { Club, League, VirtualMatch, RegisteredUser, DtmMatchRule, MarketType } from '../types';
import { virtualEngine, PRESET_FIXTURES_INFO } from '../services/virtualEngine';
import { soundManager } from '../services/soundEffects';
import {
  ShieldCheck,
  PlusCircle,
  Plus,
  Trash2,
  CheckCircle,
  Play,
  CalendarCheck,
  Users,
  Swords,
  Zap,
  RotateCcw,
  ArrowLeft,
  ChevronRight,
  Search,
  Trophy,
  X,
  AlertTriangle,
  Wallet,
  UserCheck,
  Edit3,
  Clock,
  Save,
  Cloud,
  RefreshCw,
  SlidersHorizontal,
  Power
} from 'lucide-react';
import {
  subscribeFirebaseAuth,
  isFirebaseAdminUser,
  ensureBootstrappedAdminRecord,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeAdminCloudCollections,
  upsertCloudUser,
  deleteCloudUserWithTombstone,
  syncMetaCounterToAtLeast,
  upsertCloudClub,
  deleteCloudClubWithTombstone,
  upsertCloudLeague,
  upsertCloudMatch,
  deleteCloudMatch,
  upsertCloudDtmRule,
  deleteCloudDtmRule,
  upsertCloudH2HRecord,
  type AdminCloudSnapshotState,
} from '../services/firebaseSync';

interface AdminDashboardProps {
  matches: VirtualMatch[];
  clubs: Club[];
  leagues: League[];
  adminBalance: number;
  adminEmail: string;
  onLogout: () => void;
}

type AdminPage =
  | 'hub'
  | 'dtm_search'
  | 'dtm_bookmaker'
  | 'fix_match'
  | 'create_club'
  | 'club_directory'
  | 'leagues'
  | 'active'
  | 'delete_club'
  | 'deposit'
  | 'users'
  | 'edit_user';

const CREST_OPTIONS = ['🛡️', '🟢', '🔴', '🔵', '🟡', '👑', '⚡', '🦁', '🦅', '🔥', '❄️', '🏛️', '⭐', '💎'];
const LEAGUE_ICONS = ['🏆', '⚽', '🌍', '🔥', '👑', '⭐', '🛡️', '⚡'];
const AVATAR_OPTIONS = ['🦁', '👑', '⚡', '💎', '⚽', '🎯', '🚀', '🔥'];

const VALID_ADMIN_PAGES: AdminPage[] = [
  'hub',
  'dtm_search',
  'dtm_bookmaker',
  'fix_match',
  'create_club',
  'club_directory',
  'leagues',
  'active',
  'delete_club',
  'deposit',
  'users',
  'edit_user'
];

function loadSavedAdminPage(): AdminPage {
  if (typeof window === 'undefined') return 'hub';
  const saved = window.localStorage.getItem('cas9i_admin_page') as AdminPage | null;
  if (saved === 'edit_user') return 'users';
  if (saved === 'dtm_bookmaker') return 'dtm_search';
  return saved && VALID_ADMIN_PAGES.includes(saved) ? saved : 'hub';
}

interface DtmEditorModalState {
  marketType: MarketType;
  marketName: string;
  optionLabel: string;
  winner1X2: 'Home & O15' | 'Draw' | 'Away & O15';
  firstGoal: 'Home' | 'Away';
  fiveMinGoal: 'Yes' | 'No' | 'Over 5 Goals';
  oddEven: 'Odd' | 'Even';
  firstHalf: 'Home & O10' | 'X & O10' | 'Away & O10';
  firstHalfOU15: 'Over 15' | 'Under 15';
  secondHalf: 'Home & O15' | 'X & O15' | 'Away & O15';
  overUnderLine: number;
  overUnderPick: 'Over' | 'Under';
  overUnderTargetGoals: string;
  csHome: string;
  csAway: string;
  applyOptionalScore: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  matches,
  clubs,
  leagues,
}) => {
  const [activePage, setActivePage] = useState<AdminPage>(() => loadSavedAdminPage());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [clubSearch, setClubSearch] = useState('');
  const [clubLeagueFilter, setClubLeagueFilter] = useState<string>('all');
  const [leagueSearch, setLeagueSearch] = useState('');
  const [expandedLeagueId, setExpandedLeagueId] = useState<string | null>(null);
  const [pendingDeleteClubId, setPendingDeleteClubId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registered Users, Top ID Search, Deposit & Edit User State
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [usersFilter, setUsersFilter] = useState('');
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);
  const [topSearchId, setTopSearchId] = useState('');
  const [topSearchError, setTopSearchError] = useState<string | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);

  // Firebase Cloud Sync State (multi-device Web <-> Mobile persistence)
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [cloudAdminEmail, setCloudAdminEmail] = useState<string | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const latestUsersRef = useRef<RegisteredUser[]>([]);
  const cloudSyncRef = useRef<AdminCloudSnapshotState | null>(null);

  // Deposit Page State
  const [depositSearchId, setDepositSearchId] = useState('');
  const [depositRecipient, setDepositRecipient] = useState<RegisteredUser | null>(null);
  const [depositAmountInput, setDepositAmountInput] = useState('');
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [depositCountdown, setDepositCountdown] = useState<number | null>(null);
  const depositTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit User Page State
  const [selectedEditUser, setSelectedEditUser] = useState<RegisteredUser | null>(null);
  const [editForm, setEditForm] = useState<{
    username: string;
    fullName: string;
    email: string;
    avatar: string;
    phone: string;
    country: string;
    city: string;
    address: string;
    dateOfBirth: string;
    kycIdNumber: string;
    accountTier: 'Standard' | 'VIP' | 'Suspended';
    notes: string;
  }>({
    username: '',
    fullName: '',
    email: '',
    avatar: '🦁',
    phone: '',
    country: '',
    city: '',
    address: '',
    dateOfBirth: '',
    kycIdNumber: '',
    accountTier: 'Standard',
    notes: ''
  });

  // DTM Search & Bookmaker State
  const [dtmRules, setDtmRules] = useState<DtmMatchRule[]>([]);
  const [dtmSearchQuery, setDtmSearchQuery] = useState('');
  const [dtmVerifiedMatches, setDtmVerifiedMatches] = useState<VirtualMatch[]>([]);
  const [dtmSearchError, setDtmSearchError] = useState<string | null>(null);
  const [dtmIsVerifying, setDtmIsVerifying] = useState(false);
  const [dtmHasSearched, setDtmHasSearched] = useState(false);
  const [selectedDtmMatch, setSelectedDtmMatch] = useState<VirtualMatch | null>(null);
  const [dtmMarketTab, setDtmMarketTab] = useState<'ALL' | '1X2' | 'HALVES' | 'OU' | 'SCORE'>('ALL');
  const [dtmModal, setDtmModal] = useState<DtmEditorModalState | null>(null);
  const [dtmModalError, setDtmModalError] = useState<string | null>(null);

  // Create Club State
  const [clubCreateMode, setClubCreateMode] = useState<'single' | 'bulk'>('single');
  const [clubName, setClubName] = useState('');
  const [clubShort, setClubShort] = useState('');
  const [clubCountry, setClubCountry] = useState(leagues[0]?.country || 'Spain');
  const [clubLeague, setClubLeague] = useState(leagues[0]?.name || 'Spain - Copa del Rey');
  const [clubCrest, setClubCrest] = useState('🛡️');
  const [clubAttack, setClubAttack] = useState(78);
  const [clubDefense, setClubDefense] = useState(76);
  const [bulkClubsText, setBulkClubsText] = useState('');

  // Pop-out Custom League Modal State
  const [isLeagueModalOpen, setIsLeagueModalOpen] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueCountry, setNewLeagueCountry] = useState('International');
  const [newLeagueIcon, setNewLeagueIcon] = useState('🏆');
  const [leagueModalError, setLeagueModalError] = useState<string | null>(null);

  // Fix Match Between Clubs State
  const [homeClubId, setHomeClubId] = useState<string>(clubs[0]?.id || '');
  const [awayClubId, setAwayClubId] = useState<string>(clubs[1]?.id || clubs[0]?.id || '');
  const [matchLeague, setMatchLeague] = useState<string>(clubs[0]?.league || leagues[0]?.name || 'Spain - Copa del Rey');
  const [matchStatus, setMatchStatus] = useState<'UPCOMING' | 'LIVE'>('UPCOMING');
  const [countdownMins, setCountdownMins] = useState<number>(3);
  const [homeOdds, setHomeOdds] = useState<string>('2.15');
  const [drawOdds, setDrawOdds] = useState<string>('3.20');
  const [awayOdds, setAwayOdds] = useState<string>('3.30');
  const [isFeatured, setIsFeatured] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync selected club ids if clubs list changes
  useEffect(() => {
    if (clubs.length > 0 && !clubs.some(c => c.id === homeClubId)) {
      setHomeClubId(clubs[0].id);
    }
    if (clubs.length > 1 && !clubs.some(c => c.id === awayClubId)) {
      const alt = clubs.find(c => c.id !== (clubs[0]?.id || '')) || clubs[0];
      if (alt) setAwayClubId(alt.id);
    }
  }, [clubs, homeClubId, awayClubId]);

  // Keep clubLeague initialized when leagues load
  useEffect(() => {
    if (leagues.length > 0 && !clubLeague) {
      setClubLeague(leagues[0].name);
    }
  }, [leagues, clubLeague]);

  // Auto-calculate realistic odds only when Home or Away club selection changes
  useEffect(() => {
    const home = clubs.find(c => c.id === homeClubId);
    const away = clubs.find(c => c.id === awayClubId);
    if (!home || !away || home.id === away.id) return;

    const homeRating = (home.attack + home.defense) / 2 + 2;
    const awayRating = (away.attack + away.defense) / 2;
    const diff = homeRating - awayRating;

    const pHome = Math.max(0.05, Math.min(0.85, 0.42 + diff * 0.018));
    const pAway = Math.max(0.05, Math.min(0.85, 0.33 - diff * 0.018));
    const pDraw = Math.max(0.10, 1 - pHome - pAway);

    const margin = 0.94;
    setHomeOdds(Math.max(1.05, margin / pHome).toFixed(2));
    setDrawOdds(Math.max(1.20, margin / pDraw).toFixed(2));
    setAwayOdds(Math.max(1.05, margin / pAway).toFixed(2));
    setMatchLeague(home.league);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeClubId, awayClubId]);

  // Fetch registered & verified users and DTM rules on mount and live updates
  const loadUsersList = async (): Promise<RegisteredUser[]> => {
    try {
      const list = await virtualEngine.fetchAdminUsers();
      latestUsersRef.current = list;
      setUsers(list);
      return list;
    } catch {
      return [];
    }
  };

  const loadDtmRulesList = async (): Promise<DtmMatchRule[]> => {
    try {
      const rules = await virtualEngine.fetchAdminDtmRules();
      setDtmRules(rules);
      return rules;
    } catch {
      return [];
    }
  };

  useEffect(() => {
    void loadUsersList();
    void loadDtmRulesList();
    const unsub = virtualEngine.onUsersChanged(() => {
      void loadUsersList().then(list => {
        if (!isCloudConnected || !cloudSyncRef.current) return;
        const deletedSet = new Set(cloudSyncRef.current.deletedUserIds);
        const cloudIds = new Set(cloudSyncRef.current.users.map(cu => cu.user.id));
        for (const u of list) {
          if (!deletedSet.has(u.id) && !cloudIds.has(u.id)) {
            void upsertCloudUser(u);
          }
        }
      });
    });
    return () => {
      unsub();
      if (depositTimerRef.current) {
        clearInterval(depositTimerRef.current);
      }
    };
  }, [isCloudConnected]);

  const syncedCloudH2HIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to Firebase Admin Auth & live Firestore collections
  useEffect(() => {
    let unsubCloud: (() => void) | null = null;
    let unsubH2H: (() => void) | null = null;
    const unsubAuth = subscribeFirebaseAuth(fbUser => {
      if (unsubCloud) {
        unsubCloud();
        unsubCloud = null;
      }
      if (unsubH2H) {
        unsubH2H();
        unsubH2H = null;
      }

      if (isFirebaseAdminUser(fbUser) && fbUser) {
        setIsCloudConnected(true);
        setCloudAdminEmail(fbUser.email || 'info.mipodi@gmail.com');
        setCloudSyncError(null);
        void ensureBootstrappedAdminRecord(fbUser);

        unsubCloud = subscribeAdminCloudCollections(cloudState => {
          cloudSyncRef.current = cloudState;
          const deletedUsersSet = new Set(cloudState.deletedUserIds);
          const cloudUserIds = new Set(cloudState.users.map(cu => cu.user.id));
          cloudState.h2hRecords.forEach(r => syncedCloudH2HIdsRef.current.add(r.id));

          void (async () => {
            const [localBefore, localRulesBefore] = await Promise.all([
              loadUsersList(),
              loadDtmRulesList(),
            ]);
            const syncedUsers = await virtualEngine.pushCloudSyncToServer({
              users: cloudState.users.map(cu => cu.user),
              deletedUserIds: cloudState.deletedUserIds,
              clubs: cloudState.clubs,
              deletedClubIds: cloudState.deletedClubIds,
              leagues: cloudState.leagues,
              matches: cloudState.matches,
              dtmRules: cloudState.dtmRules,
              h2hRecords: cloudState.h2hRecords,
            });
            if (syncedUsers) {
              latestUsersRef.current = syncedUsers;
              setUsers(syncedUsers);
            }
            const refreshedRules = await loadDtmRulesList();

            // Push any local DTM rules newer than Firestore up to cloud
            const cloudRuleMap = new Map(cloudState.dtmRules.map(r => [r.id, r]));
            for (const lr of refreshedRules.length > 0 ? refreshedRules : localRulesBefore) {
              const cr = cloudRuleMap.get(lr.id);
              if (!cr || lr.updatedAtMs > cr.updatedAtMs) {
                void upsertCloudDtmRule(lr);
              }
            }

            // Push unseen non-Zoom H2H records up to Firestore (capped per batch for Spark quota safety)
            const localNonZoomH2H = virtualEngine
              .getH2HRecords()
              .filter(r => !r.isZoom && !syncedCloudH2HIdsRef.current.has(r.id))
              .slice(-100);
            for (const rec of localNonZoomH2H) {
              syncedCloudH2HIdsRef.current.add(rec.id);
              void upsertCloudH2HRecord(rec);
            }

            // Push any locally-registered un-tombstoned users up to Firestore permanently
            let maxNumericId = 100000;
            for (const u of localBefore) {
              const n = Number(u.id);
              if (!Number.isNaN(n)) maxNumericId = Math.max(maxNumericId, n);
              if (!deletedUsersSet.has(u.id) && !cloudUserIds.has(u.id)) {
                void upsertCloudUser(u);
              }
            }
            for (const cu of cloudState.users) {
              const n = Number(cu.user.id);
              if (!Number.isNaN(n)) maxNumericId = Math.max(maxNumericId, n);
            }
            if (maxNumericId >= 100001) {
              void syncMetaCounterToAtLeast(maxNumericId + 1);
            }
          })();
        });

        unsubH2H = virtualEngine.subscribeH2H(records => {
          const unseen = records
            .filter(r => !r.isZoom && !syncedCloudH2HIdsRef.current.has(r.id))
            .slice(-50);
          for (const rec of unseen) {
            syncedCloudH2HIdsRef.current.add(rec.id);
            void upsertCloudH2HRecord(rec);
          }
        });
      } else {
        cloudSyncRef.current = null;
        setIsCloudConnected(false);
        setCloudAdminEmail(null);
      }
    });

    return () => {
      unsubAuth();
      if (unsubCloud) unsubCloud();
      if (unsubH2H) unsubH2H();
    };
  }, []);

  const handleConnectCloudSync = async () => {
    if (isConnectingCloud) return;
    setCloudSyncError(null);
    setIsConnectingCloud(true);
    soundManager.playClick();
    try {
      const fbUser = await signInWithGooglePopup();
      if (!isFirebaseAdminUser(fbUser)) {
        await signOutFirebase().catch(() => {});
        setCloudSyncError('Please sign in with the authorized Admin Google account (info.mipodi@gmail.com).');
        return;
      }
      await ensureBootstrappedAdminRecord(fbUser);
      showToast('Cloud Sync connected across all devices.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setCloudSyncError('Could not connect Cloud Sync. Please try again.');
      }
    } finally {
      setIsConnectingCloud(false);
    }
  };

  const openEditUserPage = (u: RegisteredUser) => {
    setSelectedEditUser(u);
    setEditForm({
      username: u.username || '',
      fullName: u.fullName || '',
      email: u.email || '',
      avatar: u.avatar || '🦁',
      phone: u.phone || '',
      country: u.country || '',
      city: u.city || '',
      address: u.address || '',
      dateOfBirth: u.dateOfBirth || '',
      kycIdNumber: u.kycIdNumber || '',
      accountTier: u.accountTier || 'Standard',
      notes: u.notes || ''
    });
    setTopSearchError(null);
    setFormError(null);
    setActivePage('edit_user');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cas9i_admin_page', 'users');
    }
  };

  const handleTopSearchById = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = topSearchId.trim().replace(/^#/, '');
    if (!cleanId) {
      setTopSearchError('Enter a user ID to search.');
      return;
    }
    setTopSearchError(null);
    setIsSearchingUser(true);
    try {
      const found = await virtualEngine.lookupAdminUserById(cleanId);
      soundManager.playClick();
      openEditUserPage(found);
    } catch {
      setTopSearchError(`User ID "${cleanId}" does not exist.`);
    } finally {
      setIsSearchingUser(false);
    }
  };

  const handleDepositLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositCountdown !== null) return;
    const cleanId = depositSearchId.trim().replace(/^#/, '');
    setDepositError(null);
    setDepositSuccessMsg(null);

    if (!cleanId) {
      setDepositRecipient(null);
      setDepositError('error');
      return;
    }

    setIsSearchingUser(true);
    try {
      const found = await virtualEngine.lookupAdminUserById(cleanId);
      if (!found || !found.fullName || !found.fullName.trim()) {
        setDepositRecipient(null);
        setDepositError('error');
        return;
      }
      soundManager.playClick();
      setDepositRecipient(found);
      setDepositAmountInput('');
    } catch {
      setDepositRecipient(null);
      setDepositError('error');
    } finally {
      setIsSearchingUser(false);
    }
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (depositCountdown !== null) return;

    if (!depositRecipient || !depositRecipient.fullName || !depositRecipient.fullName.trim()) {
      setDepositError('error');
      return;
    }

    const amount = Number(depositAmountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDepositError('Please enter a valid deposit amount.');
      return;
    }

    soundManager.playClick();
    setDepositError(null);
    setDepositSuccessMsg(null);
    setDepositCountdown(5);

    const targetUserId = depositRecipient.id;
    let remaining = 5;
    if (depositTimerRef.current) clearInterval(depositTimerRef.current);

    depositTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setDepositCountdown(remaining);
        return;
      }

      if (depositTimerRef.current) {
        clearInterval(depositTimerRef.current);
        depositTimerRef.current = null;
      }

      void (async () => {
        try {
          const res = await virtualEngine.depositToUser(targetUserId, amount);
          setDepositRecipient(res.user);
          setUsers(res.users);
          if (isCloudConnected) {
            void upsertCloudUser(res.user);
          }
          setDepositAmountInput('');
          setDepositCountdown(null);
          setDepositSuccessMsg(
            `Deposit of $${res.depositedAmount.toFixed(2)} verified & lodged to ${res.user.fullName} (ID #${res.user.id}).`
          );
          showToast(`Deposited $${res.depositedAmount.toFixed(2)} to ${res.user.fullName}`);
        } catch {
          setDepositCountdown(null);
          setDepositError('error');
        }
      })();
    }, 1000);
  };

  const handleSaveUserInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditUser || isSubmitting) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const res = await virtualEngine.updateAdminUser(selectedEditUser.id, editForm);
      setUsers(res.users);
      setSelectedEditUser(res.user);
      if (isCloudConnected) {
        void upsertCloudUser(res.user);
      }
      showToast(`Saved profile info for ${res.user.fullName} (ID #${res.user.id})`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save user info.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    soundManager.playBetPlaced();
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleOpenPage = (page: AdminPage) => {
    soundManager.playClick();
    setFormError(null);
    setTopSearchError(null);
    setDepositError(null);
    setDepositSuccessMsg(null);
    setPendingDeleteClubId(null);
    setPendingDeleteUserId(null);
    setDtmSearchError(null);
    setDtmModal(null);
    setActivePage(page);
    if (page === 'users' || page === 'deposit') {
      void loadUsersList();
    }
    if (page === 'dtm_search' || page === 'dtm_bookmaker') {
      void loadDtmRulesList();
    }
    if (typeof window !== 'undefined' && page !== 'edit_user' && page !== 'dtm_bookmaker') {
      window.localStorage.setItem('cas9i_admin_page', page);
    }
  };

  const getDtmRuleForMatch = (match: VirtualMatch | null): DtmMatchRule | undefined => {
    if (!match) return undefined;
    const byId = dtmRules.find(r => r.matchId === match.id);
    if (byId) return byId;
    const hNorm = match.homeTeam.trim().toLowerCase();
    const aNorm = match.awayTeam.trim().toLowerCase();
    return dtmRules.find(
      r => r.homeTeam.trim().toLowerCase() === hNorm && r.awayTeam.trim().toLowerCase() === aNorm
    );
  };

  const openDtmBookmaker = (match: VirtualMatch) => {
    soundManager.playClick();
    setSelectedDtmMatch(match);
    setDtmMarketTab('ALL');
    setDtmModal(null);
    setDtmModalError(null);
    setActivePage('dtm_bookmaker');
  };

  const handleDtmSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = dtmSearchQuery.trim();
    if (!q) {
      setDtmSearchError('Enter a club name, league, or match ID to verify.');
      return;
    }
    soundManager.playClick();
    setDtmSearchError(null);
    setDtmIsVerifying(true);
    setDtmHasSearched(true);
    try {
      const res = await virtualEngine.searchAdminSoccerMatches(q);
      setDtmVerifiedMatches(res.matches);
      if (!res.verified || res.matches.length === 0) {
        setDtmSearchError(res.error || `No soccer match found for "${q}".`);
        return;
      }
      if (res.matches.length === 1) {
        openDtmBookmaker(res.matches[0]);
      }
    } catch (err) {
      setDtmVerifiedMatches([]);
      setDtmSearchError(err instanceof Error ? err.message : 'Unable to verify match.');
    } finally {
      setDtmIsVerifying(false);
    }
  };

  const openDtmOptionModal = (
    match: VirtualMatch,
    marketType: MarketType,
    marketName: string,
    optionLabel: string
  ) => {
    soundManager.playClick();
    const existingRule = getDtmRuleForMatch(match);
    let csH = typeof existingRule?.correctScoreHome === 'number' ? String(existingRule.correctScoreHome) : '10';
    let csA = typeof existingRule?.correctScoreAway === 'number' ? String(existingRule.correctScoreAway) : '8';
    let applyOptionalScore = false;

    if (marketType === 'Correct Score' && optionLabel.includes(':')) {
      const [hPart, aPart] = optionLabel.split(':');
      csH = String(Math.max(0, Math.floor(Number(hPart) || 0)));
      csA = String(Math.max(0, Math.floor(Number(aPart) || 0)));
      applyOptionalScore = true;
    } else if (marketType === '1X2') {
      if (optionLabel === 'Draw') {
        csH = '9';
        csA = '9';
      } else if (optionLabel === 'Home & O15') {
        csH = '11';
        csA = '8';
      } else {
        csH = '8';
        csA = '11';
      }
    }

    let ouLine = existingRule?.overUnderLine ?? 20;
    let ouPick: 'Over' | 'Under' = existingRule?.overUnderPick ?? 'Over';
    let ouGoals =
      typeof existingRule?.overUnderTargetGoals === 'number' ? String(existingRule.overUnderTargetGoals) : '21';
    if (marketType === 'Over/Under') {
      const parts = optionLabel.split(' ');
      const side = parts[0] === 'Under' ? 'Under' : 'Over';
      const parsedLine = Math.max(15, Math.min(30, Math.floor(Number(parts[1]) || 20)));
      ouPick = side;
      ouLine = parsedLine;
      ouGoals = String(side === 'Over' ? parsedLine + 1 : Math.max(0, parsedLine - 1));
    }

    setDtmModalError(null);
    setDtmModal({
      marketType,
      marketName,
      optionLabel,
      winner1X2:
        marketType === '1X2' && (optionLabel === 'Home & O15' || optionLabel === 'Draw' || optionLabel === 'Away & O15')
          ? optionLabel
          : existingRule?.winner1X2 || 'Home & O15',
      firstGoal:
        marketType === '1st Goal' && (optionLabel === 'Home' || optionLabel === 'Away')
          ? optionLabel
          : existingRule?.firstGoal || 'Home',
      fiveMinGoal:
        marketType === '5 Min Goal' &&
        (optionLabel === 'Yes' || optionLabel === 'No' || optionLabel === 'Over 5 Goals')
          ? optionLabel
          : existingRule?.fiveMinGoal || 'Yes',
      oddEven:
        marketType === 'Odd/Even' && (optionLabel === 'Odd' || optionLabel === 'Even')
          ? optionLabel
          : existingRule?.oddEven || 'Odd',
      firstHalf:
        marketType === '1st Half' &&
        marketName === '1st Half' &&
        (optionLabel === 'Home & O10' || optionLabel === 'X & O10' || optionLabel === 'Away & O10')
          ? optionLabel
          : existingRule?.firstHalf || 'Home & O10',
      firstHalfOU15:
        marketName === '1st Half O/U 15' && (optionLabel === 'Over 15' || optionLabel === 'Under 15')
          ? optionLabel
          : existingRule?.firstHalfOU15 || 'Over 15',
      secondHalf:
        marketType === '2nd Half' &&
        (optionLabel === 'Home & O15' || optionLabel === 'X & O15' || optionLabel === 'Away & O15')
          ? optionLabel
          : existingRule?.secondHalf || 'Home & O15',
      overUnderLine: ouLine,
      overUnderPick: ouPick,
      overUnderTargetGoals: ouGoals,
      csHome: csH,
      csAway: csA,
      applyOptionalScore,
    });
  };

  const persistDtmRuleUpdate = async (nextRule: DtmMatchRule, toastText: string) => {
    setIsSubmitting(true);
    try {
      const res = await virtualEngine.saveAdminDtmRule(nextRule);
      setDtmRules(res.dtmRules);
      if (isCloudConnected) {
        void upsertCloudDtmRule(res.rule);
      }
      setDtmModal(null);
      showToast(toastText);
    } catch (err) {
      setDtmModalError(err instanceof Error ? err.message : 'Unable to save result.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDtmModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDtmMatch || !dtmModal || isSubmitting) return;
    setDtmModalError(null);

    const existing = getDtmRuleForMatch(selectedDtmMatch);
    const ruleId = existing?.id || `dtm-${selectedDtmMatch.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const baseRule: DtmMatchRule = {
      id: ruleId,
      matchId: selectedDtmMatch.id,
      homeTeam: selectedDtmMatch.homeTeam,
      awayTeam: selectedDtmMatch.awayTeam,
      league: selectedDtmMatch.league,
      enabled: true,
      winner1X2: existing?.winner1X2,
      firstGoal: existing?.firstGoal,
      fiveMinGoal: existing?.fiveMinGoal,
      oddEven: existing?.oddEven,
      firstHalf: existing?.firstHalf,
      firstHalfOU15: existing?.firstHalfOU15,
      secondHalf: existing?.secondHalf,
      overUnderLine: existing?.overUnderLine,
      overUnderPick: existing?.overUnderPick,
      overUnderTargetGoals: existing?.overUnderTargetGoals,
      correctScoreHome: existing?.correctScoreHome,
      correctScoreAway: existing?.correctScoreAway,
      updatedAtMs: Date.now(),
    };

    if (dtmModal.marketType === 'Correct Score') {
      const h = Math.floor(Number(dtmModal.csHome));
      const a = Math.floor(Number(dtmModal.csAway));
      if (!Number.isFinite(h) || !Number.isFinite(a) || h < 0 || a < 0 || h > 99 || a > 99) {
        setDtmModalError('Enter valid scores between 0 and 99.');
        return;
      }
      baseRule.correctScoreHome = h;
      baseRule.correctScoreAway = a;
      const tot = h + a;
      if (baseRule.winner1X2 === 'Draw' && h !== a) baseRule.winner1X2 = undefined;
      if (baseRule.winner1X2 === 'Home & O15' && (h <= a || tot <= 15)) baseRule.winner1X2 = undefined;
      if (baseRule.winner1X2 === 'Away & O15' && (a <= h || tot <= 15)) baseRule.winner1X2 = undefined;
      if (baseRule.oddEven === 'Odd' && tot % 2 === 0) baseRule.oddEven = undefined;
      if (baseRule.oddEven === 'Even' && tot % 2 !== 0) baseRule.oddEven = undefined;
      await persistDtmRuleUpdate(baseRule, `Saved ${h}:${a} for ${selectedDtmMatch.homeTeam} vs ${selectedDtmMatch.awayTeam}`);
      return;
    }

    if (dtmModal.marketType === '1X2') {
      baseRule.winner1X2 = dtmModal.winner1X2;
      if (dtmModal.applyOptionalScore) {
        const h = Math.floor(Number(dtmModal.csHome));
        const a = Math.floor(Number(dtmModal.csAway));
        if (!Number.isFinite(h) || !Number.isFinite(a) || h < 0 || a < 0 || h > 99 || a > 99) {
          setDtmModalError('Enter valid scores between 0 and 99.');
          return;
        }
        if (dtmModal.winner1X2 === 'Draw' && h !== a) {
          setDtmModalError('Draw requires equal Home and Away scores.');
          return;
        }
        if (dtmModal.winner1X2 === 'Home & O15' && (h <= a || h + a <= 15)) {
          setDtmModalError('Home & O15 requires Home > Away and total goals > 15.');
          return;
        }
        if (dtmModal.winner1X2 === 'Away & O15' && (a <= h || h + a <= 15)) {
          setDtmModalError('Away & O15 requires Away > Home and total goals > 15.');
          return;
        }
        baseRule.correctScoreHome = h;
        baseRule.correctScoreAway = a;
      } else {
        baseRule.correctScoreHome = undefined;
        baseRule.correctScoreAway = undefined;
      }
      await persistDtmRuleUpdate(baseRule, `Saved 1X2 (${dtmModal.winner1X2})`);
      return;
    }

    if (dtmModal.marketType === '1st Goal') {
      baseRule.firstGoal = dtmModal.firstGoal;
      await persistDtmRuleUpdate(baseRule, `Saved 1st Goal (${dtmModal.firstGoal})`);
      return;
    }

    if (dtmModal.marketType === '5 Min Goal') {
      baseRule.fiveMinGoal = dtmModal.fiveMinGoal;
      await persistDtmRuleUpdate(baseRule, `Saved 5 Min Goal (${dtmModal.fiveMinGoal})`);
      return;
    }

    if (dtmModal.marketType === 'Odd/Even') {
      baseRule.oddEven = dtmModal.oddEven;
      baseRule.correctScoreHome = undefined;
      baseRule.correctScoreAway = undefined;
      await persistDtmRuleUpdate(baseRule, `Saved Odd/Even (${dtmModal.oddEven})`);
      return;
    }

    if (dtmModal.marketName === '1st Half O/U 15') {
      baseRule.firstHalfOU15 = dtmModal.firstHalfOU15;
      await persistDtmRuleUpdate(baseRule, `Saved 1st Half O/U 15 (${dtmModal.firstHalfOU15})`);
      return;
    }

    if (dtmModal.marketType === '1st Half') {
      baseRule.firstHalf = dtmModal.firstHalf;
      await persistDtmRuleUpdate(baseRule, `Saved 1st Half (${dtmModal.firstHalf})`);
      return;
    }

    if (dtmModal.marketType === '2nd Half') {
      baseRule.secondHalf = dtmModal.secondHalf;
      await persistDtmRuleUpdate(baseRule, `Saved 2nd Half (${dtmModal.secondHalf})`);
      return;
    }

    if (dtmModal.marketType === 'Over/Under') {
      const targetTot = Math.floor(Number(dtmModal.overUnderTargetGoals));
      if (!Number.isFinite(targetTot) || targetTot < 0 || targetTot > 99) {
        setDtmModalError('Enter a valid total goals count (0 - 99).');
        return;
      }
      if (dtmModal.overUnderPick === 'Over' && targetTot <= dtmModal.overUnderLine) {
        setDtmModalError(`Over ${dtmModal.overUnderLine} requires total goals greater than ${dtmModal.overUnderLine}.`);
        return;
      }
      if (dtmModal.overUnderPick === 'Under' && targetTot >= dtmModal.overUnderLine) {
        setDtmModalError(`Under ${dtmModal.overUnderLine} requires total goals less than ${dtmModal.overUnderLine}.`);
        return;
      }
      baseRule.overUnderLine = dtmModal.overUnderLine;
      baseRule.overUnderPick = dtmModal.overUnderPick;
      baseRule.overUnderTargetGoals = targetTot;
      baseRule.correctScoreHome = undefined;
      baseRule.correctScoreAway = undefined;
      await persistDtmRuleUpdate(
        baseRule,
        `Saved ${dtmModal.overUnderPick} ${dtmModal.overUnderLine} (${targetTot} goals)`
      );
    }
  };

  const handleClearDtmModalMarket = async () => {
    if (!selectedDtmMatch || !dtmModal || isSubmitting) return;
    const existing = getDtmRuleForMatch(selectedDtmMatch);
    if (!existing) {
      setDtmModal(null);
      return;
    }
    const nextRule: DtmMatchRule = { ...existing, updatedAtMs: Date.now() };
    if (dtmModal.marketType === 'Correct Score') {
      nextRule.correctScoreHome = undefined;
      nextRule.correctScoreAway = undefined;
    } else if (dtmModal.marketType === '1X2') {
      nextRule.winner1X2 = undefined;
    } else if (dtmModal.marketType === '1st Goal') {
      nextRule.firstGoal = undefined;
    } else if (dtmModal.marketType === '5 Min Goal') {
      nextRule.fiveMinGoal = undefined;
    } else if (dtmModal.marketType === 'Odd/Even') {
      nextRule.oddEven = undefined;
    } else if (dtmModal.marketName === '1st Half O/U 15') {
      nextRule.firstHalfOU15 = undefined;
    } else if (dtmModal.marketType === '1st Half') {
      nextRule.firstHalf = undefined;
    } else if (dtmModal.marketType === '2nd Half') {
      nextRule.secondHalf = undefined;
    } else if (dtmModal.marketType === 'Over/Under') {
      nextRule.overUnderLine = undefined;
      nextRule.overUnderPick = undefined;
      nextRule.overUnderTargetGoals = undefined;
    }
    await persistDtmRuleUpdate(nextRule, `Cleared ${dtmModal.marketName}`);
  };

  const handleToggleDtmRule = async (rule: DtmMatchRule) => {
    if (isSubmitting) return;
    soundManager.playClick();
    setIsSubmitting(true);
    try {
      const res = await virtualEngine.toggleAdminDtmRule(rule.id, !rule.enabled);
      setDtmRules(res.dtmRules);
      if (isCloudConnected) {
        void upsertCloudDtmRule(res.rule);
      }
      showToast(res.rule.enabled ? `Enabled ${rule.homeTeam} vs ${rule.awayTeam}` : `Disabled ${rule.homeTeam} vs ${rule.awayTeam}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDtmRule = async (ruleId: string) => {
    if (isSubmitting) return;
    soundManager.playClick();
    setIsSubmitting(true);
    try {
      const updated = await virtualEngine.deleteAdminDtmRule(ruleId);
      setDtmRules(updated);
      if (isCloudConnected) {
        void deleteCloudDtmRule(ruleId);
      }
      showToast('Removed match target.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to remove.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubName.trim() || isSubmitting) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const short = (clubShort.trim() || clubName.trim().slice(0, 3)).toUpperCase();
      const created = await virtualEngine.createClub({
        name: clubName.trim(),
        shortName: short,
        country: clubCountry.trim() || 'International',
        league: clubLeague.trim() || 'Virtual League',
        crest: clubCrest,
        attack: clubAttack,
        defense: clubDefense
      });

      setClubName('');
      setClubShort('');
      if (isCloudConnected) {
        void upsertCloudClub(created);
      }
      showToast(`Club permanently saved: ${created.crest} ${created.name} (${created.shortName})`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create club.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkCreateClubs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const lines = bulkClubsText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setFormError('Please write at least one club name (one per line).');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const entries = lines.map(line => {
        const parts = line.split('|').map(p => p.trim());
        const name = parts[0];
        const shortName = parts[1] ? parts[1].toUpperCase().slice(0, 4) : undefined;
        const league = parts[2] || clubLeague;
        const matched = leagues.find(l => l.name.toLowerCase() === league.toLowerCase());
        const country = parts[3] || matched?.country || clubCountry;
        return { name, shortName, league, country };
      });

      const created = await virtualEngine.createClubsBulk({
        clubs: entries,
        defaultLeague: clubLeague,
        defaultCountry: clubCountry
      });

      if (isCloudConnected) {
        created.forEach(c => void upsertCloudClub(c));
      }
      setBulkClubsText('');
      showToast(`Permanently saved ${created.length} written ${created.length === 1 ? 'club' : 'clubs'} across all devices!`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save written clubs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCustomLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName.trim() || isSubmitting) {
      setLeagueModalError('Please enter a league name.');
      return;
    }
    setLeagueModalError(null);
    setIsSubmitting(true);

    try {
      const created = await virtualEngine.createLeague({
        name: newLeagueName.trim(),
        country: newLeagueCountry.trim() || 'International',
        icon: newLeagueIcon
      });
      if (isCloudConnected) {
        void upsertCloudLeague(created);
      }
      setNewLeagueName('');
      setNewLeagueCountry('International');
      setNewLeagueIcon('🏆');
      setIsLeagueModalOpen(false);
      showToast(`League saved permanently: ${created.icon} ${created.name}`);
    } catch (err) {
      setLeagueModalError(err instanceof Error ? err.message : 'Unable to create league.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFixMatchBetweenClubs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const home = clubs.find(c => c.id === homeClubId);
    const away = clubs.find(c => c.id === awayClubId);

    if (!home || !away) {
      setFormError('Please create and select both Home and Away clubs.');
      return;
    }
    if (home.id === away.id) {
      setFormError('Home Club and Away Club must be different teams.');
      return;
    }

    setIsSubmitting(true);
    try {
      const createdMatch = await virtualEngine.fixMatchBetweenClubs({
        homeClub: home,
        awayClub: away,
        league: matchLeague,
        status: matchStatus,
        startsInSeconds: Math.max(10, countdownMins * 60),
        homeOdds: parseFloat(homeOdds) || 2.10,
        drawOdds: parseFloat(drawOdds) || 3.20,
        awayOdds: parseFloat(awayOdds) || 3.40,
        isFeatured
      });
      if (isCloudConnected) {
        void upsertCloudMatch(createdMatch, { homeClubId: home.id, awayClubId: away.id });
      }
      showToast(`Match fixed & synced across all users: ${home.name} vs ${away.name}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to fix match.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFixPreset = async (type: 'featured' | 'copa_and_euro' | 'all') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await virtualEngine.fixPresetBatch(type);
      showToast(
        type === 'featured'
          ? `Published Featured Match: ${PRESET_FIXTURES_INFO.featuredTitle}`
          : type === 'copa_and_euro'
          ? `Published ${PRESET_FIXTURES_INFO.pairTitle}`
          : `Published all ${PRESET_FIXTURES_INFO.allCount} preset virtual fixtures`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to publish preset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAll = async () => {
    soundManager.playClick();
    await virtualEngine.resetAllMatches();
    showToast('All matches cleared across all devices. Clubs & leagues preserved.');
  };

  const handleAutoGenerateFiveClubs = async () => {
    if (isSubmitting) return;
    soundManager.playClick();
    setIsSubmitting(true);
    try {
      const created = await virtualEngine.autoGenerateFiveClubs();
      if (isCloudConnected) {
        created.forEach(c => void upsertCloudClub(c));
      }
      showToast(`Auto-generated & permanently saved ${created.length} new clubs across all devices!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to auto-generate clubs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeployThreePerLeague = async () => {
    if (isSubmitting) return;
    soundManager.playClick();
    setIsSubmitting(true);
    try {
      const result = await virtualEngine.deployThreeClubsPerLeague();
      if (isCloudConnected) {
        result.createdClubs.forEach(c => void upsertCloudClub(c));
      }
      showToast(
        `Deployed ${result.createdClubs.length} permanent clubs (3 per league across ${result.leagueCount} leagues)!`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to deploy clubs per league.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const liveCount = matches.filter(m => m.status === 'LIVE').length;

  const filteredClubs = clubs.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(clubSearch.toLowerCase()) ||
      c.shortName.toLowerCase().includes(clubSearch.toLowerCase()) ||
      c.league.toLowerCase().includes(clubSearch.toLowerCase()) ||
      c.country.toLowerCase().includes(clubSearch.toLowerCase());
    const matchesLeague =
      activePage !== 'club_directory' ||
      clubLeagueFilter === 'all' ||
      c.league.toLowerCase() === clubLeagueFilter.toLowerCase();
    return matchesSearch && matchesLeague;
  });

  const filteredLeagues = leagues.filter(l =>
    l.name.toLowerCase().includes(leagueSearch.toLowerCase()) ||
    l.country.toLowerCase().includes(leagueSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u => {
    const q = usersFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      u.id.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const pageTitleMap: Record<AdminPage, string> = {
    hub: 'Admin Dashboard',
    dtm_search: 'DTM',
    dtm_bookmaker: selectedDtmMatch ? `${selectedDtmMatch.homeTeam} vs ${selectedDtmMatch.awayTeam}` : 'DTM Bookmaker',
    fix_match: 'Fix Match',
    create_club: 'Create New Club',
    club_directory: 'Club Directory',
    leagues: 'Leagues',
    active: 'Active Matches',
    delete_club: 'Delete Club',
    deposit: 'Deposit Funds',
    users: 'Registered Users',
    edit_user: selectedEditUser ? `User Profile #${selectedEditUser.id}` : 'Update User Info'
  };

  const liveSelectedDtmMatch = selectedDtmMatch
    ? matches.find(m => m.id === selectedDtmMatch.id) || selectedDtmMatch
    : null;
  const activeDtmRuleForSelected = liveSelectedDtmMatch ? getDtmRuleForMatch(liveSelectedDtmMatch) : undefined;

  return (
    <div className="space-y-2.5 pb-6 px-2.5 sm:px-4 pt-2 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="border-b border-[#00e700]/20 pb-2 space-y-2">
        {activePage === 'hub' ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#00ad3a]/20 border border-[#00e700]/40 flex items-center justify-center text-[#00e700] shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-black text-white tracking-wide truncate">
                    {pageTitleMap.hub}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
                    Clubs, leagues, fixtures &amp; accounts
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenPage('dtm_search')}
                className="h-8 px-2.5 rounded-lg bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/45 text-[#00e700] text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shrink-0 whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>DTM</span>
              </button>
            </div>

            {/* Hub User ID Search Bar */}
            <form onSubmit={handleTopSearchById} className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center bg-[#03150b] border border-[#00e700]/30 focus-within:border-[#00e700] rounded-lg px-2.5 h-8 min-w-0">
                <Search className="w-3.5 h-3.5 text-[#00e700] mr-1.5 shrink-0" />
                <input
                  type="text"
                  value={topSearchId}
                  onChange={e => {
                    setTopSearchId(e.target.value);
                    if (topSearchError) setTopSearchError(null);
                  }}
                  placeholder="Search user by ID (e.g. 100001)"
                  className="bg-transparent text-xs font-bold text-white placeholder-zinc-500 focus:outline-none w-full font-mono tabular-nums min-w-0"
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingUser}
                className="h-8 px-3 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-black font-black text-xs whitespace-nowrap active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                {isSearchingUser ? 'Searching...' : 'Search ID'}
              </button>
            </form>

            {topSearchError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg">
                {topSearchError}
              </div>
            )}

            {/* Compact Multi-Device Cloud Sync Bar */}
            <div className="flex items-center justify-between gap-2 bg-[#03150b] border border-[#00e700]/20 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Cloud className={`w-3.5 h-3.5 shrink-0 ${isCloudConnected ? 'text-[#00e700]' : 'text-zinc-400'}`} />
                <span className="text-[11px] font-bold text-zinc-300 truncate">
                  {isCloudConnected
                    ? `Cloud Sync Active (${cloudAdminEmail})`
                    : 'Connect Google to sync Users & Admin across Web & Mobile'}
                </span>
              </div>
              {isCloudConnected ? (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    void loadUsersList();
                    showToast('Cloud & server state synced.');
                  }}
                  className="h-6 px-2 rounded bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/30 text-[#00e700] text-[10px] font-black flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Synced</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isConnectingCloud}
                  onClick={handleConnectCloudSync}
                  className="h-6 px-2.5 rounded bg-[#00ad3a] hover:bg-[#00c844] text-black text-[10px] font-black shrink-0 whitespace-nowrap active:scale-95 transition-all disabled:opacity-50"
                >
                  {isConnectingCloud ? 'Connecting...' : 'Sync Cloud'}
                </button>
              )}
            </div>

            {cloudSyncError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg">
                {cloudSyncError}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() =>
                  handleOpenPage(
                    activePage === 'edit_user'
                      ? 'users'
                      : activePage === 'dtm_bookmaker'
                      ? 'dtm_search'
                      : 'hub'
                  )
                }
                className="h-7 px-2.5 rounded-lg bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/35 text-[11px] font-bold text-[#00e700] flex items-center gap-1 transition-all active:scale-95 shrink-0 whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <h2 className="text-sm sm:text-base font-black text-white tracking-wide truncate">
                {pageTitleMap[activePage]}
              </h2>
            </div>

            {activePage === 'leagues' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleAutoGenerateFiveClubs}
                  aria-label="Auto-generate 5 new clubs"
                  title="Auto-generate 5 permanent new clubs"
                  className="w-7 h-7 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black flex items-center justify-center shadow-[0_0_10px_rgba(220,38,38,0.4)] active:scale-95 transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 stroke-[2.75]" />
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDeployThreePerLeague}
                  aria-label="Auto-deploy 3 new clubs to each league"
                  title="Auto-deploy 3 different new clubs to each league"
                  className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black flex items-center justify-center shadow-[0_0_10px_rgba(37,99,235,0.4)] active:scale-95 transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 stroke-[2.75]" />
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    soundManager.playClick();
                    setLeagueModalError(null);
                    setIsLeagueModalOpen(true);
                  }}
                  aria-label="Create Custom League"
                  title="Create Custom League"
                  className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black flex items-center justify-center shadow-[0_0_10px_rgba(0,231,0,0.35)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 stroke-[2.75]" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Toast Feedback */}
      {toastMsg && (
        <div className="bg-[#00ad3a] text-black font-black px-3 py-2 rounded-lg text-[11px] flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,231,0,0.35)]">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HUB VIEW: COMPACT ACTION BUTTONS */}
      {activePage === 'hub' && (
        <div className="space-y-2.5">
          {/* Compact KPI Strip */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-lg p-2">
              <span className="text-[10px] font-bold text-zinc-400 block truncate">Clubs</span>
              <span className="text-sm sm:text-base font-black text-white tabular-nums">{clubs.length}</span>
            </div>
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-lg p-2">
              <span className="text-[10px] font-bold text-zinc-400 block truncate">Leagues</span>
              <span className="text-sm sm:text-base font-black text-emerald-300 tabular-nums">{leagues.length}</span>
            </div>
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-lg p-2">
              <span className="text-[10px] font-bold text-zinc-400 block truncate">Matches</span>
              <span className="text-sm sm:text-base font-black text-[#00e700] tabular-nums">{matches.length}</span>
            </div>
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-lg p-2">
              <span className="text-[10px] font-bold text-zinc-400 block truncate">Live</span>
              <span className="text-sm sm:text-base font-black text-amber-400 tabular-nums">{liveCount}</span>
            </div>
          </div>

          {/* Dedicated Action Buttons -> Open Separate Pages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Deposit */}
            <button
              onClick={() => handleOpenPage('deposit')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/40 hover:border-[#00e700] rounded-xl p-2.5 sm:p-3.5 transition-all active:scale-[0.98] flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#00ad3a]/25 border border-[#00e700]/45 flex items-center justify-center text-[#00e700] shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">Deposit</span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate">
                    Search user by ID &amp; 5s credit
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#00e700] shrink-0" />
            </button>

            {/* Users */}
            <button
              onClick={() => handleOpenPage('users')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/40 hover:border-[#00e700] rounded-xl p-2.5 sm:p-3.5 transition-all active:scale-[0.98] flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">
                    Users <span className="text-[11px] font-bold text-[#00e700] ml-1 tabular-nums">({users.length})</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate">
                    Update details or delete profiles
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-300 shrink-0" />
            </button>

            {/* Fix Match */}
            <button
              onClick={() => handleOpenPage('fix_match')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-xl p-2.5 sm:p-3.5 transition-all active:scale-[0.98] flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#00ad3a]/25 border border-[#00e700]/40 flex items-center justify-center text-[#00e700] shrink-0">
                  <Swords className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">Fix Match</span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate">
                    Pair clubs, set odds &amp; sync
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#00e700] shrink-0" />
            </button>

            {/* Create New Club */}
            <button
              onClick={() => handleOpenPage('create_club')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-xl p-2.5 sm:p-3.5 transition-all active:scale-[0.98] flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#00ad3a]/25 border border-[#00e700]/40 flex items-center justify-center text-[#00e700] shrink-0">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">Create New Club</span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate">
                    Permanent club with crest &amp; stats
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#00e700] shrink-0" />
            </button>

            {/* Club Directory */}
            <button
              onClick={() => handleOpenPage('club_directory')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-xl p-2.5 sm:p-3.5 transition-all active:scale-[0.98] flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#00ad3a]/25 border border-[#00e700]/40 flex items-center justify-center text-[#00e700] shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">
                    Club Directory <span className="text-[11px] font-bold text-[#00e700] ml-1 tabular-nums">({clubs.length})</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate">
                    Registered clubs &amp; power ratings
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#00e700] shrink-0" />
            </button>

            {/* Leagues */}
            <button
              onClick={() => handleOpenPage('leagues')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-xl p-2.5 sm:p-3.5 transition-all active:scale-[0.98] flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">
                    Leagues <span className="text-[11px] font-bold text-emerald-300 ml-1 tabular-nums">({leagues.length})</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate">
                    Deployed leagues &amp; custom league
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-300 shrink-0" />
            </button>

            {/* Active */}
            <button
              onClick={() => handleOpenPage('active')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-xl p-2.5 sm:p-3.5 transition-all active:scale-[0.98] flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">
                    Active <span className="text-[11px] font-bold text-amber-400 ml-1 tabular-nums">({matches.length})</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate">
                    Kickoffs, live goals &amp; match resets
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />
            </button>

            {/* Delete Club */}
            <button
              onClick={() => handleOpenPage('delete_club')}
              className="group w-full text-left bg-gradient-to-br from-[#1f0d10] to-[#0b0708] hover:from-[#2c1116] hover:to-[#130a0c] border border-red-500/35 hover:border-red-400 rounded-xl p-2.5 sm:p-3.5 transition-all active:scale-[0.98] flex items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">Delete Club</span>
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block truncate">
                    Permanently remove clubs
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400 shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* PAGE: DTM SOCCER MATCH SEARCH */}
      {activePage === 'dtm_search' && (
        <div className="space-y-2.5">
          <form onSubmit={handleDtmSearchSubmit} className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3 space-y-2">
            <label className="text-[11px] font-black text-white block">
              Search Soccer Match
            </label>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center bg-[#03150b] border border-[#00e700]/35 focus-within:border-[#00e700] rounded-lg px-2.5 h-9 min-w-0">
                <Search className="w-3.5 h-3.5 text-[#00e700] mr-1.5 shrink-0" />
                <input
                  type="text"
                  value={dtmSearchQuery}
                  onChange={e => {
                    setDtmSearchQuery(e.target.value);
                    if (dtmSearchError) setDtmSearchError(null);
                  }}
                  placeholder="Enter club name, league, or match ID..."
                  className="bg-transparent text-xs font-bold text-white placeholder-zinc-500 focus:outline-none w-full min-w-0"
                />
              </div>
              <button
                type="submit"
                disabled={dtmIsVerifying}
                className="h-9 px-3 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs whitespace-nowrap active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                {dtmIsVerifying ? 'Verifying...' : 'Search'}
              </button>
            </div>

            {dtmSearchError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-[11px] font-bold px-2.5 py-2 rounded-lg flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{dtmSearchError}</span>
              </div>
            )}
          </form>

          {dtmHasSearched && !dtmIsVerifying && dtmVerifiedMatches.length > 0 && (
            <div className="bg-[#051c10]/95 border border-[#00e700]/30 rounded-xl p-2.5 sm:p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 border-b border-[#00e700]/15 pb-1.5">
                <span className="text-[11px] font-black text-[#00e700] flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Verified Matches ({dtmVerifiedMatches.length})</span>
                </span>
                <span className="text-[10px] text-zinc-400">Select match</span>
              </div>

              <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-0.5">
                {dtmVerifiedMatches.map(m => {
                  const rule = getDtmRuleForMatch(m);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openDtmBookmaker(m)}
                      className="w-full text-left bg-[#062416] hover:bg-[#0b3a23] border border-[#00e700]/25 hover:border-[#00e700] rounded-lg p-2.5 flex items-center justify-between gap-2 transition-all active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold">
                          <span className="truncate">{m.league}</span>
                          <span>·</span>
                          <span className={m.status === 'LIVE' ? 'text-[#00e700]' : 'text-amber-300'}>
                            {m.status === 'LIVE'
                              ? m.isZoom
                                ? `${m.elapsedSeconds ?? 1}s/90s`
                                : `${m.minute}'`
                              : m.scheduledTime}
                          </span>
                        </div>
                        <div className="text-xs font-black text-white truncate mt-0.5">
                          {m.homeTeam} vs {m.awayTeam}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {rule && (
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.5 rounded whitespace-nowrap ${
                              rule.enabled
                                ? 'bg-[#00e700]/20 text-[#00e700] border border-[#00e700]/40'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {rule.enabled ? 'Active' : 'Off'}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-[#00e700]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active & Saved Match Targets */}
          {dtmRules.length > 0 && (
            <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-[#00e700]/15 pb-1.5">
                <span className="text-[11px] font-black text-white">
                  Saved Matches ({dtmRules.length})
                </span>
                <span className="text-[10px] text-zinc-400">Active until disabled</span>
              </div>
              <div className="space-y-1.5 max-h-[38vh] overflow-y-auto pr-0.5">
                {dtmRules.map(rule => {
                  const matchedFixture =
                    matches.find(m => m.id === rule.matchId) ||
                    matches.find(
                      m =>
                        m.homeTeam.toLowerCase() === rule.homeTeam.toLowerCase() &&
                        m.awayTeam.toLowerCase() === rule.awayTeam.toLowerCase()
                    );
                  const summaryParts: string[] = [];
                  if (typeof rule.correctScoreHome === 'number' && typeof rule.correctScoreAway === 'number') {
                    summaryParts.push(`CS ${rule.correctScoreHome}:${rule.correctScoreAway}`);
                  }
                  if (rule.winner1X2) summaryParts.push(rule.winner1X2);
                  if (rule.firstGoal) summaryParts.push(`1G ${rule.firstGoal}`);
                  if (rule.fiveMinGoal) summaryParts.push(`5m ${rule.fiveMinGoal}`);
                  if (rule.oddEven) summaryParts.push(rule.oddEven);
                  if (rule.firstHalf) summaryParts.push(`1H ${rule.firstHalf}`);
                  if (rule.firstHalfOU15) summaryParts.push(`1H ${rule.firstHalfOU15}`);
                  if (rule.secondHalf) summaryParts.push(`2H ${rule.secondHalf}`);
                  if (rule.overUnderPick && rule.overUnderLine) {
                    summaryParts.push(
                      `${rule.overUnderPick} ${rule.overUnderLine}${
                        typeof rule.overUnderTargetGoals === 'number' ? ` (${rule.overUnderTargetGoals})` : ''
                      }`
                    );
                  }

                  return (
                    <div
                      key={rule.id}
                      className="bg-[#062416] border border-[#00e700]/20 rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white truncate">
                            {rule.homeTeam} vs {rule.awayTeam}
                          </span>
                          <span
                            className={`text-[9.5px] font-black px-1.5 py-0.5 rounded shrink-0 ${
                              rule.enabled
                                ? 'bg-[#00ad3a]/25 text-[#00e700] border border-[#00e700]/40'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {rule.enabled ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block truncate mt-0.5">
                          {summaryParts.length > 0 ? summaryParts.join(' · ') : rule.league}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {matchedFixture && (
                          <button
                            type="button"
                            onClick={() => openDtmBookmaker(matchedFixture)}
                            className="h-7 px-2 rounded-md bg-[#03150b] hover:bg-[#0e4425] border border-[#00e700]/35 text-[#00e700] text-[10px] font-black whitespace-nowrap"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleToggleDtmRule(rule)}
                          className={`h-7 px-2 rounded-md text-[10px] font-black whitespace-nowrap flex items-center gap-1 ${
                            rule.enabled
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                              : 'bg-[#00ad3a] hover:bg-[#00c844] text-black'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{rule.enabled ? 'Disable' : 'Enable'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleDeleteDtmRule(rule.id)}
                          aria-label="Remove target"
                          className="h-7 px-2 rounded-md bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-700/50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Verified Upcoming & Live List */}
          {!dtmHasSearched && matches.length > 0 && (
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-xl p-2.5 sm:p-3 space-y-2">
              <span className="text-[11px] font-black text-zinc-300 block border-b border-[#00e700]/15 pb-1.5">
                Soccer Fixtures ({matches.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[42vh] overflow-y-auto pr-0.5">
                {matches.slice(0, 20).map(m => {
                  const rule = getDtmRuleForMatch(m);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openDtmBookmaker(m)}
                      className="text-left bg-[#062416] hover:bg-[#0b3a23] border border-[#00e700]/20 hover:border-[#00e700] rounded-lg p-2 flex items-center justify-between gap-2 transition-all active:scale-[0.99]"
                    >
                      <div className="min-w-0">
                        <span className="text-[9.5px] text-zinc-400 font-semibold block truncate">
                          {m.league} · {m.status === 'LIVE' ? 'LIVE' : m.scheduledTime}
                        </span>
                        <span className="text-[11px] font-black text-white block truncate">
                          {m.homeTeam} vs {m.awayTeam}
                        </span>
                      </div>
                      {rule?.enabled ? (
                        <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-[#00e700]/20 text-[#00e700] border border-[#00e700]/40 shrink-0">
                          Active
                        </span>
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#00e700] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAGE: DTM BOOKMAKER OPTIONS */}
      {activePage === 'dtm_bookmaker' && liveSelectedDtmMatch && (
        <div className="space-y-2.5">
          {/* Match Header & Active Status */}
          <div className="bg-gradient-to-b from-[#0a331c] to-[#051c10] border border-[#00e700]/30 rounded-xl p-2.5 sm:p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] text-zinc-400 font-bold block truncate">
                  {liveSelectedDtmMatch.league} · Round #{liveSelectedDtmMatch.roundNumber || 1}
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white truncate">
                  {liveSelectedDtmMatch.homeTeam} vs {liveSelectedDtmMatch.awayTeam}
                </h3>
                <span className="text-[10px] font-bold text-amber-300 tabular-nums">
                  {liveSelectedDtmMatch.status === 'LIVE'
                    ? `${liveSelectedDtmMatch.homeScore} - ${liveSelectedDtmMatch.awayScore} · ${
                        liveSelectedDtmMatch.isZoom
                          ? `${liveSelectedDtmMatch.elapsedSeconds ?? 1}s/90s`
                          : `${liveSelectedDtmMatch.minute}'/60'`
                      }`
                    : liveSelectedDtmMatch.scheduledTime}
                </span>
              </div>

              {activeDtmRuleForSelected && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleToggleDtmRule(activeDtmRuleForSelected)}
                    className={`h-7 px-2.5 rounded-lg text-[10px] font-black flex items-center gap-1 whitespace-nowrap transition-all ${
                      activeDtmRuleForSelected.enabled
                        ? 'bg-[#00ff44] text-black shadow-[0_0_10px_rgba(0,231,0,0.35)]'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{activeDtmRuleForSelected.enabled ? 'Disable' : 'Enable'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDeleteDtmRule(activeDtmRuleForSelected.id)}
                    aria-label="Clear match target"
                    className="h-7 px-2 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-700/50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {activeDtmRuleForSelected && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-[#00e700]/15">
                {typeof activeDtmRuleForSelected.correctScoreHome === 'number' &&
                  typeof activeDtmRuleForSelected.correctScoreAway === 'number' && (
                    <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/40 text-[10px] font-black text-[#00e700] tabular-nums">
                      Score {activeDtmRuleForSelected.correctScoreHome}:{activeDtmRuleForSelected.correctScoreAway}
                    </span>
                  )}
                {activeDtmRuleForSelected.winner1X2 && (
                  <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/30 text-[10px] font-bold text-white">
                    1X2: {activeDtmRuleForSelected.winner1X2}
                  </span>
                )}
                {activeDtmRuleForSelected.firstGoal && (
                  <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/30 text-[10px] font-bold text-white">
                    1st Goal: {activeDtmRuleForSelected.firstGoal}
                  </span>
                )}
                {activeDtmRuleForSelected.fiveMinGoal && (
                  <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/30 text-[10px] font-bold text-white">
                    5m: {activeDtmRuleForSelected.fiveMinGoal}
                  </span>
                )}
                {activeDtmRuleForSelected.oddEven && (
                  <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/30 text-[10px] font-bold text-white">
                    {activeDtmRuleForSelected.oddEven}
                  </span>
                )}
                {activeDtmRuleForSelected.firstHalf && (
                  <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/30 text-[10px] font-bold text-white">
                    1H: {activeDtmRuleForSelected.firstHalf}
                  </span>
                )}
                {activeDtmRuleForSelected.firstHalfOU15 && (
                  <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/30 text-[10px] font-bold text-white">
                    1H {activeDtmRuleForSelected.firstHalfOU15}
                  </span>
                )}
                {activeDtmRuleForSelected.secondHalf && (
                  <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/30 text-[10px] font-bold text-white">
                    2H: {activeDtmRuleForSelected.secondHalf}
                  </span>
                )}
                {activeDtmRuleForSelected.overUnderPick && activeDtmRuleForSelected.overUnderLine && (
                  <span className="px-2 py-0.5 rounded bg-[#03150b] border border-[#00e700]/30 text-[10px] font-bold text-white">
                    {activeDtmRuleForSelected.overUnderPick} {activeDtmRuleForSelected.overUnderLine}
                    {typeof activeDtmRuleForSelected.overUnderTargetGoals === 'number'
                      ? ` (${activeDtmRuleForSelected.overUnderTargetGoals}g)`
                      : ''}
                  </span>
                )}
              </div>
            )}

            {/* Filter Tabs */}
            <div className="grid grid-cols-5 gap-1 pt-0.5">
              {[
                { id: 'ALL', label: 'All (8)' },
                { id: '1X2', label: 'Main' },
                { id: 'HALVES', label: 'Halves' },
                { id: 'OU', label: 'O/U' },
                { id: 'SCORE', label: 'Score' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setDtmMarketTab(tab.id as 'ALL' | '1X2' | 'HALVES' | 'OU' | 'SCORE');
                  }}
                  className={`py-1.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-black transition-all whitespace-nowrap text-center truncate ${
                    dtmMarketTab === tab.id
                      ? 'bg-[#00ad3a] text-black shadow-[0_0_8px_rgba(0,231,0,0.3)]'
                      : 'bg-[#03150b] text-zinc-300 hover:text-white border border-zinc-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 1-4: Main Markets */}
          {(dtmMarketTab === 'ALL' || dtmMarketTab === '1X2') && (
            <div className="space-y-2">
              <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/20 space-y-1.5">
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  1. 1X2 (High Goals)
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Home & O15', odds: liveSelectedDtmMatch.odds.home },
                    { label: 'Draw', odds: liveSelectedDtmMatch.odds.draw },
                    { label: 'Away & O15', odds: liveSelectedDtmMatch.odds.away },
                  ].map(opt => {
                    const selected = activeDtmRuleForSelected?.winner1X2 === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => openDtmOptionModal(liveSelectedDtmMatch, '1X2', '1X2', opt.label)}
                        className={`py-2 px-1 min-h-[42px] rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                          selected
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/20 space-y-1.5">
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  2. 1st Goal
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: 'Home', label: `Home · ${liveSelectedDtmMatch.homeTeam}`, odds: liveSelectedDtmMatch.odds.firstGoalHome },
                    { key: 'Away', label: `Away · ${liveSelectedDtmMatch.awayTeam}`, odds: liveSelectedDtmMatch.odds.firstGoalAway },
                  ].map(opt => {
                    const selected = activeDtmRuleForSelected?.firstGoal === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => openDtmOptionModal(liveSelectedDtmMatch, '1st Goal', '1st Goal', opt.key)}
                        className={`py-2 px-2 min-h-[42px] rounded-xl text-center transition-all flex flex-col items-center justify-center min-w-0 ${
                          selected
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate max-w-full">
                          {opt.label}
                        </span>
                        <span className="text-xs font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/20 space-y-1.5">
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  3. 5 Minutes Goal
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Yes', odds: liveSelectedDtmMatch.odds.fiveMinYes },
                    { label: 'No', odds: liveSelectedDtmMatch.odds.fiveMinNo },
                    { label: 'Over 5 Goals', odds: liveSelectedDtmMatch.odds.fiveMinOver5 },
                  ].map(opt => {
                    const selected = activeDtmRuleForSelected?.fiveMinGoal === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => openDtmOptionModal(liveSelectedDtmMatch, '5 Min Goal', '5 Min Goal', opt.label)}
                        className={`py-2 px-1 min-h-[42px] rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                          selected
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/20 space-y-1.5">
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  4. Odd or Even (Total Goals)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Odd', odds: liveSelectedDtmMatch.odds.oddGoals },
                    { label: 'Even', odds: liveSelectedDtmMatch.odds.evenGoals },
                  ].map(opt => {
                    const selected = activeDtmRuleForSelected?.oddEven === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => openDtmOptionModal(liveSelectedDtmMatch, 'Odd/Even', 'Odd/Even', opt.label)}
                        className={`py-2 px-2 min-h-[42px] rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                          selected
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 5-6: Halves */}
          {(dtmMarketTab === 'ALL' || dtmMarketTab === 'HALVES') && (
            <div className="space-y-2">
              <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/20 space-y-2">
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  {liveSelectedDtmMatch.isZoom ? '5. 1st Half (0s - 45s)' : "5. 1st Half (0' - 30')"}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Home & O10', odds: liveSelectedDtmMatch.odds.ht1Over10 },
                    { label: 'X & O10', odds: liveSelectedDtmMatch.odds.htXOver10 },
                    { label: 'Away & O10', odds: liveSelectedDtmMatch.odds.ht2Over10 },
                  ].map(opt => {
                    const selected = activeDtmRuleForSelected?.firstHalf === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => openDtmOptionModal(liveSelectedDtmMatch, '1st Half', '1st Half', opt.label)}
                        className={`py-2 px-1 min-h-[42px] rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                          selected
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-[#00e700]/15">
                  <span className="text-[10px] font-bold text-zinc-300 uppercase block mb-1.5">
                    1st Half Over / Under 15
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Over 15', odds: liveSelectedDtmMatch.odds.htOver15 },
                      { label: 'Under 15', odds: liveSelectedDtmMatch.odds.htUnder15 },
                    ].map(opt => {
                      const selected = activeDtmRuleForSelected?.firstHalfOU15 === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() =>
                            openDtmOptionModal(liveSelectedDtmMatch, '1st Half', '1st Half O/U 15', opt.label)
                          }
                          className={`py-2 px-2 min-h-[42px] rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                            selected
                              ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                              : 'bg-[#08381d] hover:bg-[#0d4d29] border border-[#00e700]/30 text-white'
                          }`}
                        >
                          <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                            {opt.label}
                          </span>
                          <span className="text-xs font-black tabular-nums leading-tight mt-0.5">
                            {opt.odds.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/20 space-y-1.5">
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  {liveSelectedDtmMatch.isZoom ? '6. 2nd Half (46s - 90s)' : "6. 2nd Half (31' - 60')"}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Home & O15', odds: liveSelectedDtmMatch.odds.sh1Over15 },
                    { label: 'X & O15', odds: liveSelectedDtmMatch.odds.shXOver15 },
                    { label: 'Away & O15', odds: liveSelectedDtmMatch.odds.sh2Over15 },
                  ].map(opt => {
                    const selected = activeDtmRuleForSelected?.secondHalf === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => openDtmOptionModal(liveSelectedDtmMatch, '2nd Half', '2nd Half', opt.label)}
                        className={`py-2 px-1 min-h-[42px] rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                          selected
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 7: Over & Under 15-30 */}
          {(dtmMarketTab === 'ALL' || dtmMarketTab === 'OU') && (
            <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                  7. Over &amp; Under (15 - 30)
                </span>
                <span className="text-[10px] font-bold text-[#00e700] whitespace-nowrap">Odds 2.00 - 18.75</span>
              </div>
              <div className="space-y-1.5">
                {(liveSelectedDtmMatch.odds.overUnderLines || []).map(item => {
                  const overSel = `Over ${item.line}`;
                  const underSel = `Under ${item.line}`;
                  const overActive =
                    activeDtmRuleForSelected?.overUnderLine === item.line &&
                    activeDtmRuleForSelected?.overUnderPick === 'Over';
                  const underActive =
                    activeDtmRuleForSelected?.overUnderLine === item.line &&
                    activeDtmRuleForSelected?.overUnderPick === 'Under';

                  return (
                    <div key={item.line} className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          openDtmOptionModal(liveSelectedDtmMatch, 'Over/Under', `O/U ${item.line}`, overSel)
                        }
                        className={`px-3 py-2 min-h-[40px] rounded-xl flex items-center justify-between transition-all ${
                          overActive
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[11px] font-bold whitespace-nowrap">{overSel}</span>
                        <span className="text-xs font-black tabular-nums">{item.over.toFixed(2)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openDtmOptionModal(liveSelectedDtmMatch, 'Over/Under', `O/U ${item.line}`, underSel)
                        }
                        className={`px-3 py-2 min-h-[40px] rounded-xl flex items-center justify-between transition-all ${
                          underActive
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[11px] font-bold whitespace-nowrap">{underSel}</span>
                        <span className="text-xs font-black tabular-nums">{item.under.toFixed(2)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 8: Correct Score */}
          {(dtmMarketTab === 'ALL' || dtmMarketTab === 'SCORE') && (
            <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-white uppercase tracking-wider">
                  8. Correct Score
                </span>
                <button
                  type="button"
                  onClick={() =>
                    openDtmOptionModal(liveSelectedDtmMatch, 'Correct Score', 'Correct Score', 'Custom Score')
                  }
                  className="h-6 px-2 rounded-md bg-[#03150b] hover:bg-[#0e4425] border border-[#00e700]/40 text-[#00e700] text-[10px] font-black whitespace-nowrap"
                >
                  + Custom Score
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(liveSelectedDtmMatch.odds.correctScores || []).map(cs => {
                  const selected =
                    typeof activeDtmRuleForSelected?.correctScoreHome === 'number' &&
                    typeof activeDtmRuleForSelected?.correctScoreAway === 'number' &&
                    `${activeDtmRuleForSelected.correctScoreHome}:${activeDtmRuleForSelected.correctScoreAway}` === cs.score;
                  return (
                    <button
                      key={cs.score}
                      type="button"
                      onClick={() =>
                        openDtmOptionModal(liveSelectedDtmMatch, 'Correct Score', 'Correct Score', cs.score)
                      }
                      className={`py-2 px-1 min-h-[42px] rounded-xl text-center transition-all flex flex-col items-center justify-center ${
                        selected
                          ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_10px_#00e700]'
                          : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                      }`}
                    >
                      <span className="text-xs font-black block leading-tight tabular-nums">{cs.score}</span>
                      <span className="text-[10.5px] font-bold tabular-nums opacity-95 leading-tight mt-0.5">
                        {cs.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAGE 1: FIX MATCH BETWEEN CLUBS */}
      {activePage === 'fix_match' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <form
            onSubmit={handleFixMatchBetweenClubs}
            className="md:col-span-7 bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3.5 space-y-2.5"
          >
            <div className="flex items-center justify-between border-b border-[#00e700]/15 pb-1.5">
              <h3 className="text-xs sm:text-sm font-black text-white">Fix Match Between Clubs</h3>
              <span className="text-[10px] text-[#00e700] font-bold">Auto-syncs all devices</span>
            </div>

            {formError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-[11px] font-bold p-2 rounded-lg">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Home Club (1)</label>
                <select
                  value={homeClubId}
                  onChange={e => setHomeClubId(e.target.value)}
                  className="w-full h-8 bg-[#03150b] border border-[#00e700]/30 rounded-lg px-2 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                >
                  {clubs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.crest} {c.name} ({c.attack}/{c.defense})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Away Club (2)</label>
                <select
                  value={awayClubId}
                  onChange={e => setAwayClubId(e.target.value)}
                  className="w-full h-8 bg-[#03150b] border border-[#00e700]/30 rounded-lg px-2 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                >
                  {clubs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.crest} {c.name} ({c.attack}/{c.defense})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Competition / League</label>
                <select
                  value={matchLeague}
                  onChange={e => setMatchLeague(e.target.value)}
                  className="w-full h-8 bg-[#03150b] border border-zinc-700 rounded-lg px-2 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                >
                  {leagues.map(l => (
                    <option key={l.id} value={l.name}>
                      {l.icon} {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Start Status</label>
                  <select
                    value={matchStatus}
                    onChange={e => setMatchStatus(e.target.value as 'UPCOMING' | 'LIVE')}
                    className="w-full h-8 bg-[#03150b] border border-zinc-700 rounded-lg px-2 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="LIVE">Live Now</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Starts (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    disabled={matchStatus === 'LIVE'}
                    value={countdownMins}
                    onChange={e => setCountdownMins(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full h-8 bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700] disabled:opacity-40 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Home (1)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1.02"
                  required
                  value={homeOdds}
                  onChange={e => setHomeOdds(e.target.value)}
                  className="w-full h-8 bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 text-xs font-black text-[#00e700] tabular-nums focus:outline-none focus:border-[#00e700]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Draw (X)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1.05"
                  required
                  value={drawOdds}
                  onChange={e => setDrawOdds(e.target.value)}
                  className="w-full h-8 bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 text-xs font-black text-[#00e700] tabular-nums focus:outline-none focus:border-[#00e700]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Away (2)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1.02"
                  required
                  value={awayOdds}
                  onChange={e => setAwayOdds(e.target.value)}
                  className="w-full h-8 bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 text-xs font-black text-[#00e700] tabular-nums focus:outline-none focus:border-[#00e700]"
                />
              </div>
            </div>

            <label className="flex items-center justify-between p-2 bg-[#03150b] rounded-lg border border-zinc-800 text-[11px] cursor-pointer">
              <span className="font-bold text-zinc-300">Feature as Homepage Hero Match</span>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={e => setIsFeatured(e.target.checked)}
                className="w-4 h-4 accent-[#00e700]"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting || clubs.length < 2}
              className="w-full h-9 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_16px_rgba(0,231,0,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Publishing...' : 'Fix & Publish Match'}</span>
            </button>
          </form>

          {/* Quick Official Packs */}
          <div className="md:col-span-5 bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3.5 space-y-2">
            <div className="border-b border-[#00e700]/15 pb-1.5">
              <h3 className="text-xs sm:text-sm font-black text-white">Quick Fixture Presets</h3>
            </div>

            <div className="space-y-1.5">
              <div className="bg-[#062416] p-2 rounded-lg border border-[#00e700]/25 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 font-bold block">Copa del Rey Hero</span>
                  <span className="text-xs font-black text-white truncate block">{PRESET_FIXTURES_INFO.featuredTitle}</span>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFixPreset('featured')}
                  className="h-7 px-2.5 rounded-md bg-[#00ad3a] hover:bg-[#00c844] text-black font-black text-[11px] shrink-0 active:scale-95 transition-all disabled:opacity-50"
                >
                  Fix
                </button>
              </div>

              <div className="bg-[#062416] p-2 rounded-lg border border-[#00e700]/25 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 font-bold block">Featured + Live Euro U21</span>
                  <span className="text-xs font-black text-white truncate block">{PRESET_FIXTURES_INFO.pairTitle}</span>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFixPreset('copa_and_euro')}
                  className="h-7 px-2.5 rounded-md bg-[#00ad3a] hover:bg-[#00c844] text-black font-black text-[11px] shrink-0 active:scale-95 transition-all disabled:opacity-50"
                >
                  Fix Pair
                </button>
              </div>

              <div className="bg-[#062416] p-2 rounded-lg border border-[#00e700]/25 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 font-bold block">Full Virtual Matchday</span>
                  <span className="text-xs font-black text-white truncate block">All {PRESET_FIXTURES_INFO.allCount} Virtual Fixtures</span>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFixPreset('all')}
                  className="h-7 px-2.5 rounded-md bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-[11px] shrink-0 active:scale-95 transition-all disabled:opacity-50"
                >
                  Fix All {PRESET_FIXTURES_INFO.allCount}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAGE 2: CREATE NEW CLUB (WRITE SINGLE OR MULTIPLE CLUBS PERMANENTLY) */}
      {activePage === 'create_club' && (
        <div className="max-w-xl mx-auto">
          <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-3 sm:p-4 space-y-2.5">
            <div className="bg-[#03150b] p-1 rounded-lg border border-zinc-800 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setFormError(null);
                  setClubCreateMode('single');
                }}
                className={`py-1.5 rounded-md text-[11px] font-black transition-all ${
                  clubCreateMode === 'single'
                    ? 'bg-[#00ad3a] text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Single Club
              </button>
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setFormError(null);
                  setClubCreateMode('bulk');
                }}
                className={`py-1.5 rounded-md text-[11px] font-black transition-all ${
                  clubCreateMode === 'bulk'
                    ? 'bg-[#00ad3a] text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Write Multiple
              </button>
            </div>

            {formError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-[11px] font-bold p-2 rounded-lg">
                {formError}
              </div>
            )}

            {clubCreateMode === 'single' ? (
              <form onSubmit={handleCreateClub} className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">Club Crest</label>
                  <div className="flex flex-wrap gap-1 bg-[#03150b] p-1.5 rounded-lg border border-zinc-800">
                    {CREST_OPTIONS.map(cr => (
                      <button
                        type="button"
                        key={cr}
                        onClick={() => {
                          soundManager.playClick();
                          setClubCrest(cr);
                        }}
                        className={`w-8 h-8 rounded-md text-base flex items-center justify-center transition-all ${
                          clubCrest === cr ? 'bg-[#00ad3a]/40 ring-2 ring-[#00e700]' : 'hover:bg-white/5'
                        }`}
                      >
                        {cr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Club Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Liverpool"
                      value={clubName}
                      onChange={e => setClubName(e.target.value)}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Code</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="LIV"
                      value={clubShort}
                      onChange={e => setClubShort(e.target.value.toUpperCase())}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-black text-white uppercase focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">League</label>
                    <select
                      value={clubLeague}
                      onChange={e => {
                        const selected = e.target.value;
                        setClubLeague(selected);
                        const lg = leagues.find(l => l.name === selected);
                        if (lg) setClubCountry(lg.country);
                      }}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                    >
                      {leagues.map(l => (
                        <option key={l.id} value={l.name}>
                          {l.icon} {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Country</label>
                    <input
                      type="text"
                      required
                      value={clubCountry}
                      onChange={e => setClubCountry(e.target.value)}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">
                      Attack ({clubAttack})
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={99}
                      value={clubAttack}
                      onChange={e => setClubAttack(Number(e.target.value))}
                      className="w-full accent-[#00e700]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">
                      Defense ({clubDefense})
                    </label>
                    <input
                      type="range"
                      min={50}
                      max={99}
                      value={clubDefense}
                      onChange={e => setClubDefense(Number(e.target.value))}
                      className="w-full accent-[#00e700]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-9 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Create & Deploy Club'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleBulkCreateClubs} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Target League</label>
                    <select
                      value={clubLeague}
                      onChange={e => {
                        const selected = e.target.value;
                        setClubLeague(selected);
                        const lg = leagues.find(l => l.name === selected);
                        if (lg) setClubCountry(lg.country);
                      }}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                    >
                      {leagues.map(l => (
                        <option key={l.id} value={l.name}>
                          {l.icon} {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Default Country</label>
                    <input
                      type="text"
                      required
                      value={clubCountry}
                      onChange={e => setClubCountry(e.target.value)}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-zinc-400">
                      Club Names (one per line)
                    </label>
                    <span className="text-[10px] text-[#00e700] font-bold">
                      {bulkClubsText.split('\n').filter(l => l.trim()).length} ready
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    required
                    value={bulkClubsText}
                    onChange={e => setBulkClubsText(e.target.value)}
                    placeholder={`Leeds United\nBurnley\nSunderland\nSheffield United`}
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg p-2.5 text-[11px] font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-[#00e700] resize-y"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-9 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Save & Deploy Clubs'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PAGE 3: CLUB DIRECTORY */}
      {activePage === 'club_directory' && (
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[#00e700]/15 pb-2">
            <select
              value={clubLeagueFilter}
              onChange={e => setClubLeagueFilter(e.target.value)}
              className="bg-[#03150b] border border-zinc-700 rounded-lg px-2 h-8 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700] max-w-[140px]"
            >
              <option value="all">All Leagues ({leagues.length})</option>
              {leagues.map(l => (
                <option key={l.id} value={l.name}>
                  {l.icon} {l.name}
                </option>
              ))}
            </select>

            <div className="flex items-center bg-[#03150b] border border-zinc-700 rounded-lg px-2 h-8 flex-1 min-w-[110px]">
              <Search className="w-3 h-3 text-zinc-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={clubSearch}
                onChange={e => setClubSearch(e.target.value)}
                placeholder="Search clubs..."
                className="bg-transparent text-[11px] text-white placeholder-zinc-500 focus:outline-none w-full"
              />
            </div>

            <button
              type="button"
              onClick={() => handleOpenPage('create_club')}
              className="h-8 px-2.5 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-white text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all"
            >
              <PlusCircle className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>

          {filteredClubs.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[11px] font-bold text-zinc-400">No clubs found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[68vh] overflow-y-auto pr-0.5">
              {filteredClubs.map(c => (
                <div
                  key={c.id}
                  className="bg-[#062416] border border-[#00e700]/20 rounded-lg p-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{c.crest}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-white truncate">{c.name}</span>
                        <span className="text-[10px] font-mono font-bold text-[#00e700]">({c.shortName})</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate">
                        <span className="truncate">{c.league}</span>
                        <span>·</span>
                        <span className="text-[#00e700] font-bold tabular-nums shrink-0">ATK {c.attack}/DEF {c.defense}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 shrink-0">{c.country}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAGE 4: LEAGUES */}
      {activePage === 'leagues' && (
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-[#00e700]/15 pb-2">
            <span className="text-xs font-black text-white shrink-0">Leagues ({leagues.length})</span>
            <div className="flex items-center bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 h-8 flex-1 max-w-[220px]">
              <Search className="w-3 h-3 text-zinc-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={leagueSearch}
                onChange={e => setLeagueSearch(e.target.value)}
                placeholder="Search leagues..."
                className="bg-transparent text-[11px] text-white placeholder-zinc-500 focus:outline-none w-full"
              />
            </div>
          </div>

          {filteredLeagues.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[11px] font-bold text-zinc-400">No leagues match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[68vh] overflow-y-auto pr-0.5">
              {filteredLeagues.map(lg => {
                const assignedClubs = clubs.filter(c => c.league.toLowerCase() === lg.name.toLowerCase());
                const leagueMatchCount = matches.filter(m => m.league.toLowerCase() === lg.name.toLowerCase()).length;
                const isExpanded = expandedLeagueId === lg.id;
                return (
                  <div
                    key={lg.id}
                    className="bg-[#062416] border border-[#00e700]/20 rounded-lg p-2.5 space-y-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playClick();
                        setExpandedLeagueId(isExpanded ? null : lg.id);
                      }}
                      className="w-full text-left flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#03150b] border border-[#00e700]/30 flex items-center justify-center text-base shrink-0">
                          {lg.icon}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-black text-white truncate block">{lg.name}</span>
                          <span className="text-[10px] text-zinc-400 block truncate">
                            {lg.country} · {assignedClubs.length} Clubs · {leagueMatchCount} Matches
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase text-[#00e700] shrink-0">
                        {lg.isCustom ? 'Custom' : 'Active'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="pt-1.5 border-t border-[#00e700]/15 space-y-1">
                        {assignedClubs.length === 0 ? (
                          <span className="text-[10px] text-zinc-400 block">No clubs assigned yet.</span>
                        ) : (
                          assignedClubs.map(c => (
                            <div
                              key={c.id}
                              className="bg-[#03150b] border border-zinc-800 rounded-md px-2 py-1 flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span>{c.crest}</span>
                                <span className="font-bold text-white truncate">{c.name}</span>
                                <span className="text-[10px] font-mono text-[#00e700]">({c.shortName})</span>
                              </div>
                              <span className="text-[10px] font-bold text-zinc-400 tabular-nums shrink-0">
                                {c.attack}/{c.defense}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PAGE 5: ACTIVE MATCHES CONTROL */}
      {activePage === 'active' && (
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#00e700]/15 pb-2">
            <h3 className="text-xs font-black text-white">Fixtures ({matches.length})</h3>
            {matches.length > 0 && (
              <button
                onClick={handleResetAll}
                className="h-7 px-2.5 rounded-md bg-red-900/60 hover:bg-red-800 text-red-200 text-[11px] font-bold border border-red-700/60 flex items-center gap-1 active:scale-95 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            )}
          </div>

          {matches.length === 0 ? (
            <div className="py-8 text-center space-y-2.5">
              <p className="text-xs font-black text-zinc-300">No active matches right now</p>
              <button
                onClick={() => handleOpenPage('fix_match')}
                className="h-8 px-3.5 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 active:scale-95"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Go to Fix Match</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[68vh] overflow-y-auto pr-0.5">
              {matches.map(m => (
                <div
                  key={m.id}
                  className="bg-[#062416] border border-[#00e700]/25 rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold">
                      <span className="truncate">{m.league}</span>
                      <span>·</span>
                      <span className={m.status === 'LIVE' ? 'text-[#00e700]' : 'text-amber-400'}>
                        {m.status === 'LIVE' ? `${m.minute}'/60' LIVE` : m.scheduledTime}
                      </span>
                      {m.isFeatured && <span className="text-amber-300">★</span>}
                    </div>
                    <div className="text-xs font-black text-white mt-0.5 truncate">
                      {m.homeTeam} <span className="text-amber-400 font-mono mx-1">{m.homeScore} - {m.awayScore}</span> {m.awayTeam}
                    </div>
                    <div className="text-[10px] text-[#00e700] font-bold tabular-nums">
                      H&amp;O15: {m.odds.home.toFixed(2)} · X: {m.odds.draw.toFixed(2)} · A&amp;O15: {m.odds.away.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.status === 'UPCOMING' && (
                      <button
                        onClick={async () => {
                          soundManager.playClick();
                          await virtualEngine.kickoffMatchNow(m.id);
                          showToast(`Kicked off: ${m.homeTeam} vs ${m.awayTeam}`);
                        }}
                        className="h-7 px-2.5 rounded-md bg-[#00ad3a] hover:bg-[#00c844] text-white text-[11px] font-black flex items-center gap-1 active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Kickoff</span>
                      </button>
                    )}

                    {m.status === 'LIVE' && (
                      <>
                        <button
                          onClick={async () => {
                            soundManager.playGoal();
                            await virtualEngine.triggerAdminGoal(m.id, 'home');
                          }}
                          className="h-7 px-2 rounded-md bg-[#00ad3a] hover:bg-[#00c844] text-white text-[11px] font-black flex items-center gap-0.5 active:scale-95"
                        >
                          <Zap className="w-3 h-3" />
                          <span>+1 Home</span>
                        </button>
                        <button
                          onClick={async () => {
                            soundManager.playGoal();
                            await virtualEngine.triggerAdminGoal(m.id, 'away');
                          }}
                          className="h-7 px-2 rounded-md bg-[#00ad3a] hover:bg-[#00c844] text-white text-[11px] font-black flex items-center gap-0.5 active:scale-95"
                        >
                          <Zap className="w-3 h-3" />
                          <span>+1 Away</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={async () => {
                        soundManager.playClick();
                        await virtualEngine.removeMatch(m.id);
                        if (isCloudConnected) {
                          void deleteCloudMatch(m.id);
                        }
                        showToast(`Removed: ${m.homeTeam} vs ${m.awayTeam}`);
                      }}
                      className="h-7 px-2 rounded-md bg-red-950/50 hover:bg-red-900 text-red-300 border border-red-800/50"
                      title="Remove Match"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAGE 6: DELETE CLUB (PERMANENT) */}
      {activePage === 'delete_club' && (
        <div className="bg-[#051c10]/95 border border-red-500/30 rounded-xl p-2.5 sm:p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-black text-white shrink-0">Clubs ({clubs.length})</h3>
            <div className="flex items-center bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 h-8 flex-1 max-w-[220px]">
              <Search className="w-3 h-3 text-zinc-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={clubSearch}
                onChange={e => setClubSearch(e.target.value)}
                placeholder="Search clubs..."
                className="bg-transparent text-[11px] text-white placeholder-zinc-500 focus:outline-none w-full"
              />
            </div>
          </div>

          {filteredClubs.length === 0 ? (
            <div className="py-8 text-center text-[11px] text-zinc-400">
              No clubs match your search.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[68vh] overflow-y-auto pr-0.5">
              {filteredClubs.map(c => {
                const isConfirming = pendingDeleteClubId === c.id;
                return (
                  <div
                    key={c.id}
                    className="bg-[#062416] border border-zinc-800 hover:border-red-500/40 rounded-lg p-2 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{c.crest}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black text-white truncate">{c.name}</span>
                          <span className="text-[10px] font-mono font-bold text-[#00e700]">({c.shortName})</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 truncate block">
                          {c.league} · ATK {c.attack}/DEF {c.defense}
                        </span>
                      </div>
                    </div>

                    {isConfirming ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteClubId(null)}
                          className="h-7 px-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold active:scale-95 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            soundManager.playClick();
                            await virtualEngine.deleteClub(c.id);
                            if (isCloudConnected) {
                              void deleteCloudClubWithTombstone(c.id);
                            }
                            setPendingDeleteClubId(null);
                            showToast(`Permanently deleted club: ${c.name}`);
                          }}
                          className="h-7 px-2.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-[11px] font-black flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Confirm</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playClick();
                          setPendingDeleteClubId(c.id);
                        }}
                        className="h-7 px-2.5 rounded-md bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-[11px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PAGE 7: ADMIN DEPOSIT PAGE */}
      {activePage === 'deposit' && (
        <div className="max-w-xl mx-auto">
          <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-3 sm:p-4 space-y-3">
            <form onSubmit={handleDepositLookup} className="flex items-center gap-1.5">
              <div className="flex-1 flex items-center bg-[#03150b] border border-zinc-700 focus-within:border-[#00e700] rounded-lg px-2.5 h-9">
                <Search className="w-3.5 h-3.5 text-zinc-400 mr-1.5 shrink-0" />
                <input
                  type="text"
                  value={depositSearchId}
                  onChange={e => {
                    setDepositSearchId(e.target.value);
                    if (depositError) setDepositError(null);
                  }}
                  placeholder="Enter User ID (e.g. 100001)"
                  className="bg-transparent text-xs font-mono font-bold text-white placeholder-zinc-500 focus:outline-none w-full tabular-nums"
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingUser || depositCountdown !== null}
                className="h-9 px-3 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-black font-black text-xs whitespace-nowrap active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                {isSearchingUser ? '...' : 'Search'}
              </button>
            </form>

            {depositError && (
              <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-xs font-black p-2.5 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{depositError}</span>
              </div>
            )}

            {depositSuccessMsg && (
              <div className="bg-[#00ad3a]/20 border border-[#00e700]/50 text-[#00e700] text-xs font-black p-2.5 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{depositSuccessMsg}</span>
              </div>
            )}

            {depositRecipient && (
              <form onSubmit={handleDepositSubmit} className="space-y-2.5">
                <div className="bg-[#062416] border border-[#00e700]/35 rounded-lg p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0">{depositRecipient.avatar}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-white block truncate">
                        {depositRecipient.fullName}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono tabular-nums block truncate">
                        #{depositRecipient.id} · @{depositRecipient.username}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-zinc-400 font-bold block">Balance</span>
                    <span className="text-xs font-black text-[#00e700] tabular-nums">
                      ${depositRecipient.balance.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">
                    Deposit Amount (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    disabled={depositCountdown !== null}
                    value={depositAmountInput}
                    onChange={e => setDepositAmountInput(e.target.value)}
                    placeholder="Enter amount (e.g. 5000)"
                    className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-lg px-3 py-2 text-xs font-black text-white placeholder-zinc-500 focus:outline-none focus:border-[#00e700] tabular-nums disabled:opacity-50"
                  />
                </div>

                {depositCountdown !== null && (
                  <div className="bg-amber-950/60 border border-amber-500/40 rounded-lg p-2 flex items-center justify-between gap-2 text-[11px] font-black text-amber-300">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-3.5 h-3.5 animate-spin shrink-0" />
                      <span className="truncate">Verifying {depositRecipient.fullName}...</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums shrink-0">{depositCountdown}s</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={depositCountdown !== null}
                  className="w-full h-9 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>
                    {depositCountdown !== null
                      ? `Verifying (${depositCountdown}s)...`
                      : 'Deposit'}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PAGE 8: REGISTERED USERS DIRECTORY */}
      {activePage === 'users' && (
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 border-b border-[#00e700]/15 pb-2">
            <span className="text-xs font-black text-white tabular-nums shrink-0">
              Verified ({users.length})
            </span>
            <div className="flex items-center bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 h-8 flex-1 max-w-[220px]">
              <Search className="w-3 h-3 text-zinc-400 mr-1.5 shrink-0" />
              <input
                type="text"
                value={usersFilter}
                onChange={e => setUsersFilter(e.target.value)}
                placeholder="Filter ID, username, name..."
                className="bg-transparent text-[11px] text-white placeholder-zinc-500 focus:outline-none w-full"
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs font-bold text-zinc-300">No verified registered users yet.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[68vh] overflow-y-auto pr-0.5">
              {filteredUsers.map(u => {
                const isConfirmingDelete = pendingDeleteUserId === u.id;
                return (
                  <div
                    key={u.id}
                    className="bg-[#062416] border border-[#00e700]/20 rounded-lg p-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#03150b] border border-[#00e700]/30 flex items-center justify-center text-base shrink-0">
                        {u.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs font-black text-white truncate">@{u.username}</span>
                          <span className="text-[10px] font-mono font-black text-[#00e700] tabular-nums">
                            #{u.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate">
                          <span className="truncate">{u.fullName}</span>
                          <span>·</span>
                          <span className="font-mono font-bold text-[#00e700] tabular-nums shrink-0">
                            ${u.balance.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isConfirmingDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteUserId(null)}
                            className="h-7 px-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold whitespace-nowrap active:scale-95 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              soundManager.playClick();
                              try {
                                const updatedList = await virtualEngine.deleteAdminUser(u.id);
                                if (isCloudConnected) {
                                  await deleteCloudUserWithTombstone(u.id);
                                }
                                setUsers(updatedList);
                                setPendingDeleteUserId(null);
                                showToast(`Deleted user @${u.username} (ID #${u.id})`);
                              } catch (err) {
                                showToast(err instanceof Error ? err.message : 'Unable to delete user.');
                              }
                            }}
                            className="h-7 px-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-[11px] font-black flex items-center gap-1 whitespace-nowrap active:scale-95 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Confirm</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              openEditUserPage(u);
                            }}
                            className="h-7 px-2 rounded-md bg-[#00ad3a] hover:bg-[#00c844] text-black text-[11px] font-black flex items-center gap-1 whitespace-nowrap active:scale-95 transition-all"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Update</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              setPendingDeleteUserId(u.id);
                            }}
                            className="h-7 px-2 rounded-md bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-[11px] font-black flex items-center gap-1 whitespace-nowrap active:scale-95 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PAGE 9: USER INFO UPDATE FORM */}
      {activePage === 'edit_user' && selectedEditUser && (
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={handleSaveUserInfo}
            className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-3 sm:p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#00e700]/15 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">{editForm.avatar}</span>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white truncate">
                    {selectedEditUser.fullName} <span className="font-mono text-[#00e700] tabular-nums">#{selectedEditUser.id}</span>
                  </h3>
                  <span className="text-[10px] text-zinc-400 block">
                    Balance: <span className="text-[#00e700] font-bold tabular-nums">${selectedEditUser.balance.toFixed(2)}</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setDepositRecipient(selectedEditUser);
                  setDepositSearchId(selectedEditUser.id);
                  setDepositError(null);
                  setDepositSuccessMsg(null);
                  handleOpenPage('deposit');
                }}
                className="h-7 px-2.5 rounded-lg bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/40 text-[11px] font-black text-[#00e700] flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Wallet className="w-3 h-3" />
                <span>Deposit</span>
              </button>
            </div>

            {formError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-[11px] font-bold p-2 rounded-lg">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00e700] block">
                Registration Details (Auto-Filled)
              </span>

              <div className="flex flex-wrap gap-1 bg-[#03150b] p-1.5 rounded-lg border border-zinc-800">
                {AVATAR_OPTIONS.map(av => (
                  <button
                    type="button"
                    key={av}
                    onClick={() => {
                      soundManager.playClick();
                      setEditForm(prev => ({ ...prev, avatar: av }));
                    }}
                    className={`w-8 h-8 rounded-md text-base flex items-center justify-center transition-all ${
                      editForm.avatar === av ? 'bg-[#00ad3a]/40 ring-2 ring-[#00e700]' : 'hover:bg-white/5'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">User ID</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedEditUser.id}
                    className="w-full bg-[#020e07] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-black text-[#00e700] tabular-nums focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Username</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={e => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Email</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#00e700]/15">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-300 block">
                Additional Profile Information
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Phone number"
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Country</label>
                  <input
                    type="text"
                    value={editForm.country}
                    onChange={e => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Country"
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={e => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={e => setEditForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Home Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Street address"
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">KYC / ID Number</label>
                  <input
                    type="text"
                    value={editForm.kycIdNumber}
                    onChange={e => setEditForm(prev => ({ ...prev, kycIdNumber: e.target.value }))}
                    placeholder="ID / Passport No."
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Account Tier</label>
                  <select
                    value={editForm.accountTier}
                    onChange={e =>
                      setEditForm(prev => ({
                        ...prev,
                        accountTier: e.target.value as 'Standard' | 'VIP' | 'Suspended'
                      }))
                    }
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-[#00e700]"
                  >
                    <option value="Standard">Standard</option>
                    <option value="VIP">VIP</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Admin Notes</label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes..."
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-lg p-2 text-[11px] font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700] resize-y"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleOpenPage('users')}
                className="h-9 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs whitespace-nowrap"
              >
                All Users
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-9 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Saving...' : 'Save User Info'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POP-OUT MODAL: CREATE CUSTOM LEAGUE */}
      {isLeagueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#051c11] border border-[#00e700]/35 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#00e700]" />
                <h3 className="text-sm sm:text-base font-black text-white">Create Custom League</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLeagueModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomLeague} className="p-4 space-y-3.5">
              {leagueModalError && (
                <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-xs font-bold p-2.5 rounded-xl">
                  {leagueModalError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1.5">League Icon</label>
                <div className="flex flex-wrap gap-1.5 bg-[#03150b] p-2 rounded-xl border border-zinc-800">
                  {LEAGUE_ICONS.map(ic => (
                    <button
                      type="button"
                      key={ic}
                      onClick={() => {
                        soundManager.playClick();
                        setNewLeagueIcon(ic);
                      }}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                        newLeagueIcon === ic ? 'bg-[#00ad3a]/40 ring-2 ring-[#00e700] scale-105' : 'hover:bg-white/5'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Custom League Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAS9i Champions Super League"
                  value={newLeagueName}
                  onChange={e => setNewLeagueName(e.target.value)}
                  className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Country / Region</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Europe"
                  value={newLeagueCountry}
                  onChange={e => setNewLeagueCountry(e.target.value)}
                  className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsLeagueModalOpen(false)}
                  className="h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs sm:text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 stroke-[2.75]" />
                  <span>{isSubmitting ? 'Saving...' : 'Save Custom League'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-OUT MODAL: DTM RESULT INPUT BOX */}
      {dtmModal && liveSelectedDtmMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#051c11] border border-[#00e700]/40 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.22)] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#03150b] border-b border-[#00e700]/20">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-[#00e700] block truncate">
                  {liveSelectedDtmMatch.homeTeam} vs {liveSelectedDtmMatch.awayTeam}
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white truncate">
                  {dtmModal.marketName} · {dtmModal.optionLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDtmModal(null)}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDtmModal} className="p-3.5 space-y-3">
              {dtmModalError && (
                <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-[11px] font-bold p-2 rounded-lg">
                  {dtmModalError}
                </div>
              )}

              {/* Correct Score Input */}
              {dtmModal.marketType === 'Correct Score' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1 truncate">
                      {liveSelectedDtmMatch.homeTeam} Score
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      required
                      value={dtmModal.csHome}
                      onChange={e => setDtmModal(prev => (prev ? { ...prev, csHome: e.target.value } : prev))}
                      className="w-full h-10 bg-[#03150b] border border-[#00e700]/35 focus:border-[#00e700] rounded-xl px-3 text-base font-black text-amber-400 text-center tabular-nums focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1 truncate">
                      {liveSelectedDtmMatch.awayTeam} Score
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      required
                      value={dtmModal.csAway}
                      onChange={e => setDtmModal(prev => (prev ? { ...prev, csAway: e.target.value } : prev))}
                      className="w-full h-10 bg-[#03150b] border border-[#00e700]/35 focus:border-[#00e700] rounded-xl px-3 text-base font-black text-amber-400 text-center tabular-nums focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 1X2 Input */}
              {dtmModal.marketType === '1X2' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Home & O15', 'Draw', 'Away & O15'] as const).map(choice => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() =>
                          setDtmModal(prev =>
                            prev
                              ? {
                                  ...prev,
                                  winner1X2: choice,
                                  csHome: choice === 'Draw' ? '9' : choice === 'Home & O15' ? '11' : '8',
                                  csAway: choice === 'Draw' ? '9' : choice === 'Away & O15' ? '11' : '8',
                                }
                              : prev
                          )
                        }
                        className={`py-2 px-1 rounded-lg text-[10px] sm:text-[11px] font-black transition-all whitespace-nowrap ${
                          dtmModal.winner1X2 === choice
                            ? 'bg-[#00ff44] text-black ring-2 ring-white'
                            : 'bg-[#03150b] text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center justify-between bg-[#03150b] border border-zinc-800 rounded-lg px-2.5 py-2 text-[11px] cursor-pointer">
                    <span className="font-bold text-zinc-300">Set Exact Final Score (Optional)</span>
                    <input
                      type="checkbox"
                      checked={dtmModal.applyOptionalScore}
                      onChange={e =>
                        setDtmModal(prev => (prev ? { ...prev, applyOptionalScore: e.target.checked } : prev))
                      }
                      className="w-4 h-4 accent-[#00e700]"
                    />
                  </label>

                  {dtmModal.applyOptionalScore && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-0.5 truncate">
                          {liveSelectedDtmMatch.homeTeam} Score
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          required
                          value={dtmModal.csHome}
                          onChange={e => setDtmModal(prev => (prev ? { ...prev, csHome: e.target.value } : prev))}
                          className="w-full h-9 bg-[#03150b] border border-[#00e700]/30 rounded-lg px-2 text-sm font-black text-amber-400 text-center tabular-nums focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-0.5 truncate">
                          {liveSelectedDtmMatch.awayTeam} Score
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          required
                          value={dtmModal.csAway}
                          onChange={e => setDtmModal(prev => (prev ? { ...prev, csAway: e.target.value } : prev))}
                          className="w-full h-9 bg-[#03150b] border border-[#00e700]/30 rounded-lg px-2 text-sm font-black text-amber-400 text-center tabular-nums focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 1st Goal Input */}
              {dtmModal.marketType === '1st Goal' && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'Home' as const, label: `Home (${liveSelectedDtmMatch.homeTeam})` },
                    { key: 'Away' as const, label: `Away (${liveSelectedDtmMatch.awayTeam})` },
                  ].map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setDtmModal(prev => (prev ? { ...prev, firstGoal: item.key } : prev))}
                      className={`py-2.5 px-2 rounded-lg text-[11px] font-black truncate ${
                        dtmModal.firstGoal === item.key
                          ? 'bg-[#00ff44] text-black ring-2 ring-white'
                          : 'bg-[#03150b] text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {/* 5 Min Goal Input */}
              {dtmModal.marketType === '5 Min Goal' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Yes', 'No', 'Over 5 Goals'] as const).map(choice => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setDtmModal(prev => (prev ? { ...prev, fiveMinGoal: choice } : prev))}
                      className={`py-2.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-black whitespace-nowrap ${
                        dtmModal.fiveMinGoal === choice
                          ? 'bg-[#00ff44] text-black ring-2 ring-white'
                          : 'bg-[#03150b] text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {/* Odd/Even Input */}
              {dtmModal.marketType === 'Odd/Even' && (
                <div className="grid grid-cols-2 gap-2">
                  {(['Odd', 'Even'] as const).map(choice => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setDtmModal(prev => (prev ? { ...prev, oddEven: choice } : prev))}
                      className={`py-2.5 px-2 rounded-lg text-xs font-black ${
                        dtmModal.oddEven === choice
                          ? 'bg-[#00ff44] text-black ring-2 ring-white'
                          : 'bg-[#03150b] text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {choice} Total Goals
                    </button>
                  ))}
                </div>
              )}

              {/* 1st Half O/U 15 */}
              {dtmModal.marketName === '1st Half O/U 15' && (
                <div className="grid grid-cols-2 gap-2">
                  {(['Over 15', 'Under 15'] as const).map(choice => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setDtmModal(prev => (prev ? { ...prev, firstHalfOU15: choice } : prev))}
                      className={`py-2.5 px-2 rounded-lg text-xs font-black ${
                        dtmModal.firstHalfOU15 === choice
                          ? 'bg-[#00ff44] text-black ring-2 ring-white'
                          : 'bg-[#03150b] text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {/* 1st Half */}
              {dtmModal.marketType === '1st Half' && dtmModal.marketName === '1st Half' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Home & O10', 'X & O10', 'Away & O10'] as const).map(choice => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setDtmModal(prev => (prev ? { ...prev, firstHalf: choice } : prev))}
                      className={`py-2.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-black whitespace-nowrap ${
                        dtmModal.firstHalf === choice
                          ? 'bg-[#00ff44] text-black ring-2 ring-white'
                          : 'bg-[#03150b] text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {/* 2nd Half */}
              {dtmModal.marketType === '2nd Half' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Home & O15', 'X & O15', 'Away & O15'] as const).map(choice => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setDtmModal(prev => (prev ? { ...prev, secondHalf: choice } : prev))}
                      className={`py-2.5 px-1 rounded-lg text-[10px] sm:text-[11px] font-black whitespace-nowrap ${
                        dtmModal.secondHalf === choice
                          ? 'bg-[#00ff44] text-black ring-2 ring-white'
                          : 'bg-[#03150b] text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {/* Over / Under Input */}
              {dtmModal.marketType === 'Over/Under' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Line (15 - 30)</label>
                      <input
                        type="number"
                        min={15}
                        max={30}
                        value={dtmModal.overUnderLine}
                        onChange={e => {
                          const line = Math.max(15, Math.min(30, Math.floor(Number(e.target.value) || 15)));
                          setDtmModal(prev => (prev ? { ...prev, overUnderLine: line } : prev));
                        }}
                        className="w-full h-9 bg-[#03150b] border border-zinc-700 rounded-lg px-2.5 text-xs font-black text-white tabular-nums focus:outline-none focus:border-[#00e700]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">Outcome</label>
                      <div className="grid grid-cols-2 gap-1 h-9">
                        {(['Over', 'Under'] as const).map(side => (
                          <button
                            key={side}
                            type="button"
                            onClick={() =>
                              setDtmModal(prev =>
                                prev
                                  ? {
                                      ...prev,
                                      overUnderPick: side,
                                      overUnderTargetGoals: String(
                                        side === 'Over' ? prev.overUnderLine + 1 : Math.max(0, prev.overUnderLine - 1)
                                      ),
                                    }
                                  : prev
                              )
                            }
                            className={`rounded-lg text-[11px] font-black ${
                              dtmModal.overUnderPick === side
                                ? 'bg-[#00ff44] text-black'
                                : 'bg-[#03150b] text-zinc-300 border border-zinc-700'
                            }`}
                          >
                            {side}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-0.5">
                      Total Goals ({dtmModal.overUnderPick} {dtmModal.overUnderLine})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      required
                      value={dtmModal.overUnderTargetGoals}
                      onChange={e =>
                        setDtmModal(prev => (prev ? { ...prev, overUnderTargetGoals: e.target.value } : prev))
                      }
                      className="w-full h-9 bg-[#03150b] border border-[#00e700]/35 rounded-lg px-3 text-sm font-black text-amber-400 text-center tabular-nums focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-1">
                {activeDtmRuleForSelected && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleClearDtmModalMarket}
                    className="h-9 px-2.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-700/50 text-[11px] font-bold whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDtmModal(null)}
                  className="h-9 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-9 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
