import React from 'react';
import { UserPlus, LogIn, LogOut, ShieldCheck, PlusCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { soundManager } from '../services/soundEffects';

interface HeaderProps {
  user: UserProfile;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenDeposit: () => void;
  onOpenAdminDashboard: () => void;
  onNavigateHome: () => void;
  isAdminViewActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenAuth,
  onLogout,
  onOpenDeposit,
  onOpenAdminDashboard,
  onNavigateHome,
  isAdminViewActive
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#03150b]/95 backdrop-blur-md border-b border-[#00e700]/15 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-2.5 sm:px-5 h-11 sm:h-12 gap-2">
        {/* Left Zone: Register (when logged out) OR User/Admin badge (when logged in) */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          {!user.isLoggedIn ? (
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenAuth('register');
              }}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold text-xs sm:text-sm py-1 px-1 rounded-lg active:scale-95 transition-all whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              <span>Register</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-zinc-200 font-bold text-xs py-1 px-1.5 rounded-lg bg-[#062416] border border-[#00e700]/25">
                <span className="text-xs">{user.avatar}</span>
                <span className="hidden sm:inline max-w-[80px] truncate">{user.username}</span>
              </div>

              {user.isAdmin && (
                <button
                  onClick={() => {
                    soundManager.playClick();
                    onOpenAdminDashboard();
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border transition-all whitespace-nowrap shrink-0 ${
                    isAdminViewActive
                      ? 'bg-[#00ad3a] text-black border-[#00e700]'
                      : 'bg-[#062416] text-[#00e700] border-[#00e700]/40 hover:bg-[#00ad3a]/20'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Center Zone: Iconic CAS9i Wordmark */}
        <div
          onClick={() => {
            soundManager.playClick();
            onNavigateHome();
          }}
          className="cursor-pointer select-none flex items-center justify-center shrink-0 group"
        >
          <div className="relative flex items-center tracking-tighter">
            <div className="absolute -top-0.5 -left-1 right-0 h-1 bg-gradient-to-r from-transparent via-[#00e700] to-transparent opacity-75 blur-[1px] group-hover:opacity-100 transition-opacity" />
            <span className="text-xl sm:text-2xl font-black italic text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              CAS
            </span>
            <span className="text-xl sm:text-2xl font-black italic text-[#00e700] drop-shadow-[0_0_10px_rgba(0,231,0,0.8)]">
              9
            </span>
            <span className="text-xl sm:text-2xl font-black italic text-[#00ff44] -ml-0.5 drop-shadow-[0_0_12px_rgba(0,255,68,0.9)]">
              i
            </span>
          </div>
        </div>

        {/* Right Zone: Balance + Login / Logout Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user.isLoggedIn && (
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenDeposit();
              }}
              className="flex items-center gap-1 bg-[#062416] border border-[#00e700]/30 rounded-lg px-1.5 py-1 text-[11px] font-extrabold text-[#00e700] tabular-nums hover:border-[#00e700] whitespace-nowrap shrink-0"
              title="Top-up Balance"
            >
              <span>${user.balance.toFixed(0)}</span>
              <PlusCircle className="w-3 h-3 text-amber-400" />
            </button>
          )}

          {!user.isLoggedIn ? (
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenAuth('login');
              }}
              className="flex items-center gap-1 text-white hover:text-[#00e700] font-semibold text-xs sm:text-sm py-1 px-1.5 rounded-lg active:scale-95 transition-all whitespace-nowrap shrink-0"
            >
              <span>Login</span>
              <LogIn className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                soundManager.playClick();
                onLogout();
              }}
              className="flex items-center gap-1 text-white hover:text-red-400 font-semibold text-xs sm:text-sm py-1 px-1.5 rounded-lg active:scale-95 transition-all whitespace-nowrap shrink-0"
            >
              <span>Logout</span>
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
