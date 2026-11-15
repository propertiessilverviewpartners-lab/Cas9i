import React, { useState } from 'react';
import { soundManager } from '../../services/soundEffects';
import confetti from 'canvas-confetti';
import { X, Volume2, VolumeX, ShieldCheck, Sparkles } from 'lucide-react';

interface SpinWinProps {
  onClose: () => void;
  userBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  onRecordWin: (amount: number, multiplier: number, game: string) => void;
}

const SEGMENTS = [
  { mult: 2, color: '#059669', label: '2x' },
  { mult: 5, color: '#2563eb', label: '5x' },
  { mult: 2, color: '#059669', label: '2x' },
  { mult: 10, color: '#7c3aed', label: '10x' },
  { mult: 2, color: '#059669', label: '2x' },
  { mult: 25, color: '#ea580c', label: '25x' },
  { mult: 5, color: '#2563eb', label: '5x' },
  { mult: 50, color: '#db2777', label: '50x' },
  { mult: 2, color: '#059669', label: '2x' },
  { mult: 100, color: '#eab308', label: '100x' },
];

export const SpinWinGame: React.FC<SpinWinProps> = ({
  onClose,
  userBalance,
  onUpdateBalance,
  onRecordWin
}) => {
  const [betAmount, setBetAmount] = useState(15);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [winningMult, setWinningMult] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(soundManager.isEnabled());

  const handleSpin = () => {
    if (isSpinning) return;
    if (userBalance < betAmount) {
      alert('Insufficient balance. Please deposit or reset demo balance.');
      return;
    }

    onUpdateBalance(userBalance - betAmount);
    soundManager.playClick();
    setIsSpinning(true);
    setLastWin(null);
    setWinningMult(null);

    // Pick segment
    const r = Math.random();
    let chosenIdx = 0;
    if (r < 0.45) chosenIdx = [0, 2, 4, 8][Math.floor(Math.random() * 4)]; // 2x
    else if (r < 0.75) chosenIdx = [1, 6][Math.floor(Math.random() * 2)]; // 5x
    else if (r < 0.90) chosenIdx = 3; // 10x
    else if (r < 0.97) chosenIdx = 5; // 25x
    else if (r < 0.99) chosenIdx = 7; // 50x
    else chosenIdx = 9; // 100x

    const segmentAngle = 360 / SEGMENTS.length;
    // Calculate rotation to land on chosenIdx
    const extraTurns = 5 + Math.floor(Math.random() * 3);
    const targetAngle = rotation + extraTurns * 360 + (SEGMENTS.length - chosenIdx) * segmentAngle - segmentAngle / 2;
    setRotation(targetAngle);

    setTimeout(() => {
      setIsSpinning(false);
      const chosenSeg = SEGMENTS[chosenIdx];
      const winAmount = Math.round(betAmount * chosenSeg.mult * 100) / 100;
      setWinningMult(chosenSeg.mult);
      setLastWin(winAmount);

      onUpdateBalance(userBalance - betAmount + winAmount);
      onRecordWin(winAmount, chosenSeg.mult, 'Spin & Win +');
      soundManager.playWin();

      confetti({
        particleCount: chosenSeg.mult >= 25 ? 80 : 35,
        spread: 70,
        origin: { y: 0.6 }
      });
    }, 3200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎡</span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                SPIN & WIN + <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-black">WHEEL</span>
              </h2>
              <span className="text-[10px] text-zinc-400">Up to 100x Fortune Multiplier</span>
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
              onClick={() => setSoundOn(soundManager.toggle())}
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

        {/* Wheel Arena */}
        <div className="relative flex-1 min-h-[270px] bg-gradient-to-b from-[#082a19] to-[#020e06] flex flex-col items-center justify-center p-4">
          <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-full border-4 border-amber-400/90 shadow-[0_0_30px_rgba(251,191,36,0.4)] flex items-center justify-center overflow-hidden mb-3">
            {/* The Conic Wheel */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? 'transform 3.2s cubic-bezier(0.12, 0.8, 0.35, 1)' : 'none',
                background: `conic-gradient(
                  ${SEGMENTS[0].color} 0deg 36deg,
                  ${SEGMENTS[1].color} 36deg 72deg,
                  ${SEGMENTS[2].color} 72deg 108deg,
                  ${SEGMENTS[3].color} 108deg 144deg,
                  ${SEGMENTS[4].color} 144deg 180deg,
                  ${SEGMENTS[5].color} 180deg 216deg,
                  ${SEGMENTS[6].color} 216deg 252deg,
                  ${SEGMENTS[7].color} 252deg 288deg,
                  ${SEGMENTS[8].color} 288deg 324deg,
                  ${SEGMENTS[9].color} 324deg 360deg
                )`
              }}
            >
              {/* Segment labels */}
              {SEGMENTS.map((s, idx) => {
                const angle = idx * 36 + 18;
                return (
                  <div
                    key={idx}
                    className="absolute inset-0 flex items-start justify-center pt-2 select-none"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <span className="text-xs sm:text-sm font-black text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Center Cap */}
            <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-600 via-amber-300 to-yellow-600 shadow-xl border-2 border-white flex flex-col items-center justify-center">
              <span className="text-[10px] font-black text-black uppercase">
                {isSpinning ? 'LUCKY' : 'WIN'}
              </span>
            </div>

            {/* Top Pointer */}
            <div className="absolute top-1 z-20 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
          </div>

          {/* Win Result */}
          {winningMult && lastWin && (
            <div className="px-4 py-1.5 bg-[#00e700] text-black font-black rounded-full text-xs sm:text-sm animate-bounce shadow-[0_0_20px_#00e700] flex items-center gap-2">
              <Sparkles className="w-4 h-4 fill-black" />
              <span>LANDED ON {winningMult}x! WON +${lastWin.toFixed(2)}!</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-[#03150b] border-t border-[#00e700]/20 flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-1/2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Bet Amount ($)</span>
              <div className="flex gap-1">
                {[10, 15, 25, 50].map(v => (
                  <button
                    key={v}
                    disabled={isSpinning}
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
                disabled={isSpinning}
                onClick={() => setBetAmount(Math.max(1, betAmount - 5))}
                className="w-9 h-9 flex items-center justify-center font-bold text-lg text-zinc-300 hover:text-white bg-zinc-800/60 rounded-lg"
              >
                -
              </button>
              <input
                type="number"
                disabled={isSpinning}
                value={betAmount}
                onChange={e => setBetAmount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full text-center font-black text-lg bg-transparent text-white focus:outline-none tabular-nums"
              />
              <button
                disabled={isSpinning}
                onClick={() => setBetAmount(betAmount + 5)}
                className="w-9 h-9 flex items-center justify-center font-bold text-lg text-zinc-300 hover:text-white bg-zinc-800/60 rounded-lg"
              >
                +
              </button>
            </div>
          </div>

          <div className="w-full sm:w-1/2">
            <button
              onClick={handleSpin}
              disabled={isSpinning}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-amber-400 to-[#00e700] text-black font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isSpinning ? 'SPINNING...' : `SPIN WHEEL ($${betAmount})`}</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-[#020c06] text-[10px] text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00e700]" />
            <span>Certified Random Stop · Instant Credit</span>
          </div>
          <span>Max Segment: 100x</span>
        </div>
      </div>
    </div>
  );
};
