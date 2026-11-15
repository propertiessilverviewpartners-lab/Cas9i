import React, { useState } from 'react';
import {
  SportCategory,
  MarketType,
  VirtualMatch,
  BetSelection,
  League,
  TipsterBetcode,
  H2HRecord,
  FXAsset,
  FXPosition
} from '../types';
import {
  LayoutGrid,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Clock,
  Zap,
  History
} from 'lucide-react';
import { soundManager } from '../services/soundEffects';
import { FXTradingView } from './FXTradingView';

interface SportsViewProps {
  matches: VirtualMatch[];
  leagues: League[];
  tipsterBetcodes: TipsterBetcode[];
  h2hRecords?: H2HRecord[];
  fxAssets?: FXAsset[];
  fxPositions?: FXPosition[];
  userBalance?: number;
  onSelectFxAsset?: (asset: FXAsset) => void;
  selectedSelections: BetSelection[];
  onToggleSelection: (
    match: VirtualMatch,
    marketType: MarketType,
    marketName: string,
    selection: string,
    odds: number
  ) => void;
  onLoadBetcode: (betcode: TipsterBetcode) => void;
  onOpenMatchDetail: (match: VirtualMatch, initialTab?: 'ALL' | 'H2H') => void;
  onOpenBetslip: () => void;
  isAdmin: boolean;
  onOpenAdminDashboard: () => void;
}

const OVER_UNDER_THRESHOLDS = Array.from({ length: 16 }, (_, i) => 15 + i);

const BOOKMARK_MARKETS: Array<{ id: MarketType; shortLabel: string; hint: string }> = [
  { id: '1X2', shortLabel: '1X2', hint: 'Home & O15 · Draw · Away & O15' },
  { id: '1st Goal', shortLabel: '1st Goal', hint: 'Home · Away' },
  { id: '5 Min Goal', shortLabel: '5m Goal', hint: 'Yes · No · Over 5 Goals' },
  { id: '1st Half', shortLabel: '1st Half', hint: '1X2 & O10 · Over/Under 15' },
  { id: '2nd Half', shortLabel: '2nd Half', hint: 'Home & O15 · X & O15 · Away & O15' },
  { id: 'Odd/Even', shortLabel: 'Odd/Even', hint: 'Total Match Goals: Odd · Even' },
  { id: 'Over/Under', shortLabel: 'O/U 15-30', hint: 'Over & Under 15 to 30 (2.00 - 18.75)' },
  { id: 'Correct Score', shortLabel: 'C. Score', hint: 'High-Goals Bracket' },
];

