import React, { useState, useEffect, useRef } from 'react';
import { Club, League, VirtualMatch, RegisteredUser } from '../types';
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
  List,
  Trophy,
  X,
  AlertTriangle,
  Wallet,
  UserCheck,
  Edit3,
  Clock,
  Save
} from 'lucide-react';

interface AdminDashboardProps {
  matches: VirtualMatch[];
  clubs: Club[];
  leagues: League[];
  onNavigateSports: () => void;
}

type AdminPage =
  | 'hub'
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
  return saved && VALID_ADMIN_PAGES.includes(saved) ? saved : 'hub';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  matches,
  clubs,
  leagues,
  onNavigateSports
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

  // Fetch registered & verified users on mount and live updates
  const loadUsersList = async () => {
    try {
      const list = await virtualEngine.fetchAdminUsers();
      setUsers(list);
    } catch {
      // ignore if token not ready yet
    }
  };

  useEffect(() => {
    void loadUsersList();
    const unsub = virtualEngine.onUsersChanged(() => {
      void loadUsersList();
    });
    return () => {
      unsub();
      if (depositTimerRef.current) {
        clearInterval(depositTimerRef.current);
      }
    };
  }, []);

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
    setActivePage(page);
    if (page === 'users' || page === 'deposit') {
      void loadUsersList();
    }
    if (typeof window !== 'undefined' && page !== 'edit_user') {
      window.localStorage.setItem('cas9i_admin_page', page);
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
      await virtualEngine.fixMatchBetweenClubs({
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

  const pageSubtitleMap: Record<AdminPage, string> = {
    hub: 'Manage clubs, leagues, fixtures, user deposits, and registered profiles',
    fix_match: 'Schedule & fix virtual matches — auto-synced across all users & devices',
    create_club: 'Register a permanent virtual club until explicitly deleted by admin',
    club_directory: 'Browse all permanently registered clubs and team power ratings',
    leagues: 'All currently deployed and active leagues in the system',
    active: 'Manage live scores, kickoffs, or reset active fixtures',
    delete_club: 'Permanently delete a club — cannot be undone',
    deposit: 'Search user by ID, verify recipient full name, and lodge deposit',
    users: 'All verified registered users — update details or remove profiles',
    edit_user: 'Registration fields are pre-filled; complete and save remaining user details'
  };

  return (
    <div className="space-y-4 pb-10 px-3 sm:px-5 pt-3 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="border-b border-[#00e700]/20 pb-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {activePage !== 'hub' ? (
              <button
                onClick={() => handleOpenPage(activePage === 'edit_user' ? 'users' : 'hub')}
                className="h-9 px-3 rounded-xl bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/35 text-xs font-bold text-[#00e700] flex items-center gap-1.5 transition-all active:scale-95 shrink-0 whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#00ad3a]/20 border border-[#00e700]/40 flex items-center justify-center text-[#00e700] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide truncate">
                {pageTitleMap[activePage]}
              </h2>
              <p className="text-[11px] text-zinc-400 truncate">
                {pageSubtitleMap[activePage]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activePage === 'leagues' && (
              <div className="flex items-center gap-1.5">
                {/* Red + button: Auto-generate 5 permanent clubs */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleAutoGenerateFiveClubs}
                  aria-label="Auto-generate 5 new clubs"
                  title="Auto-generate 5 permanent new clubs"
                  className="w-9 h-9 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black flex items-center justify-center shadow-[0_0_14px_rgba(220,38,38,0.45)] active:scale-95 transition-all disabled:opacity-50"
                >
                  <Plus className="w-5 h-5 stroke-[2.75]" />
                </button>

                {/* Blue + button: Auto-deploy 3 different clubs to each league */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDeployThreePerLeague}
                  aria-label="Auto-deploy 3 new clubs to each league"
                  title="Auto-deploy 3 different new clubs to each league"
                  className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black flex items-center justify-center shadow-[0_0_14px_rgba(37,99,235,0.45)] active:scale-95 transition-all disabled:opacity-50"
                >
                  <Plus className="w-5 h-5 stroke-[2.75]" />
                </button>

                {/* Green + button: Create Custom League */}
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
                  className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black flex items-center justify-center shadow-[0_0_15px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Plus className="w-5 h-5 stroke-[2.75]" />
                </button>
              </div>
            )}

            <button
              onClick={() => {
                soundManager.playClick();
                onNavigateSports();
              }}
              className="h-9 px-3 rounded-xl bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/35 text-xs font-bold text-white flex items-center gap-1.5 transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              <span>View Homepage</span>
            </button>
          </div>
        </div>

        {/* Top User ID Search Bar */}
        <form onSubmit={handleTopSearchById} className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-[#03150b] border border-[#00e700]/30 focus-within:border-[#00e700] rounded-xl px-3 h-9">
            <Search className="w-4 h-4 text-[#00e700] mr-2 shrink-0" />
            <input
              type="text"
              value={topSearchId}
              onChange={e => {
                setTopSearchId(e.target.value);
                if (topSearchError) setTopSearchError(null);
              }}
              placeholder="Search user data by ID (e.g. 100001)..."
              className="bg-transparent text-xs font-bold text-white placeholder-zinc-500 focus:outline-none w-full font-mono tabular-nums"
            />
          </div>
          <button
            type="submit"
            disabled={isSearchingUser}
            className="h-9 px-4 rounded-xl bg-[#00ad3a] hover:bg-[#00c844] text-black font-black text-xs whitespace-nowrap active:scale-95 transition-all disabled:opacity-50 shrink-0"
          >
            {isSearchingUser ? 'Searching...' : 'Search ID'}
          </button>
        </form>

        {topSearchError && (
          <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-xs font-bold px-3 py-2 rounded-xl">
            {topSearchError}
          </div>
        )}
      </div>

      {/* Live Toast Feedback */}
      {toastMsg && (
        <div className="bg-[#00ad3a] text-black font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(0,231,0,0.4)]">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HUB VIEW: ONLY ACTION BUTTONS */}
      {activePage === 'hub' && (
        <div className="space-y-4">
          {/* Compact KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-xl p-3">
              <span className="text-[10px] sm:text-xs font-bold text-zinc-400 block">Clubs</span>
              <span className="text-lg sm:text-2xl font-black text-white tabular-nums">{clubs.length}</span>
            </div>
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-xl p-3">
              <span className="text-[10px] sm:text-xs font-bold text-zinc-400 block">Leagues</span>
              <span className="text-lg sm:text-2xl font-black text-emerald-300 tabular-nums">{leagues.length}</span>
            </div>
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-xl p-3">
              <span className="text-[10px] sm:text-xs font-bold text-zinc-400 block">Fixed Matches</span>
              <span className="text-lg sm:text-2xl font-black text-[#00e700] tabular-nums">{matches.length}</span>
            </div>
            <div className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-xl p-3">
              <span className="text-[10px] sm:text-xs font-bold text-zinc-400 block">Live Playing</span>
              <span className="text-lg sm:text-2xl font-black text-amber-400 tabular-nums">{liveCount}</span>
            </div>
          </div>

          {/* Dedicated Action Buttons -> Open Separate Pages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Deposit */}
            <button
              onClick={() => handleOpenPage('deposit')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/45 hover:border-[#00e700] rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#00ad3a]/25 border border-[#00e700]/45 flex items-center justify-center text-[#00e700] shrink-0 group-hover:scale-105 transition-transform">
                  <Wallet className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white block">Deposit</span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    Search user by ID &amp; verify 5s deposit credit
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#00e700] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Users */}
            <button
              onClick={() => handleOpenPage('users')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/45 hover:border-[#00e700] rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white block">
                    Users <span className="text-xs font-bold text-[#00e700] ml-1 tabular-nums">({users.length})</span>
                  </span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    Verified accounts, update profiles or delete users
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 1. Fix Match */}
            <button
              onClick={() => handleOpenPage('fix_match')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#00ad3a]/25 border border-[#00e700]/40 flex items-center justify-center text-[#00e700] shrink-0 group-hover:scale-105 transition-transform">
                  <Swords className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white block">Fix Match</span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    Pair clubs, set odds &amp; sync across all devices
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#00e700] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 2. Create New Club */}
            <button
              onClick={() => handleOpenPage('create_club')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#00ad3a]/25 border border-[#00e700]/40 flex items-center justify-center text-[#00e700] shrink-0 group-hover:scale-105 transition-transform">
                  <PlusCircle className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white block">Create New Club</span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    Add a permanent club with custom crest &amp; ratings
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#00e700] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 3. Club Directory */}
            <button
              onClick={() => handleOpenPage('club_directory')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#00ad3a]/25 border border-[#00e700]/40 flex items-center justify-center text-[#00e700] shrink-0 group-hover:scale-105 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white block">
                    Club Directory <span className="text-xs font-bold text-[#00e700] ml-1">({clubs.length})</span>
                  </span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    View all registered clubs &amp; power ratings
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#00e700] shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 4. Leagues */}
            <button
              onClick={() => handleOpenPage('leagues')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition-transform">
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white block">
                    Leagues <span className="text-xs font-bold text-emerald-300 ml-1">({leagues.length})</span>
                  </span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    View deployed leagues &amp; create custom leagues
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-emerald-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 5. Active */}
            <button
              onClick={() => handleOpenPage('active')}
              className="group w-full text-left bg-gradient-to-br from-[#09321c] to-[#051c10] hover:from-[#0e4728] hover:to-[#072616] border border-[#00e700]/35 hover:border-[#00e700] rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white block">
                    Active <span className="text-xs font-bold text-amber-400 ml-1">({matches.length})</span>
                  </span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    Control kickoffs, live goals &amp; reset matches
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 6. Delete Club */}
            <button
              onClick={() => handleOpenPage('delete_club')}
              className="group w-full text-left bg-gradient-to-br from-[#1f0d10] to-[#0b0708] hover:from-[#2c1116] hover:to-[#130a0c] border border-red-500/35 hover:border-red-400 rounded-2xl p-4 sm:p-5 transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <span className="text-base font-black text-white block">Delete Club</span>
                  <span className="text-xs text-zinc-400 block mt-0.5">
                    Permanently remove clubs (cannot be undone)
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-red-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* PAGE 1: FIX MATCH BETWEEN CLUBS */}
      {activePage === 'fix_match' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <form
            onSubmit={handleFixMatchBetweenClubs}
            className="md:col-span-7 bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-3 sm:p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[#00e700]/15 pb-2">
              <h3 className="text-sm font-black text-white">Fix Match Between Clubs</h3>
              <span className="text-[11px] text-[#00e700] font-bold">Auto-syncs to all devices</span>
            </div>

            {formError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-xs font-bold p-2.5 rounded-xl">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Home Club (1)</label>
                <select
                  value={homeClubId}
                  onChange={e => setHomeClubId(e.target.value)}
                  className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                >
                  {clubs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.crest} {c.name} ({c.attack}/{c.defense})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Away Club (2)</label>
                <select
                  value={awayClubId}
                  onChange={e => setAwayClubId(e.target.value)}
                  className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                >
                  {clubs.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.crest} {c.name} ({c.attack}/{c.defense})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Competition / League</label>
                <select
                  value={matchLeague}
                  onChange={e => setMatchLeague(e.target.value)}
                  className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
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
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Start Status</label>
                  <select
                    value={matchStatus}
                    onChange={e => setMatchStatus(e.target.value as 'UPCOMING' | 'LIVE')}
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                  >
                    <option value="UPCOMING">Upcoming</option>
                    <option value="LIVE">Live Now</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Starts In (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    disabled={matchStatus === 'LIVE'}
                    value={countdownMins}
                    onChange={e => setCountdownMins(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00e700] disabled:opacity-40 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Home (1)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1.02"
                  required
                  value={homeOdds}
                  onChange={e => setHomeOdds(e.target.value)}
                  className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-black text-[#00e700] tabular-nums focus:outline-none focus:border-[#00e700]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Draw (X)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1.05"
                  required
                  value={drawOdds}
                  onChange={e => setDrawOdds(e.target.value)}
                  className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-black text-[#00e700] tabular-nums focus:outline-none focus:border-[#00e700]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1">Away (2)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1.02"
                  required
                  value={awayOdds}
                  onChange={e => setAwayOdds(e.target.value)}
                  className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-black text-[#00e700] tabular-nums focus:outline-none focus:border-[#00e700]"
                />
              </div>
            </div>

            <label className="flex items-center justify-between p-2.5 bg-[#03150b] rounded-xl border border-zinc-800 text-xs cursor-pointer">
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
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Publishing...' : 'Fix & Publish Match'}</span>
            </button>
          </form>

          {/* Quick Official Packs */}
          <div className="md:col-span-5 bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-3 sm:p-4 space-y-3">
            <div className="border-b border-[#00e700]/15 pb-2">
              <h3 className="text-sm font-black text-white">Quick Fixture Presets</h3>
              <span className="text-[11px] text-zinc-400">Instant matchday deployment</span>
            </div>

            <div className="space-y-2.5">
              <div className="bg-[#062416] p-3 rounded-xl border border-[#00e700]/25 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 font-bold block">Copa del Rey Hero</span>
                  <span className="text-xs font-black text-white truncate block">{PRESET_FIXTURES_INFO.featuredTitle}</span>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFixPreset('featured')}
                  className="h-9 px-3 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-white font-black text-xs shrink-0 active:scale-95 transition-all disabled:opacity-50"
                >
                  Fix
                </button>
              </div>

              <div className="bg-[#062416] p-3 rounded-xl border border-[#00e700]/25 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 font-bold block">Featured + Live Euro U21</span>
                  <span className="text-xs font-black text-white truncate block">{PRESET_FIXTURES_INFO.pairTitle}</span>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFixPreset('copa_and_euro')}
                  className="h-9 px-3 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-white font-black text-xs shrink-0 active:scale-95 transition-all disabled:opacity-50"
                >
                  Fix Pair
                </button>
              </div>

              <div className="bg-[#062416] p-3 rounded-xl border border-[#00e700]/25 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-400 font-bold block">Full Virtual Matchday</span>
                  <span className="text-xs font-black text-white truncate block">All {PRESET_FIXTURES_INFO.allCount} Virtual Fixtures</span>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFixPreset('all')}
                  className="h-9 px-3 rounded-lg bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs shrink-0 active:scale-95 transition-all disabled:opacity-50"
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
          <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#00e700]/15 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">Create &amp; Write New Clubs</h3>
                <span className="text-[11px] text-zinc-400">
                  Permanently saved — remains in Club Directory unless deleted by Admin
                </span>
              </div>

              <div className="bg-[#03150b] p-1 rounded-xl border border-zinc-800 grid grid-cols-2 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setFormError(null);
                    setClubCreateMode('single');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    clubCreateMode === 'bulk'
                      ? 'bg-[#00ad3a] text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Write Multiple
                </button>
              </div>
            </div>

            {formError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-xs font-bold p-2.5 rounded-xl">
                {formError}
              </div>
            )}

            {clubCreateMode === 'single' ? (
              <form onSubmit={handleCreateClub} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1.5">Club Crest</label>
                  <div className="flex flex-wrap gap-1.5 bg-[#03150b] p-2.5 rounded-xl border border-zinc-800">
                    {CREST_OPTIONS.map(cr => (
                      <button
                        type="button"
                        key={cr}
                        onClick={() => {
                          soundManager.playClick();
                          setClubCrest(cr);
                        }}
                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                          clubCrest === cr ? 'bg-[#00ad3a]/40 ring-2 ring-[#00e700] scale-105' : 'hover:bg-white/5'
                        }`}
                      >
                        {cr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-zinc-400 block mb-1">Club Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Liverpool"
                      value={clubName}
                      onChange={e => setClubName(e.target.value)}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">Code</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="LIV"
                      value={clubShort}
                      onChange={e => setClubShort(e.target.value.toUpperCase())}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-black text-white uppercase focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">League</label>
                    <select
                      value={clubLeague}
                      onChange={e => {
                        const selected = e.target.value;
                        setClubLeague(selected);
                        const lg = leagues.find(l => l.name === selected);
                        if (lg) setClubCountry(lg.country);
                      }}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                    >
                      {leagues.map(l => (
                        <option key={l.id} value={l.name}>
                          {l.icon} {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">Country</label>
                    <input
                      type="text"
                      required
                      value={clubCountry}
                      onChange={e => setClubCountry(e.target.value)}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">
                      Attack Rating ({clubAttack})
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
                    <label className="text-xs font-bold text-zinc-400 block mb-1">
                      Defense Rating ({clubDefense})
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
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Create & Deploy Club'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleBulkCreateClubs} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">Target League</label>
                    <select
                      value={clubLeague}
                      onChange={e => {
                        const selected = e.target.value;
                        setClubLeague(selected);
                        const lg = leagues.find(l => l.name === selected);
                        if (lg) setClubCountry(lg.country);
                      }}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                    >
                      {leagues.map(l => (
                        <option key={l.id} value={l.name}>
                          {l.icon} {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-400 block mb-1">Default Country</label>
                    <input
                      type="text"
                      required
                      value={clubCountry}
                      onChange={e => setClubCountry(e.target.value)}
                      className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-zinc-400">
                      Write Club Names (one per line)
                    </label>
                    <span className="text-[10px] text-[#00e700] font-bold">
                      {bulkClubsText.split('\n').filter(l => l.trim()).length} ready
                    </span>
                  </div>
                  <textarea
                    rows={7}
                    required
                    value={bulkClubsText}
                    onChange={e => setBulkClubsText(e.target.value)}
                    placeholder={`Leeds United\nBurnley\nSunderland\nSheffield United`}
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl p-3 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-[#00e700] resize-y"
                  />
                  <span className="text-[10px] text-zinc-400 block mt-1">
                    Optional format per line: Club Name | Code | League | Country
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Save & Deploy Clubs Permanently'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* PAGE 3: CLUB DIRECTORY */}
      {activePage === 'club_directory' && (
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#00e700]/15 pb-3">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-[#00e700] shrink-0" />
              <div>
                <h3 className="text-sm font-black text-white">All Registered Clubs ({clubs.length})</h3>
                <span className="text-[11px] text-zinc-400">Permanent registry · ATK / DEF Power Ratings</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={clubLeagueFilter}
                onChange={e => setClubLeagueFilter(e.target.value)}
                className="bg-[#03150b] border border-zinc-700 rounded-xl px-2.5 h-9 text-xs font-bold text-white focus:outline-none focus:border-[#00e700] max-w-[180px]"
              >
                <option value="all">All Leagues ({leagues.length})</option>
                {leagues.map(l => (
                  <option key={l.id} value={l.name}>
                    {l.icon} {l.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center bg-[#03150b] border border-zinc-700 rounded-xl px-3 h-9 flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={clubSearch}
                  onChange={e => setClubSearch(e.target.value)}
                  placeholder="Search clubs..."
                  className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-full sm:w-40"
                />
              </div>

              <button
                type="button"
                onClick={() => handleOpenPage('create_club')}
                className="h-9 px-3 rounded-xl bg-[#00ad3a] hover:bg-[#00c844] text-white text-xs font-black flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Club</span>
              </button>
            </div>
          </div>

          {filteredClubs.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs font-bold text-zinc-400">No clubs found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[540px] overflow-y-auto pr-1">
              {filteredClubs.map(c => (
                <div
                  key={c.id}
                  className="bg-[#062416] border border-[#00e700]/20 rounded-xl p-3 flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0">{c.crest}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-white truncate">{c.name}</span>
                        <span className="text-[10px] font-mono font-bold text-[#00e700]">({c.shortName})</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 truncate block mt-0.5">
                        {c.league}
                      </span>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-black tabular-nums">
                        <span className="text-[#00e700]">ATK {c.attack}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="text-emerald-300">DEF {c.defense}</span>
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

      {/* PAGE 4: LEAGUES (DEPLOYED & ACTIVE LEAGUES + TOP-RIGHT + BUTTON POP-OUT) */}
      {activePage === 'leagues' && (
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#00e700]/15 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#00e700] shrink-0" />
              <div>
                <h3 className="text-sm font-black text-white">Deployed &amp; Active Leagues ({leagues.length})</h3>
                <span className="text-[11px] text-zinc-400 block">
                  Red +: Auto-generate 5 clubs · Blue +: 3 clubs per league · Green +: Custom league
                </span>
              </div>
            </div>

            <div className="flex items-center bg-[#03150b] border border-zinc-700 rounded-xl px-3 h-9">
              <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
              <input
                type="text"
                value={leagueSearch}
                onChange={e => setLeagueSearch(e.target.value)}
                placeholder="Search leagues..."
                className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-full sm:w-48"
              />
            </div>
          </div>

          {filteredLeagues.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs font-bold text-zinc-400">No leagues match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[540px] overflow-y-auto pr-1">
              {filteredLeagues.map(lg => {
                const assignedClubs = clubs.filter(c => c.league.toLowerCase() === lg.name.toLowerCase());
                const leagueMatchCount = matches.filter(m => m.league.toLowerCase() === lg.name.toLowerCase()).length;
                const isExpanded = expandedLeagueId === lg.id;
                return (
                  <div
                    key={lg.id}
                    className="bg-[#062416] border border-[#00e700]/20 rounded-xl p-3 space-y-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playClick();
                        setExpandedLeagueId(isExpanded ? null : lg.id);
                      }}
                      className="w-full text-left flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#03150b] border border-[#00e700]/30 flex items-center justify-center text-xl shrink-0">
                          {lg.icon}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-black text-white truncate block">
                            {lg.name}
                          </span>
                          <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                            {lg.country} · {assignedClubs.length} {assignedClubs.length === 1 ? 'Club' : 'Clubs'} · {leagueMatchCount} Active {leagueMatchCount === 1 ? 'Match' : 'Matches'}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-black uppercase tracking-wider text-[#00e700] shrink-0">
                        {lg.isCustom ? 'Custom' : 'Active'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="pt-2 border-t border-[#00e700]/15 space-y-1.5">
                        {assignedClubs.length === 0 ? (
                          <span className="text-[11px] text-zinc-400 block">No clubs assigned yet.</span>
                        ) : (
                          assignedClubs.map(c => (
                            <div
                              key={c.id}
                              className="bg-[#03150b] border border-zinc-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
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
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#00e700]/15 pb-2">
            <div>
              <h3 className="text-sm font-black text-white">Live &amp; Scheduled Fixtures ({matches.length})</h3>
              <span className="text-[11px] text-zinc-400">Control kickoff, goals, or reset matches</span>
            </div>

            {matches.length > 0 && (
              <button
                onClick={handleResetAll}
                className="h-9 px-3 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-bold border border-red-700/60 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All</span>
              </button>
            )}
          </div>

          {matches.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm font-black text-zinc-300">No active matches right now</p>
              <button
                onClick={() => handleOpenPage('fix_match')}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 active:scale-95"
              >
                <Swords className="w-4 h-4" />
                <span>Go to Fix Match</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map(m => (
                <div
                  key={m.id}
                  className="bg-[#062416] border border-[#00e700]/25 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold">
                      <span className="truncate">{m.league}</span>
                      <span>·</span>
                      <span className={m.status === 'LIVE' ? 'text-[#00e700]' : 'text-amber-400'}>
                        {m.status === 'LIVE' ? `${m.minute}'/60' LIVE` : m.scheduledTime}
                      </span>
                      {m.dayBucket === 'NEXT_DAY' && <span className="text-emerald-300">Next Day</span>}
                      {m.isFeatured && <span className="text-amber-300">★ Hero</span>}
                    </div>
                    <div className="text-sm font-black text-white mt-0.5">
                      {m.homeTeam} <span className="text-amber-400 font-mono mx-1">{m.homeScore} - {m.awayScore}</span> {m.awayTeam}
                    </div>
                    <div className="text-[11px] text-[#00e700] font-bold tabular-nums mt-0.5">
                      H&amp;O15: {m.odds.home.toFixed(2)} · X: {m.odds.draw.toFixed(2)} · A&amp;O15: {m.odds.away.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    {m.status === 'UPCOMING' && (
                      <button
                        onClick={async () => {
                          soundManager.playClick();
                          await virtualEngine.kickoffMatchNow(m.id);
                          showToast(`Kicked off: ${m.homeTeam} vs ${m.awayTeam}`);
                        }}
                        className="h-9 px-3 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-white text-xs font-black flex items-center gap-1 active:scale-95"
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
                          className="h-9 px-3 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-white text-xs font-black flex items-center gap-1 active:scale-95"
                        >
                          <Zap className="w-3 h-3" />
                          <span>+1 Home</span>
                        </button>
                        <button
                          onClick={async () => {
                            soundManager.playGoal();
                            await virtualEngine.triggerAdminGoal(m.id, 'away');
                          }}
                          className="h-9 px-3 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-white text-xs font-black flex items-center gap-1 active:scale-95"
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
                        showToast(`Removed: ${m.homeTeam} vs ${m.awayTeam}`);
                      }}
                      className="h-9 px-2.5 rounded-lg bg-red-950/50 hover:bg-red-900 text-red-300 border border-red-800/50"
                      title="Remove Match"
                    >
                      <Trash2 className="w-4 h-4" />
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
        <div className="bg-[#051c10]/95 border border-red-500/30 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-2.5 flex items-center gap-2 text-xs text-red-200 font-bold">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Deleting a club is permanent across all users and devices and cannot be undone.</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-white">Delete Club ({clubs.length})</h3>
              <span className="text-[11px] text-zinc-400">Select any club below to permanently remove it</span>
            </div>

            <div className="flex items-center bg-[#03150b] border border-zinc-700 rounded-xl px-3 h-9">
              <Search className="w-3.5 h-3.5 text-zinc-400 mr-2" />
              <input
                type="text"
                value={clubSearch}
                onChange={e => setClubSearch(e.target.value)}
                placeholder="Search clubs..."
                className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-full sm:w-44"
              />
            </div>
          </div>

          {filteredClubs.length === 0 ? (
            <div className="py-10 text-center text-xs text-zinc-400">
              No clubs match your search.
            </div>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {filteredClubs.map(c => {
                const isConfirming = pendingDeleteClubId === c.id;
                return (
                  <div
                    key={c.id}
                    className="bg-[#062416] border border-zinc-800 hover:border-red-500/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xl shrink-0">{c.crest}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-sm font-black text-white truncate">{c.name}</span>
                          <span className="text-[10px] font-mono font-bold text-[#00e700]">({c.shortName})</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 truncate block">
                          {c.league} · ATK {c.attack} / DEF {c.defense}
                        </span>
                      </div>
                    </div>

                    {isConfirming ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteClubId(null)}
                          className="h-9 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold active:scale-95 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            soundManager.playClick();
                            await virtualEngine.deleteClub(c.id);
                            setPendingDeleteClubId(null);
                            showToast(`Permanently deleted club: ${c.name}`);
                          }}
                          className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                        className="h-9 px-3 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-black flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

      {/* PAGE 7: ADMIN DEPOSIT PAGE (SEARCH USER BY ID -> RECIPIENT FULL NAME -> 5s VERIFY DEPOSIT) */}
      {activePage === 'deposit' && (
        <div className="max-w-xl mx-auto space-y-3">
          <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#00e700]/15 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#00e700] shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">Deposit to User Account</h3>
                  <span className="text-[11px] text-zinc-400">
                    Search recipient by User ID number · 5-second verification before lodging
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleDepositLookup} className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-[#03150b] border border-zinc-700 focus-within:border-[#00e700] rounded-xl px-3 h-10">
                <Search className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={depositSearchId}
                  onChange={e => {
                    setDepositSearchId(e.target.value);
                    if (depositError) setDepositError(null);
                  }}
                  placeholder="Enter User ID number (e.g. 100001)"
                  className="bg-transparent text-xs sm:text-sm font-mono font-bold text-white placeholder-zinc-500 focus:outline-none w-full tabular-nums"
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingUser || depositCountdown !== null}
                className="h-10 px-4 rounded-xl bg-[#00ad3a] hover:bg-[#00c844] text-black font-black text-xs whitespace-nowrap active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                {isSearchingUser ? 'Searching...' : 'Search'}
              </button>
            </form>

            {depositError && (
              <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-xs sm:text-sm font-black p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{depositError}</span>
              </div>
            )}

            {depositSuccessMsg && (
              <div className="bg-[#00ad3a]/20 border border-[#00e700]/50 text-[#00e700] text-xs font-black p-3 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{depositSuccessMsg}</span>
              </div>
            )}

            {depositRecipient && (
              <form onSubmit={handleDepositSubmit} className="space-y-3.5 pt-1">
                <div className="bg-[#062416] border border-[#00e700]/35 rounded-xl p-3.5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                    Recipient
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl shrink-0">{depositRecipient.avatar}</span>
                      <div className="min-w-0">
                        <span className="text-base font-black text-white block truncate">
                          {depositRecipient.fullName}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono tabular-nums block truncate">
                          ID #{depositRecipient.id} · @{depositRecipient.username}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-zinc-400 font-bold block">Balance</span>
                      <span className="text-sm font-black text-[#00e700] tabular-nums">
                        ${depositRecipient.balance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">
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
                    placeholder="Enter deposit amount (e.g. 5000)"
                    className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3.5 py-2.5 text-sm font-black text-white placeholder-zinc-500 focus:outline-none focus:border-[#00e700] tabular-nums disabled:opacity-50"
                  />
                </div>

                {depositCountdown !== null && (
                  <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-2 text-xs font-black text-amber-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 animate-spin shrink-0" />
                      <span>Verifying user {depositRecipient.fullName} &amp; lodging deposit...</span>
                    </div>
                    <span className="font-mono text-sm tabular-nums">{depositCountdown}s</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={depositCountdown !== null}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap"
                >
                  <Wallet className="w-4 h-4" />
                  <span>
                    {depositCountdown !== null
                      ? `Verifying User (${depositCountdown}s)...`
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
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#00e700]/15 pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#00e700] shrink-0" />
              <div>
                <h3 className="text-sm font-black text-white tabular-nums">
                  Verified Registered Users ({users.length})
                </h3>
                <span className="text-[11px] text-zinc-400">
                  Automatically populated once a user registers and verifies
                </span>
              </div>
            </div>

            <div className="flex items-center bg-[#03150b] border border-zinc-700 rounded-xl px-3 h-9">
              <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
              <input
                type="text"
                value={usersFilter}
                onChange={e => setUsersFilter(e.target.value)}
                placeholder="Filter ID, username, name..."
                className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-full sm:w-52"
              />
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center space-y-1.5">
              <p className="text-xs font-bold text-zinc-300">No verified registered users yet.</p>
              <span className="text-[11px] text-zinc-500 block">
                Once a player completes registration &amp; verification, their profile appears here.
              </span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {filteredUsers.map(u => {
                const isConfirmingDelete = pendingDeleteUserId === u.id;
                return (
                  <div
                    key={u.id}
                    className="bg-[#062416] border border-[#00e700]/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#03150b] border border-[#00e700]/30 flex items-center justify-center text-xl shrink-0">
                        {u.avatar}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-white truncate">@{u.username}</span>
                          <span className="text-xs font-mono font-black text-[#00e700] tabular-nums">
                            #{u.id}
                          </span>
                          <span className="text-xs font-bold text-zinc-300 truncate">{u.fullName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5 flex-wrap">
                          <span className="truncate">{u.email}</span>
                          <span>·</span>
                          <span className="font-mono font-bold text-[#00e700] tabular-nums">
                            ${u.balance.toFixed(2)}
                          </span>
                          {u.phone && (
                            <>
                              <span>·</span>
                              <span className="truncate">{u.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isConfirmingDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteUserId(null)}
                            className="h-9 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold whitespace-nowrap active:scale-95 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              soundManager.playClick();
                              try {
                                const updatedList = await virtualEngine.deleteAdminUser(u.id);
                                setUsers(updatedList);
                                setPendingDeleteUserId(null);
                                showToast(`Deleted user @${u.username} (ID #${u.id})`);
                              } catch (err) {
                                showToast(err instanceof Error ? err.message : 'Unable to delete user.');
                              }
                            }}
                            className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-1 whitespace-nowrap active:scale-95 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                            className="h-9 px-3 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-black text-xs font-black flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Update</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              setPendingDeleteUserId(u.id);
                            }}
                            className="h-9 px-3 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-black flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* PAGE 9: USER INFO UPDATE FORM (PRE-FILLED REGISTRATION FIELDS + ADDITIONAL FIELDS) */}
      {activePage === 'edit_user' && selectedEditUser && (
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={handleSaveUserInfo}
            className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00e700]/15 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl">{editForm.avatar}</span>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    {selectedEditUser.fullName} <span className="font-mono text-[#00e700] tabular-nums">#{selectedEditUser.id}</span>
                  </h3>
                  <span className="text-[11px] text-zinc-400 block">
                    Balance: <span className="text-[#00e700] font-bold tabular-nums">${selectedEditUser.balance.toFixed(2)}</span> · Verified Account
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
                className="h-9 px-3 rounded-xl bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/40 text-xs font-black text-[#00e700] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Deposit Funds</span>
              </button>
            </div>

            {formError && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-xs font-bold p-2.5 rounded-xl">
                {formError}
              </div>
            )}

            {/* Pre-filled Registration Details */}
            <div className="space-y-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#00e700] block">
                Registration Details (Auto-Filled)
              </span>

              <div>
                <label className="text-xs font-bold text-zinc-400 block mb-1.5">Avatar</label>
                <div className="flex flex-wrap gap-1.5 bg-[#03150b] p-2 rounded-xl border border-zinc-800">
                  {AVATAR_OPTIONS.map(av => (
                    <button
                      type="button"
                      key={av}
                      onClick={() => {
                        soundManager.playClick();
                        setEditForm(prev => ({ ...prev, avatar: av }));
                      }}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                        editForm.avatar === av ? 'bg-[#00ad3a]/40 ring-2 ring-[#00e700] scale-105' : 'hover:bg-white/5'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">User ID</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedEditUser.id}
                    className="w-full bg-[#020e07] border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono font-black text-[#00e700] tabular-nums focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={e => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
              </div>
            </div>

            {/* Additional User Info Fields */}
            <div className="space-y-3 pt-2 border-t border-[#00e700]/15">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block">
                Additional Profile Information
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Country</label>
                  <input
                    type="text"
                    value={editForm.country}
                    onChange={e => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Enter country"
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={e => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Enter city"
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={e => setEditForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Home Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter street address"
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">KYC / National ID Number</label>
                  <input
                    type="text"
                    value={editForm.kycIdNumber}
                    onChange={e => setEditForm(prev => ({ ...prev, kycIdNumber: e.target.value }))}
                    placeholder="Enter ID / Passport No."
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Account Tier</label>
                  <select
                    value={editForm.accountTier}
                    onChange={e =>
                      setEditForm(prev => ({
                        ...prev,
                        accountTier: e.target.value as 'Standard' | 'VIP' | 'Suspended'
                      }))
                    }
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#00e700]"
                  >
                    <option value="Standard">Standard</option>
                    <option value="VIP">VIP</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-zinc-400 block mb-1">Admin Notes</label>
                  <textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes on user profile..."
                    className="w-full bg-[#03150b] border border-zinc-700 rounded-xl p-3 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700] resize-y"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleOpenPage('users')}
                className="h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs whitespace-nowrap"
              >
                All Users
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
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
    </div>
  );
};
