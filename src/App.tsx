/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  VirtualMatch,
  BetSelection,
  PlacedBet,
  CasinoGame,
  LeaderboardEntry,
  LiveBetTickerItem,
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

// Core Components
import { Header } from './components/Header';
import { BottomNav, MainTab } from './components/BottomNav';
import { SportsView } from './components/SportsView';
import { CasinoView } from './components/CasinoView';
import { LeaderboardView } from './components/LeaderboardView';
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
  balance: 100000.00,
  currency: 'USD',
  avatar: '👤',
  isLoggedIn: false,
  isAdmin: false,
  totalBetsPlaced: 0,
  totalWon: 0
};

function loadSavedUser(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_GUEST_USER;
  try {
    const raw = window.localStorage.getItem('cas9i_user_session');
    if (!raw) return DEFAULT_GUEST_USER;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (parsed && parsed.isLoggedIn) {
      return { ...DEFAULT_GUEST_USER, ...parsed };
    }
  } catch {
    // ignore corrupt session
  }
  return DEFAULT_GUEST_USER;
}

function loadSavedTab(savedUser: UserProfile): MainTab {
  if (typeof window === 'undefined') return 'sports';
  const saved = window.localStorage.getItem('cas9i_active_tab') as MainTab | null;
  if (saved === 'admin' && savedUser.isAdmin) return 'admin';
  if (saved === 'casino' || saved === 'leaderboard' || saved === 'sports') return saved;
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
  const [initialUser] = useState<UserProfile>(() => loadSavedUser());
  const [activeTab, setActiveTab] = useState<MainTab>(() => loadSavedTab(initialUser));
  const [matches, setMatches] = useState<VirtualMatch[]>(virtualEngine.getMatches());
  const [tipsterBetcodes, setTipsterBetcodes] = useState<TipsterBetcode[]>(virtualEngine.getTipsterBetcodes());
  const [h2hRecords, setH2HRecords] = useState<H2HRecord[]>(virtualEngine.getH2HRecords());
  const [fxAssets, setFxAssets] = useState<FXAsset[]>(virtualEngine.getFxAssets());
  const [fxPositions, setFxPositions] = useState<FXPosition[]>(() =>
    loadSavedJson<FXPosition[]>('cas9i_fx_positions', [])
  );
  const [clubs, setClubs] = useState<Club[]>(virtualEngine.getClubs());
  const [leagues, setLeagues] = useState<League[]>(virtualEngine.getLeagues());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(virtualEngine.getLeaderboard());
  const [ticker, setTicker] = useState<LiveBetTickerItem[]>(virtualEngine.getLiveTicker());
  const [selectedSelections, setSelectedSelections] = useState<BetSelection[]>(() =>
    loadSavedJson<BetSelection[]>('cas9i_selected_selections', [])
  );
  const [placedBets, setPlacedBets] = useState<PlacedBet[]>(() =>
    loadSavedJson<PlacedBet[]>('cas9i_placed_bets', [])
  );

  // Modals & Drawers
  const [isBetslipOpen, setIsBetslipOpen] = useState(false);
  const [betslipDefaultMode, setBetslipDefaultMode] = useState<'single' | 'accumulator'>('single');
  const [betslipModeSignal, setBetslipModeSignal] = useState(0);
  const [isCheckBetsOpen, setIsCheckBetsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'deposit'>('login');
  const [activeGameModal, setActiveGameModal] = useState<CasinoGame | null>(null);
  const [detailMatch, setDetailMatch] = useState<VirtualMatch | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<'ALL' | 'H2H'>('ALL');
  const [selectedFxAssetId, setSelectedFxAssetId] = useState<string | null>(null);

  // Goal alert toast
  const [goalAlert, setGoalAlert] = useState<{ match: VirtualMatch; text: string } | null>(null);

  // User profile (persisted in localStorage when logged in)
  const [user, setUser] = useState<UserProfile>(initialUser);

  // Persist user session & verify admin token with server on startup
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
    window.localStorage.setItem('cas9i_selected_selections', JSON.stringify(selectedSelections));
  }, [selectedSelections]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('cas9i_placed_bets', JSON.stringify(placedBets));
  }, [placedBets]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('cas9i_fx_positions', JSON.stringify(fxPositions));
  }, [fxPositions]);

  useEffect(() => {
    if (!user.isAdmin) return;
    void virtualEngine.verifyAdminSession().then(status => {
      if (status === 'invalid') {
        virtualEngine.setAdminToken(null);
        setUser(DEFAULT_GUEST_USER);
        setActiveTab('sports');
      }
    });
  }, []);

  // Real-time Virtual Engine Subscriptions (low-latency sync)
  useEffect(() => {
    const unsubMatches = virtualEngine.subscribeMatches(newMatches => {
      setMatches(newMatches);
      // Sync detailed match if currently open
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

    const unsubLeaderboard = virtualEngine.subscribeLeaderboard(newLeaderboard => {
      setLeaderboard(newLeaderboard);
    });

    const unsubTicker = virtualEngine.subscribeTicker(newTicker => {
      setTicker(newTicker);
    });

    const unsubGoal = virtualEngine.onGoalAlert(alert => {
      setGoalAlert(alert);
      soundManager.playGoal();
      setTimeout(() => {
        setGoalAlert(null);
      }, 3500);
    });

    return () => {
      unsubMatches();
      unsubTipster();
      unsubH2H();
      unsubFx();
      unsubClubs();
      unsubLeagues();
      unsubLeaderboard();
      unsubTicker();
      unsubGoal();
    };
  }, []);

  const handleLogout = () => {
    virtualEngine.setAdminToken(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('cas9i_user_session');
      window.localStorage.removeItem('cas9i_active_tab');
      window.localStorage.removeItem('cas9i_admin_page');
    }
    setUser(DEFAULT_GUEST_USER);
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
        return { ...workingBet, status: 'WON' as const, cashoutAmount: workingBet.potentialPayout };
      }
      if (settlement === 'LOST') {
        changed = true;
        return { ...workingBet, status: 'LOST' as const, cashoutAmount: 0 };
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
      setUser(prev => ({
        ...prev,
        balance: prev.balance + totalNewWinnings,
        totalWon: prev.totalWon + totalNewWinnings
      }));
      wonTickets.forEach(t => {
        virtualEngine.recordUserWin(user.username, t.payout, t.odds, t.label);
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
          status: won ? ('WON' as const) : ('LOST' as const),
        };
      });

      if (changed) {
        setFxPositions(nextPositions);
      }
      if (totalFxWinnings > 0) {
        setUser(prev => ({
          ...prev,
          balance: prev.balance + totalFxWinnings,
          totalWon: prev.totalWon + totalFxWinnings,
        }));
        fxWins.forEach(w => {
          virtualEngine.recordUserWin(user.username, w.payout, w.odds, w.label);
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
          isZoom: Boolean(match.isZoom)
        };
        return [...filtered, newItem];
      }
    });
  };

  const handleLoadBetcode = (betcode: TipsterBetcode) => {
    soundManager.playClick();
    setSelectedSelections(betcode.selections.map(s => ({ ...s })));
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
    setUser(prev => ({
      ...prev,
      balance: prev.balance - newBet.stake,
      totalBetsPlaced: prev.totalBetsPlaced + 1
    }));
    setPlacedBets(prev => [newBet, ...prev]);
  };

  const handleCashoutBet = (betId: string, amount: number) => {
    if (amount <= 0) return;
    const target = placedBets.find(b => b.id === betId && b.status === 'OPEN');
    if (!target || target.cashoutAmount <= 0) return;
    setPlacedBets(prev =>
      prev.map(b => (b.id === betId ? { ...b, status: 'CASHED_OUT', cashoutAmount: amount } : b))
    );
    setUser(prev => ({
      ...prev,
      balance: prev.balance + amount,
      totalWon: prev.totalWon + amount
    }));
    virtualEngine.recordUserWin(user.username, amount, Number((amount / 10).toFixed(2)), 'Early Cashout');
  };

  const handlePlaceFxPosition = (newPos: FXPosition) => {
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
      onUpdateBalance: (newBalance: number) => setUser(prev => ({ ...prev, balance: newBalance })),
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
      case 'duck-hunters':
        return <PenaltyShootGame {...commonProps} />;
      case 'plinko':
      case 'lucky-49':
        return <PlinkoGame {...commonProps} />;
      case 'roulette':
        return <RouletteGame {...commonProps} />;
      case 'spin-win':
      case 'ice-fishing':
        return <SpinWinGame {...commonProps} />;
      case 'strike-777':
      case 'hit-slot-2025':
      case 'burning-classics':
      case 'gidi-slot':
      case 'burning-coins-40':
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
        onOpenDeposit={() => {
          setAuthMode('deposit');
          setIsAuthOpen(true);
        }}
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

            {activeTab === 'leaderboard' && (
              <LeaderboardView
                leaderboard={leaderboard}
                ticker={ticker}
                user={user}
              />
            )}

            {activeTab === 'admin' && user.isAdmin && (
              <AdminDashboard
                matches={matches}
                clubs={clubs}
                leagues={leagues}
                onNavigateSports={() => setActiveTab('sports')}
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

      {/* User Auth & Top-Up Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        initialMode={authMode}
        onUpdateUser={updated => setUser(prev => ({ ...prev, ...updated }))}
        onAdminLoginSuccess={() => setActiveTab('admin')}
      />

      {/* Active Playable Casino Mini-Game Modal */}
      {renderActiveGameModal()}
    </div>
  );
}
