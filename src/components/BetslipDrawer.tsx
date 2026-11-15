import React, { useState, useEffect } from 'react';
import { BetSelection, PlacedBet, UserProfile } from '../types';
import { X, Trash2, Zap, CheckCircle2 } from 'lucide-react';
import { soundManager } from '../services/soundEffects';

interface BetslipDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selections: BetSelection[];
  onRemoveSelection: (matchId: string, marketName: string, selection: string) => void;
  onClearAll: () => void;
  user: UserProfile;
  onPlaceBet: (newBet: PlacedBet) => void;
  defaultBetMode?: 'single' | 'accumulator';
  modeSignal?: number;
}

const STANDARD_MIN_STAKE = 30000;
const ZOOM_MIN_STAKE = 3000;

const STANDARD_QUICK_STAKES = [
  { val: 30000, label: '$30k' },
  { val: 50000, label: '$50k' },
  { val: 100000, label: '$100k' },
  { val: 250000, label: '$250k' },
  { val: 500000, label: '$500k' },
];

const ZOOM_QUICK_STAKES = [
  { val: 3000, label: '$3k' },
  { val: 5000, label: '$5k' },
  { val: 10000, label: '$10k' },
  { val: 25000, label: '$25k' },
  { val: 50000, label: '$50k' },
];

