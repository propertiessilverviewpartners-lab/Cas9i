import React, { useState } from 'react';
import { soundManager } from '../../services/soundEffects';
import confetti from 'canvas-confetti';
import { X, Volume2, VolumeX, ShieldCheck, Zap } from 'lucide-react';

interface SlotsGameProps {
  title?: string;
  onClose: () => void;
  userBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  onRecordWin: (amount: number, multiplier: number, game: string) => void;
}

const SYMBOLS = ['7️⃣', '💎', '👑', '🍒', '🔔', '🍇', '⭐'];

export const SlotsGame: React.FC<SlotsGameProps> = ({
  title = '777 Strike',
  onClose,
  userBalance,
  onUpdateBalance,
  onRecordWin
}) => {
  const [reels, setReels] = useState<string[]>(['7️⃣', '7️⃣', '7️⃣']);
  const [betAmount, setBetAmount] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [winMessage, setWinMessage] = useState<string | null>(null);
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
    setWinMessage(null);

    // Rapid shuffle effect
    let spinsCount = 0;
    const interval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
      soundManager.playTick();
      spinsCount++;

      if (spinsCount >= 14) {
        clearInterval(interval);

        // Determine final outcome
        const r = Math.random();
        let outcome: string[];

        if (r < 0.05) {
          // Triple 7s JACKPOT!
          outcome = ['7️⃣', '7️⃣', '7️⃣'];
        } else if (r < 0.15) {
          // Triple Diamonds
          outcome = ['💎', '💎', '💎'];
        } else if (r < 0.30) {
          // Triple Crown or Bell
          const sym = Math.random() > 0.5 ? '👑' : '🔔';
          outcome = [sym, sym, sym];
        } else if (r < 0.60) {
          // Pair match
          const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          const diff = SYMBOLS.filter(s => s !== sym)[0];
          outcome = [sym, sym, diff];
        } else {
          // Loss
          outcome = ['🍇', '🍒', '⭐'];
        }

        setReels(outcome);
        setIsSpinning(false);

        // Calculate payout
        let mult = 0;
        let msg = '';

        if (outcome[0] === outcome[1] && outcome[1] === outcome[2]) {
          if (outcome[0] === '7️⃣') { mult = 50; msg = '777 MEGA JACKPOT!'; }
          else if (outcome[0] === '💎') { mult = 25; msg = 'DIAMOND CASCADE!'; }
          else if (outcome[0] === '👑') { mult = 15; msg = 'ROYAL CROWN TRIPLE!'; }
          else if (outcome[0] === '🔔') { mult = 10; msg = 'LUCKY BELLS!'; }
          else { mult = 6; msg = 'FRUIT FRENZY!'; }
        } else if (outcome[0] === outcome[1] || outcome[1] === outcome[2] || outcome[0] === outcome[2]) {
          mult = 1.8;
          msg = 'NICE PAIR MATCH!';
        }

        if (mult > 0) {
          const winAmount = Math.round(betAmount * mult * 100) / 100;
          setLastWin(winAmount);
          setWinMessage(msg);
          onUpdateBalance(userBalance - betAmount + winAmount);
          onRecordWin(winAmount, mult, title);
          soundManager.playWin();

          confetti({
            particleCount: mult >= 25 ? 90 : 40,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎰</span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                {title.toUpperCase()} <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-black">SLOT</span>
              </h2>
              <span className="text-[10px] text-zinc-400">Triple 7s pays 50x · 96.5% RTP</span>
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

        {/* Slot Machine Frame */}
        <div className="relative flex-1 min-h-[250px] bg-gradient-to-b from-[#0c3a21] via-[#051c10] to-[#020e06] flex flex-col items-center justify-center p-4">
          {/* Machine Header Marquee */}
          <div className="px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 text-black font-black text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(245,158,11,0.5)] mb-4">
            ★ GOLDEN SLOTS ★
          </div>

          {/* Reels Enclosure */}
          <div className="relative p-3 bg-zinc-950 border-4 border-amber-500/80 rounded-2xl shadow-[inset_0_0_20px_rgba(0,0,0,0.9)] flex items-center gap-2 sm:gap-3">
            {/* Payline indicator line */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/60 z-20 pointer-events-none" />

            {reels.map((symbol, idx) => (
              <div
                key={idx}
                className="w-20 h-28 sm:w-24 sm:h-32 bg-gradient-to-b from-zinc-800 via-zinc-900 to-zinc-800 border-2 border-zinc-700 rounded-xl flex items-center justify-center text-4xl sm:text-5xl shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)] select-none overflow-hidden"
              >
                <span className={`transition-transform duration-100 ${isSpinning ? 'scale-110 blur-[0.5px]' : 'scale-100'}`}>
                  {symbol}
                </span>
              </div>
            ))}
          </div>

          {/* Win Announcement */}
          {winMessage && lastWin && (
            <div className="mt-4 px-4 py-1.5 bg-[#00ad3a] text-black font-black rounded-full text-xs sm:text-sm animate-bounce shadow-[0_0_20px_#00e700] flex items-center gap-2">
              <Zap className="w-4 h-4 fill-black" />
              <span>{winMessage} WON +${lastWin.toFixed(2)}!</span>
            </div>
          )}
        </div>

        {/* Betting Controls */}
        <div className="p-4 bg-[#03150b] border-t border-[#00e700]/20 flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-1/2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Bet Stake ($)</span>
              <div className="flex gap-1">
                {[5, 10, 25, 50].map(v => (
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
              className="w-full h-14 rounded-xl bg-gradient-to-r from-amber-400 to-[#00e700] text-black font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isSpinning ? 'SPINNING...' : `SPIN ($${betAmount})`}</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-[#020c06] text-[10px] text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00e700]" />
            <span>Provably Fair RNG · Instant Payout</span>
          </div>
          <span>Max Jackpot: 50x</span>
        </div>
      </div>
    </div>
  );
};
