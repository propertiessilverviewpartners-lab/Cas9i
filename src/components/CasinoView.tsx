import React, { useState } from 'react';
import { CasinoGame } from '../types';
import { CASINO_GAMES } from '../data/casinoGames';
import { Sparkles, Flame, Play, Trophy, Search, Star } from 'lucide-react';
import { soundManager } from '../services/soundEffects';

interface CasinoViewProps {
  onSelectGame: (game: CasinoGame) => void;
  userBalance: number;
}

export const CasinoView: React.FC<CasinoViewProps> = ({
  onSelectGame,
  userBalance
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredGames = CASINO_GAMES.filter(game => {
    if (activeCategory !== 'all' && game.category !== activeCategory) return false;
    if (searchQuery && !game.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getGameVisual = (game: CasinoGame) => {
    switch (game.id) {
      case 'spin-win':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-950 to-amber-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">🎡</span>
            <span className="text-xs sm:text-sm font-black text-amber-400 mt-1 uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              SPIN &amp; WIN +
            </span>
          </div>
        );
      case 'roulette':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-zinc-950 to-amber-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">🎰</span>
            <span className="text-xs sm:text-sm font-black text-white mt-1 uppercase tracking-widest drop-shadow">
              ROULETTE
            </span>
          </div>
        );
      case 'flight':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/90 via-orange-800 to-blue-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">✈️</span>
            <span className="text-xs sm:text-sm font-black text-white mt-1 uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              FLIGHT ✈
            </span>
          </div>
        );
      case 'shoot':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-emerald-950 to-lime-900 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">⚽</span>
            <span className="text-xs sm:text-sm font-black text-lime-400 mt-1 uppercase tracking-wider drop-shadow">
              SHOOT!
            </span>
          </div>
        );
      case 'plinko':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-indigo-950 to-cyan-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">⚪</span>
            <span className="text-xs sm:text-sm font-black text-cyan-400 mt-1 uppercase tracking-widest drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]">
              PLINKO
            </span>
          </div>
        );
      case 'lucky-49':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 flex flex-col items-center justify-center p-2 text-center">
            <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-black text-black">49</span>
            </div>
          </div>
        );
      case 'strike-777':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-red-950 to-yellow-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl font-black text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]">
              777
            </span>
            <span className="text-xs font-black text-white uppercase tracking-wider">
              STRIKE
            </span>
          </div>
        );
      case 'jetx':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">🚀</span>
            <span className="text-xs sm:text-sm font-black text-purple-300 mt-1 uppercase tracking-wider drop-shadow">
              JetX
            </span>
          </div>
        );
      case 'hit-slot-2025':
      case 'burning-classics':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-rose-950 via-amber-950 to-zinc-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-2xl sm:text-3xl filter drop-shadow">🔥 7 🍒</span>
            <span className="text-xs sm:text-sm font-black text-amber-400 mt-1 uppercase tracking-wider">
              {game.title}
            </span>
          </div>
        );
      case 'ice-fishing':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-sky-950 via-blue-900 to-indigo-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">🎣</span>
            <span className="text-xs sm:text-sm font-black text-sky-300 mt-1 uppercase tracking-wider">
              ICE FISHING
            </span>
          </div>
        );
      case 'aviator':
      case 'high-flyer':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-zinc-950 to-rose-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">🛩️</span>
            <span className="text-xs sm:text-sm font-black text-red-500 mt-1 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
              {game.title}
            </span>
          </div>
        );
      case 'duck-hunters':
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-amber-950 to-zinc-950 flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl sm:text-4xl filter drop-shadow">🦆</span>
            <span className="text-xs sm:text-sm font-black text-emerald-400 mt-1 uppercase tracking-wider">
              DUCK HUNTERS
            </span>
          </div>
        );
      default:
        return (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a3821] via-[#051c10] to-[#020e06] flex flex-col items-center justify-center p-2 text-center">
            <span className="text-3xl filter drop-shadow">💎</span>
            <span className="text-xs font-black text-white mt-1 uppercase tracking-wider">
              {game.title}
            </span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-3 pb-24">
      {/* "Top Games" Header Tab matching Screenshot 2 */}
      <div className="px-3 pt-2">
        <div className="flex items-center justify-between border-b border-[#00e700]/20 pb-2">
          <div className="relative">
            <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
              Top Games
            </h2>
            <div className="absolute -bottom-2 left-0 w-12 h-1 bg-[#00e700] rounded-full shadow-[0_0_8px_#00e700]" />
          </div>

          {/* Quick Search */}
          <div className="flex items-center bg-[#062416] border border-[#00e700]/30 rounded-lg px-2.5 py-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 mr-1.5" />
            <input
              type="text"
              placeholder="Search games..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-28 sm:w-40"
            />
          </div>
        </div>
      </div>

      {/* Casino Categories Filter Bar */}
      <div className="flex items-center gap-1.5 px-3 overflow-x-auto no-scrollbar py-1">
        {[
          { id: 'all', label: 'All Games', icon: '🎰' },
          { id: 'crash', label: 'Crash & Fast', icon: '🚀' },
          { id: 'instant', label: 'Instant Win', icon: '⚡' },
          { id: 'slots', label: 'Slots', icon: '🍒' },
          { id: 'table', label: 'Roulette & Table', icon: '🎡' },
          { id: 'wheel', label: 'Fortune Wheel', icon: '✨' },
        ].map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                soundManager.playClick();
                setActiveCategory(cat.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#00ad3a] text-white border-[#00e700] shadow-[0_0_10px_rgba(0,231,0,0.3)]'
                  : 'bg-[#062416]/90 text-zinc-300 border-[#00e700]/20 hover:border-[#00e700]/50'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Casino Games Grid: 3 columns on mobile, 4 on tablet, 6 on desktop */}
      <div className="px-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
          {filteredGames.map(game => (
            <div
              key={game.id}
              onClick={() => {
                soundManager.playClick();
                onSelectGame(game);
              }}
              className="group relative cursor-pointer aspect-[4/3] rounded-xl overflow-hidden border border-[#00e700]/30 shadow-[0_4px_12px_rgba(0,0,0,0.6)] hover:border-[#00e700] hover:shadow-[0_0_20px_rgba(0,231,0,0.4)] transition-all transform hover:scale-[1.03] active:scale-95"
            >
              {/* Game Visual / Render */}
              {getGameVisual(game)}

              {/* Badge Overlay (e.g. HOT, 5000x, JACKPOT) */}
              {game.badge && (
                <div className="absolute top-1.5 left-1.5 z-20">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-600 text-white shadow-md">
                    {game.badge}
                  </span>
                </div>
              )}

              {/* Play Hover Overlay */}
              <div className="absolute inset-0 z-30 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center backdrop-blur-[1px]">
                <div className="w-10 h-10 rounded-full bg-[#00e700] text-black flex items-center justify-center shadow-[0_0_15px_#00e700] mb-1 transform group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-black ml-0.5" />
                </div>
                <span className="text-[10px] font-black text-white uppercase tracking-wider">
                  PLAY NOW
                </span>
                <span className="text-[9px] text-[#00e700] font-bold">
                  Max: {game.multiplierMax}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
