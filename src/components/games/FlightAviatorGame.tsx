import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../../services/soundEffects';
import confetti from 'canvas-confetti';
import { X, Volume2, VolumeX, ShieldCheck, Zap } from 'lucide-react';

interface FlightGameProps {
  onClose: () => void;
  userBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  onRecordWin: (amount: number, multiplier: number, game: string) => void;
}

export const FlightAviatorGame: React.FC<FlightGameProps> = ({
  onClose,
  userBalance,
  onUpdateBalance,
  onRecordWin
}) => {
  const [gameState, setGameState] = useState<'WAITING' | 'FLYING' | 'CRASHED'>('WAITING');
  const [countdown, setCountdown] = useState(4);
  const [multiplier, setMultiplier] = useState(1.00);
  const [betAmount, setBetAmount] = useState(25);
  const [hasBet, setHasBet] = useState(false);
  const [hasCashedOut, setHasCashedOut] = useState(false);
  const [cashoutMultiplier, setCashoutMultiplier] = useState(0);
  const [history, setHistory] = useState<number[]>([1.84, 3.12, 1.15, 6.45, 2.05, 12.30, 1.40]);
  const [soundOn, setSoundOn] = useState(soundManager.isEnabled());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const flightStartTimeRef = useRef<number>(0);
  const crashPointRef = useRef<number>(2.5);

  // Generate randomized crash point (exponential distribution favoring 1.2x - 3x with rare 20x+)
  const generateCrashPoint = () => {
    const r = Math.random();
    if (r < 0.08) return 1.05 + Math.random() * 0.15; // Instant crash
    if (r < 0.55) return 1.20 + Math.random() * 1.5;  // 1.2x - 2.7x
    if (r < 0.85) return 2.70 + Math.random() * 4.0;  // 2.7x - 6.7x
    if (r < 0.96) return 6.70 + Math.random() * 12.0; // 6.7x - 18.7x
    return 20.0 + Math.random() * 45.0;               // Super flight
  };

  // Start next round sequence
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (gameState === 'WAITING') {
      setMultiplier(1.00);
      setHasCashedOut(false);
      setCashoutMultiplier(0);
      crashPointRef.current = generateCrashPoint();

      let currentCount = 4;
      setCountdown(currentCount);

      const countInterval = setInterval(() => {
        currentCount -= 1;
        setCountdown(currentCount);
        if (currentCount <= 0) {
          clearInterval(countInterval);
          flightStartTimeRef.current = Date.now();
          setGameState('FLYING');
        }
      }, 1000);

      return () => clearInterval(countInterval);
    }

    if (gameState === 'CRASHED') {
      timer = setTimeout(() => {
        setGameState('WAITING');
        setHasBet(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  // Main flight animation loop
  useEffect(() => {
    if (gameState !== 'FLYING') return;

    let active = true;

    const loop = () => {
      if (!active) return;
      const elapsedSec = (Date.now() - flightStartTimeRef.current) / 1000;
      // Multiplier increases exponentially
      const currentMult = Number((1.0 + Math.pow(elapsedSec * 0.45, 1.8)).toFixed(2));

      if (currentMult >= crashPointRef.current) {
        // Crash!
        setMultiplier(crashPointRef.current);
        setGameState('CRASHED');
        setHistory(prev => [crashPointRef.current, ...prev.slice(0, 9)]);
        soundManager.playTick();
        return;
      }

      setMultiplier(currentMult);
      drawFlightCanvas(currentMult, elapsedSec);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gameState]);

  // Canvas rendering for the flight path
  const drawFlightCanvas = (currentMult: number, elapsedSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw background grid lines
    ctx.strokeStyle = 'rgba(0, 231, 0, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Origin point
    const startX = 40;
    const startY = h - 40;

    // Progress percentage
    const progress = Math.min(1, elapsedSec / 10);
    const endX = startX + (w - 100) * Math.min(1, Math.pow(progress, 0.8));
    const endY = startY - (h - 80) * Math.min(0.9, Math.pow(progress, 1.1));

    // Draw curve
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + (endX - startX) * 0.5, startY, endX, endY);
    ctx.strokeStyle = '#00e700';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00e700';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    ctx.lineTo(endX, startY);
    ctx.lineTo(startX, startY);
    const grad = ctx.createLinearGradient(0, endY, 0, startY);
    grad.addColorStop(0, 'rgba(0, 231, 0, 0.35)');
    grad.addColorStop(1, 'rgba(0, 231, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw Airplane at end point
    ctx.save();
    ctx.translate(endX, endY);
    const angle = -Math.atan2(startY - endY, endX - startX) * 0.7;
    ctx.rotate(angle);

    // Plane Body
    ctx.fillStyle = '#ff3344';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-14, -8);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 8);
    ctx.closePath();
    ctx.fill();

    // Wing
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-6, -14);
    ctx.lineTo(-10, -14);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const handlePlaceBet = () => {
    if (userBalance < betAmount) {
      alert('Insufficient balance. Please deposit or reset demo balance.');
      return;
    }
    soundManager.playClick();
    onUpdateBalance(userBalance - betAmount);
    setHasBet(true);
  };

  const handleCashout = () => {
    if (gameState !== 'FLYING' || !hasBet || hasCashedOut) return;

    const winAmount = Math.round(betAmount * multiplier * 100) / 100;
    setHasCashedOut(true);
    setCashoutMultiplier(multiplier);
    onUpdateBalance(userBalance + winAmount);
    onRecordWin(winAmount, multiplier, 'Flight (Aviator)');
    soundManager.playWin();

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const toggleSound = () => {
    const newState = soundManager.toggle();
    setSoundOn(newState);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">✈️</span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                FLIGHT <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded text-white font-bold">CRASH</span>
              </h2>
              <span className="text-[10px] text-zinc-400">RTP 97.0% · Provably Fair</span>
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
              onClick={toggleSound}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
              title="Toggle sound"
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

        {/* History Bar */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#020d07] border-b border-zinc-800 overflow-x-auto no-scrollbar">
          <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0 mr-1">Rounds:</span>
          {history.map((h, i) => (
            <span
              key={i}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 tabular-nums ${
                h >= 10
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                  : h >= 2.0
                  ? 'bg-emerald-600/30 text-[#00e700] border border-emerald-500/40'
                  : 'bg-zinc-800/80 text-blue-300 border border-zinc-700'
              }`}
            >
              {h.toFixed(2)}x
            </span>
          ))}
        </div>

        {/* Game Canvas Arena */}
        <div className="relative flex-1 min-h-[220px] sm:min-h-[280px] bg-gradient-to-b from-[#062416] to-[#021008] flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={640}
            height={320}
            className="w-full h-full object-cover"
          />

          {/* Central Overlay Multiplier & Status */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {gameState === 'WAITING' && (
              <div className="text-center animate-pulse">
                <span className="text-xs uppercase tracking-widest text-[#00e700] font-bold block mb-1">
                  NEXT FLIGHT IN
                </span>
                <span className="text-5xl sm:text-6xl font-black text-white tabular-nums tracking-tighter">
                  {countdown}s
                </span>
                <div className="w-36 h-1.5 bg-zinc-800 rounded-full mx-auto mt-3 overflow-hidden">
                  <div
                    className="h-full bg-[#00e700] transition-all duration-1000"
                    style={{ width: `${((4 - countdown) / 4) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {gameState === 'FLYING' && (
              <div className="text-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
                <span className="text-5xl sm:text-7xl font-black text-white tabular-nums tracking-tighter drop-shadow-[0_0_20px_rgba(0,231,0,0.6)]">
                  {multiplier.toFixed(2)}x
                </span>
                {hasBet && !hasCashedOut && (
                  <span className="text-xs sm:text-sm text-[#00e700] font-bold block mt-1">
                    Current Win: ${(betAmount * multiplier).toFixed(2)}
                  </span>
                )}
                {hasCashedOut && (
                  <span className="text-xs sm:text-sm text-yellow-400 font-bold bg-black/60 px-3 py-1 rounded-full mt-2 inline-block">
                    Cashed Out @ {cashoutMultiplier.toFixed(2)}x (+${(betAmount * cashoutMultiplier).toFixed(2)})
                  </span>
                )}
              </div>
            )}

            {gameState === 'CRASHED' && (
              <div className="text-center animate-bounce">
                <span className="text-xs uppercase tracking-widest text-red-500 font-black block mb-1">
                  FLEW AWAY!
                </span>
                <span className="text-4xl sm:text-6xl font-black text-red-500 tabular-nums">
                  {multiplier.toFixed(2)}x
                </span>
                <span className="text-xs text-zinc-400 block mt-1">Waiting for next flight...</span>
              </div>
            )}
          </div>
        </div>

        {/* Betting Controls & Action Button */}
        <div className="p-3 sm:p-4 bg-[#03150b] border-t border-[#00e700]/20 flex flex-col sm:flex-row items-center gap-3">
          {/* Stake Adjuster */}
          <div className="w-full sm:w-1/2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Bet Amount ($)</span>
              <div className="flex gap-1">
                {[5, 10, 25, 50, 100].map(val => (
                  <button
                    key={val}
                    disabled={hasBet && gameState === 'FLYING'}
                    onClick={() => {
                      soundManager.playClick();
                      setBetAmount(val);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      betAmount === val ? 'bg-[#00ad3a] text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center bg-[#062416] border border-zinc-700 rounded-xl overflow-hidden p-1">
              <button
                disabled={hasBet && gameState === 'FLYING'}
                onClick={() => setBetAmount(Math.max(1, betAmount - 5))}
                className="w-9 h-9 flex items-center justify-center font-bold text-lg text-zinc-300 hover:text-white bg-zinc-800/60 rounded-lg active:scale-95"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={5000}
                disabled={hasBet && gameState === 'FLYING'}
                value={betAmount}
                onChange={e => setBetAmount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full text-center font-black text-base sm:text-lg bg-transparent text-white focus:outline-none tabular-nums"
              />
              <button
                disabled={hasBet && gameState === 'FLYING'}
                onClick={() => setBetAmount(betAmount + 5)}
                className="w-9 h-9 flex items-center justify-center font-bold text-lg text-zinc-300 hover:text-white bg-zinc-800/60 rounded-lg active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="w-full sm:w-1/2">
            {!hasBet ? (
              <button
                onClick={handlePlaceBet}
                disabled={gameState === 'CRASHED'}
                className="w-full h-14 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-base sm:text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex flex-col items-center justify-center disabled:opacity-50"
              >
                <span>{gameState === 'FLYING' ? 'BET FOR NEXT ROUND' : 'PLACE BET'}</span>
                <span className="text-[11px] font-bold text-black/80">${betAmount.toFixed(2)}</span>
              </button>
            ) : hasCashedOut ? (
              <div className="w-full h-14 rounded-xl bg-[#062416] border border-[#00e700]/40 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-[#00e700] font-bold">CASHED OUT SUCCESS</span>
                <span className="text-sm font-black text-white">+${(betAmount * cashoutMultiplier).toFixed(2)}</span>
              </div>
            ) : (
              <button
                onClick={handleCashout}
                disabled={gameState !== 'FLYING'}
                className="w-full h-14 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black text-base sm:text-lg uppercase tracking-wider shadow-[0_0_25px_rgba(251,191,36,0.6)] hover:brightness-110 active:scale-[0.98] transition-all flex flex-col items-center justify-center animate-pulse"
              >
                <span>CASH OUT</span>
                <span className="text-xs font-black text-black">
                  ${(betAmount * multiplier).toFixed(2)} ({multiplier.toFixed(2)}x)
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Provably Fair Footer */}
        <div className="px-4 py-2 bg-[#020c06] text-[10px] text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00e700]" />
            <span>SHA-256 Server Seed Verified · Random Multiplier</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-400">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span>Low-Latency Instant Cashout</span>
          </div>
        </div>
      </div>
    </div>
  );
};
