import React, { useState } from 'react';
import { LeaderboardEntry, LiveBetTickerItem, UserProfile } from '../types';
import { Trophy, Flame, Zap, ArrowUpRight, Award, Crown, Star, Clock } from 'lucide-react';
import { soundManager } from '../services/soundEffects';

interface LeaderboardViewProps {
  leaderboard: LeaderboardEntry[];
  ticker: LiveBetTickerItem[];
  user: UserProfile;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  leaderboard,
  ticker,
  user
}) => {
  const [timeframe, setTimeframe] = useState<'24h' | 'weekly' | 'alltime'>('24h');
  const [activeTab, setActiveTab] = useState<'ranking' | 'liveticker'>('ranking');

  return (
    <div className="space-y-3 pb-24 px-3 pt-2">
      {/* Header and Live Sync Indicator */}
      <div className="flex items-center justify-between border-b border-[#00e700]/20 pb-2">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Live Leaderboard</span>
          </h2>
          <span className="text-[11px] text-zinc-400">Real-time player profits &amp; high multipliers</span>
        </div>

        {/* Low-Latency Sync Badge */}
        <div className="flex items-center gap-1.5 bg-[#072514] border border-[#00e700]/40 rounded-full px-2.5 py-1 text-[10px] font-bold text-[#00e700]">
          <span className="w-2 h-2 rounded-full bg-[#00e700] animate-ping" />
          <span>LIVE SYNC</span>
        </div>
      </div>

      {/* View Switcher: Leaderboard vs Live Bets Ticker */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-[#051c10] p-1 rounded-xl border border-[#00e700]/25">
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('ranking');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              activeTab === 'ranking'
                ? 'bg-[#00ad3a] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Rankings
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('liveticker');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
              activeTab === 'liveticker'
                ? 'bg-[#00ad3a] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Live Ticker</span>
          </button>
        </div>

        {activeTab === 'ranking' && (
          <div className="flex items-center gap-1 text-[11px] font-bold">
            {(['24h', 'weekly', 'alltime'] as const).map(t => (
              <button
                key={t}
                onClick={() => {
                  soundManager.playClick();
                  setTimeframe(t);
                }}
                className={`px-2 py-1 rounded-md transition-colors ${
                  timeframe === t ? 'text-[#00e700] bg-[#072414] border border-[#00e700]/40' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t === '24h' ? 'Today' : t === 'weekly' ? 'Weekly' : 'All-Time'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top 3 Podium Cards */}
      {activeTab === 'ranking' && (
        <div className="grid grid-cols-3 gap-2">
          {leaderboard.slice(0, 3).map((entry, idx) => {
            const isFirst = idx === 0;
            return (
              <div
                key={entry.id}
                className={`relative rounded-xl p-2.5 flex flex-col items-center text-center border transition-all ${
                  isFirst
                    ? 'bg-gradient-to-b from-[#144827] via-[#092817] to-[#04160b] border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] order-2 sm:order-2'
                    : idx === 1
                    ? 'bg-[#062416] border-zinc-500/60 order-1 sm:order-1'
                    : 'bg-[#062416] border-amber-700/60 order-3 sm:order-3'
                }`}
              >
                <div className="relative mb-1">
                  <span className="text-2xl sm:text-3xl">{entry.avatar}</span>
                  <div
                    className={`absolute -top-1 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black ${
                      isFirst ? 'bg-amber-400' : idx === 1 ? 'bg-zinc-300' : 'bg-amber-600'
                    }`}
                  >
                    {idx + 1}
                  </div>
                </div>

                <span className="text-xs font-black text-white truncate max-w-full">
                  {entry.username}
                </span>

                <span className="text-xs sm:text-sm font-black text-[#00e700] tabular-nums mt-0.5">
                  +${entry.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>

                <span className="text-[10px] text-zinc-400 mt-0.5">
                  {entry.winRate}% Win
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Leaderboard Table */}
      {activeTab === 'ranking' && (
        <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl overflow-hidden shadow-lg">
          <div className="px-3 py-2 bg-[#020e06] text-[10px] font-bold text-zinc-400 grid grid-cols-12 gap-1 uppercase tracking-wider">
            <span className="col-span-2">Rank</span>
            <span className="col-span-5">Player</span>
            <span className="col-span-3 text-right">Profit</span>
            <span className="col-span-2 text-right">Recent</span>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {leaderboard.map(entry => {
              const isCurrentUser = entry.isUser;
              return (
                <div
                  key={entry.id}
                  className={`px-3 py-2.5 grid grid-cols-12 gap-1 items-center transition-colors ${
                    isCurrentUser
                      ? 'bg-[#00ad3a]/20 border-l-4 border-l-[#00e700] font-bold'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="col-span-2 flex items-center gap-1">
                    {entry.rank <= 3 ? (
                      <Crown className={`w-3.5 h-3.5 ${
                        entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-zinc-300' : 'text-amber-600'
                      }`} />
                    ) : null}
                    <span className="text-xs font-black text-zinc-300 tabular-nums">
                      #{entry.rank}
                    </span>
                  </div>

                  <div className="col-span-5 flex items-center gap-1.5 min-w-0">
                    <span className="text-sm shrink-0">{entry.avatar}</span>
                    <span className={`text-xs truncate ${isCurrentUser ? 'text-[#00e700] font-black' : 'text-white'}`}>
                      {entry.username} {isCurrentUser ? '(You)' : ''}
                    </span>
                  </div>

                  <div className="col-span-3 text-right">
                    <span className="text-xs font-black text-[#00e700] tabular-nums block">
                      +${entry.totalProfit.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-zinc-400 tabular-nums">
                      {entry.winRate}% win
                    </span>
                  </div>

                  <div className="col-span-2 text-right">
                    <span className="text-[10px] font-bold text-amber-300 block truncate">
                      {entry.recentWin.game}
                    </span>
                    <span className="text-[9px] text-zinc-400 block tabular-nums">
                      {entry.recentWin.multiplier}x
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Bets Ticker Tab */}
      {activeTab === 'liveticker' && (
        <div className="space-y-2">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between px-1">
            <span>Streaming low-latency betting feed</span>
            <span className="text-[#00e700] font-bold">Auto-Sync 1.5s</span>
          </div>

          <div className="space-y-1.5">
            {ticker.map(item => (
              <div
                key={item.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                  item.isWin
                    ? 'bg-[#062416]/90 border-[#00e700]/30 shadow-[0_0_10px_rgba(0,231,0,0.1)]'
                    : 'bg-[#150a0a]/90 border-red-900/30'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{item.avatar}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white truncate">
                        {item.username}
                      </span>
                      <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded font-bold">
                        {item.gameOrMatch}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      Bet ${item.betAmount.toFixed(2)} @ {item.multiplier}x
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {item.isWin ? (
                    <div>
                      <span className="text-xs sm:text-sm font-black text-[#00e700] tabular-nums block">
                        +${item.payout.toFixed(2)}
                      </span>
                      <span className="text-[9px] text-emerald-400/80 font-bold uppercase">
                        CASHED OUT
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-bold text-red-400 tabular-nums block">
                        -${item.betAmount.toFixed(2)}
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase">
                        CLOSED
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