export const BetslipDrawer: React.FC<BetslipDrawerProps> = ({
  isOpen,
  onClose,
  selections,
  onRemoveSelection,
  onClearAll,
  user,
  onPlaceBet,
  defaultBetMode = 'single',
  modeSignal = 0
}) => {
  const isZoomSlip = selections.length > 0 && selections.every(s => Boolean(s.isZoom));
  const minStake = isZoomSlip ? ZOOM_MIN_STAKE : STANDARD_MIN_STAKE;
  const quickStakes = isZoomSlip ? ZOOM_QUICK_STAKES : STANDARD_QUICK_STAKES;
  const stepAmount = isZoomSlip ? 1000 : 5000;

  const [betMode, setBetMode] = useState<'single' | 'accumulator'>('single');
  const [stake, setStake] = useState<number>(minStake);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [placedSuccess, setPlacedSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (modeSignal > 0) {
      setBetMode(selections.length >= 2 && defaultBetMode === 'accumulator' ? 'accumulator' : 'single');
    }
  }, [modeSignal, defaultBetMode, selections.length]);

  useEffect(() => {
    if (selections.length < 2 && betMode === 'accumulator') {
      setBetMode('single');
    }
  }, [selections.length, betMode]);

  useEffect(() => {
    if (isZoomSlip) {
      if (stake === STANDARD_MIN_STAKE || stake < ZOOM_MIN_STAKE) {
        setStake(ZOOM_MIN_STAKE);
      }
    } else if (stake < STANDARD_MIN_STAKE) {
      setStake(STANDARD_MIN_STAKE);
    }
    setErrorMsg(null);
  }, [isZoomSlip, isOpen]);

  const totalAccumulatorOdds = Number(
    selections.reduce((acc, s) => acc * s.odds, 1).toFixed(2)
  );

  const potentialReturn = betMode === 'accumulator'
    ? Math.round(stake * totalAccumulatorOdds * 100) / 100
    : Math.round(selections.reduce((sum, s) => sum + stake * s.odds, 0) * 100) / 100;

  const totalRequiredStake = betMode === 'accumulator'
    ? stake
    : stake * selections.length;

  const handleExecuteBet = () => {
    if (selections.length === 0) return;
    setErrorMsg(null);
    if (stake < minStake) {
      setErrorMsg(`Minimum stake is $${minStake.toLocaleString()}.`);
      return;
    }
    if (user.balance < totalRequiredStake) {
      setErrorMsg('Insufficient balance. Please top-up.');
      return;
    }

    setIsSubmitting(true);
    soundManager.playBetPlaced();

    setTimeout(() => {
      const placed: PlacedBet = {
        id: `bet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        type: betMode,
        selections: [...selections],
        stake: totalRequiredStake,
        originalStake: totalRequiredStake,
        liveHalfApplied: false,
        totalOdds: betMode === 'accumulator' ? totalAccumulatorOdds : Number((potentialReturn / (totalRequiredStake || 1)).toFixed(2)),
        potentialPayout: potentialReturn,
        status: 'OPEN',
        cashoutAmount: 0
      };

      onPlaceBet(placed);
      setIsSubmitting(false);
      setPlacedSuccess(true);

      setTimeout(() => {
        setPlacedSuccess(false);
        onClearAll();
        onClose();
      }, 1400);
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-[#051c11] border border-[#00e700]/30 rounded-t-3xl sm:rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-3 bg-[#03150b] border-b border-[#00e700]/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-2">
              <span>BETSLIP</span>
              <span className="w-5 h-5 rounded-full bg-[#00ad3a] text-black text-xs font-black flex items-center justify-center">
                {selections.length}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {selections.length > 0 && (
              <button
                onClick={() => {
                  soundManager.playClick();
                  onClearAll();
                }}
                className="text-[11px] font-bold text-zinc-400 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white bg-zinc-800/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab: Single vs Accumulator */}
        <div className="p-2 bg-[#020e06] border-b border-zinc-800 flex gap-2">
          <button
            onClick={() => {
              soundManager.playClick();
              setBetMode('single');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
              betMode === 'single'
                ? 'bg-[#00ad3a] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Single Bets ({selections.length})
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              setBetMode('accumulator');
            }}
            disabled={selections.length < 2}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
              betMode === 'accumulator'
                ? 'bg-[#00ad3a] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white disabled:opacity-40'
            }`}
          >
            Accumulator ({totalAccumulatorOdds}x)
          </button>
        </div>

        {/* Selections List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[45vh]">
          {placedSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="w-12 h-12 text-[#00e700] mb-2 animate-bounce" />
              <h4 className="text-base font-black text-white">BET PLACED SUCCESSFULLY!</h4>
              <p className="text-xs text-zinc-400 mt-1">Track live Cash Out in &apos;Check Bets&apos;.</p>
            </div>
          ) : selections.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              <p className="mb-2 text-2xl">📋</p>
              <p className="font-bold text-white">Your Betslip is Empty</p>
              <p className="text-[11px] text-zinc-500 mt-1">Tap odds from matches to add picks to your betslip.</p>
            </div>
          ) : (
            selections.map(sel => (
              <div
                key={`${sel.matchId}-${sel.marketName}-${sel.selection}`}
                className="bg-[#062416] border border-[#00e700]/25 rounded-xl p-2.5 relative flex items-center justify-between"
              >
                <div className="min-w-0 pr-3">
                  <span className="text-[10px] text-zinc-400 block truncate font-medium">
                    {sel.matchTitle}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-black text-white">
                      {sel.marketType}: {sel.selection}
                    </span>
                    <span className="text-xs font-black text-[#00e700] tabular-nums">
                      @{sel.odds.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    soundManager.playClick();
                    onRemoveSelection(sel.matchId, sel.marketName, sel.selection);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-950/40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Stake Controls & Potential Payout */}
        {selections.length > 0 && !placedSuccess && (
          <div className="p-3 bg-[#03150b] border-t border-[#00e700]/20 space-y-2.5">
            {/* Stake Label & Minimum Indication */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-400 font-bold">
                Stake · Min: ${minStake.toLocaleString()}
              </span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {quickStakes.map(item => (
                  <button
                    key={item.val}
                    onClick={() => {
                      soundManager.playClick();
                      setStake(item.val);
                      setErrorMsg(null);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      stake === item.val ? 'bg-[#00ad3a] text-white' : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stake Input */}
            <div className="flex items-center bg-[#062416] border border-zinc-700 rounded-xl overflow-hidden p-1">
              <button
                onClick={() => setStake(Math.max(minStake, stake - stepAmount))}
                className="w-8 h-8 rounded bg-zinc-800 text-zinc-200 font-bold hover:text-white shrink-0"
              >
                -
              </button>
              <input
                type="number"
                min={minStake}
                step={1000}
                value={stake}
                onChange={e => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setStake(val);
                  if (val >= minStake) setErrorMsg(null);
                }}
                onBlur={() => {
                  if (stake < minStake) setStake(minStake);
                }}
                className="w-full text-center bg-transparent font-black text-white text-base focus:outline-none tabular-nums"
              />
              <button
                onClick={() => {
                  setStake(stake + stepAmount);
                  setErrorMsg(null);
                }}
                className="w-8 h-8 rounded bg-zinc-800 text-zinc-200 font-bold hover:text-white shrink-0"
              >
                +
              </button>
            </div>

            {/* Payout Summary */}
            <div className="bg-[#020e06] p-2.5 rounded-xl border border-zinc-800/80 space-y-1 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Total Stake:</span>
                <span className="font-bold text-white tabular-nums">${totalRequiredStake.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total Odds:</span>
                <span className="font-bold text-[#00e700] tabular-nums">
                  {betMode === 'accumulator' ? `${totalAccumulatorOdds}x` : 'Multiple'}
                </span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-800">
                <span className="text-white">Est. Return:</span>
                <span className="text-[#00e700] tabular-nums">${potentialReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-950/70 border border-red-600/50 text-red-200 text-xs font-bold p-2 rounded-xl text-center">
                {errorMsg}
              </div>
            )}

            {/* Place Bet Action Button */}
            <button
              onClick={handleExecuteBet}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-sm sm:text-base uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>{isSubmitting ? 'PROCESSING...' : `PLACE BET ($${totalRequiredStake.toLocaleString()})`}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
