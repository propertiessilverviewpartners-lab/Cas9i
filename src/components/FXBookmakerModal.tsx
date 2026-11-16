import React, { useState, useEffect, useMemo } from 'react';
import { FXAsset, FXDuration, FXDirection, FXPosition } from '../types';
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Info,
  CheckCircle2
} from 'lucide-react';
import { soundManager } from '../services/soundEffects';

interface FXBookmakerModalProps {
  asset: FXAsset | null;
  userBalance: number;
  positions: FXPosition[];
  onClose: () => void;
  onPlacePosition: (position: FXPosition) => void;
}

const DURATIONS: Array<{ id: FXDuration; label: string; shortLabel: string; minutes: number }> = [
  { id: '10m', label: '10 Minutes', shortLabel: '10 Min', minutes: 10 },
  { id: '15m', label: '15 Minutes', shortLabel: '15 Min', minutes: 15 },
  { id: '20m', label: '20 Minutes', shortLabel: '20 Min', minutes: 20 },
  { id: '1h', label: '1 Hour', shortLabel: '1 Hr', minutes: 60 },
];

const QUICK_AMOUNTS = [
  { val: 100, label: '$100' },
  { val: 500, label: '$500' },
  { val: 1000, label: '$1k' },
  { val: 5000, label: '$5k' },
  { val: 10000, label: '$10k' },
];

const MIN_FX_STAKE = 10;

export function formatAssetPrice(price: number, asset: Pick<FXAsset, 'decimals' | 'unitPrefix' | 'unitSuffix'>): string {
  const formatted = price.toFixed(asset.decimals);
  return `${asset.unitPrefix || ''}${formatted}${asset.unitSuffix || ''}`;
}

