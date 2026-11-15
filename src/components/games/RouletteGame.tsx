import React, { useState } from 'react';
import { soundManager } from '../../services/soundEffects';
import confetti from 'canvas-confetti';
import { X, Volume2, VolumeX, ShieldCheck, RefreshCw } from 'lucide-react';

interface RouletteGameProps {
  onClose: () => void;
  userBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  onRecordWin: (amount: number, multiplier: number, game: string) => void;
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const RouletteGame: React.FC<RouletteGameProps> = ({
  onClose,
  userBalance,
  onUpdateBalance,
  onRecordWin
}) => {
  const [selectedBet, setSelectedBet] = useState<'RED' | 'BLACK' | 'EVEN' | 'ODD' | '1-18' | '19-36' | number>('RED');
  const [betAmount, setBetAmount] = useState(25);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
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
    setWinningNumber(null);
    setLastWin(null);

    // Random European roulette number 0-36
    const outcome = Math.floor(Math.random() * 37);
    const extraSpins = 5 + Math.floor(Math.random() * 4);
    const newRotation = wheelRotation + extraSpins * 360 + outcome * (360 / 37);
    setWheelRotation(newRotation);

    setTimeout(() => {
      setWinningNumber(outcome);
      setIsSpinning(false);

      // Evaluate win
      let won = false;
      let multiplier = 0;

      if (typeof selectedBet === 'number') {
        if (selectedBet === outcome) {
          won = true;
          multiplier = 36;
        }
      } else {
        const isRed = RED_NUMBERS.includes(outcome);
        const isBlack = outcome !== 0 && !isRed;
        const isEven = outcome !== 0 && outcome % 2 === 0;
        const isOdd = outcome % 2 !== 0;
        const isLow = outcome >= 1 && outcome <= 18;
        const isHigh = outcome >= 19 && outcome <= 36;

        if (selectedBet === 'RED' && isRed) { won = true; multiplier = 2; }
        else if (selectedBet === 'BLACK' && isBlack) { won = true; multiplier = 2; }
        else if (selectedBet === 'EVEN' && isEven) { won = true; multiplier = 2; }
        else if (selectedBet === 'ODD' && isOdd) { won = true; multiplier = 2; }
        else if (selectedBet === '1-18' && isLow) { won = true; multiplier = 2; }
        else if (selectedBet === '19-36' && isHigh) { won = true; multiplier = 2; }
      }

      if (won) {
        const winAmount = Math.round(betAmount * multiplier * 100) / 100;
        setLastWin(winAmount);
        onUpdateBalance(userBalance - betAmount + winAmount);
        onRecordWin(winAmount, multiplier, 'Roulette');
        soundManager.playWin();

        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        soundManager.playTick();
      }
    }, 2800);
  };

