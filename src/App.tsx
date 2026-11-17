/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  VirtualMatch,
  BetSelection,
  PlacedBet,
  CasinoGame,
  UserProfile,
  MarketType,
  Club,
  League,
  TipsterBetcode,
  H2HRecord,
  FXAsset,
  FXPosition
} from './types';
import { virtualEngine } from './services/virtualEngine';
import { soundManager } from './services/soundEffects';
import { auth } from './firebase';
import {
  subscribeFirebaseAuth,
  subscribeOwnCloudUser,
  syncOwnUserProfileToCloud,
  signOutFirebase,
  isFirebaseAdminUser,
} from './services/firebaseSync';

// Core Components
import { Header } from './components/Header';
import { BottomNav, MainTab } from './components/BottomNav';
import { SportsView } from './components/SportsView';
import { CasinoView } from './components/CasinoView';
import { ProfileView } from './components/ProfileView';
import { BetslipDrawer } from './components/BetslipDrawer';
import { CheckBetsModal } from './components/CheckBetsModal';
import { MatchDetailModal } from './components/MatchDetailModal';
import { FXBookmakerModal } from './components/FXBookmakerModal';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './components/AdminDashboard';

// Interactive Casino Game Modals
import { FlightAviatorGame } from './components/games/FlightAviatorGame';
import { PenaltyShootGame } from './components/games/PenaltyShootGame';
import { PlinkoGame } from './components/games/PlinkoGame';
import { RouletteGame } from './components/games/RouletteGame';
import { SlotsGame } from './components/games/SlotsGame';
import { SpinWinGame } from './components/games/SpinWinGame';

const DEFAULT_GUEST_USER: UserProfile = {
  id: 'guest',
  email: '',
  username: 'Guest',
  balance: 0,
  currency: 'USD',
  avatar: '👤',
  isLoggedIn: false,
  isAdmin: false,
  totalBetsPlaced: 0,
  totalWon: 0
};

const USER_ISOLATION_RESET_KEY = 'cas9i_user_isolation_reset_v3';

function getUserScopedKey(prefix: string, userId: string): string {
  return `${prefix}_${userId || 'guest'}`;
}

function ensureUserIsolationResetOnce() {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(USER_ISOLATION_RESET_KEY) !== '1') {
      window.localStorage.removeItem('cas9i_placed_bets');
      window.localStorage.removeItem('cas9i_fx_positions');
      window.localStorage.removeItem('cas9i_selected_selections');

      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (
          key &&
          (key.startsWith('cas9i_placed_bets_') ||
            key.startsWith('cas9i_fx_positions_') ||
            key.startsWith('cas9i_selected_selections_'))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => window.localStorage.removeItem(k));

      const rawSession = window.localStorage.getItem('cas9i_user_session');
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession) as Partial<UserProfile>;
          if (parsed && !parsed.isAdmin) {
            window.localStorage.setItem(
              'cas9i_user_session',
              JSON.stringify({
                ...parsed,
                balance: 0,
                totalBetsPlaced: 0,
                totalWon: 0,
                lastDepositAt: undefined,
                lastDepositAmount: undefined
              })
            );
          }
        } catch {
          window.localStorage.removeItem('cas9i_user_session');
        }
      }

      window.localStorage.setItem(USER_ISOLATION_RESET_KEY, '1');
    }
  } catch {
    // ignore storage errors
  }
}

function loadSavedUser(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_GUEST_USER;
  try {
    const raw = window.localStorage.getItem('cas9i_user_session');
    if (!raw) return DEFAULT_GUEST_USER;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (parsed && parsed.isLoggedIn) {
      return {
        ...DEFAULT_GUEST_USER,
        ...parsed,
        balance: parsed.isAdmin ? (typeof parsed.balance === 'number' ? parsed.balance : 100000) : (typeof parsed.balance === 'number' ? parsed.balance : 0),
      };
    }
  } catch {
    // ignore corrupt session
  }
  return DEFAULT_GUEST_USER;
}

function loadSavedTab(savedUser: UserProfile): MainTab {
  if (typeof window === 'undefined') return 'sports';
  const saved = window.localStorage.getItem('cas9i_active_tab');
  if (saved === 'admin' && savedUser.isAdmin) return 'admin';
  if (saved === 'leaderboard' || saved === 'profile') return 'profile';
  if (saved === 'casino' || saved === 'sports') return saved;
  return 'sports';
}

function loadSavedJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [initialUser] = useState<UserProfile>(() => {
    ensureUserIsolationResetOnce();
    return loadSavedUser();
  });
  const [activeTab, setActiveTab] = useState<MainTab>(() => loadSavedTab(initialUser));
  const [matches, setMatches] = useState<VirtualMatch[]>(virtualEngine.getMatches());
  const [tipsterBetcodes, setTipsterBetcodes] = useState<TipsterBetcode[]>(virtualEngine.getTipsterBetcodes());
  const [h2hRecords, setH2HRecords] = useState<H2HRecord[]>(virtualEngine.getH2HRecords());
  const [fxAssets, setFxAssets] = useState<FXAsset[]>(virtualEngine.getFxAssets());
  const [fxPositions, setFxPositions] = useState<FXPosition[]>(() =>
    loadSavedJson<FXPosition[]>(getUserScopedKey('cas9i_fx_positions', initialUser.id), [])
  );
  const [clubs, setClubs] = useState<Club[]>(virtualEngine.getClubs());
  const [leagues, setLeagues] = useState<League[]>(virtualEngine.getLeagues());
  const [selectedSelections, setSelectedSelections] = useState<BetSelection[]>(() =>
    loadSavedJson<BetSelection[]>(getUserScopedKey('cas9i_selected_selections', initialUser.id), [])
  );
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>(() =>
    loadSavedJson<PlacedBet[]>(getUserScopedKey('cas9i_placed_bets', initialUser.id), [])
  );

  // Modals & Drawers
  const [isBetslipOpen, setIsBetslipOpen] = useState(false);
  const [betslipDefaultMode, setBetslipDefaultMode] = useState<'single' | 'accumulator'>('single');
  const [betslipModeSignal, setBetslipModeSignal] = useState(0);
  const [isCheckBetsOpen, setIsCheckBetsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [activeGameModal, setActiveGameModal] = useState<CasinoGame | null>(null);
  const [detailMatch, setDetailMatch] = useState<VirtualMatch | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<'ALL' | 'H2H'>('ALL');
  const [selectedFxAssetId, setSelectedFxAssetId] = useState<string | null>(null);

  // Goal alert toast
  const [goalAlert, setGoalAlert] = useState<{ match: VirtualMatch; text: string } | null>(null);

  // User profile (strictly isolated per logged-in user)
  const [user, setUser] = useState<UserProfile>(initialUser);
  const userIdRef = useRef<string>(initialUser.id);
  const activeOwnerIdRef = useRef<string>(initialUser.id);
  const userRef = useRef<UserProfile>(initialUser);
  const lastSyncedBetsKeyRef = useRef<string>('');
  useEffect(() => {
    userIdRef.current = user.id;
    userRef.current = user;
  }, [user]);

  // Persist user session & per-user Check Bets / selections locally
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user.isLoggedIn) {
      window.localStorage.setItem('cas9i_user_session', JSON.stringify(user));
    } else {
      window.localStorage.removeItem('cas9i_user_session');
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('cas9i_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeOwnerIdRef.current !== user.id) return;
    window.localStorage.setItem(
      getUserScopedKey('cas9i_selected_selections', user.id),
      JSON.stringify(selectedSelections)
    );
  }, [selectedSelections, user.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeOwnerIdRef.current !== user.id) return;
    window.localStorage.setItem(
      getUserScopedKey('cas9i_placed_bets', user.id),
      JSON.stringify(placedBets)
    );
  }, [placedBets, user.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeOwnerIdRef.current !== user.id) return;
    window.localStorage.setItem(
      getUserScopedKey('cas9i_fx_positions', user.id),
      JSON.stringify(fxPositions)
    );
  }, [fxPositions, user.id]);

  // Sync user's private Check Bets & FX positions back to their own server profile
  useEffect(() => {
    if (!user.isLoggedIn || user.isAdmin || user.id === 'guest') return;
    if (activeOwnerIdRef.current !== user.id) return;
    const payload = {
      placedBets,
      fxPositions,
      totalBetsPlaced: userRef.current.totalBetsPlaced,
      totalWon: userRef.current.totalWon,
    };
    const fingerprint = `${user.id}:${JSON.stringify(payload)}`;
    if (lastSyncedBetsKeyRef.current === fingerprint) return;
    lastSyncedBetsKeyRef.current = fingerprint;
    virtualEngine.syncUserBets(user.id, payload);
  }, [placedBets, fxPositions, user.id, user.isLoggedIn, user.isAdmin]);

  // Real-time Firestore sync for Google-signed-in users (live Admin deposits & deletions)
  const lastCloudUserSyncKeyRef = useRef<string>('');
  useEffect(() => {
    if (!user.isLoggedIn || user.isAdmin || !user.id || user.id === 'guest') return;
    let unsubOwn: (() => void) | null = null;

    const unsubAuth = subscribeFirebaseAuth(fbUser => {
      if (unsubOwn) {
        unsubOwn();
        unsubOwn = null;
      }
      if (!fbUser || isFirebaseAdminUser(fbUser)) return;

      unsubOwn = subscribeOwnCloudUser(
        fbUser,
        user.id,
        cloudUser => {
          if (cloudUser.id !== userIdRef.current) return;
          lastCloudUserSyncKeyRef.current = `${cloudUser.id}:${cloudUser.balance}:${cloudUser.username}:${cloudUser.fullName}:${cloudUser.avatar}:${cloudUser.phone || ''}:${cloudUser.country || ''}:${cloudUser.city || ''}:${cloudUser.address || ''}:${cloudUser.dateOfBirth || ''}:${cloudUser.totalBetsPlaced ?? 0}:${cloudUser.totalWon ?? 0}`;
          setUser(prev => {
            if (!prev.isLoggedIn || prev.isAdmin || prev.id !== cloudUser.id) return prev;
            const changed =
              Math.abs(prev.balance - cloudUser.balance) > 0.001 ||
              prev.username !== cloudUser.username ||
              prev.fullName !== cloudUser.fullName ||
              prev.avatar !== cloudUser.avatar ||
              prev.accountTier !== cloudUser.accountTier ||
              prev.phone !== cloudUser.phone ||
              prev.country !== cloudUser.country ||
              prev.city !== cloudUser.city ||
              prev.address !== cloudUser.address ||
              prev.dateOfBirth !== cloudUser.dateOfBirth;
            if (!changed) return prev;
            return {
              ...prev,
              username: cloudUser.username,
              fullName: cloudUser.fullName,
              email: cloudUser.email,
              avatar: cloudUser.avatar,
              balance: cloudUser.balance,
              phone: cloudUser.phone,
              country: cloudUser.country,
              city: cloudUser.city,
              address: cloudUser.address,
              dateOfBirth: cloudUser.dateOfBirth,
              kycIdNumber: cloudUser.kycIdNumber,
              accountTier: cloudUser.accountTier,
              verified: cloudUser.verified,
            };
          });
          void fbUser
            .getIdToken()
            .then(token => virtualEngine.syncGoogleUserSession(token, cloudUser))
            .catch(() => {});
        },
        () => {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem('cas9i_user_session');
          }
          activeOwnerIdRef.current = 'guest';
          setUser(DEFAULT_GUEST_USER);
          setPlacedBets([]);
          setFxPositions([]);
          setSelectedSelections([]);
          void signOutFirebase().catch(() => {});
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubOwn) unsubOwn();
    };
  }, [user.id, user.isLoggedIn, user.isAdmin]);

  // Sync own profile & balance changes back to Firestore when signed in with Google
  useEffect(() => {
    if (!user.isLoggedIn || user.isAdmin || !user.id || user.id === 'guest') return;
    if (activeOwnerIdRef.current !== user.id) return;
    const fbUser = auth.currentUser;
    if (!fbUser || isFirebaseAdminUser(fbUser)) return;

    const fingerprint = `${user.id}:${user.balance}:${user.username}:${user.fullName || ''}:${user.avatar}:${user.phone || ''}:${user.country || ''}:${user.city || ''}:${user.address || ''}:${user.dateOfBirth || ''}:${user.totalBetsPlaced}:${user.totalWon}:${placedBets.length}:${fxPositions.length}`;
    if (lastCloudUserSyncKeyRef.current === fingerprint) return;
    lastCloudUserSyncKeyRef.current = fingerprint;

    void syncOwnUserProfileToCloud(user, placedBets.length, fxPositions.length);
  }, [
    user,
    placedBets.length,
    fxPositions.length,
  ]);

  useEffect(() => {
    if (user.isAdmin) {
      void virtualEngine.verifyAdminSession().then(status => {
        if (status === 'invalid') {
          virtualEngine.setAdminToken(null);
          activeOwnerIdRef.current = 'guest';
          setUser(DEFAULT_GUEST_USER);
          setPlacedBets([]);
          setFxPositions([]);
          setSelectedSelections([]);
          setActiveTab('sports');
        }
      });
      return;
    }

    if (user.isLoggedIn && user.id && user.id !== 'guest') {
      void virtualEngine.fetchUserSession(user.id).then(session => {
        if (!session) {
          activeOwnerIdRef.current = 'guest';
          setUser(DEFAULT_GUEST_USER);
          setPlacedBets([]);
          setFxPositions([]);
          setSelectedSelections([]);
          return;
        }
        const serverUser = session.user;
        const serverPlaced = session.placedBets || [];
        const serverFx = session.fxPositions || [];
        lastSyncedBetsKeyRef.current = `${serverUser.id}:${JSON.stringify({
          placedBets: serverPlaced,
          fxPositions: serverFx,
          totalBetsPlaced: serverUser.totalBetsPlaced ?? 0,
          totalWon: serverUser.totalWon ?? 0,
        })}`;
        if (activeOwnerIdRef.current === serverUser.id) {
          setPlacedBets(serverPlaced);
          setFxPositions(serverFx);
        }
        setUser(prev =>
          prev.id === serverUser.id
            ? {
                ...prev,
                username: serverUser.username,
                fullName: serverUser.fullName,
                email: serverUser.email,
                avatar: serverUser.avatar,
                balance: serverUser.balance,
                phone: serverUser.phone,
                country: serverUser.country,
                city: serverUser.city,
                address: serverUser.address,
                dateOfBirth: serverUser.dateOfBirth,
                kycIdNumber: serverUser.kycIdNumber,
                accountTier: serverUser.accountTier,
                createdAt: serverUser.createdAt,
                totalBetsPlaced: serverUser.totalBetsPlaced ?? 0,
                totalWon: serverUser.totalWon ?? 0,
                verified: serverUser.verified,
              }
            : prev
        );
      });
    }
  }, []);

  // Real-time Virtual Engine Subscriptions (low-latency sync)
  useEffect(() => {
    const unsubMatches = virtualEngine.subscribeMatches(newMatches => {
      setMatches(newMatches);
      setDetailMatch(prev => prev ? newMatches.find(m => m.id === prev.id) || prev : null);
    });

    const unsubTipster = virtualEngine.subscribeTipsterBetcodes(codes => {
      setTipsterBetcodes(codes);
    });

    const unsubH2H = virtualEngine.subscribeH2H(records => {
      setH2HRecords(records);
    });

    const unsubFx = virtualEngine.subscribeFxAssets(assets => {
      setFxAssets(assets);
    });

    const unsubClubs = virtualEngine.subscribeClubs(newClubs => {
      setClubs(newClubs);
    });

    const unsubLeagues = virtualEngine.subscribeLeagues(newLeagues => {
      setLeagues(newLeagues);
    });

    const unsubGoal = virtualEngine.onGoalAlert(alert => {
      setGoalAlert(alert);
      soundManager.playGoal();
      setTimeout(() => {
        setGoalAlert(null);
      }, 3500);
    });

    const unsubUserUpdated = virtualEngine.onUserUpdated(updatedUser => {
      setUser(prev => {
        if (!prev.isLoggedIn || prev.isAdmin || prev.id !== updatedUser.id) {
          return prev;
        }
        return {
          ...prev,
          username: updatedUser.username,
          fullName: updatedUser.fullName,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          balance: updatedUser.balance,
          phone: updatedUser.phone,
          country: updatedUser.country,
          city: updatedUser.city,
          address: updatedUser.address,
          dateOfBirth: updatedUser.dateOfBirth,
          kycIdNumber: updatedUser.kycIdNumber,
          accountTier: updatedUser.accountTier,
          totalBetsPlaced: updatedUser.totalBetsPlaced ?? prev.totalBetsPlaced,
          totalWon: updatedUser.totalWon ?? prev.totalWon,
          verified: updatedUser.verified,
        };
      });
    });

    const unsubUserDeleted = virtualEngine.onUserDeleted(deletedUserId => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(getUserScopedKey('cas9i_placed_bets', deletedUserId));
        window.localStorage.removeItem(getUserScopedKey('cas9i_fx_positions', deletedUserId));
        window.localStorage.removeItem(getUserScopedKey('cas9i_selected_selections', deletedUserId));
      }
      if (userIdRef.current === deletedUserId) {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('cas9i_user_session');
        }
        activeOwnerIdRef.current = 'guest';
        setUser(DEFAULT_GUEST_USER);
        setPlacedBets([]);
        setFxPositions([]);
        setSelectedSelections([]);
      }
    });

    const unsubUserBetsReset = virtualEngine.onUserBetsReset(resetUserId => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(getUserScopedKey('cas9i_placed_bets', resetUserId));
        window.localStorage.removeItem(getUserScopedKey('cas9i_fx_positions', resetUserId));
      }
      if (userIdRef.current === resetUserId) {
        lastSyncedBetsKeyRef.current = `${resetUserId}:${JSON.stringify({
          placedBets: [],
          fxPositions: [],
          totalBetsPlaced: 0,
          totalWon: 0,
        })}`;
        setPlacedBets([]);
        setFxPositions([]);
        setUser(prev =>
          prev.id === resetUserId ? { ...prev, totalBetsPlaced: 0, totalWon: 0 } : prev
        );
      }
    });

    return () => {
      unsubMatches();
      unsubTipster();
      unsubH2H();
      unsubFx();
      unsubClubs();
      unsubLeagues();
      unsubGoal();
      unsubUserUpdated();
      unsubUserDeleted();
      unsubUserBetsReset();
    };
  }, []);

  const handleLogout = () => {
    virtualEngine.setAdminToken(null);
    void signOutFirebase().catch(() => {});
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('cas9i_user_session');
      window.localStorage.removeItem('cas9i_active_tab');
      window.localStorage.removeItem('cas9i_admin_page');
    }
    activeOwnerIdRef.current = 'guest';
    lastSyncedBetsKeyRef.current = '';
    lastCloudUserSyncKeyRef.current = '';
    setUser(DEFAULT_GUEST_USER);
    setPlacedBets(loadSavedJson<PlacedBet[]>(getUserScopedKey('cas9i_placed_bets', 'guest'), []));
    setFxPositions(loadSavedJson<FXPosition[]>(getUserScopedKey('cas9i_fx_positions', 'guest'), []));
    setSelectedSelections([]);
    if (activeTab === 'admin') {
      setActiveTab('sports');
    }
  };

  // Update dynamic Cashout & settle completed continuous bets via H2H results
  useEffect(() => {
    const hasOpenBets = placedBets.some(b => b.status === 'OPEN');
    if (!hasOpenBets) return;

    let totalNewWinnings = 0;
    let changed = false;
    const wonTickets: Array<{ payout: number; odds: number; label: string }> = [];

    const nextBets = placedBets.map(bet => {
      if (bet.status !== 'OPEN') return bet;

      let workingBet = bet;
      if (!workingBet.liveHalfApplied && virtualEngine.hasBetGoneLive(workingBet)) {
        const origStake = workingBet.originalStake ?? workingBet.stake;
        const reducedStake = Math.round(origStake * 0.5 * 100) / 100;
        changed = true;
        workingBet = {
          ...workingBet,
          originalStake: origStake,
          stake: reducedStake,
          liveHalfApplied: true,
        };
      }

      const settlement = virtualEngine.evaluateBetSettlement(workingBet);
      if (settlement === 'WON') {
        changed = true;
        totalNewWinnings += workingBet.potentialPayout;
        wonTickets.push({
          payout: workingBet.potentialPayout,
          odds: workingBet.totalOdds,
          label: workingBet.selections[0]?.matchTitle || 'Virtual Ticket'
        });
        return {
          ...workingBet,
          status: 'WON' as const,
          cashoutAmount: workingBet.potentialPayout,
          settledAt: Date.now()
        };
      }
      if (settlement === 'LOST') {
        changed = true;
        return {
          ...workingBet,
          status: 'LOST' as const,
          cashoutAmount: 0,
          settledAt: Date.now()
        };
      }
      const currentCashout = virtualEngine.calculateCashout(workingBet);
      if (currentCashout !== workingBet.cashoutAmount) {
        changed = true;
        return { ...workingBet, cashoutAmount: currentCashout };
      }
      return workingBet;
    });

    if (changed) {
      setPlacedBets(nextBets);
    }

    if (totalNewWinnings > 0) {
      const currentUser = userRef.current;
      if (currentUser.isLoggedIn && currentUser.id !== 'guest') {
        virtualEngine.syncUserBalanceDelta(currentUser.id, totalNewWinnings);
      }
      setUser(prev => ({
        ...prev,
        balance: prev.balance + totalNewWinnings,
        totalWon: prev.totalWon + totalNewWinnings
      }));
      wonTickets.forEach(t => {
        virtualEngine.recordUserWin(currentUser.username, t.payout, t.odds, t.label);
      });
    }
  }, [matches, h2hRecords, placedBets]);

  // Automatic settlement for expired FX Rise/Fall predictions against live FX market prices
  useEffect(() => {
    const hasOpenFx = fxPositions.some(p => p.status === 'OPEN');
    if (!hasOpenFx || fxAssets.length === 0) return;

    const settleExpiredFx = () => {
      const now = Date.now();
      let changed = false;
      let totalFxWinnings = 0;
      const fxWins: Array<{ payout: number; odds: number; label: string }> = [];

      const nextPositions = fxPositions.map(pos => {
        if (pos.status !== 'OPEN' || now < pos.expiresAt) return pos;
        const liveAsset = fxAssets.find(a => a.id === pos.assetId);
        const closePrice = liveAsset?.price ?? pos.entryPrice;
        const won =
          (pos.direction === 'RISE' && closePrice > pos.entryPrice) ||
          (pos.direction === 'FALL' && closePrice < pos.entryPrice);
        changed = true;
        if (won) {
          totalFxWinnings += pos.potentialPayout;
          fxWins.push({
            payout: pos.potentialPayout,
            odds: pos.odds,
            label: `${pos.symbol} ${pos.direction} (${pos.duration})`,
          });
        }
        return {
          ...pos,
          settlementPrice: closePrice,
          settledAt: now,
          status: won ? ('WON' as const) : ('LOST' as const),
        };
      });

      if (changed) {
        setFxPositions(nextPositions);
      }
      if (totalFxWinnings > 0) {
        const currentUser = userRef.current;
        if (currentUser.isLoggedIn && currentUser.id !== 'guest') {
          virtualEngine.syncUserBalanceDelta(currentUser.id, totalFxWinnings);
        }
        setUser(prev => ({
          ...prev,
          balance: prev.balance + totalFxWinnings,
          totalWon: prev.totalWon + totalFxWinnings,
        }));
        fxWins.forEach(w => {
          virtualEngine.recordUserWin(currentUser.username, w.payout, w.odds, w.label);
        });
      }
    };

    settleExpiredFx();
    const timerId = setInterval(settleExpiredFx, 1000);
    return () => clearInterval(timerId);
  }, [fxAssets, fxPositions]);

  // Betslip toggle selection
  const handleToggleSelection = (
    match: VirtualMatch,
    marketType: MarketType,
    marketName: string,
    selection: string,
    odds: number
  ) => {
    setSelectedSelections(prev => {
      const existsIndex = prev.findIndex(
        s => s.matchId === match.id && s.marketName === marketName && s.selection === selection
      );

      if (existsIndex !== -1) {
        // Remove selection
        return prev.filter((_, i) => i !== existsIndex);
      } else {
        // Add new selection (replace same market on same match)
        const filtered = prev.filter(
          s => !(s.matchId === match.id && s.marketName === marketName)
        );
        const newItem: BetSelection = {
          matchId: match.id,
          matchTitle: `${match.homeTeam} vs ${match.awayTeam}`,
          marketType,
          marketName,
          selection,
          odds,
          initialOdds: odds,
          isZoom: Boolean(match.isZoom),
          roundNumber: match.roundNumber || 1
        };
        return [...filtered, newItem];
      }
    });
  };

  const handleLoadBetcode = (betcode: TipsterBetcode) => {
    soundManager.playClick();
    setSelectedSelections(
      betcode.selections.map(s => {
        const liveMatch = matches.find(m => m.id === s.matchId);
        return {
          ...s,
          roundNumber: s.roundNumber ?? liveMatch?.roundNumber ?? 1
        };
      })
    );
    setBetslipDefaultMode(betcode.selections.length >= 2 ? 'accumulator' : 'single');
    setBetslipModeSignal(prev => prev + 1);
    setIsBetslipOpen(true);
  };

  const handleRemoveSelection = (matchId: string, marketName: string, selection: string) => {
    setSelectedSelections(prev =>
      prev.filter(s => !(s.matchId === matchId && s.marketName === marketName && s.selection === selection))
    );
  };

  const handleClearBetslip = () => {
    setSelectedSelections([]);
  };

  const handlePlaceBet = (newBet: PlacedBet) => {
    const stampedBet: PlacedBet = {
      ...newBet,
      selections: newBet.selections.map(s => {
        if (typeof s.roundNumber === 'number') return s;
        const liveMatch = matches.find(m => m.id === s.matchId);
        return {
          ...s,
          roundNumber: liveMatch?.roundNumber ?? 1
        };
      })
    };
    if (user.isLoggedIn && user.id !== 'guest') {
      virtualEngine.syncUserBalanceDelta(user.id, -stampedBet.stake);
    }
    setUser(prev => ({
      ...prev,
      balance: prev.balance - stampedBet.stake,
      totalBetsPlaced: prev.totalBetsPlaced + 1
    }));
    setPlacedBets(prev => [stampedBet, ...prev]);
  };

  const handleCashoutBet = (betId: string, amount: number) => {
    if (amount <= 0) return;
    const target = placedBets.find(b => b.id === betId && b.status === 'OPEN');
    if (!target || target.cashoutAmount <= 0) return;
    if (user.isLoggedIn && user.id !== 'guest') {
      virtualEngine.syncUserBalanceDelta(user.id, amount);
    }
    setPlacedBets(prev =>
      prev.map(b =>
        b.id === betId
          ? { ...b, status: 'CASHED_OUT', cashoutAmount: amount, settledAt: Date.now() }
          : b
      )
    );
    setUser(prev => ({
      ...prev,
      balance: prev.balance + amount,
      totalWon: prev.totalWon + amount
    }));
    virtualEngine.recordUserWin(user.username, amount, Number((amount / 10).toFixed(2)), 'Early Cashout');
  };

  const handlePlaceFxPosition = (newPos: FXPosition) => {
    if (user.isLoggedIn && user.id !== 'guest') {
      virtualEngine.syncUserBalanceDelta(user.id, -newPos.stake);
    }
    setUser(prev => ({
      ...prev,
      balance: prev.balance - newPos.stake,
      totalBetsPlaced: prev.totalBetsPlaced + 1,
    }));
    setFxPositions(prev => [newPos, ...prev]);
  };

  const handleRecordCasinoWin = (amount: number, multiplier: number, gameTitle: string) => {
    setUser(prev => ({
      ...prev,
      totalWon: prev.totalWon + amount
    }));
    virtualEngine.recordUserWin(user.username, amount, multiplier, gameTitle);
  };

  // Open appropriate interactive casino game modal
  const renderActiveGameModal = () => {
    if (!activeGameModal) return null;

    const commonProps = {
      userBalance: user.balance,
      onClose: () => setActiveGameModal(null),
      onUpdateBalance: (newBalance: number) =>
        setUser(prev => {
          const delta = newBalance - prev.balance;
          if (prev.isLoggedIn && prev.id !== 'guest' && delta !== 0) {
            virtualEngine.syncUserBalanceDelta(prev.id, delta);
          }
          return { ...prev, balance: newBalance };
        }),
      onRecordWin: (amount: number, mult: number, game: string) =>
        handleRecordCasinoWin(amount, mult, game)
    };

    switch (activeGameModal.id) {
      case 'flight':
      case 'jetx':
      case 'aviator':
      case 'high-flyer':
        return <FlightAviatorGame {...commonProps} />;
      case 'shoot':
        return <PenaltyShootGame {...commonProps} />;
      case 'plinko':
      case 'lucky-49':
        return <PlinkoGame {...commonProps} />;
      case 'roulette':
        return <RouletteGame {...commonProps} />;
      case 'spin-win':
        return <SpinWinGame {...commonProps} />;
      case 'hit-slot-2025':
      default:
        return <SlotsGame title={activeGameModal.title} {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#03150b] casino-bg text-white flex flex-col antialiased selection:bg-[#00e700] selection:text-black">
      {/* Real-time Goal Notification Banner */}
      {goalAlert && (
        <div className="fixed top-14 inset-x-0 z-50 flex justify-center px-4 animate-bounce pointer-events-none">
          <div className="bg-[#00ad3a] text-black font-black px-4 py-2 rounded-full shadow-[0_0_20px_#00e700] flex items-center gap-2 text-xs sm:text-sm border border-white">
            <span className="text-base">⚽</span>
            <span>{goalAlert.text}</span>
            <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] text-black font-bold">
              {goalAlert.match.league}
            </span>
          </div>
        </div>
      )}

      {/* Top Header matching CAS9i branding */}
      <Header
        user={user}
        onOpenAuth={mode => {
          setAuthMode(mode);
          setIsAuthOpen(true);
        }}
        onLogout={handleLogout}
        onOpenAdminDashboard={() => setActiveTab('admin')}
        onNavigateHome={() => setActiveTab('sports')}
        isAdminViewActive={activeTab === 'admin'}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto">
        {/* Tablet / Desktop Grid Optimization */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Primary View (Sports, Casino, Leaderboard, or Admin) */}
          <div className={`col-span-1 ${selectedSelections.length > 0 && activeTab !== 'admin' ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'}`}>
            {activeTab === 'sports' && (
              <SportsView
                matches={matches}
                leagues={leagues}
                tipsterBetcodes={tipsterBetcodes}
                h2hRecords={h2hRecords}
                fxAssets={fxAssets}
                fxPositions={fxPositions}
                userBalance={user.balance}
                onSelectFxAsset={asset => setSelectedFxAssetId(asset.id)}
                selectedSelections={selectedSelections}
                onToggleSelection={handleToggleSelection}
                onLoadBetcode={handleLoadBetcode}
                onOpenMatchDetail={(m, initialTab = 'ALL') => {
                  setDetailInitialTab(initialTab);
                  setDetailMatch(m);
                }}
                onOpenBetslip={() => setIsBetslipOpen(true)}
                isAdmin={user.isAdmin}
                onOpenAdminDashboard={() => setActiveTab('admin')}
              />
            )}

            {activeTab === 'casino' && (
              <CasinoView
                onSelectGame={game => setActiveGameModal(game)}
                userBalance={user.balance}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                user={user}
                placedBets={placedBets}
                fxPositions={fxPositions}
                onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
                onOpenAuth={mode => {
                  setAuthMode(mode);
                  setIsAuthOpen(true);
                }}
                onOpenCheckBets={() => setIsCheckBetsOpen(true)}
                onOpenAdminDashboard={() => setActiveTab('admin')}
                onNavigateTab={tab => setActiveTab(tab)}
                onLogout={handleLogout}
              />
            )}

            {activeTab === 'admin' && user.isAdmin && (
              <AdminDashboard
                matches={matches}
                clubs={clubs}
                leagues={leagues}
                adminBalance={user.balance}
                adminEmail={user.email}
                onLogout={handleLogout}
              />
            )}
          </div>

          {/* Desktop Persistent Betslip Rail when bets selected on large screens */}
          {selectedSelections.length > 0 && (
            <div className="hidden lg:block lg:col-span-4 xl:col-span-3 pt-2 pr-3 sticky top-16 h-[calc(100vh-5rem)] overflow-y-auto">
              <div className="bg-[#051c11] border border-[#00e700]/30 rounded-2xl p-3 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#00e700]/20 pb-2">
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>Active Betslip</span>
                    <span className="w-5 h-5 rounded-full bg-[#00ad3a] text-black text-xs font-black flex items-center justify-center">
                      {selectedSelections.length}
                    </span>
                  </h4>
                  <button
                    onClick={handleClearBetslip}
                    className="text-[11px] text-zinc-400 hover:text-red-400 font-bold"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {selectedSelections.map(sel => (
                    <div
                      key={`${sel.matchId}-${sel.marketName}-${sel.selection}`}
                      className="bg-[#062416] p-2 rounded-lg border border-[#00e700]/20 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] text-zinc-400 block truncate">{sel.matchTitle}</span>
                        <span className="font-bold text-white">{sel.marketType}: {sel.selection}</span>
                      </div>
                      <span className="font-mono font-bold text-[#00e700] tabular-nums shrink-0">
                        @{sel.odds.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setIsBetslipOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-95 transition-all"
                >
                  Review &amp; Place Bet
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Betslip Bubble (when items selected and drawer is closed on mobile, hidden on admin dashboard) */}
      {activeTab !== 'admin' && selectedSelections.length > 0 && !isBetslipOpen && (
        <div className="fixed bottom-20 right-4 z-30 lg:hidden animate-bounce">
          <button
            onClick={() => {
              soundManager.playClick();
              setIsBetslipOpen(true);
            }}
            className="flex items-center gap-2 bg-[#00ad3a] hover:bg-[#00c844] text-black px-4 py-2.5 rounded-full font-black text-xs shadow-[0_0_20px_rgba(0,231,0,0.5)] border-2 border-white"
          >
            <span>BETSLIP</span>
            <span className="bg-black text-white px-2 py-0.5 rounded-full text-[10px] font-black">
              {selectedSelections.length}
            </span>
          </button>
        </div>
      )}

      {/* Fixed Bottom Navigation (shown only on homepage/user views, removed from Admin Dashboard) */}
      {activeTab !== 'admin' && (
        <BottomNav
          activeTab={activeTab}
          onSelectTab={tab => setActiveTab(tab)}
          betslipCount={selectedSelections.length}
          onOpenBetslip={() => setIsBetslipOpen(true)}
          onOpenCheckBets={() => setIsCheckBetsOpen(true)}
          onOpenAccount={() => {
            setAuthMode('login');
            setIsAuthOpen(true);
          }}
        />
      )}

      {/* Interactive Betslip Drawer */}
      <BetslipDrawer
        isOpen={isBetslipOpen}
        onClose={() => setIsBetslipOpen(false)}
        selections={selectedSelections}
        onRemoveSelection={handleRemoveSelection}
        onClearAll={handleClearBetslip}
        user={user}
        onPlaceBet={handlePlaceBet}
        defaultBetMode={betslipDefaultMode}
        modeSignal={betslipModeSignal}
      />

      {/* Check Bets / Early Cashout Modal */}
      <CheckBetsModal
        isOpen={isCheckBetsOpen}
        onClose={() => setIsCheckBetsOpen(false)}
        bets={placedBets}
        fxPositions={fxPositions}
        fxAssets={fxAssets}
        onCashoutBet={handleCashoutBet}
      />

      {/* Match Detail Radar & Expanded Markets Modal */}
      <MatchDetailModal
        match={detailMatch}
        initialTab={detailInitialTab}
        h2hRecords={h2hRecords}
        onClose={() => setDetailMatch(null)}
        selectedSelections={selectedSelections}
        onToggleSelection={handleToggleSelection}
      />

      {/* FX Asset Bookmaker & Live Trend Modal */}
      <FXBookmakerModal
        asset={selectedFxAssetId ? fxAssets.find(a => a.id === selectedFxAssetId) || null : null}
        userBalance={user.balance}
        positions={fxPositions}
        onClose={() => setSelectedFxAssetId(null)}
        onPlacePosition={handlePlaceFxPosition}
      />

      {/* User Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        initialMode={authMode}
        onUpdateUser={(updated, hydratedBets) => {
          const nextUser: UserProfile = {
            ...DEFAULT_GUEST_USER,
            ...updated,
          };
          activeOwnerIdRef.current = nextUser.id;
          const nextPlacedBets =
            hydratedBets?.placedBets ??
            loadSavedJson<PlacedBet[]>(getUserScopedKey('cas9i_placed_bets', nextUser.id), []);
          const nextFxPositions =
            hydratedBets?.fxPositions ??
            loadSavedJson<FXPosition[]>(getUserScopedKey('cas9i_fx_positions', nextUser.id), []);
          const nextSelections = loadSavedJson<BetSelection[]>(
            getUserScopedKey('cas9i_selected_selections', nextUser.id),
            []
          );
          if (nextUser.isLoggedIn && !nextUser.isAdmin && nextUser.id !== 'guest') {
            lastSyncedBetsKeyRef.current = `${nextUser.id}:${JSON.stringify({
              placedBets: nextPlacedBets,
              fxPositions: nextFxPositions,
              totalBetsPlaced: nextUser.totalBetsPlaced,
              totalWon: nextUser.totalWon,
            })}`;
          } else {
            lastSyncedBetsKeyRef.current = '';
          }
          setUser(nextUser);
          setPlacedBets(nextPlacedBets);
          setFxPositions(nextFxPositions);
          setSelectedSelections(nextSelections);
        }}
        onAdminLoginSuccess={() => setActiveTab('admin')}
      />

      {/* Active Playable Casino Mini-Game Modal */}
      {renderActiveGameModal()}
    </div>
  );
}