export const FXBookmakerModal: React.FC<FXBookmakerModalProps> = ({
  asset,
  userBalance,
  positions,
  onClose,
  onPlacePosition,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<FXDuration>('10m');
  const [selectedDirection, setSelectedDirection] = useState<FXDirection>('RISE');
  const [amountInput, setAmountInput] = useState<string>('500');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justPlaced, setJustPlaced] = useState<boolean>(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    setErrorMsg(null);
    setJustPlaced(false);
    setHoverIdx(null);
  }, [asset?.id]);

  useEffect(() => {
    if (!asset) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [asset]);

  const assetPositions = useMemo(() => {
    if (!asset) return [];
    return positions.filter(p => p.assetId === asset.id && p.status === 'OPEN').slice(0, 6);
  }, [positions, asset]);

  if (!asset) return null;

  const history = asset.history.length > 1 ? asset.history : [{ time: Date.now(), price: asset.price }];
  const prices = history.map(p => p.price);
  const minVal = Math.min(...prices, asset.openPrice);
  const maxVal = Math.max(...prices, asset.openPrice);
  const span = Math.max(maxVal - minVal, Math.pow(10, -asset.decimals) * 4);
  const padMin = minVal - span * 0.12;
  const padMax = maxVal + span * 0.12;
  const padSpan = padMax - padMin || 1;

  const svgWidth = 420;
  const svgHeight = 148;
  const toX = (idx: number) => (history.length <= 1 ? svgWidth : (idx / (history.length - 1)) * svgWidth);
  const toY = (val: number) => svgHeight - ((val - padMin) / padSpan) * (svgHeight - 16) - 8;

  const pointsStr = history.map((pt, i) => `${toX(i).toFixed(1)},${toY(pt.price).toFixed(1)}`).join(' ');
  const areaStr = `0,${svgHeight} ${pointsStr} ${svgWidth},${svgHeight}`;
  const openY = toY(asset.openPrice);
  const lastPt = history[history.length - 1];
  const lastX = toX(history.length - 1);
  const lastY = toY(lastPt.price);

  const inspectedPt = hoverIdx !== null && history[hoverIdx] ? history[hoverIdx] : lastPt;

  const isPositiveDay = asset.changePercent >= 0;
  const strokeColor =
    asset.trendDirection === 'RISING'
      ? '#00e700'
      : asset.trendDirection === 'FALLING'
      ? '#f87171'
      : '#fbbf24';

  const durationMeta = DURATIONS.find(d => d.id === selectedDuration) || DURATIONS[0];
  const durationOdds = asset.oddsByDuration?.[selectedDuration] || { rise: 1.9, fall: 1.9 };
  const activeOdds = selectedDirection === 'RISE' ? durationOdds.rise : durationOdds.fall;

  const parsedAmount = Math.max(0, Number(amountInput) || 0);
  const potentialReturn = Math.round(parsedAmount * activeOdds * 100) / 100;

  const trendLabel =
    asset.trendDirection === 'RISING'
      ? `Bullish Uptrend (${asset.trendStrength}% momentum)`
      : asset.trendDirection === 'FALLING'
      ? `Bearish Downtrend (${asset.trendStrength}% momentum)`
      : `Sideways Consolidation (${asset.trendStrength}% neutral)`;

  const handleStake = () => {
    setErrorMsg(null);
    if (!Number.isFinite(parsedAmount) || parsedAmount < MIN_FX_STAKE) {
      setErrorMsg(`Minimum stake amount is $${MIN_FX_STAKE}.`);
      return;
    }
    if (parsedAmount > userBalance) {
      setErrorMsg('Insufficient balance for this stake.');
      return;
    }

    const now = Date.now();
    const newPos: FXPosition = {
      id: `fxpos-${now}-${Math.random().toString(36).substring(2, 6)}`,
      assetId: asset.id,
      symbol: asset.symbol,
      assetName: asset.name,
      category: asset.category,
      direction: selectedDirection,
      duration: selectedDuration,
      durationMinutes: durationMeta.minutes,
      entryPrice: asset.price,
      stake: parsedAmount,
      odds: activeOdds,
      potentialPayout: potentialReturn,
      createdAt: now,
      expiresAt: now + durationMeta.minutes * 60 * 1000,
      status: 'OPEN',
    };

    soundManager.playBetPlaced();
    onPlacePosition(newPos);
    setJustPlaced(true);
    setTimeout(() => setJustPlaced(false), 1800);
  };

  const formatCountdown = (expiresAt: number) => {
    const remSec = Math.max(0, Math.floor((expiresAt - nowTick) / 1000));
    const hrs = Math.floor(remSec / 3600);
    const mins = Math.floor((remSec % 3600) / 60);
    const secs = remSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-[#03150b] border-b border-[#00e700]/20 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-semibold truncate">
              <span className="uppercase text-[#00e700] font-black">{asset.category}</span>
              <span>·</span>
              <span className="truncate">{asset.sector}</span>
              <span>·</span>
              <span className="truncate">{asset.region}</span>
            </div>
            <h3 className="text-xs sm:text-sm font-black text-white truncate">
              {asset.symbol} — {asset.name}
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Close FX asset bookmaker"
            className="p-1.5 min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
          {/* Live Price & Trending Strip */}
          <div className="bg-[#03150b] border border-[#00e700]/20 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] text-zinc-400 font-semibold block">Live Market Price</span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg sm:text-xl font-black font-mono text-white tabular-nums">
                  {formatAssetPrice(asset.price, asset)}
                </span>
                <span
                  className={`text-[11px] font-black tabular-nums ${
                    isPositiveDay ? 'text-[#00e700]' : 'text-red-400'
                  }`}
                >
                  {isPositiveDay ? '+' : ''}{asset.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-zinc-400 font-semibold block">Current Trend</span>
              <div
                className={`inline-flex items-center gap-1 text-[11px] font-black ${
                  asset.trendDirection === 'RISING'
                    ? 'text-[#00e700]'
                    : asset.trendDirection === 'FALLING'
                    ? 'text-red-400'
                    : 'text-amber-300'
                }`}
              >
                {asset.trendDirection === 'RISING' ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : asset.trendDirection === 'FALLING' ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>
                  {asset.trendDirection === 'RISING'
                    ? 'Trending Up'
                    : asset.trendDirection === 'FALLING'
                    ? 'Trending Down'
                    : 'Consolidating'}
                </span>
              </div>
            </div>
          </div>

          {/* Live Interactive Trend Chart */}
          <div className="bg-[#03150b] border border-zinc-800 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-semibold">
              <span>Live Price &amp; Trend Chart</span>
              <span className="font-mono text-zinc-200 tabular-nums">
                {new Date(inspectedPt.time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}{' '}
                · {formatAssetPrice(inspectedPt.price, asset)}
              </span>
            </div>

            <div className="relative w-full h-32 sm:h-36 bg-[#020d07] rounded-lg border border-zinc-800/80 overflow-hidden">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="none"
                className="w-full h-full cursor-crosshair"
                onMouseLeave={() => setHoverIdx(null)}
                onMouseMove={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1)));
                  const idx = Math.round(relX * (history.length - 1));
                  setHoverIdx(idx);
                }}
              >
                <defs>
                  <linearGradient id={`fxGrad-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid & Open Reference */}
                <line
                  x1="0"
                  y1={openY}
                  x2={svgWidth}
                  y2={openY}
                  stroke="#71717a"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                  opacity="0.55"
                />

                {/* Area Fill */}
                <polygon points={areaStr} fill={`url(#fxGrad-${asset.id})`} />

                {/* Trend Line */}
                <polyline
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={pointsStr}
                />

                {/* Hover Crosshair */}
                {hoverIdx !== null && history[hoverIdx] && (
                  <line
                    x1={toX(hoverIdx)}
                    y1="0"
                    x2={toX(hoverIdx)}
                    y2={svgHeight}
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.5"
                  />
                )}

                {/* Current Price Marker */}
                <circle cx={lastX} cy={lastY} r="3.5" fill={strokeColor} stroke="#03150b" strokeWidth="1.5" />
              </svg>

              <div className="absolute top-1.5 left-2 text-[9px] font-mono text-zinc-400 pointer-events-none">
                H: {formatAssetPrice(maxVal, asset)}
              </div>
              <div className="absolute bottom-1.5 left-2 text-[9px] font-mono text-zinc-400 pointer-events-none">
                L: {formatAssetPrice(minVal, asset)}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>{trendLabel}</span>
              <span className="font-mono tabular-nums">Open: {formatAssetPrice(asset.openPrice, asset)}</span>
            </div>
          </div>

          {/* Bookmaker Rise / Fall Prediction Panel */}
          <div className="bg-[#062416] border border-[#00e700]/25 rounded-xl p-2.5 sm:p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider">
                Predict Direction &amp; Expiry
              </span>
              <span className="text-[10px] text-zinc-300 font-semibold tabular-nums">
                Balance: <span className="text-[#00e700] font-black">${userBalance.toLocaleString()}</span>
              </span>
            </div>

            {/* Duration Selection: 10m, 15m, 20m, 1hr */}
            <div>
              <span className="text-[10px] text-zinc-400 font-bold block mb-1">
                Select Timeframe
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {DURATIONS.map(dur => {
                  const active = selectedDuration === dur.id;
                  const pairOdds = asset.oddsByDuration?.[dur.id] || { rise: 1.9, fall: 1.9 };
                  return (
                    <button
                      key={dur.id}
                      onClick={() => {
                        soundManager.playClick();
                        setSelectedDuration(dur.id);
                      }}
                      className={`py-1.5 px-1 min-h-[42px] rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                        active
                          ? 'bg-[#00ad3a] border-[#00ff44] text-white shadow-[0_0_10px_rgba(0,231,0,0.3)]'
                          : 'bg-[#03150b] border-zinc-800 text-zinc-300 hover:border-[#00e700]/40'
                      }`}
                    >
                      <span className="text-[10px] sm:text-[11px] font-black whitespace-nowrap leading-tight">
                        {dur.shortLabel}
                      </span>
                      <span className="text-[9px] font-mono opacity-85 tabular-nums mt-0.5">
                        {pairOdds.rise.toFixed(2)}x
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rise or Fall Selection */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  soundManager.playClick();
                  setSelectedDirection('RISE');
                }}
                className={`py-2 px-2.5 min-h-[46px] rounded-xl border transition-all flex items-center justify-between ${
                  selectedDirection === 'RISE'
                    ? 'bg-[#00ff44] text-black border-white font-black shadow-[0_0_14px_rgba(0,231,0,0.45)]'
                    : 'bg-[#08381d] hover:bg-[#0d4d29] border-[#00e700]/30 text-white font-bold'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  <span>RISE</span>
                </span>
                <span className="text-xs sm:text-sm font-black font-mono tabular-nums">
                  {durationOdds.rise.toFixed(2)}x
                </span>
              </button>

              <button
                onClick={() => {
                  soundManager.playClick();
                  setSelectedDirection('FALL');
                }}
                className={`py-2 px-2.5 min-h-[46px] rounded-xl border transition-all flex items-center justify-between ${
                  selectedDirection === 'FALL'
                    ? 'bg-red-500 text-white border-white font-black shadow-[0_0_14px_rgba(239,68,68,0.45)]'
                    : 'bg-[#2a0d12] hover:bg-[#3d1219] border-red-500/35 text-red-200 font-bold'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <TrendingDown className="w-4 h-4 shrink-0" />
                  <span>FALL</span>
                </span>
                <span className="text-xs sm:text-sm font-black font-mono tabular-nums">
                  {durationOdds.fall.toFixed(2)}x
                </span>
              </button>
            </div>

            {/* Amount Input Box + Quick Amount Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] text-zinc-300 font-bold whitespace-nowrap">
                  Stake Amount (Min ${MIN_FX_STAKE})
                </label>
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {QUICK_AMOUNTS.map(chip => (
                    <button
                      key={chip.val}
                      onClick={() => {
                        soundManager.playClick();
                        setAmountInput(String(chip.val));
                        setErrorMsg(null);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                        parsedAmount === chip.val
                          ? 'bg-[#00ad3a] text-white'
                          : 'bg-[#03150b] text-zinc-300 border border-zinc-800 hover:border-[#00e700]/40'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center bg-[#03150b] border border-zinc-700 focus-within:border-[#00e700] rounded-xl px-2.5 h-10">
                  <span className="text-xs font-black text-zinc-400 mr-1.5">$</span>
                  <input
                    type="number"
                    min={MIN_FX_STAKE}
                    step={10}
                    value={amountInput}
                    onChange={e => {
                      setAmountInput(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Enter stake amount"
                    className="w-full bg-transparent text-xs sm:text-sm font-black text-white focus:outline-none tabular-nums"
                  />
                </div>

                <div className="bg-[#03150b] border border-zinc-800 rounded-xl px-2.5 h-10 flex flex-col justify-center shrink-0 min-w-[104px]">
                  <span className="text-[9px] text-zinc-400 font-semibold leading-none">Est. Return</span>
                  <span className="text-xs font-black text-[#00e700] tabular-nums leading-tight mt-0.5">
                    ${potentialReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-950/75 border border-red-500/50 text-red-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-center">
                {errorMsg}
              </div>
            )}

            {justPlaced && (
              <div className="bg-[#08381d] border border-[#00e700]/50 text-[#00e700] text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Staked ${parsedAmount.toLocaleString()} on {asset.symbol} {selectedDirection} ({durationMeta.shortLabel})
                </span>
              </div>
            )}

            {/* Stake Button */}
            <button
              onClick={handleStake}
              className={`w-full h-11 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                selectedDirection === 'RISE'
                  ? 'bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black shadow-[0_0_16px_rgba(0,231,0,0.35)]'
                  : 'bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)]'
              }`}
            >
              {selectedDirection === 'RISE' ? (
                <TrendingUp className="w-4 h-4 shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 shrink-0" />
              )}
              <span>
                STAKE {selectedDirection} · {durationMeta.shortLabel} (${parsedAmount.toLocaleString()})
              </span>
            </button>
          </div>

          {/* Asset Bookmaker Information Card */}
          <div className="bg-[#03150b] border border-zinc-800 rounded-xl p-2.5 sm:p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#00e700] shrink-0" />
              <span className="text-[11px] font-black text-white uppercase tracking-wider">
                About {asset.symbol}
              </span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">{asset.description}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[10px]">
              <div className="bg-[#062416]/70 px-2 py-1.5 rounded-lg border border-zinc-800/80">
                <span className="text-zinc-400 block">24h High</span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {formatAssetPrice(asset.high24h, asset)}
                </span>
              </div>
              <div className="bg-[#062416]/70 px-2 py-1.5 rounded-lg border border-zinc-800/80">
                <span className="text-zinc-400 block">24h Low</span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {formatAssetPrice(asset.low24h, asset)}
                </span>
              </div>
              <div className="bg-[#062416]/70 px-2 py-1.5 rounded-lg border border-zinc-800/80">
                <span className="text-zinc-400 block">Spread</span>
                <span className="font-mono font-bold text-[#00e700]">{asset.spread}</span>
              </div>
              <div className="bg-[#062416]/70 px-2 py-1.5 rounded-lg border border-zinc-800/80">
                <span className="text-zinc-400 block">Profile</span>
                <span className="font-bold text-amber-300 truncate block">
                  {asset.yieldOrDividend || asset.volatilityLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Active & Recent Stakes on this Asset */}
          {assetPositions.length > 0 && (
            <div className="bg-[#03150b] border border-zinc-800 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold">
                <span className="uppercase">Your {asset.symbol} Predictions</span>
                <span>{assetPositions.filter(p => p.status === 'OPEN').length} Open</span>
              </div>
              <div className="space-y-1.5">
                {assetPositions.map(pos => {
                  const isWinningNow =
                    pos.status === 'OPEN'
                      ? (pos.direction === 'RISE' && asset.price > pos.entryPrice) ||
                        (pos.direction === 'FALL' && asset.price < pos.entryPrice)
                      : pos.status === 'WON';

                  return (
                    <div
                      key={pos.id}
                      className="bg-[#062416]/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 text-[10px]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-black text-white">
                          <span className={pos.direction === 'RISE' ? 'text-[#00e700]' : 'text-red-400'}>
                            {pos.direction}
                          </span>
                          <span>· {pos.duration}</span>
                          <span className="text-zinc-400 font-mono">
                            @{formatAssetPrice(pos.entryPrice, asset)}
                          </span>
                        </div>
                        <span className="text-zinc-400">
                          Stake ${pos.stake.toLocaleString()} → ${pos.potentialPayout.toLocaleString()}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        {pos.status === 'OPEN' ? (
                          <>
                            <span className="font-mono font-bold text-amber-300 flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3" />
                              {formatCountdown(pos.expiresAt)}
                            </span>
                            <span className={`font-bold ${isWinningNow ? 'text-[#00e700]' : 'text-red-400'}`}>
                              {isWinningNow ? 'Leading' : 'Trailing'}
                            </span>
                          </>
                        ) : (
                          <span
                            className={`font-black uppercase ${
                              pos.status === 'WON' ? 'text-[#00e700]' : 'text-red-400'
                            }`}
                          >
                            {pos.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
