import React, { useState, useEffect } from 'react';
import { FXAsset, FXCategory, FXPosition } from '../types';
import { formatAssetPrice } from './FXBookmakerModal';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { soundManager } from '../services/soundEffects';

interface FXTradingViewProps {
  assets: FXAsset[];
  positions: FXPosition[];
  userBalance: number;
  onSelectAsset: (asset: FXAsset) => void;
}

export const FXTradingView: React.FC<FXTradingViewProps> = ({
  assets,
  positions,
  userBalance,
  onSelectAsset,
}) => {
  const [filterCat, setFilterCat] = useState<'all' | FXCategory | 'positions'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (!positions.some(p => p.status === 'OPEN')) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [positions]);

  const openPositions = positions.filter(p => p.status === 'OPEN');
  const wonPositions = positions.filter(p => p.status === 'WON');

  const forexCount = assets.filter(a => a.category === 'forex').length;
  const bondsCount = assets.filter(a => a.category === 'bonds').length;
  const sharesCount = assets.filter(a => a.category === 'shares').length;

  const filteredAssets = assets.filter(asset => {
    if (filterCat !== 'all' && filterCat !== 'positions' && asset.category !== filterCat) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      asset.symbol.toLowerCase().includes(q) ||
      asset.name.toLowerCase().includes(q) ||
      asset.sector.toLowerCase().includes(q)
    );
  });

  const formatRemaining = (expiresAt: number) => {
    const remSec = Math.max(0, Math.floor((expiresAt - nowTick) / 1000));
    const hrs = Math.floor(remSec / 3600);
    const mins = Math.floor((remSec % 3600) / 60);
    const secs = remSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="px-2.5 sm:px-3 space-y-2.5 pb-4">
      {/* Compact FX Header & Stats */}
      <div className="bg-[#051c10]/95 border border-[#00e700]/25 rounded-xl p-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
            FX, BONDS &amp; SHARES MARKET
          </h3>
          <p className="text-[10px] text-zinc-400 truncate">
            Select any asset to view live chart &amp; predict Rise or Fall (10m · 15m · 20m · 1hr)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-right">
          <div className="bg-[#03150b] border border-zinc-800 rounded-lg px-2 py-1">
            <span className="text-[9px] text-zinc-400 block leading-none">Open</span>
            <span className="text-[11px] font-black text-[#00e700] tabular-nums">{openPositions.length}</span>
          </div>
          <div className="bg-[#03150b] border border-zinc-800 rounded-lg px-2 py-1 hidden sm:block">
            <span className="text-[9px] text-zinc-400 block leading-none">Balance</span>
            <span className="text-[11px] font-black text-white tabular-nums">${userBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Category Filter Strip + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: `All (${assets.length})` },
            { id: 'forex', label: `Forex (${forexCount})` },
            { id: 'bonds', label: `Bonds (${bondsCount})` },
            { id: 'shares', label: `Shares (${sharesCount})` },
            { id: 'positions', label: `Trades (${positions.length})` },
          ].map(tab => {
            const active = filterCat === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundManager.playClick();
                  setFilterCat(tab.id as 'all' | FXCategory | 'positions');
                }}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black whitespace-nowrap border transition-all ${
                  active
                    ? 'bg-[#00ad3a] text-white border-[#00e700] shadow-[0_0_8px_rgba(0,231,0,0.28)]'
                    : 'bg-[#051c10] text-zinc-300 border-zinc-800 hover:border-[#00e700]/40'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {filterCat !== 'positions' && (
          <div className="relative flex-1 sm:max-w-[220px] sm:ml-auto">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter pair, bond, stock..."
              className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-[#051c10] border border-zinc-800 focus:border-[#00e700] text-[11px] text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Positions View OR Live Assets Grid */}
      {filterCat === 'positions' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold px-0.5">
            <span>Active &amp; Settled FX Predictions ({positions.length})</span>
            <span className="text-[#00e700]">Won: {wonPositions.length}</span>
          </div>

          {positions.length === 0 ? (
            <div className="bg-[#051c10]/80 border border-zinc-800 rounded-xl p-6 text-center space-y-2">
              <p className="text-xs font-bold text-white">No FX predictions staked yet</p>
              <p className="text-[10px] text-zinc-400">
                Choose any Forex pair, Bond, or Share to predict Rise or Fall on 10m, 15m, 20m, or 1hr.
              </p>
              <button
                onClick={() => setFilterCat('all')}
                className="px-3 py-1.5 rounded-lg bg-[#00ad3a] text-white text-[11px] font-black"
              >
                Browse Assets
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {positions.map(pos => {
                const liveAsset = assets.find(a => a.id === pos.assetId);
                const livePrice = liveAsset?.price ?? pos.entryPrice;
                const priceMeta = liveAsset || { decimals: 2, unitPrefix: '$', unitSuffix: '' };
                const leading =
                  pos.status === 'OPEN'
                    ? (pos.direction === 'RISE' && livePrice > pos.entryPrice) ||
                      (pos.direction === 'FALL' && livePrice < pos.entryPrice)
                    : pos.status === 'WON';

                return (
                  <div
                    key={pos.id}
                    onClick={() => liveAsset && onSelectAsset(liveAsset)}
                    className="bg-[#051c10]/95 border border-[#00e700]/20 hover:border-[#00e700]/50 rounded-xl p-2.5 space-y-1.5 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-black text-white truncate">{pos.symbol}</span>
                        <span
                          className={`text-[10px] font-black ${
                            pos.direction === 'RISE' ? 'text-[#00e700]' : 'text-red-400'
                          }`}
                        >
                          {pos.direction} · {pos.duration}
                        </span>
                      </div>

                      {pos.status === 'OPEN' ? (
                        <span className="text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatRemaining(pos.expiresAt)}
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-black uppercase shrink-0 ${
                            pos.status === 'WON' ? 'text-[#00e700]' : 'text-red-400'
                          }`}
                        >
                          {pos.status}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono tabular-nums">
                      <span>Entry: {formatAssetPrice(pos.entryPrice, priceMeta)}</span>
                      <span>
                        {pos.status === 'OPEN' ? 'Live' : 'Close'}:{' '}
                        <span className={leading ? 'text-[#00e700] font-bold' : 'text-red-400 font-bold'}>
                          {formatAssetPrice(pos.settlementPrice ?? livePrice, priceMeta)}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-zinc-800/80">
                      <span className="text-zinc-300 font-semibold tabular-nums">
                        Stake: ${pos.stake.toLocaleString()} @{pos.odds.toFixed(2)}x
                      </span>
                      <span className="font-black text-[#00e700] tabular-nums">
                        Return: ${pos.potentialPayout.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-[#051c10]/80 border border-zinc-800 rounded-xl p-6 text-center text-xs text-zinc-400">
          No FX assets matched your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredAssets.map(asset => {
            const pts = asset.history.slice(-24);
            const vals = pts.map(p => p.price);
            const minV = Math.min(...vals);
            const maxV = Math.max(...vals);
            const spanV = maxV - minV || 1;
            const sparkW = 84;
            const sparkH = 28;
            const sparkPoints = pts
              .map((pt, idx) => {
                const x = pts.length <= 1 ? sparkW : (idx / (pts.length - 1)) * sparkW;
                const y = sparkH - ((pt.price - minV) / spanV) * (sparkH - 4) - 2;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');
            const isPositive = asset.changePercent >= 0;
            const lineCol =
              asset.trendDirection === 'RISING'
                ? '#00e700'
                : asset.trendDirection === 'FALLING'
                ? '#f87171'
                : '#fbbf24';

            return (
              <div
                key={asset.id}
                onClick={() => {
                  soundManager.playClick();
                  onSelectAsset(asset);
                }}
                className="bg-[#051c10]/95 border border-[#00e700]/20 hover:border-[#00e700]/60 rounded-xl p-2.5 space-y-2 cursor-pointer transition-all group"
              >
                {/* Row Top: Symbol & Live Price */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-white group-hover:text-[#00e700] transition-colors">
                        {asset.symbol}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-zinc-400">
                        · {asset.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block truncate">{asset.name}</span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-black font-mono text-white tabular-nums block leading-tight">
                      {formatAssetPrice(asset.price, asset)}
                    </span>
                    <span
                      className={`text-[10px] font-black tabular-nums ${
                        isPositive ? 'text-[#00e700]' : 'text-red-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Middle: Mini Live Sparkline & Trend */}
                <div className="flex items-center justify-between gap-2 bg-[#03150b] px-2 py-1.5 rounded-lg border border-zinc-800/80">
                  <div className="flex items-center gap-1 text-[10px] font-bold min-w-0">
                    {asset.trendDirection === 'RISING' ? (
                      <TrendingUp className="w-3 h-3 text-[#00e700] shrink-0" />
                    ) : asset.trendDirection === 'FALLING' ? (
                      <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />
                    ) : (
                      <Minus className="w-3 h-3 text-amber-300 shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        asset.trendDirection === 'RISING'
                          ? 'text-[#00e700]'
                          : asset.trendDirection === 'FALLING'
                          ? 'text-red-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {asset.trendDirection === 'RISING'
                        ? 'Rising'
                        : asset.trendDirection === 'FALLING'
                        ? 'Falling'
                        : 'Flat'}
                    </span>
                  </div>

                  <svg width={sparkW} height={sparkH} className="shrink-0 overflow-visible">
                    <polyline
                      fill="none"
                      stroke={lineCol}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={sparkPoints}
                    />
                  </svg>
                </div>

                {/* Bottom: Compact Metadata & Predict Button */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <span className="text-[9px] text-zinc-400 truncate">
                    {asset.sector}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      soundManager.playClick();
                      onSelectAsset(asset);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#00ad3a] hover:bg-[#00c844] text-white text-[10px] font-black whitespace-nowrap flex items-center gap-0.5 shrink-0"
                  >
                    <span>Trade</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
