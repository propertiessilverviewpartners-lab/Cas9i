import React, { useState } from 'react';
import { soundManager } from '../../services/soundEffects';
import confetti from 'canvas-confetti';
import { X, Trophy, Volume2, VolumeX, ShieldCheck } from 'lucide-react';

interface PenaltyGameProps {
  onClose: () => void;
  userBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  onRecordWin: (amount: number, multiplier: number, game: string) => void;
}

type TargetZone = 'TL' | 'TR' | 'BL' | 'BR' | 'CTR';

interface ZoneConfig {
  id: TargetZone;
  label: string;
  mult: number;
  positionClass: string;
}

const ZONES: ZoneConfig[] = [
  { id: 'TL', label: 'Top Left', mult: 2.40, positionClass: 'top-3 left-4' },
  { id: 'CTR', label: 'Roof/Center', mult: 3.80, positionClass: 'top-3 left-1/2 -translate-x-1/2' },
  { id: 'TR', label: 'Top Right', mult: 2.40, positionClass: 'top-3 right-4' },
  { id: 'BL', label: 'Bottom Left', mult: 1.92, positionClass: 'bottom-4 left-4' },
  { id: 'BR', label: 'Bottom Right', mult: 1.92, positionClass: 'bottom-4 right-4' },
];

export const PenaltyShootGame: React.FC<PenaltyGameProps> = ({
  onClose,
  userBalance,
  onUpdateBalance,
  onRecordWin
}) => {
  const [selectedZone, setSelectedZone] = useState<TargetZone>('TL');
  const [betAmount, setBetAmount] = useState(20);
  const [isShooting, setIsShooting] = useState(false);
  const [lastResult, setLastResult] = useState<'GOAL' | 'SAVED' | null>(null);
  const [keeperDive, setKeeperDive] = useState<TargetZone | null>(null);
  const [ballPos, setBallPos] = useState<TargetZone | 'CENTER'>('CENTER');
  const [soundOn, setSoundOn] = useState(soundManager.isEnabled());

  const handleShoot = () => {
    if (isShooting) return;
    if (userBalance < betAmount) {
      alert('Insufficient balance. Please deposit or reset demo balance.');
      return;
    }

    // Deduct bet
    onUpdateBalance(userBalance - betAmount);
    soundManager.playClick();
    setIsShooting(true);
    setLastResult(null);

    // Random keeper dive
    const allZones: TargetZone[] = ['TL', 'CTR', 'TR', 'BL', 'BR'];
    const keeperChoice = allZones[Math.floor(Math.random() * allZones.length)];
    setKeeperDive(keeperChoice);
    setBallPos(selectedZone);

    setTimeout(() => {
      if (selectedZone !== keeperChoice) {
        // GOAL!
        const targetMult = ZONES.find(z => z.id === selectedZone)?.mult || 2.0;
        const win = Math.round(betAmount * targetMult * 100) / 100;
        setLastResult('GOAL');
        onUpdateBalance(userBalance - betAmount + win);
        onRecordWin(win, targetMult, 'Shoot (Penalties)');
        soundManager.playGoal();
        soundManager.playWin();

        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        // Saved!
        setLastResult('SAVED');
        soundManager.playTick();
      }

      setIsShooting(false);
    }, 1200);
  };

  const getKeeperTransform = () => {
    if (!keeperDive) return 'translate-x-0 translate-y-0 scale-100';
    switch (keeperDive) {
      case 'TL': return '-translate-x-24 -translate-y-12 rotate-[-35deg]';
      case 'TR': return 'translate-x-24 -translate-y-12 rotate-[35deg]';
      case 'BL': return '-translate-x-24 translate-y-6 rotate-[-55deg]';
      case 'BR': return 'translate-x-24 translate-y-6 rotate-[55deg]';
      case 'CTR': return 'translate-x-0 -translate-y-14 scale-110';
      default: return '';
    }
  };

  const getBallTransform = () => {
    if (ballPos === 'CENTER') return 'translate-x-0 translate-y-12 scale-100 opacity-90';
    switch (ballPos) {
      case 'TL': return '-translate-x-28 -translate-y-20 scale-75';
      case 'TR': return 'translate-x-28 -translate-y-20 scale-75';
      case 'BL': return '-translate-x-28 -translate-y-4 scale-75';
      case 'BR': return 'translate-x-28 -translate-y-4 scale-75';
      case 'CTR': return 'translate-x-0 -translate-y-20 scale-75';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                SHOOT <span className="text-[10px] bg-[#00ad3a] px-1.5 py-0.5 rounded text-white font-bold">PENALTY</span>
              </h2>
              <span className="text-[10px] text-zinc-400">Aim for the corner & beat the keeper</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 block">Balance</span>
              <span className="text-xs sm:text-sm font-bold text-[#00e700] tabular-nums">
                ${userBalance.toFixed(2)}
              </span>
            </div>

            <button
              onClick={() => {
                const s = soundManager.toggle();
                setSoundOn(s);
              }}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
            >
              {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stadium & Goal Pitch */}
        <div className="relative flex-1 min-h-[250px] sm:min-h-[300px] bg-gradient-to-b from-[#0a3821] via-[#052113] to-[#021008] flex flex-col items-center justify-center p-4 overflow-hidden select-none">
          {/* Floodlights background glow */}
          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

          {/* Goal Frame */}
          <div className="relative w-full max-w-sm h-48 sm:h-56 border-4 border-white rounded-t-xl bg-black/40 shadow-[0_0_25px_rgba(255,255,255,0.2)] flex items-center justify-center">
            {/* Net Pattern */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(45deg, #fff 1px, transparent 1px), linear-gradient(-45deg, #fff 1px, transparent 1px)`,
                backgroundSize: '16px 16px'
              }}
            />

            {/* Target Selectors */}
            {ZONES.map(z => {
              const isSelected = selectedZone === z.id;
              return (
                <button
                  key={z.id}
                  disabled={isShooting}
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedZone(z.id);
                  }}
                  className={`absolute ${z.positionClass} z-20 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all flex flex-col items-center border ${
                    isSelected
                      ? 'bg-[#00e700] text-black border-white shadow-[0_0_15px_#00e700] scale-105'
                      : 'bg-black/70 text-zinc-200 border-zinc-600 hover:border-[#00e700]/70'
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold">{z.label}</span>
                  <span className="text-xs font-black tabular-nums">{z.mult.toFixed(2)}x</span>
                </button>
              );
            })}

            {/* Goalkeeper */}
            <div
              className={`absolute z-10 transition-transform duration-500 ease-out ${getKeeperTransform()}`}
            >
              <div className="relative flex flex-col items-center">
                {/* Goalie Gloves */}
                <div className="flex gap-10 -mb-2">
                  <span className="text-xl">🧤</span>
                  <span className="text-xl">🧤</span>
                </div>
                {/* Goalie Jersey */}
                <div className="w-12 h-14 bg-amber-400 border-2 border-black rounded-lg flex items-center justify-center shadow-md">
                  <span className="text-xs font-black text-black">1</span>
                </div>
                {/* Goalie Shorts */}
                <div className="w-10 h-6 bg-black rounded-b-md" />
              </div>
            </div>

            {/* The Football */}
            <div
              className={`absolute z-30 transition-all duration-500 ease-out text-3xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] ${getBallTransform()}`}
            >
              ⚽
            </div>
          </div>

          {/* Result Alert Toast */}
          {lastResult && (
            <div className="absolute top-4 inset-x-0 flex justify-center z-40 animate-bounce">
              {lastResult === 'GOAL' ? (
                <div className="bg-[#00ad3a] text-black font-black px-6 py-2 rounded-full shadow-[0_0_20px_#00e700] flex items-center gap-2 text-base">
                  <Trophy className="w-5 h-5" />
                  <span>GOOOAL! Won +${(betAmount * (ZONES.find(z => z.id === selectedZone)?.mult || 2.0)).toFixed(2)}!</span>
                </div>
              ) : (
                <div className="bg-red-600 text-white font-bold px-6 py-2 rounded-full shadow-lg text-sm">
                  SAVED BY GOALKEEPER! Try another corner!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bet Controls */}
        <div className="p-4 bg-[#03150b] border-t border-[#00e700]/20 flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-1/2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Stake Amount ($)</span>
              <div className="flex gap-1">
                {[5, 10, 20, 50, 100].map(v => (
                  <button
                    key={v}
                    disabled={isShooting}
                    onClick={() => {
                      soundManager.playClick();
                      setBetAmount(v);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      betAmount === v ? 'bg-[#00ad3a] text-white' : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center bg-[#062416] border border-zinc-700 rounded-xl overflow-hidden p-1">
              <button
                disabled={isShooting}
                onClick={() => setBetAmount(Math.max(1, betAmount - 5))}
                className="w-9 h-9 flex items-center justify-center font-bold text-lg text-zinc-300 hover:text-white bg-zinc-800/60 rounded-lg"
              >
                -
              </button>
              <input
                type="number"
                disabled={isShooting}
                value={betAmount}
                onChange={e => setBetAmount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full text-center font-black text-lg bg-transparent text-white focus:outline-none tabular-nums"
              />
              <button
                disabled={isShooting}
                onClick={() => setBetAmount(betAmount + 5)}
                className="w-9 h-9 flex items-center justify-center font-bold text-lg text-zinc-300 hover:text-white bg-zinc-800/60 rounded-lg"
              >
                +
              </button>
            </div>
          </div>

          <div className="w-full sm:w-1/2">
            <button
              onClick={handleShoot}
              disabled={isShooting}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex flex-col items-center justify-center disabled:opacity-50"
            >
              <span>{isShooting ? 'SHOOTING...' : 'SHOOT!'}</span>
              <span className="text-[11px] font-bold text-black/80">
                Win ${(betAmount * (ZONES.find(z => z.id === selectedZone)?.mult || 2.0)).toFixed(2)}
              </span>
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-[#020c06] text-[10px] text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00e700]" />
            <span>Random Goalkeeper AI · Verified Physics</span>
          </div>
          <span>Max Payout: 3.80x (Center Roof)</span>
        </div>
      </div>
    </div>
  );
};
