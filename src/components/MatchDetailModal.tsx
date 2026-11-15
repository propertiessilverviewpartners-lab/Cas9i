import React, { useState, useEffect } from 'react';
import { VirtualMatch, BetSelection, MarketType, H2HRecord } from '../types';
import { X, Activity, History, ArrowRight } from 'lucide-react';
import { soundManager } from '../services/soundEffects';

interface MatchDetailModalProps {
  match: VirtualMatch | null;
  initialTab?: 'ALL' | 'H2H';
  h2hRecords?: H2HRecord[];
  onClose: () => void;
  selectedSelections: BetSelection[];
  onToggleSelection: (
    match: VirtualMatch,
    marketType: MarketType,
    marketName: string,
    selection: string,
    odds: number
  ) => void;
}

const formatMatchDateTime = (ts: number) => {
  const d = new Date(ts);
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
};

const formatCompactDateTime = (ts: number) => {
  const d = new Date(ts);
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
};

const sameTeam = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  initialTab = 'ALL',
  h2hRecords = [],
  onClose,
  selectedSelections,
  onToggleSelection
}) => {
  const [activeMarketTab, setActiveMarketTab] = useState<'ALL' | '1X2' | 'HALVES' | 'OU' | 'SCORE' | 'H2H'>(initialTab);

  useEffect(() => {
    setActiveMarketTab(initialTab);
  }, [match?.id, initialTab]);

  if (!match) return null;

  const isSelected = (marketName: string, selection: string) => {
    return selectedSelections.some(
      s => s.matchId === match.id && s.marketName === marketName && s.selection === selection
    );
  };

  // All previous direct meetings between homeTeam & awayTeam (latest first)
  const pairH2H = h2hRecords
    .filter(
      r =>
        (sameTeam(r.homeTeam, match.homeTeam) && sameTeam(r.awayTeam, match.awayTeam)) ||
        (sameTeam(r.homeTeam, match.awayTeam) && sameTeam(r.awayTeam, match.homeTeam))
    )
    .sort((a, b) => b.playedAt - a.playedAt);

  // Individual previous meetings with other clubs (excluding direct meetings between the two)
  const getOtherClubH2H = (clubName: string, excludeOpponent: string) => {
    const filtered = h2hRecords
      .filter(
        r =>
          (sameTeam(r.homeTeam, clubName) && !sameTeam(r.awayTeam, excludeOpponent)) ||
          (sameTeam(r.awayTeam, clubName) && !sameTeam(r.homeTeam, excludeOpponent))
      )
      .sort((a, b) => b.playedAt - a.playedAt);

    const perOpponentCount = new Map<string, number>();
    const picked: H2HRecord[] = [];
    for (const rec of filtered) {
      const opp = (sameTeam(rec.homeTeam, clubName) ? rec.awayTeam : rec.homeTeam).trim().toLowerCase();
      const count = perOpponentCount.get(opp) || 0;
      if (count >= 3) continue;
      perOpponentCount.set(opp, count + 1);
      picked.push(rec);
      if (picked.length >= 8) break;
    }
    return picked;
  };

  const homeOtherH2H = getOtherClubH2H(match.homeTeam, match.awayTeam);
  const awayOtherH2H = getOtherClubH2H(match.awayTeam, match.homeTeam);

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalGoalsSum = 0;
  for (const rec of pairH2H) {
    const isSameOrientation = sameTeam(rec.homeTeam, match.homeTeam);
    const hGoals = isSameOrientation ? rec.homeScore : rec.awayScore;
    const aGoals = isSameOrientation ? rec.awayScore : rec.homeScore;
    totalGoalsSum += hGoals + aGoals;
    if (hGoals > aGoals) homeWins += 1;
    else if (aGoals > hGoals) awayWins += 1;
    else draws += 1;
  }

  const getClubFormSummary = (clubName: string, records: H2HRecord[]) => {
    let w = 0;
    let d = 0;
    let l = 0;
    for (const rec of records) {
      const isHome = sameTeam(rec.homeTeam, clubName);
      const gf = isHome ? rec.homeScore : rec.awayScore;
      const ga = isHome ? rec.awayScore : rec.homeScore;
      if (gf > ga) w += 1;
      else if (gf < ga) l += 1;
      else d += 1;
    }
    return `${w}W · ${d}D · ${l}L`;
  };

  const showMain = activeMarketTab === 'ALL' || activeMarketTab === '1X2';
  const showHalves = activeMarketTab === 'ALL' || activeMarketTab === 'HALVES';
  const showOu = activeMarketTab === 'ALL' || activeMarketTab === 'OU';
  const showScore = activeMarketTab === 'ALL' || activeMarketTab === 'SCORE';
  const showH2H = activeMarketTab === 'H2H';

  const statusText =
    match.status === 'LIVE'
      ? match.isZoom
        ? `${match.elapsedSeconds ?? 1}s/90s LIVE`
        : `${match.minute}'/60' LIVE`
      : match.scheduledTime;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-[#03150b] border-b border-[#00e700]/20 shrink-0">
          <div className="min-w-0">
            <span className="text-[10px] text-zinc-400 font-semibold block truncate">
              {match.league} · Round #{match.roundNumber || 1}
            </span>
            <h3 className="text-xs sm:text-sm font-black text-white truncate">
              {match.homeTeam} vs {match.awayTeam}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                soundManager.playClick();
                setActiveMarketTab(prev => (prev === 'H2H' ? 'ALL' : 'H2H'));
              }}
              className={`px-2.5 py-1.5 min-h-[34px] rounded-lg text-[11px] font-black transition-all flex items-center gap-1 border whitespace-nowrap shrink-0 ${
                activeMarketTab === 'H2H'
                  ? 'bg-[#00ff44] text-black border-white shadow-[0_0_12px_rgba(0,231,0,0.45)]'
                  : 'bg-[#072b19] hover:bg-[#0b3e24] text-[#00e700] border-[#00e700]/40'
              }`}
              title="Head-to-Head History"
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>H2H ({pairH2H.length})</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Close match details"
              className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scoreboard, Pitch & Filter Tabs */}
        <div className="relative bg-gradient-to-b from-[#0a331c] to-[#04160b] px-3 py-2.5 sm:px-4 sm:py-3 border-b border-zinc-800 shrink-0">
          {showH2H ? (
            <div className="flex items-center justify-between gap-2 bg-[#03150b]/85 px-3 py-2 rounded-xl border border-[#00e700]/20">
              <span className="text-xs sm:text-sm font-black text-white truncate flex-1">
                {match.homeTeam}
              </span>
              <div className="flex flex-col items-center shrink-0 px-2">
                <span className="text-sm sm:text-base font-black font-mono text-amber-400 tabular-nums leading-none">
                  {match.homeScore} - {match.awayScore}
                </span>
                <span className="text-[10px] font-semibold text-zinc-400 mt-0.5 whitespace-nowrap">
                  {statusText}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-black text-white truncate flex-1 text-right">
                {match.awayTeam}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2.5 bg-[#03150b]/80 px-3 py-2.5 rounded-xl border border-[#00e700]/20">
                <div className="text-center flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">{match.homeTeam}</span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">{match.homeScore}</span>
                </div>

                <div className="flex flex-col items-center px-2.5 shrink-0">
                  {match.status === 'LIVE' ? (
                    <div className="flex items-center gap-1 text-[11px] font-black text-[#00e700] whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-[#00e700] animate-ping" />
                      <span>{statusText}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap">{match.scheduledTime}</span>
                  )}
                  <span className="text-[10px] text-zinc-400 mt-0.5 whitespace-nowrap">
                    {match.isZoom ? '90s Zoom Sim' : "60' Standard Sim"}
                  </span>
                </div>

                <div className="text-center flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white block truncate">{match.awayTeam}</span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">{match.awayScore}</span>
                </div>
              </div>

              {/* Mini 2D Pitch Graphic */}
              <div className="relative h-16 sm:h-20 bg-[#0d4023] rounded-xl border border-white/25 overflow-hidden flex items-center justify-center p-2 shadow-inner">
                <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/35" />
                <div className="absolute w-11 h-11 rounded-full border border-white/35" />
                <div className="absolute inset-y-2.5 left-0 w-7 border-r border-t border-b border-white/35" />
                <div className="absolute inset-y-2.5 right-0 w-7 border-l border-t border-b border-white/35" />

                <div className="relative z-10 flex items-center gap-1.5 bg-black/75 px-3 py-1 rounded-full text-[10px] font-bold text-white border border-[#00e700]/40 whitespace-nowrap">
                  <Activity className="w-3 h-3 text-[#00e700]" />
                  <span>Possession: {match.stats.possessionHome}% · {match.stats.possessionAway}%</span>
                </div>
              </div>
            </>
          )}

          {/* Market Section Filter */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 mt-2">
            {[
              { id: 'ALL', label: 'All (8)' },
              { id: '1X2', label: 'Main' },
              { id: 'HALVES', label: 'Halves' },
              { id: 'OU', label: 'O/U 15-30' },
              { id: 'SCORE', label: 'C. Score' },
              { id: 'H2H', label: `H2H (${pairH2H.length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  soundManager.playClick();
                  setActiveMarketTab(tab.id as 'ALL' | '1X2' | 'HALVES' | 'OU' | 'SCORE' | 'H2H');
                }}
                className={`py-1.5 px-1.5 rounded-lg text-[10px] sm:text-[11px] font-black transition-all whitespace-nowrap text-center truncate ${
                  activeMarketTab === tab.id
                    ? 'bg-[#00ad3a] text-white shadow-[0_0_10px_rgba(0,231,0,0.3)]'
                    : 'bg-[#03150b] text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
          {/* 1. 1X2 & Main Markets */}
          {showMain && (
            <>
              <div className="bg-[#062416] p-2.5 sm:p-3 rounded-xl border border-[#00e700]/20 space-y-2">
                <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider block">
                  1. 1X2 (High Goals)
                </span>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { label: 'Home & O15', sub: 'Home & O15', odds: match.odds.home },
                    { label: 'Draw', sub: 'Draw', odds: match.odds.draw },
                    { label: 'Away & O15', sub: 'Away & O15', odds: match.odds.away },
                  ].map(opt => {
                    const active = isSelected('1X2', opt.sub);
                    return (
                      <button
                        key={opt.sub}
                        onClick={() => {
                          soundManager.playClick();
                          onToggleSelection(match, '1X2', '1X2', opt.sub, opt.odds);
                        }}
                        className={`py-2 px-1.5 min-h-[44px] rounded-xl text-center transition-all select-none flex flex-col items-center justify-center ${
                          active
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs sm:text-sm font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. 1st Goal (Home or Away) */}
              <div className="bg-[#062416] p-2.5 sm:p-3 rounded-xl border border-[#00e700]/20 space-y-2">
                <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider block">
                  2. 1st Goal
                </span>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {[
                    { label: `Home · ${match.homeTeam}`, sub: 'Home', odds: match.odds.firstGoalHome },
                    { label: `Away · ${match.awayTeam}`, sub: 'Away', odds: match.odds.firstGoalAway },
                  ].map(opt => {
                    const active = isSelected('1st Goal', opt.sub);
                    return (
                      <button
                        key={opt.sub}
                        onClick={() => {
                          soundManager.playClick();
                          onToggleSelection(match, '1st Goal', '1st Goal', opt.sub, opt.odds);
                        }}
                        className={`py-2 px-2 min-h-[44px] rounded-xl text-center transition-all select-none flex flex-col items-center justify-center ${
                          active
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate max-w-full">
                          {opt.label}
                        </span>
                        <span className="text-xs sm:text-sm font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. 5 Minutes Goal */}
              <div className="bg-[#062416] p-2.5 sm:p-3 rounded-xl border border-[#00e700]/20 space-y-2">
                <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider block">
                  3. 5 Minutes Goal
                </span>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { label: 'Yes', sub: 'Yes', odds: match.odds.fiveMinYes },
                    { label: 'No', sub: 'No', odds: match.odds.fiveMinNo },
                    { label: 'Over 5 Goals', sub: 'Over 5 Goals', odds: match.odds.fiveMinOver5 },
                  ].map(opt => {
                    const active = isSelected('5 Min Goal', opt.sub);
                    return (
                      <button
                        key={opt.sub}
                        onClick={() => {
                          soundManager.playClick();
                          onToggleSelection(match, '5 Min Goal', '5 Min Goal', opt.sub, opt.odds);
                        }}
                        className={`py-2 px-1.5 min-h-[44px] rounded-xl text-center transition-all select-none flex flex-col items-center justify-center ${
                          active
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs sm:text-sm font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Odd or Even Total Goals */}
              <div className="bg-[#062416] p-2.5 sm:p-3 rounded-xl border border-[#00e700]/20 space-y-2">
                <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider block">
                  4. Odd or Even (Total Goals)
                </span>
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {[
                    { label: 'Odd', sub: 'Odd', odds: match.odds.oddGoals },
                    { label: 'Even', sub: 'Even', odds: match.odds.evenGoals },
                  ].map(opt => {
                    const active = isSelected('Odd/Even', opt.sub);
                    return (
                      <button
                        key={opt.sub}
                        onClick={() => {
                          soundManager.playClick();
                          onToggleSelection(match, 'Odd/Even', 'Odd/Even', opt.sub, opt.odds);
                        }}
                        className={`py-2 px-2 min-h-[44px] rounded-xl text-center transition-all select-none flex flex-col items-center justify-center ${
                          active
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs sm:text-sm font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 5. 1st Half & 6. 2nd Half */}
          {showHalves && (
            <>
              <div className="bg-[#062416] p-2.5 sm:p-3 rounded-xl border border-[#00e700]/20 space-y-2">
                <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider block">
                  {match.isZoom ? '5. 1st Half (0s - 45s)' : "5. 1st Half (0' - 30')"}
                </span>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { label: 'Home & O10', sub: 'Home & O10', odds: match.odds.ht1Over10 },
                    { label: 'X & O10', sub: 'X & O10', odds: match.odds.htXOver10 },
                    { label: 'Away & O10', sub: 'Away & O10', odds: match.odds.ht2Over10 },
                  ].map(opt => {
                    const active = isSelected('1st Half', opt.sub);
                    return (
                      <button
                        key={opt.sub}
                        onClick={() => {
                          soundManager.playClick();
                          onToggleSelection(match, '1st Half', '1st Half', opt.sub, opt.odds);
                        }}
                        className={`py-2 px-1.5 min-h-[44px] rounded-xl text-center transition-all select-none flex flex-col items-center justify-center ${
                          active
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs sm:text-sm font-black tabular-nums leading-tight mt-0.5">
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
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {[
                      { label: 'Over 15', sub: 'Over 15', odds: match.odds.htOver15 },
                      { label: 'Under 15', sub: 'Under 15', odds: match.odds.htUnder15 },
                    ].map(opt => {
                      const active = isSelected('1st Half O/U 15', opt.sub);
                      return (
                        <button
                          key={opt.sub}
                          onClick={() => {
                            soundManager.playClick();
                            onToggleSelection(match, '1st Half', '1st Half O/U 15', opt.sub, opt.odds);
                          }}
                          className={`py-2 px-2 min-h-[44px] rounded-xl text-center transition-all select-none flex flex-col items-center justify-center ${
                            active
                              ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                              : 'bg-[#08381d] hover:bg-[#0d4d29] border border-[#00e700]/30 text-white'
                          }`}
                        >
                          <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                            {opt.label}
                          </span>
                          <span className="text-xs sm:text-sm font-black tabular-nums leading-tight mt-0.5">
                            {opt.odds.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-[#062416] p-2.5 sm:p-3 rounded-xl border border-[#00e700]/20 space-y-2">
                <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider block">
                  {match.isZoom ? '6. 2nd Half (46s - 90s)' : "6. 2nd Half (31' - 60')"}
                </span>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {[
                    { label: 'Home & O15', sub: 'Home & O15', odds: match.odds.sh1Over15 },
                    { label: 'X & O15', sub: 'X & O15', odds: match.odds.shXOver15 },
                    { label: 'Away & O15', sub: 'Away & O15', odds: match.odds.sh2Over15 },
                  ].map(opt => {
                    const active = isSelected('2nd Half', opt.sub);
                    return (
                      <button
                        key={opt.sub}
                        onClick={() => {
                          soundManager.playClick();
                          onToggleSelection(match, '2nd Half', '2nd Half', opt.sub, opt.odds);
                        }}
                        className={`py-2 px-1.5 min-h-[44px] rounded-xl text-center transition-all select-none flex flex-col items-center justify-center ${
                          active
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight whitespace-nowrap">
                          {opt.label}
                        </span>
                        <span className="text-xs sm:text-sm font-black tabular-nums leading-tight mt-0.5">
                          {opt.odds.toFixed(2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 7. Over & Under 15 to 30 */}
          {showOu && (
            <div className="bg-[#062416] p-2.5 sm:p-3 rounded-xl border border-[#00e700]/20 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider">
                  7. Over &amp; Under (15 - 30)
                </span>
                <span className="text-[10px] font-bold text-[#00e700] whitespace-nowrap">Odds 2.00 - 18.75</span>
              </div>
              <div className="space-y-1.5">
                {(match.odds.overUnderLines || []).map(item => {
                  const mktName = `O/U ${item.line}`;
                  const overSel = `Over ${item.line}`;
                  const underSel = `Under ${item.line}`;
                  const overActive = isSelected(mktName, overSel);
                  const underActive = isSelected(mktName, underSel);

                  return (
                    <div key={item.line} className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <button
                        onClick={() => {
                          soundManager.playClick();
                          onToggleSelection(match, 'Over/Under', mktName, overSel, item.over);
                        }}
                        className={`px-3 py-2 min-h-[42px] rounded-xl flex items-center justify-between transition-all select-none ${
                          overActive
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[11px] font-bold whitespace-nowrap">{overSel}</span>
                        <span className="text-xs sm:text-sm font-black tabular-nums">{item.over.toFixed(2)}</span>
                      </button>

                      <button
                        onClick={() => {
                          soundManager.playClick();
                          onToggleSelection(match, 'Over/Under', mktName, underSel, item.under);
                        }}
                        className={`px-3 py-2 min-h-[42px] rounded-xl flex items-center justify-between transition-all select-none ${
                          underActive
                            ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                            : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                        }`}
                      >
                        <span className="text-[11px] font-bold whitespace-nowrap">{underSel}</span>
                        <span className="text-xs sm:text-sm font-black tabular-nums">{item.under.toFixed(2)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 8. Correct Score: High Goals Bracket */}
          {showScore && (
            <div className="bg-[#062416] p-2.5 sm:p-3 rounded-xl border border-[#00e700]/20 space-y-2">
              <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider block">
                8. Correct Score (High Goals Bracket)
              </span>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {(match.odds.correctScores || []).map(cs => {
                  const active = isSelected('Correct Score', cs.score);
                  return (
                    <button
                      key={cs.score}
                      onClick={() => {
                        soundManager.playClick();
                        onToggleSelection(match, 'Correct Score', 'Correct Score', cs.score, cs.odds);
                      }}
                      className={`py-2 px-1.5 min-h-[44px] rounded-xl text-center transition-all select-none flex flex-col items-center justify-center ${
                        active
                          ? 'bg-[#00ff44] text-black font-black ring-2 ring-white shadow-[0_0_12px_#00e700]'
                          : 'bg-[#00ad3a] hover:bg-[#00c844] text-white'
                      }`}
                    >
                      <span className="text-xs font-black block leading-tight">{cs.score}</span>
                      <span className="text-[11px] font-bold tabular-nums opacity-95 leading-tight mt-0.5">
                        {cs.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 9. Head-to-Head: Direct Meetings First, Individual Club Meetings Underneath (Final Results Only) */}
          {showH2H && (
            <div className="space-y-2.5">
              {/* Section 1: Direct Previous Meetings between these two clubs */}
              <div className="bg-[#062416] p-2.5 rounded-xl border border-[#00e700]/25 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-[#00e700] shrink-0" />
                      <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider truncate">
                        Head-to-Head Meetings
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-semibold block truncate mt-0.5">
                      {match.homeTeam} vs {match.awayTeam} ({pairH2H.length} completed)
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setActiveMarketTab('ALL');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#03150b] hover:bg-[#0b3e24] border border-[#00e700]/30 text-[10px] font-bold text-[#00e700] flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <span>Markets</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* H2H Summary Stats */}
                <div className="grid grid-cols-4 gap-1 text-center bg-[#03150b] p-1.5 rounded-lg border border-zinc-800">
                  <div className="min-w-0">
                    <span className="text-[9px] text-zinc-400 font-bold block truncate">
                      {match.homeTeam}
                    </span>
                    <span className="text-xs font-black text-[#00e700] tabular-nums">{homeWins}W</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-400 font-bold block">Draws</span>
                    <span className="text-xs font-black text-amber-400 tabular-nums">{draws}D</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] text-zinc-400 font-bold block truncate">
                      {match.awayTeam}
                    </span>
                    <span className="text-xs font-black text-cyan-400 tabular-nums">{awayWins}W</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-zinc-400 font-bold block">Avg Goals</span>
                    <span className="text-xs font-black text-white tabular-nums">
                      {pairH2H.length > 0 ? (totalGoalsSum / pairH2H.length).toFixed(1) : '0.0'}
                    </span>
                  </div>
                </div>

                {/* All Previous Direct Meetings (Final Score Only) */}
                <div className="space-y-1.5">
                  {pairH2H.length === 0 ? (
                    <div className="text-center py-2.5 px-3 bg-[#03150b]/70 rounded-lg border border-zinc-800 text-[10px] sm:text-[11px] text-zinc-400">
                      No previous direct meetings recorded yet between {match.homeTeam} and {match.awayTeam}. Final results appear here once a match finishes.
                    </div>
                  ) : (
                    pairH2H.map((rec, idx) => {
                      const isLatestPrevious = idx === 0;
                      const homeWin = rec.homeScore > rec.awayScore;
                      const awayWin = rec.awayScore > rec.homeScore;
                      const isDraw = rec.homeScore === rec.awayScore;
                      const resultText = homeWin
                        ? `${rec.homeTeam} Win`
                        : awayWin
                        ? `${rec.awayTeam} Win`
                        : 'Draw';
                      return (
                        <div
                          key={rec.id}
                          className={`bg-[#03150b] px-2.5 py-1.5 rounded-lg border space-y-1 ${
                            isLatestPrevious ? 'border-[#00e700]/45' : 'border-zinc-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[9.5px] sm:text-[10px] text-zinc-400 font-semibold">
                            <span className="truncate">
                              {formatMatchDateTime(rec.playedAt)} · {rec.isZoom ? 'Zoom' : 'Virtual'} · FT
                            </span>
                            <span
                              className={`shrink-0 font-bold ${
                                isDraw ? 'text-amber-300' : 'text-[#00e700]'
                              }`}
                            >
                              {resultText}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[11px] font-black">
                            <span className={`flex-1 truncate ${homeWin ? 'text-[#00e700]' : 'text-white'}`}>
                              {rec.homeTeam}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[#072616] border border-[#00e700]/30 font-mono text-amber-400 tabular-nums shrink-0">
                              {rec.homeScore} - {rec.awayScore}
                            </span>
                            <span className={`flex-1 truncate text-right ${awayWin ? 'text-[#00e700]' : 'text-white'}`}>
                              {rec.awayTeam}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Section 2: Individual Previous Meetings with Other Clubs (Final Result Only) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider">
                    Previous Meetings vs Other Clubs
                  </span>
                  <span className="text-[9.5px] text-zinc-400 font-semibold">Final Result (FT)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { clubName: match.homeTeam, records: homeOtherH2H },
                    { clubName: match.awayTeam, records: awayOtherH2H },
                  ].map(group => (
                    <div
                      key={group.clubName}
                      className="bg-[#062416] p-2 rounded-xl border border-[#00e700]/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-zinc-800/80">
                        <span className="text-[11px] sm:text-xs font-black text-white truncate">{group.clubName}</span>
                        <span className="text-[10px] font-bold text-[#00e700] tabular-nums shrink-0">
                          {getClubFormSummary(group.clubName, group.records)}
                        </span>
                      </div>

                      {group.records.length === 0 ? (
                        <div className="text-center py-2.5 px-2 bg-[#03150b]/60 rounded-lg border border-zinc-800/80 text-[10px] text-zinc-400">
                          No completed matches against other clubs yet for {group.clubName}.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {group.records.map(rec => {
                            const isClubHome = sameTeam(rec.homeTeam, group.clubName);
                            const clubScore = isClubHome ? rec.homeScore : rec.awayScore;
                            const oppScore = isClubHome ? rec.awayScore : rec.homeScore;
                            const opponent = isClubHome ? rec.awayTeam : rec.homeTeam;
                            const outcome = clubScore > oppScore ? 'W' : clubScore < oppScore ? 'L' : 'D';
                            const outcomeClass =
                              outcome === 'W'
                                ? 'bg-[#00ad3a]/25 text-[#00e700] border-[#00e700]/40'
                                : outcome === 'D'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                : 'bg-red-500/20 text-red-300 border-red-400/40';

                            return (
                              <div
                                key={`${group.clubName}-${rec.id}`}
                                className="bg-[#03150b] px-2 py-1.5 rounded-lg border border-zinc-800/80 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="text-[9.5px] text-zinc-400 font-medium block truncate">
                                    {formatCompactDateTime(rec.playedAt)} · {isClubHome ? 'Home' : 'Away'} · FT
                                  </span>
                                  <span className="text-[11px] font-bold text-zinc-100 block truncate">
                                    {isClubHome ? 'vs' : '@'} {opponent}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-1.5 py-0.5 rounded bg-[#072616] border border-[#00e700]/25 font-mono text-[11px] font-black text-amber-400 tabular-nums">
                                    {clubScore} - {oppScore}
                                  </span>
                                  <span
                                    className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center border ${outcomeClass}`}
                                  >
                                    {outcome}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live Commentary Log (hidden in H2H view so H2H fits cleanly on screen) */}
          {!showH2H && (
            <div className="bg-[#03150b] p-2.5 sm:p-3 rounded-xl border border-zinc-800 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Match Feed</span>
              {match.events.slice(0, 6).map((ev, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-1 border-b border-zinc-800/60 last:border-0">
                  <span className="font-mono text-[10px] font-bold text-amber-400 mt-0.5 shrink-0">
                    {ev.minute}{match.isZoom ? 's' : '\''}
                  </span>
                  <span className="text-zinc-300">{ev.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