export const SportsView: React.FC<SportsViewProps> = ({
  matches,
  leagues,
  tipsterBetcodes,
  h2hRecords = [],
  fxAssets = [],
  fxPositions = [],
  userBalance = 0,
  onSelectFxAsset,
  selectedSelections,
  onToggleSelection,
  onLoadBetcode,
  onOpenMatchDetail,
  isAdmin,
  onOpenAdminDashboard
}) => {
  const [activeCategory, setActiveCategory] = useState<SportCategory>('soccer');
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'events' | 'tipster' | 'fx' | 'trending'>('events');
  const [filterMode, setFilterMode] = useState<'LIVE' | 'VIRTUAL' | 'UPCOMING' | 'HIGHLIGHTS'>('LIVE');
  const [zoomFilterMode, setZoomFilterMode] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'H2H'>('ALL');
  const [marketType, setMarketType] = useState<MarketType>('1X2');
  const [selectedOuLine, setSelectedOuLine] = useState<number>(15);

  const matchesLeague = (m: VirtualMatch) =>
    selectedLeague === 'all' || m.league.toLowerCase().includes(selectedLeague.toLowerCase());

  const mainMatches = matches.filter(m => !m.isZoom);
  const zoomAllMatches = matches.filter(m => Boolean(m.isZoom));

  const todayAll = mainMatches.filter(m => m.dayBucket !== 'NEXT_DAY');
  const nextDayAll = mainMatches.filter(m => m.dayBucket === 'NEXT_DAY');

  const todayFiltered = todayAll.filter(matchesLeague);
  const nextDayFiltered = nextDayAll.filter(matchesLeague);
  const zoomFiltered = zoomAllMatches.filter(matchesLeague);

  const zoomLiveCount = zoomFiltered.filter(m => m.status === 'LIVE').length;
  const zoomUpcomingCount = zoomFiltered.filter(m => m.status === 'UPCOMING').length;
  const zoomH2HRecords = h2hRecords
    .filter(r => r.isZoom && (selectedLeague === 'all' || r.league.toLowerCase().includes(selectedLeague.toLowerCase())))
    .slice()
    .reverse();

  const activeLiveToday = todayFiltered.filter(m => m.status === 'LIVE').slice(0, 5);
  const isLiveFallbackUpcoming = activeLiveToday.length === 0;
  const fallbackNext20to30 = todayFiltered
    .filter(m => m.status === 'UPCOMING')
    .sort((a, b) => a.startsInSeconds - b.startsInSeconds);
  const within20to30 = fallbackNext20to30.filter(m => m.startsInSeconds > 0 && m.startsInSeconds <= 1800);
  const liveViewMatches =
    activeLiveToday.length > 0
      ? activeLiveToday
      : (within20to30.length > 0 ? within20to30 : fallbackNext20to30).slice(0, 5);

  const featuredMatch =
    todayAll.find(m => m.isFeatured) ||
    todayAll.find(m => m.status === 'LIVE') ||
    todayAll[0] ||
    mainMatches[0];

  const isSelected = (matchId: string, marketName: string, selection: string) => {
    return selectedSelections.some(
      s => s.matchId === matchId && s.marketName === marketName && s.selection === selection
    );
  };

  const formatCountdown = (totalSec: number) => {
    const safe = Math.max(0, totalSec);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    return {
      h: String(hours).padStart(2, '0'),
      m: String(minutes).padStart(2, '0'),
      s: String(seconds).padStart(2, '0')
    };
  };

  const countdown = formatCountdown(featuredMatch ? featuredMatch.startsInSeconds : 0);

  let filteredMatches: VirtualMatch[] = [];
  if (activeCategory === 'zoom') {
    if (zoomFilterMode === 'LIVE') {
      filteredMatches = zoomFiltered.filter(m => m.status === 'LIVE');
    } else if (zoomFilterMode === 'UPCOMING') {
      filteredMatches = zoomFiltered.filter(m => m.status === 'UPCOMING');
    } else if (zoomFilterMode === 'H2H') {
      filteredMatches = [];
    } else {
      filteredMatches = zoomFiltered;
    }
  } else if (filterMode === 'LIVE') {
    filteredMatches = liveViewMatches;
  } else if (filterMode === 'VIRTUAL') {
    filteredMatches = todayFiltered;
  } else if (filterMode === 'UPCOMING') {
    filteredMatches = nextDayFiltered;
  } else {
    filteredMatches = todayFiltered.slice(0, 8);
  }

  const getOddsFlashClass = (direction?: 'up' | 'down' | 'same') => {
    if (direction === 'up') return 'ring-2 ring-emerald-400 bg-[#00c844]';
    if (direction === 'down') return 'ring-2 ring-red-400 bg-red-800';
    return '';
  };

  const activeMarketMeta = BOOKMARK_MARKETS.find(m => m.id === marketType);
  const isFxView = activeSubTab === 'fx';
  const isTipsterView = !isFxView && (activeCategory === 'tipster' || activeSubTab === 'tipster');
  const isZoomView = !isFxView && !isTipsterView && activeCategory === 'zoom';

  return (
    <div className="space-y-3 pb-24">
      {/* 1. Category Tiles Row */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-3 px-3 pt-2">
        {[
          { id: 'soccer', label: 'Soccer', icon: '⚽' },
          { id: 'live', label: 'Live', icon: '⏱️' },
          { id: 'tipster', label: 'Tipster', icon: '🛡️' },
          { id: 'virtuals', label: 'Virtuals', icon: '🏆' },
          { id: 'zoom', label: 'Zoom', icon: '💨' },
        ].map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                soundManager.playClick();
                const nextCat = cat.id as SportCategory;
                setActiveCategory(nextCat);
                if (nextCat === 'tipster') {
                  setActiveSubTab('tipster');
                } else {
                  setActiveSubTab('events');
                  if (nextCat === 'live') setFilterMode('LIVE');
                  if (nextCat === 'virtuals') setFilterMode('VIRTUAL');
                }
              }}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all border ${
                isActive
                  ? 'bg-gradient-to-b from-[#0e4425] to-[#062414] border-[#00e700] shadow-[0_0_15px_rgba(0,231,0,0.3)]'
                  : 'bg-[#051c10]/90 border-[#00e700]/20 hover:border-[#00e700]/50 hover:bg-[#072516]'
              }`}
            >
              <span className="text-lg sm:text-2xl mb-0.5">{cat.icon}</span>
              <span className="text-[10px] sm:text-xs font-bold text-zinc-200 whitespace-nowrap truncate max-w-full">
                {cat.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-[1px] inset-x-3 h-0.5 bg-[#00e700] rounded-full shadow-[0_0_8px_#00e700]" />
              )}
            </button>
          );
        })}
      </div>

      {/* 2. Horizontal League Filter Tags (hidden on FX market view for maximum screen fit) */}
      {!isFxView && (
        <div className="flex items-center gap-1.5 px-3 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: 'All Leagues' },
            ...leagues.map(lg => ({ id: lg.name, label: lg.name }))
          ].map(lg => {
            const isSelectedLeague = selectedLeague === lg.id;
            return (
              <button
                key={lg.id}
                onClick={() => {
                  soundManager.playClick();
                  setSelectedLeague(lg.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border ${
                  isSelectedLeague
                    ? 'bg-[#00ad3a] text-white border-[#00e700] shadow-[0_0_10px_rgba(0,231,0,0.3)]'
                    : 'bg-[#062416]/90 text-zinc-300 border-[#00e700]/25 hover:border-[#00e700]/60'
                }`}
              >
                {lg.label}
              </button>
            );
          })}
          <button
            onClick={() => soundManager.playClick()}
            className="p-1.5 rounded-lg bg-[#062416] border border-[#00e700]/25 text-zinc-300 hover:text-white shrink-0"
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Section Sub-tabs */}
      <div className="flex items-center gap-1.5 px-3 border-b border-[#00e700]/15 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'events', label: 'Events' },
          { id: 'tipster', label: 'Tipster' },
          { id: 'fx', label: 'FX' },
          { id: 'trending', label: 'Trending' },
        ].map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                soundManager.playClick();
                const nextTab = tab.id as 'events' | 'tipster' | 'fx' | 'trending';
                setActiveSubTab(nextTab);
                if (nextTab === 'tipster') {
                  setActiveCategory('tipster');
                } else if (activeCategory === 'tipster') {
                  setActiveCategory('soccer');
                }
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#0e4425] text-white border border-[#00e700]/50 shadow-[0_0_10px_rgba(0,231,0,0.25)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isFxView ? (
        <FXTradingView
          assets={fxAssets}
          positions={fxPositions}
          userBalance={userBalance}
          onSelectAsset={asset => onSelectFxAsset && onSelectFxAsset(asset)}
        />
      ) : isTipsterView ? (
        <div className="px-3 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              Daily Betcodes ({tipsterBetcodes.length}/10)
            </h3>
            <span className="text-[10px] font-bold text-[#00e700]">Tap any code to load</span>
          </div>

          {tipsterBetcodes.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs bg-[#051c10]/60 rounded-xl border border-zinc-800">
              Generating daily betcodes...
            </div>
          ) : (
            tipsterBetcodes.map(codeItem => (
              <div
                key={codeItem.id}
                className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-2xl p-3 space-y-2.5 hover:border-[#00e700]/60 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-[#00ad3a]/25 border border-[#00e700]/40 text-[#00e700] font-mono text-[11px] font-black shrink-0">
                      {codeItem.code}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-white truncate">
                      {codeItem.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-zinc-400">
                      {codeItem.selections.length} Picks
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-xs font-black tabular-nums">
                      {codeItem.totalOdds.toFixed(2)}x
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {codeItem.selections.map((sel, idx) => (
                    <div
                      key={`${codeItem.id}-${idx}`}
                      className="flex items-center justify-between gap-2 bg-[#03150b] px-2.5 py-1.5 rounded-lg border border-zinc-800/80 text-[11px]"
                    >
                      <span className="text-zinc-300 font-semibold truncate">{sel.matchTitle}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-zinc-400 text-[10px] font-bold">
                          {sel.marketType}: <span className="text-white">{sel.selection}</span>
                        </span>
                        <span className="font-mono font-black text-[#00e700] tabular-nums">
                          @{sel.odds.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onLoadBetcode(codeItem)}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(0,231,0,0.3)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-black" />
                  <span>Load {codeItem.code} ({codeItem.totalOdds.toFixed(2)}x) to Betslip</span>
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <>

      {/* 4. Featured Match Hero Card (hidden in Zoom view for direct focus on 50 simulated matches) */}
      {!isZoomView && mainMatches.length === 0 ? (
        <div className="px-3">
          <div className="relative bg-gradient-to-b from-[#09321c] via-[#052113] to-[#021208] border border-[#00e700]/30 rounded-2xl p-4 sm:p-6 shadow-[0_0_25px_rgba(0,231,0,0.15)] text-center">
            <div className="w-12 h-12 rounded-full bg-[#062416] border border-[#00e700]/40 flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner">
              ⏱️
            </div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
              SCHEDULING DAILY FIXTURES
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 leading-relaxed">
              20 daily matches and 20 next-day fixtures are automatically prepared from active leagues.
            </p>
            {isAdmin && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => {
                    soundManager.playClick();
                    onOpenAdminDashboard();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Open Admin Dashboard</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        !isZoomView && featuredMatch && (
          <div className="px-3">
            <div className="relative bg-gradient-to-b from-[#09321c] via-[#052113] to-[#021208] border border-[#00e700]/30 rounded-2xl p-3 sm:p-4 shadow-[0_0_25px_rgba(0,231,0,0.15)] overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-2.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-zinc-300 font-bold min-w-0">
                  <span className="shrink-0">⚽</span>
                  <span className="truncate">{featuredMatch.league}</span>
                </div>

                {featuredMatch.status === 'LIVE' ? (
                  <div className="flex items-center gap-1.5 shrink-0 bg-[#03150b] px-2 py-0.5 rounded-md border border-[#00e700]/35">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00e700] animate-ping" />
                    <span className="font-mono font-black text-[#00e700]">
                      {featuredMatch.minute}&apos;/60&apos; LIVE
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">STARTS</span>
                    <div className="flex items-center gap-0.5 font-mono text-[11px] font-black text-amber-400">
                      <span className="bg-[#03150b] px-1 py-0.5 rounded border border-zinc-700/80">
                        {countdown.h}
                      </span>
                      <span>:</span>
                      <span className="bg-[#03150b] px-1 py-0.5 rounded border border-zinc-700/80">
                        {countdown.m}
                      </span>
                      <span>:</span>
                      <span className="bg-[#03150b] px-1 py-0.5 rounded border border-zinc-700/80">
                        {countdown.s}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div
                onClick={() => {
                  soundManager.playClick();
                  onOpenMatchDetail(featuredMatch);
                }}
                className="cursor-pointer group mb-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-black text-white group-hover:text-[#00e700] transition-colors truncate">
                        {featuredMatch.homeTeam}
                      </h3>
                      {featuredMatch.status !== 'UPCOMING' && (
                        <span className="font-mono text-base font-black text-amber-400 tabular-nums shrink-0">
                          {featuredMatch.homeScore}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-black text-white group-hover:text-[#00e700] transition-colors truncate">
                        {featuredMatch.awayTeam}
                      </h3>
                      {featuredMatch.status !== 'UPCOMING' && (
                        <span className="font-mono text-base font-black text-amber-400 tabular-nums shrink-0">
                          {featuredMatch.awayScore}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-semibold block pt-0.5">
                      {featuredMatch.scheduledTime} · 60&apos; Standard Match
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 text-[11px] font-bold text-[#00e700] group-hover:underline shrink-0 pl-2">
                    <span>Markets</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Hero Quick 1X2 (Home & O15 | Draw | Away & O15) */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {[
                  {
                    label: 'Home & O15',
                    sub: 'Home & O15',
                    odds: featuredMatch.odds.home,
                    dir: featuredMatch.oddsDirection['home']
                  },
                  {
                    label: 'Draw',
                    sub: 'Draw',
                    odds: featuredMatch.odds.draw,
                    dir: featuredMatch.oddsDirection['draw']
                  },
                  {
                    label: 'Away & O15',
                    sub: 'Away & O15',
                    odds: featuredMatch.odds.away,
                    dir: featuredMatch.oddsDirection['away']
                  },
                ].map(opt => {
                  const active = isSelected(featuredMatch.id, '1X2', opt.sub);
                  return (
                    <button
                      key={opt.sub}
                      onClick={() => {
                        soundManager.playClick();
                        onToggleSelection(
                          featuredMatch,
                          '1X2',
                          '1X2',
                          opt.sub,
                          opt.odds
                        );
                      }}
                      className={`py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center text-center select-none active:scale-95 ${
                        active
                          ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_15px_#00e700]'
                          : 'bg-[#00ad3a] hover:bg-[#00c844] text-white shadow-md'
                      } ${getOddsFlashClass(opt.dir)}`}
                    >
                      <span className="text-[10px] font-bold opacity-95 whitespace-nowrap leading-tight">
                        {opt.label}
                      </span>
                      <span className="text-sm sm:text-base font-black tabular-nums tracking-tight flex items-center gap-0.5 mt-0.5">
                        {opt.odds.toFixed(2)}
                        {opt.dir === 'up' && <ArrowUp className="w-2.5 h-2.5 text-white inline" />}
                        {opt.dir === 'down' && <ArrowDown className="w-2.5 h-2.5 text-red-200 inline" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )
      )}

      {/* 5. Schedule Filter Mode Strip */}
      <div className="px-3 pt-0.5">
        {isZoomView ? (
          <>
            <div className="bg-[#051c10] p-1 rounded-xl border border-[#00e700]/20 grid grid-cols-4 gap-1">
              {[
                { id: 'ALL', label: `ALL (${zoomFiltered.length})` },
                { id: 'LIVE', label: `LIVE (${zoomLiveCount})` },
                { id: 'UPCOMING', label: `NEXT (${zoomUpcomingCount})` },
                { id: 'H2H', label: `H2H (${zoomH2HRecords.length})` },
              ].map(f => {
                const isActive = zoomFilterMode === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      soundManager.playClick();
                      setZoomFilterMode(f.id as 'ALL' | 'LIVE' | 'UPCOMING' | 'H2H');
                    }}
                    className={`py-2 px-1 rounded-lg text-[10px] sm:text-xs font-black transition-all whitespace-nowrap truncate ${
                      isActive
                        ? 'bg-[#00ad3a] text-white shadow-[0_0_12px_rgba(0,173,58,0.4)]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold px-1 pt-1.5">
              <span className="text-[#00e700]">Zoom ({zoomFiltered.length}/50) · 90s · Min: $3,000</span>
              <span className="text-zinc-500 hidden sm:inline">{activeMarketMeta?.hint}</span>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#051c10] p-1 rounded-xl border border-[#00e700]/20 grid grid-cols-4 gap-1">
              {[
                { id: 'LIVE', label: `LIVE (${activeLiveToday.length})` },
                { id: 'VIRTUAL', label: `VIRTUAL (${todayFiltered.length})` },
                { id: 'UPCOMING', label: `UPCOMING (${nextDayFiltered.length})` },
                { id: 'HIGHLIGHTS', label: 'TOP' },
              ].map(f => {
                const isActive = filterMode === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      soundManager.playClick();
                      setFilterMode(f.id as 'LIVE' | 'VIRTUAL' | 'UPCOMING' | 'HIGHLIGHTS');
                    }}
                    className={`py-2 px-1 rounded-lg text-[10px] sm:text-xs font-black transition-all whitespace-nowrap truncate ${
                      isActive
                        ? 'bg-[#00ad3a] text-white shadow-[0_0_12px_rgba(0,173,58,0.4)]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Context Banner for Filter Mode */}
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold px-1 pt-1.5">
              {filterMode === 'LIVE' ? (
                isLiveFallbackUpcoming ? (
                  <span className="text-amber-300 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>No match is currently in-play · Next kickoff in 20–30 min</span>
                  </span>
                ) : (
                  <span className="text-[#00e700]">Showing {activeLiveToday.length} in-play matches (60&apos; standard)</span>
                )
              ) : filterMode === 'VIRTUAL' ? (
                <span>Today&apos;s Daily Matches ({todayFiltered.length}/20) · 60&apos; Standard</span>
              ) : filterMode === 'UPCOMING' ? (
                <span>Next Day Fixed Matches ({nextDayFiltered.length}/20)</span>
              ) : (
                <span>Top Featured Virtual Fixtures</span>
              )}
              <span className="text-zinc-500 hidden sm:inline">{activeMarketMeta?.hint}</span>
            </div>
          </>
        )}
      </div>

      {/* 6. Matches Bookmark Market Strip */}
      <div className="px-3 border-b border-[#00e700]/15 pb-1.5 space-y-1.5">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {BOOKMARK_MARKETS.map(mkt => {
            const isMktActive = marketType === mkt.id;
            return (
              <button
                key={mkt.id}
                onClick={() => {
                  soundManager.playClick();
                  setMarketType(mkt.id);
                }}
                className={`relative shrink-0 py-2 px-2.5 text-[10px] sm:text-xs font-black transition-colors whitespace-nowrap text-center rounded-t-lg ${
                  isMktActive
                    ? 'text-[#00e700] bg-[#072616]/80'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>{mkt.shortLabel}</span>
                {isMktActive && (
                  <div className="absolute -bottom-1 inset-x-1 h-0.5 bg-[#00e700] rounded-full shadow-[0_0_6px_#00e700]" />
                )}
              </button>
            );
          })}
        </div>

        {marketType === 'Over/Under' && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
            <span className="text-[10px] font-black text-zinc-400 shrink-0 pr-1">Line:</span>
            {OVER_UNDER_THRESHOLDS.map(line => {
              const active = selectedOuLine === line;
              return (
                <button
                  key={line}
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedOuLine(line);
                  }}
                  className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-black tabular-nums transition-all border ${
                    active
                      ? 'bg-[#00ad3a] text-white border-[#00e700] shadow-[0_0_8px_rgba(0,231,0,0.3)]'
                      : 'bg-[#03150b] text-zinc-300 border-zinc-800 hover:border-[#00e700]/50'
                  }`}
                >
                  {line}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Virtual Matches List or Zoom H2H Results */}
      <div className="px-3 space-y-2">
        {isZoomView && zoomFilterMode === 'H2H' ? (
          zoomH2HRecords.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-xs bg-[#051c10]/60 rounded-xl border border-zinc-800">
              No closed Zoom H2H results yet. Completed 90s Zoom matches automatically record here and reset to 0 - 0.
            </div>
          ) : (
            zoomH2HRecords.map(rec => (
              <div
                key={rec.id}
                className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold">
                  <span className="truncate">{rec.league} · R#{rec.roundNumber} · FT</span>
                  <span className="font-mono shrink-0">
                    {new Date(rec.playedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {new Date(rec.playedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-black">
                  <span className={`flex-1 truncate ${rec.homeScore > rec.awayScore ? 'text-[#00e700]' : 'text-white'}`}>
                    {rec.homeTeam}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-[#072616] border border-[#00e700]/30 font-mono text-amber-400 tabular-nums shrink-0">
                    {rec.homeScore} - {rec.awayScore}
                  </span>
                  <span className={`flex-1 truncate text-right ${rec.awayScore > rec.homeScore ? 'text-[#00e700]' : 'text-white'}`}>
                    {rec.awayTeam}
                  </span>
                </div>
              </div>
            ))
          )
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs bg-[#051c10]/60 rounded-xl border border-zinc-800">
            No matches found for this filter.
          </div>
        ) : (
          filteredMatches.map(match => {
            const activeOuOption =
              (match.odds.overUnderLines || []).find(l => l.line === selectedOuLine) ||
              (match.odds.overUnderLines || [])[0] || { line: selectedOuLine, over: 2.0, under: 18.75 };

            const quickOptions =
              marketType === '1X2'
                ? [
                    { label: 'Home & O15', selection: 'Home & O15', marketName: '1X2', odds: match.odds.home, dir: match.oddsDirection['home'] },
                    { label: 'Draw', selection: 'Draw', marketName: '1X2', odds: match.odds.draw, dir: match.oddsDirection['draw'] },
                    { label: 'Away & O15', selection: 'Away & O15', marketName: '1X2', odds: match.odds.away, dir: match.oddsDirection['away'] },
                  ]
                : marketType === '1st Goal'
                ? [
                    { label: 'Home', selection: 'Home', marketName: '1st Goal', odds: match.odds.firstGoalHome, dir: match.oddsDirection['firstGoalHome'] },
                    { label: 'Away', selection: 'Away', marketName: '1st Goal', odds: match.odds.firstGoalAway, dir: match.oddsDirection['firstGoalAway'] },
                  ]
                : marketType === '5 Min Goal'
                ? [
                    { label: 'Yes', selection: 'Yes', marketName: '5 Min Goal', odds: match.odds.fiveMinYes, dir: match.oddsDirection['fiveMinYes'] },
                    { label: 'No', selection: 'No', marketName: '5 Min Goal', odds: match.odds.fiveMinNo, dir: match.oddsDirection['fiveMinNo'] },
                    { label: 'Over 5', selection: 'Over 5 Goals', marketName: '5 Min Goal', odds: match.odds.fiveMinOver5, dir: match.oddsDirection['fiveMinOver5'] },
                  ]
                : marketType === '1st Half'
                ? [
                    { label: 'Home & O10', selection: 'Home & O10', marketName: '1st Half', odds: match.odds.ht1Over10, dir: match.oddsDirection['ht1Over10'] },
                    { label: 'X & O10', selection: 'X & O10', marketName: '1st Half', odds: match.odds.htXOver10, dir: match.oddsDirection['htXOver10'] },
                    { label: 'Away & O10', selection: 'Away & O10', marketName: '1st Half', odds: match.odds.ht2Over10, dir: match.oddsDirection['ht2Over10'] },
                  ]
                : marketType === '2nd Half'
                ? [
                    { label: 'Home & O15', selection: 'Home & O15', marketName: '2nd Half', odds: match.odds.sh1Over15, dir: match.oddsDirection['sh1Over15'] },
                    { label: 'X & O15', selection: 'X & O15', marketName: '2nd Half', odds: match.odds.shXOver15, dir: match.oddsDirection['shXOver15'] },
                    { label: 'Away & O15', selection: 'Away & O15', marketName: '2nd Half', odds: match.odds.sh2Over15, dir: match.oddsDirection['sh2Over15'] },
                  ]
                : marketType === 'Odd/Even'
                ? [
                    { label: 'Odd', selection: 'Odd', marketName: 'Odd/Even', odds: match.odds.oddGoals, dir: match.oddsDirection['oddGoals'] },
                    { label: 'Even', selection: 'Even', marketName: 'Odd/Even', odds: match.odds.evenGoals, dir: match.oddsDirection['evenGoals'] },
                  ]
                : marketType === 'Over/Under'
                ? [
                    { label: `Over ${activeOuOption.line}`, selection: `Over ${activeOuOption.line}`, marketName: `O/U ${activeOuOption.line}`, odds: activeOuOption.over, dir: undefined },
                    { label: `Under ${activeOuOption.line}`, selection: `Under ${activeOuOption.line}`, marketName: `O/U ${activeOuOption.line}`, odds: activeOuOption.under, dir: undefined },
                  ]
                : [];

            return (
              <div
                key={match.id}
                className="bg-[#051c10]/95 border border-[#00e700]/20 rounded-xl p-2.5 transition-all hover:border-[#00e700]/50 space-y-2"
              >
                {/* League & Time Header */}
                <div className="text-[10px] sm:text-[11px] font-bold text-zinc-400 flex items-center justify-between gap-2">
                  <span className="truncate">{match.league}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        soundManager.playClick();
                        onOpenMatchDetail(match, 'H2H');
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#072b19] hover:bg-[#0d4629] border border-[#00e700]/35 text-[#00e700] text-[9px] font-black flex items-center gap-0.5"
                      title="View Previous to Current H2H"
                    >
                      <History className="w-2.5 h-2.5" />
                      <span>H2H</span>
                    </button>
                    <span className="text-[9px] font-black text-zinc-500">
                      {match.isZoom ? '90s' : "60'"} · R{match.roundNumber || 1}
                    </span>
                    {match.status === 'LIVE' ? (
                      <span className="text-[10px] text-[#00e700] font-black flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00e700] animate-ping" />
                        {match.isZoom ? `${match.elapsedSeconds ?? 1}s/90s LIVE` : `${match.minute}' LIVE`}
                      </span>
                    ) : match.status === 'FINISHED' ? (
                      <span className="text-[10px] text-zinc-400 font-black">
                        {match.isZoom ? 'FT 90s' : "FT 60'"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-300 font-bold">
                        {match.scheduledTime}
                      </span>
                    )}
                  </div>
                </div>

                {/* Match Teams & Odds Row (Responsive: stacked on small mobile, side-by-side on desktop) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Teams and Scores */}
                  <div
                    onClick={() => {
                      soundManager.playClick();
                      onOpenMatchDetail(match);
                    }}
                    className="flex-1 cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white mb-0.5">
                      <span className="truncate group-hover:text-[#00e700] transition-colors">
                        {match.homeTeam}
                      </span>
                      <span className="font-mono text-amber-400 font-extrabold ml-2 tabular-nums shrink-0">
                        {match.homeScore}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-white">
                      <span className="truncate group-hover:text-[#00e700] transition-colors">
                        {match.awayTeam}
                      </span>
                      <span className="font-mono text-amber-400 font-extrabold ml-2 tabular-nums shrink-0">
                        {match.awayScore}
                      </span>
                    </div>
                  </div>

                  {/* Odds Buttons */}
                  {marketType === 'Correct Score' ? (
                    <div className="grid grid-cols-3 gap-1.5 w-full sm:w-64 shrink-0">
                      {(match.odds.correctScores || []).slice(0, 6).map(cs => {
                        const active = isSelected(match.id, 'Correct Score', cs.score);
                        return (
                          <button
                            key={cs.score}
                            onClick={() => {
                              soundManager.playClick();
                              onToggleSelection(
                                match,
                                'Correct Score',
                                'Correct Score',
                                cs.score,
                                cs.odds
                              );
                            }}
                            className={`h-10 rounded-lg px-1 flex flex-col items-center justify-center transition-all select-none active:scale-95 ${
                              active
                                ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                                : 'bg-[#00ad3a] hover:bg-[#00c844] text-white shadow-sm'
                            }`}
                          >
                            <span className="text-[9px] font-bold leading-none opacity-95">
                              {cs.score}
                            </span>
                            <span className="text-[11px] font-black tabular-nums leading-tight mt-0.5">
                              {cs.odds.toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="w-full sm:w-64 shrink-0 space-y-1.5">
                      <div className={`grid ${quickOptions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-1.5`}>
                        {quickOptions.map((col, idx) => {
                          const active = isSelected(match.id, col.marketName, col.selection);
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                soundManager.playClick();
                                onToggleSelection(
                                  match,
                                  marketType,
                                  col.marketName,
                                  col.selection,
                                  col.odds
                                );
                              }}
                              className={`h-11 rounded-lg px-1 flex flex-col items-center justify-center transition-all select-none active:scale-95 ${
                                active
                                  ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                                  : 'bg-[#00ad3a] hover:bg-[#00c844] text-white shadow-sm'
                              } ${getOddsFlashClass(col.dir)}`}
                            >
                              <span className="text-[9px] sm:text-[10px] font-bold leading-none opacity-95 whitespace-nowrap">
                                {col.label}
                              </span>
                              <span className="text-xs font-black tabular-nums flex items-center gap-0.5 leading-tight mt-0.5">
                                {col.odds.toFixed(2)}
                                {col.dir === 'up' && <ArrowUp className="w-2.5 h-2.5 inline" />}
                                {col.dir === 'down' && <ArrowDown className="w-2.5 h-2.5 text-red-200 inline" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {marketType === '1st Half' && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { label: '1H Over 15', selection: 'Over 15', odds: match.odds.htOver15, dir: match.oddsDirection['htOver15'] },
                            { label: '1H Under 15', selection: 'Under 15', odds: match.odds.htUnder15, dir: match.oddsDirection['htUnder15'] },
                          ].map(col => {
                            const active = isSelected(match.id, '1st Half O/U 15', col.selection);
                            return (
                              <button
                                key={col.selection}
                                onClick={() => {
                                  soundManager.playClick();
                                  onToggleSelection(
                                    match,
                                    '1st Half',
                                    '1st Half O/U 15',
                                    col.selection,
                                    col.odds
                                  );
                                }}
                                className={`h-9 rounded-lg px-2 flex items-center justify-between gap-1 transition-all select-none active:scale-95 ${
                                  active
                                    ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                                    : 'bg-[#08381d] hover:bg-[#0d4d29] border border-[#00e700]/30 text-white shadow-sm'
                                } ${getOddsFlashClass(col.dir)}`}
                              >
                                <span className="text-[9px] sm:text-[10px] font-bold opacity-95 whitespace-nowrap">
                                  {col.label}
                                </span>
                                <span className="text-[11px] font-black tabular-nums">
                                  {col.odds.toFixed(2)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      )}
    </div>
  );
};