  const getNumberColor = (num: number) => {
    if (num === 0) return 'bg-emerald-600 text-white';
    if (RED_NUMBERS.includes(num)) return 'bg-red-600 text-white';
    return 'bg-zinc-900 text-white border border-zinc-700';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎡</span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                ROULETTE <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded text-white font-bold">EUROPEAN</span>
              </h2>
              <span className="text-[10px] text-zinc-400">RTP 97.3% · Single Zero</span>
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

        {/* Wheel & Table Area */}
        <div className="relative flex-1 min-h-[260px] bg-gradient-to-b from-[#082b19] to-[#020e06] flex flex-col items-center justify-center p-4">
          {/* Animated Roulette Wheel Graphic */}
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full border-4 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.3)] flex items-center justify-center overflow-hidden mb-4">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: isSpinning ? 'transform 2.8s cubic-bezier(0.12, 0.8, 0.32, 1)' : 'none',
                background: 'conic-gradient(#059669 0deg 9.7deg, #dc2626 9.7deg 19.4deg, #18181b 19.4deg 29.1deg, #dc2626 29.1deg 38.8deg, #18181b 38.8deg 48.5deg, #dc2626 48.5deg 58.2deg, #18181b 58.2deg 67.9deg, #dc2626 67.9deg 77.6deg, #18181b 77.6deg 87.3deg, #dc2626 87.3deg 97deg, #18181b 97deg 106.7deg, #dc2626 106.7deg 116.4deg, #18181b 116.4deg 126.1deg, #dc2626 126.1deg 135.8deg, #18181b 135.8deg 145.5deg, #dc2626 145.5deg 155.2deg, #18181b 155.2deg 164.9deg, #dc2626 164.9deg 174.6deg, #18181b 174.6deg 184.3deg, #dc2626 184.3deg 194deg, #18181b 194deg 203.7deg, #dc2626 203.7deg 213.4deg, #18181b 213.4deg 223.1deg, #dc2626 223.1deg 232.8deg, #18181b 232.8deg 242.5deg, #dc2626 242.5deg 252.2deg, #18181b 252.2deg 261.9deg, #dc2626 261.9deg 271.6deg, #18181b 271.6deg 281.3deg, #dc2626 281.3deg 291deg, #18181b 291deg 300.7deg, #dc2626 300.7deg 310.4deg, #18181b 310.4deg 320.1deg, #dc2626 320.1deg 329.8deg, #18181b 329.8deg 339.5deg, #dc2626 339.5deg 349.2deg, #18181b 349.2deg 360deg)'
              }}
            />
            {/* Center turret */}
            <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 via-amber-300 to-amber-700 shadow-xl border-2 border-amber-200 flex flex-col items-center justify-center">
              {winningNumber !== null ? (
                <span className="text-base font-black text-black tabular-nums">
                  {winningNumber}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-black uppercase">
                  {isSpinning ? 'SPINNING' : 'PLACE BET'}
                </span>
              )}
            </div>
            {/* Wheel Pointer */}
            <div className="absolute top-1 z-20 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-white drop-shadow" />
          </div>

          {/* Winning Banner */}
          {winningNumber !== null && (
            <div className="mb-3 flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-black ${getNumberColor(winningNumber)}`}>
                Number {winningNumber} {winningNumber === 0 ? 'Green' : RED_NUMBERS.includes(winningNumber) ? 'RED' : 'BLACK'}
              </span>
              {lastWin !== null && (
                <span className="bg-[#00e700] text-black font-black px-3 py-1 rounded-full text-xs animate-bounce shadow-[0_0_15px_#00e700]">
                  WON +${lastWin.toFixed(2)}!
                </span>
              )}
            </div>
          )}

          {/* Quick Betting Grid (Outside Bets) */}
          <div className="w-full max-w-md grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {[
              { id: 'RED', label: 'RED', mult: '2x', bg: 'bg-red-600 hover:bg-red-500' },
              { id: 'BLACK', label: 'BLACK', mult: '2x', bg: 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-700' },
              { id: 'EVEN', label: 'EVEN', mult: '2x', bg: 'bg-[#092b19] hover:bg-[#0e3d23] border border-emerald-700' },
              { id: 'ODD', label: 'ODD', mult: '2x', bg: 'bg-[#092b19] hover:bg-[#0e3d23] border border-emerald-700' },
              { id: '1-18', label: '1 - 18', mult: '2x', bg: 'bg-[#092b19] hover:bg-[#0e3d23] border border-emerald-700' },
              { id: '19-36', label: '19 - 36', mult: '2x', bg: 'bg-[#092b19] hover:bg-[#0e3d23] border border-emerald-700' },
            ].map(b => (
              <button
                key={b.id}
                disabled={isSpinning}
                onClick={() => {
                  soundManager.playClick();
                  setSelectedBet(b.id as any);
                }}
                className={`py-2 px-1 rounded-lg text-xs font-black transition-all flex flex-col items-center ${b.bg} ${
                  selectedBet === b.id ? 'ring-2 ring-[#00e700] scale-105 shadow-[0_0_12px_#00e700]' : 'opacity-85'
                }`}
              >
                <span>{b.label}</span>
                <span className="text-[10px] text-amber-300 font-bold">{b.mult}</span>
              </button>
            ))}
          </div>

          {/* Lucky Single Numbers Strip */}
          <div className="w-full max-w-md mt-2 flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            <span className="text-[10px] uppercase font-bold text-zinc-400 shrink-0">Single (36x):</span>
            {[0, 7, 11, 17, 21, 25, 32].map(n => (
              <button
                key={n}
                disabled={isSpinning}
                onClick={() => {
                  soundManager.playClick();
                  setSelectedBet(n);
                }}
                className={`w-7 h-7 rounded-full text-xs font-black shrink-0 ${getNumberColor(n)} ${
                  selectedBet === n ? 'ring-2 ring-yellow-400 scale-110 shadow-lg' : ''
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Bet & Spin Controls */}
        <div className="p-4 bg-[#03150b] border-t border-[#00e700]/20 flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-1/2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Bet Amount ($)</span>
              <div className="flex gap-1">
                {[10, 25, 50, 100].map(v => (
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
              className="w-full h-14 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`} />
              <span>{isSpinning ? 'SPINNING WHEEL...' : `SPIN ($${betAmount})`}</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-[#020c06] text-[10px] text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00e700]" />
            <span>Certified RNG Wheel · Fair Odds</span>
          </div>
          <span>Payout on {String(selectedBet)}: {typeof selectedBet === 'number' ? '36x' : '2x'}</span>
        </div>
      </div>
    </div>
  );
};
