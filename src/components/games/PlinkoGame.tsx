import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../../services/soundEffects';
import confetti from 'canvas-confetti';
import { X, Volume2, VolumeX, ShieldCheck, Play } from 'lucide-react';

interface PlinkoGameProps {
  onClose: () => void;
  userBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  onRecordWin: (amount: number, multiplier: number, game: string) => void;
}

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  betAmount: number;
  color: string;
}

const MULTIPLIERS = [16, 9, 2, 1.2, 0.4, 0.2, 0.4, 1.2, 2, 9, 16];

export const PlinkoGame: React.FC<PlinkoGameProps> = ({
  onClose,
  userBalance,
  onUpdateBalance,
  onRecordWin
}) => {
  const [betAmount, setBetAmount] = useState(10);
  const [activeBucket, setActiveBucket] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(soundManager.isEnabled());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animRef = useRef<number | null>(null);
  const nextBallId = useRef(1);

  // Rows of pins
  const ROWS = 8;
  const PIN_RADIUS = 3.5;
  const BALL_RADIUS = 6;
  const GRAVITY = 0.22;
  const BOUNCE = 0.55;

  useEffect(() => {
    let active = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const startY = 40;
    const rowSpacing = 28;

    // Generate pins positions
    const pins: { x: number; y: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
      const pinsInRow = r + 3;
      const spacing = 34;
      const rowWidth = (pinsInRow - 1) * spacing;
      const startX = (w - rowWidth) / 2;
      for (let c = 0; c < pinsInRow; c++) {
        pins.push({
          x: startX + c * spacing,
          y: startY + r * rowSpacing
        });
      }
    }

    const loop = () => {
      if (!active) return;
      ctx.clearRect(0, 0, w, h);

      // Draw pins
      pins.forEach(pin => {
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, PIN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00e700';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Update and draw balls
      const bucketY = startY + ROWS * rowSpacing + 10;
      const numBuckets = MULTIPLIERS.length;
      const bucketWidth = w / numBuckets;

      const remainingBalls: Ball[] = [];

      ballsRef.current.forEach(ball => {
        ball.vy += GRAVITY;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Wall collisions
        if (ball.x - BALL_RADIUS < 10) {
          ball.x = 10 + BALL_RADIUS;
          ball.vx = -ball.vx * BOUNCE;
        } else if (ball.x + BALL_RADIUS > w - 10) {
          ball.x = w - 10 - BALL_RADIUS;
          ball.vx = -ball.vx * BOUNCE;
        }

        // Pin collisions
        pins.forEach(pin => {
          const dx = ball.x - pin.x;
          const dy = ball.y - pin.y;
          const dist = Math.hypot(dx, dy);
          if (dist < BALL_RADIUS + PIN_RADIUS) {
            // Collision!
            const angle = Math.atan2(dy, dx);
            const speed = Math.hypot(ball.vx, ball.vy) * BOUNCE;
            // Add slight randomness to bounce
            const randAngle = angle + (Math.random() - 0.5) * 0.4;
            ball.vx = Math.cos(randAngle) * Math.max(1.5, speed);
            ball.vy = Math.sin(randAngle) * Math.max(1.2, speed);

            // Separate
            ball.x = pin.x + Math.cos(angle) * (BALL_RADIUS + PIN_RADIUS + 0.5);
            ball.y = pin.y + Math.sin(angle) * (BALL_RADIUS + PIN_RADIUS + 0.5);

            soundManager.playTick();
          }
        });

        // Check if ball landed in bucket
        if (ball.y >= bucketY) {
          const bucketIndex = Math.min(
            numBuckets - 1,
            Math.max(0, Math.floor(ball.x / bucketWidth))
          );
          const mult = MULTIPLIERS[bucketIndex];
          const winAmount = Math.round(ball.betAmount * mult * 100) / 100;

          setActiveBucket(bucketIndex);
          setTimeout(() => setActiveBucket(null), 800);

          onUpdateBalance(userBalance + winAmount);
          if (mult >= 2.0) {
            soundManager.playWin();
            onRecordWin(winAmount, mult, 'Plinko');
            if (mult >= 9.0) {
              confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
            }
          }
          return;
        }

        // Draw ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.shadowColor = ball.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        remainingBalls.push(ball);
      });

      ballsRef.current = remainingBalls;
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      active = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [userBalance]);

  const dropBall = () => {
    if (userBalance < betAmount) {
      alert('Insufficient balance. Please deposit or reset demo balance.');
      return;
    }

    onUpdateBalance(userBalance - betAmount);
    soundManager.playClick();

    const canvas = canvasRef.current;
    const w = canvas ? canvas.width : 400;
    // Slight jitter in drop location
    const startX = w / 2 + (Math.random() - 0.5) * 12;

    const colors = ['#00e700', '#06b6d4', '#f59e0b', '#ec4899', '#a855f7'];
    const chosenColor = colors[Math.floor(Math.random() * colors.length)];

    ballsRef.current.push({
      id: nextBallId.current++,
      x: startX,
      y: 15,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1,
      betAmount,
      color: chosenColor
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚪</span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                PLINKO <span className="text-[10px] bg-cyan-600 px-1.5 py-0.5 rounded text-white font-bold">ARCADE</span>
              </h2>
              <span className="text-[10px] text-zinc-400">Peg drop multiplier arcade</span>
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

        {/* Board Canvas */}
        <div className="relative flex-1 min-h-[300px] bg-gradient-to-b from-[#031c11] to-[#010904] flex flex-col items-center justify-center p-2">
          <canvas
            ref={canvasRef}
            width={400}
            height={290}
            className="w-full max-w-[400px] h-auto object-contain"
          />

          {/* Multiplier Pockets Footer */}
          <div className="w-full max-w-[400px] grid grid-cols-11 gap-0.5 px-1 py-1 bg-black/60 rounded-xl border border-zinc-800">
            {MULTIPLIERS.map((m, idx) => {
              const isActive = activeBucket === idx;
              let bg = 'bg-zinc-800 text-zinc-300';
              if (m >= 16) bg = 'bg-red-600/80 text-white';
              else if (m >= 9) bg = 'bg-orange-600/80 text-white';
              else if (m >= 2) bg = 'bg-amber-600/80 text-white';
              else if (m >= 1) bg = 'bg-emerald-600/80 text-white';

              return (
                <div
                  key={idx}
                  className={`py-1.5 text-center rounded text-[10px] font-black transition-all tabular-nums ${bg} ${
                    isActive ? 'scale-110 ring-2 ring-[#00e700] shadow-[0_0_12px_#00e700]' : ''
                  }`}
                >
                  {m}x
                </div>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 bg-[#03150b] border-t border-[#00e700]/20 flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-1/2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Bet per Ball ($)</span>
              <div className="flex gap-1">
                {[5, 10, 25, 50].map(v => (
                  <button
                    key={v}
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
                onClick={() => setBetAmount(Math.max(1, betAmount - 5))}
                className="w-9 h-9 flex items-center justify-center font-bold text-lg text-zinc-300 hover:text-white bg-zinc-800/60 rounded-lg"
              >
                -
              </button>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full text-center font-black text-lg bg-transparent text-white focus:outline-none tabular-nums"
              />
              <button
                onClick={() => setBetAmount(betAmount + 5)}
                className="w-9 h-9 flex items-center justify-center font-bold text-lg text-zinc-300 hover:text-white bg-zinc-800/60 rounded-lg"
              >
                +
              </button>
            </div>
          </div>

          <div className="w-full sm:w-1/2">
            <button
              onClick={dropBall}
              className="w-full h-14 rounded-xl bg-gradient-to-r from-cyan-500 to-[#00e700] text-black font-black text-lg uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-black" />
              <span>DROP BALL (${betAmount})</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-2 bg-[#020c06] text-[10px] text-zinc-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00e700]" />
            <span>Multi-Ball Supported · Random Peg Scatter</span>
          </div>
          <span>Max: 16x Pocket</span>
        </div>
      </div>
    </div>
  );
};
