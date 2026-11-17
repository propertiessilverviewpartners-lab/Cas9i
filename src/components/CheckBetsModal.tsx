import React, { useState, useEffect } from 'react';
import { PlacedBet, FXPosition, FXAsset } from '../types';
import { X, DollarSign, Clock } from 'lucide-react';
import { soundManager } from '../services/soundEffects';
import { formatAssetPrice } from './FXBookmakerModal';

interface CheckBetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bets: PlacedBet[];
  fxPositions?: FXPosition[];
  fxAssets?: FXAsset[];
  onCashoutBet: (betId: string, amount: number) => void;
}

type SettledEntry =
  | { kind: 'SOCCER'; sortTime: number; bet: PlacedBet }
  | { kind: 'FX'; sortTime: number; pos: FXPosition };

export const CheckBetsModal: React.FC<CheckBetsModalProps> = ({
  isOpen,
  onClose,
  bets,
  fxPositions = [],
  fxAssets = [],
  onCashoutBet
}) => {
  const [activeTab, setActiveTab] = useState<'OPEN' | 'SETTLED' | 'FX'>('OPEN');
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    if (!isOpen || !fxPositions.some(p => p.status === 'OPEN')) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isOpen, fxPositions]);

  if (!isOpen) return null;

  const openBets = bets.filter(b => b.status === 'OPEN');
  const openFxPositions = fxPositions.filter(p => p.status === 'OPEN');

  const settledBets = bets.filter(b => b.status !== 'OPEN');
  const settledFxPositions = fxPositions.filter(p => p.status !== 'OPEN');

  const settledItems: SettledEntry[] = [
    ...settledBets.map(bet => ({
      kind: 'SOCCER' as const,
      sortTime: bet.settledAt ?? bet.timestamp,
      bet
    })),
    ...settledFxPositions.map(pos => ({
      kind: 'FX' as const,
      sortTime: pos.settledAt ?? pos.expiresAt ?? pos.createdAt,
      pos
    }))
  ].sort((a, b) => b.sortTime - a.sortTime);

  const formatRemaining = (expiresAt: number) => {
    const remSec = Math.max(0, Math.floor((expiresAt - nowTick) / 1000));
    const hrs = Math.floor(remSec / 3600);
    const mins = Math.floor((remSec % 3600) / 60);
    const secs = remSec % 60;
    if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}m`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧾</span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                MY BETS &amp; CASHOUT
              </h3>
              <span className="text-[10px] text-zinc-400">Track live tickets, FX trades, and settled results</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Live (Soccer) vs Settled (Soccer + FX) vs FX Trades (Open FX) */}
        <div className="p-2 bg-[#020e06] border-b border-zinc-800 grid grid-cols-3 gap-1.5">
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('OPEN');
            }}
            className={`py-1.5 rounded-lg text-[11px] font-black transition-all whitespace-nowrap ${
              activeTab === 'OPEN'
                ? 'bg-[#00ad3a] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Live ({openBets.length})
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('SETTLED');
            }}
            className={`py-1.5 rounded-lg text-[11px] font-black transition-all whitespace-nowrap ${
              activeTab === 'SETTLED'
                ? 'bg-[#00ad3a] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Settled ({settledItems.length})
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab('FX');
            }}
            className={`py-1.5 rounded-lg text-[11px] font-black transition-all whitespace-nowrap ${
              activeTab === 'FX'
                ? 'bg-[#00ad3a] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            FX ({openFxPositions.length})
          </button>
        </div>

        {/* Bets List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activeTab === 'FX' ? (
            openFxPositions.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                <p className="text-3xl mb-2">📈</p>
                <p className="font-bold text-white">No live FX predictions</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Open FX predictions appear here until settled, then move to Settled.
                </p>
              </div>
            ) : (
              openFxPositions.map(pos => {
                const liveAsset = fxAssets.find(a => a.id === pos.assetId);
                const livePrice = liveAsset?.price ?? pos.entryPrice;
                const priceMeta = liveAsset || { decimals: 2, unitPrefix: '$', unitSuffix: '' };
                const leading =
                  (pos.direction === 'RISE' && livePrice > pos.entryPrice) ||
                  (pos.direction === 'FALL' && livePrice < pos.entryPrice);

                return (
                  <div
                    key={pos.id}
                    className="bg-[#062416] border border-[#00e700]/25 rounded-xl p-3 space-y-2 shadow-md"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white">{pos.symbol}</span>
                        <span className={`font-black ${pos.direction === 'RISE' ? 'text-[#00e700]' : 'text-red-400'}`}>
                          {pos.direction} · {pos.duration}
                        </span>
                      </div>

                      <span className="font-mono text-[10px] font-bold text-amber-300 flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {formatRemaining(pos.expiresAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-[#03150b] px-2.5 py-2 rounded-lg border border-zinc-800 text-[11px] font-mono tabular-nums">
                      <span className="text-zinc-400">Entry: {formatAssetPrice(pos.entryPrice, priceMeta)}</span>
                      <span className={leading ? 'text-[#00e700] font-bold' : 'text-red-400 font-bold'}>
                        Live: {formatAssetPrice(livePrice, priceMeta)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800">
                      <div className="text-zinc-400">
                        Stake: <span className="font-bold text-white tabular-nums">${pos.stake.toLocaleString()}</span>
                      </div>
                      <div className="text-zinc-400">
                        Return: <span className="font-bold text-[#00e700] tabular-nums">${pos.potentialPayout.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : activeTab === 'SETTLED' ? (
            settledItems.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-xs">
                <p className="text-3xl mb-2">🎫</p>
                <p className="font-bold text-white">No settled bets found</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Completed soccer bets and FX predictions appear here once settled.
                </p>
              </div>
            ) : (
              settledItems.map(item => {
                if (item.kind === 'FX') {
                  const pos = item.pos;
                  const liveAsset = fxAssets.find(a => a.id === pos.assetId);
                  const priceMeta = liveAsset || { decimals: 2, unitPrefix: '$', unitSuffix: '' };
                  const isWin = pos.status === 'WON';
                  const credited = isWin ? pos.potentialPayout : 0;

                  return (
                    <div
                      key={pos.id}
                      className="bg-[#062416] border border-[#00e700]/25 rounded-xl p-3 space-y-2 shadow-md"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-zinc-800 text-[#00e700] px-1.5 py-0.5 rounded font-black uppercase">
                            FX
                          </span>
                          <span className="font-black text-white">{pos.symbol}</span>
                          <span className={`font-black ${pos.direction === 'RISE' ? 'text-[#00e700]' : 'text-red-400'}`}>
                            {pos.direction} · {pos.duration}
                          </span>
                        </div>

                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isWin
                              ? 'bg-amber-900/60 text-amber-400 border border-amber-500/40'
                              : 'bg-red-900/60 text-red-400 border border-red-500/40'
                          }`}
                        >
                          {pos.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-[#03150b] px-2.5 py-2 rounded-lg border border-zinc-800 text-[11px] font-mono tabular-nums">
                        <span className="text-zinc-400">Entry: {formatAssetPrice(pos.entryPrice, priceMeta)}</span>
                        <span className={isWin ? 'text-[#00e700] font-bold' : 'text-red-400 font-bold'}>
                          Close: {formatAssetPrice(pos.settlementPrice ?? pos.entryPrice, priceMeta)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800">
                        <div className="text-zinc-400">
                          Stake: <span className="font-bold text-white tabular-nums">${pos.stake.toLocaleString()}</span>
                        </div>
                        <div className="text-zinc-400">
                          {isWin ? 'Credited: ' : 'Payout: '}
                          <span className={`font-bold tabular-nums ${isWin ? 'text-[#00e700]' : 'text-zinc-500'}`}>
                            ${credited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                const bet = item.bet;
                const credited =
                  bet.status === 'WON'
                    ? bet.potentialPayout
                    : bet.status === 'CASHED_OUT'
                    ? bet.cashoutAmount
                    : 0;

                return (
                  <div
                    key={bet.id}
                    className="bg-[#062416] border border-[#00e700]/25 rounded-xl p-3 space-y-2.5 shadow-md"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-zinc-400 font-bold">
                          #{bet.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-black uppercase">
                          {bet.type}
                        </span>
                      </div>

                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        bet.status === 'WON'
                          ? 'bg-amber-900/60 text-amber-400 border border-amber-500/40'
                          : bet.status === 'CASHED_OUT'
                          ? 'bg-blue-900/60 text-blue-400 border border-blue-500/40'
                          : 'bg-red-900/60 text-red-400 border border-red-500/40'
                      }`}>
                        {bet.status}
                      </span>
                    </div>

                    <div className="space-y-1 bg-[#03150b] p-2 rounded-lg border border-zinc-800">
                      {bet.selections.map((sel, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="truncate pr-2">
                            <span className="text-zinc-400 text-[10px] block truncate">{sel.matchTitle}</span>
                            <span className="font-bold text-white">{sel.marketType}: {sel.selection}</span>
                          </div>
                          <span className="font-mono font-bold text-[#00e700] tabular-nums">
                            @{sel.odds.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800">
                      <div className="text-zinc-400">
                        Stake: <span className="font-bold text-white tabular-nums">${(bet.originalStake ?? bet.stake).toFixed(2)}</span>
                      </div>
                      <div className="text-zinc-400">
                        {bet.status === 'LOST' ? 'Payout: ' : 'Credited: '}
                        <span className={`font-bold tabular-nums ${bet.status === 'LOST' ? 'text-zinc-500' : 'text-[#00e700]'}`}>
                          ${credited.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          ) : openBets.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              <p className="text-3xl mb-2">🎫</p>
              <p className="font-bold text-white">No live bets found</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Place bets on sports or virtuals to track them live here.
              </p>
            </div>
          ) : (
            openBets.map(bet => (
              <div
                key={bet.id}
                className="bg-[#062416] border border-[#00e700]/25 rounded-xl p-3 space-y-2.5 shadow-md"
              >
                {/* Bet Header */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-zinc-400 font-bold">
                      #{bet.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-black uppercase">
                      {bet.type}
                    </span>
                  </div>

                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-900/60 text-[#00e700] border border-emerald-500/40">
                    {bet.status}
                  </span>
                </div>

                {/* Selections */}
                <div className="space-y-1 bg-[#03150b] p-2 rounded-lg border border-zinc-800">
                  {bet.selections.map((sel, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="truncate pr-2">
                        <span className="text-zinc-400 text-[10px] block truncate">{sel.matchTitle}</span>
                        <span className="font-bold text-white">{sel.marketType}: {sel.selection}</span>
                      </div>
                      <span className="font-mono font-bold text-[#00e700] tabular-nums">
                        @{sel.odds.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Stake & Returns */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800">
                  <div className="text-zinc-400">
                    Stake: <span className="font-bold text-white tabular-nums">${bet.stake.toFixed(2)}</span>
                  </div>
                  <div className="text-zinc-400">
                    Payout: <span className="font-bold text-[#00e700] tabular-nums">${bet.potentialPayout.toFixed(2)}</span>
                  </div>
                </div>

                {/* Live Cash Out Button (only offered when winning >= 80% / complete win) */}
                {bet.status === 'OPEN' && bet.cashoutAmount > 0 && (
                  <button
                    onClick={() => {
                      soundManager.playCashout();
                      onCashoutBet(bet.id, bet.cashoutAmount);
                    }}
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-95 transition-all"
                  >
                    <DollarSign className="w-3.5 h-3.5 fill-black" />
                    <span>CASH OUT NOW (${bet.cashoutAmount.toFixed(2)})</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
