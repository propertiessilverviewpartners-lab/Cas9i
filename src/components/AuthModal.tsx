import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { X, DollarSign, RotateCcw, Check, Lock, Mail, User } from 'lucide-react';
import { soundManager } from '../services/soundEffects';
import { virtualEngine } from '../services/virtualEngine';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  initialMode: 'login' | 'register' | 'deposit';
  onUpdateUser: (updatedUser: Partial<UserProfile>) => void;
  onAdminLoginSuccess?: () => void;
}

const ADMIN_EMAIL = 'admin@cas9i.com';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  user,
  initialMode,
  onUpdateUser,
  onAdminLoginSuccess
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'deposit'>(initialMode);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦁');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const avatars = ['🦁', '👑', '⚡', '💎', '⚽', '🎯', '🚀', '🔥'];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (!normalizedEmail || !passwordInput) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    try {
      const result = await virtualEngine.login(normalizedEmail, passwordInput);
      if (!result.ok) {
        setErrorMsg(result.error || 'Invalid credentials.');
        return;
      }

      if (result.isAdmin) {
        soundManager.playBetPlaced();
        onUpdateUser({
          id: 'admin-cas9i',
          email: ADMIN_EMAIL,
          username: 'Admin',
          avatar: '🛡️',
          isLoggedIn: true,
          isAdmin: true
        });
        onClose();
        if (onAdminLoginSuccess) onAdminLoginSuccess();
        return;
      }

      // Standard player login
      soundManager.playBetPlaced();
      const derivedName = normalizedEmail.split('@')[0] || 'Player';
      onUpdateUser({
        id: `user-${Date.now()}`,
        email: normalizedEmail,
        username: derivedName,
        avatar: selectedAvatar,
        isLoggedIn: true,
        isAdmin: false
      });
      onClose();
    } catch {
      setErrorMsg('Unable to reach server. Please try again.');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (normalizedEmail === ADMIN_EMAIL) {
      setErrorMsg('This email is reserved. Please use the Login tab.');
      return;
    }
    if (!normalizedEmail || !passwordInput || !usernameInput.trim()) {
      setErrorMsg('Please complete all registration fields.');
      return;
    }

    soundManager.playBetPlaced();
    onUpdateUser({
      id: `user-${Date.now()}`,
      email: normalizedEmail,
      username: usernameInput.trim(),
      avatar: selectedAvatar,
      isLoggedIn: true,
      isAdmin: false,
      balance: user.balance >= 30000 ? user.balance : 100000
    });
    onClose();
  };

  const handleDeposit = (amount: number) => {
    soundManager.playBetPlaced();
    onUpdateUser({
      balance: user.balance + amount
    });
    setDepositSuccess(true);
    setTimeout(() => {
      setDepositSuccess(false);
      onClose();
    }, 900);
  };

  const handleReset = () => {
    soundManager.playClick();
    onUpdateUser({
      balance: 100000
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {mode === 'deposit' ? '💰' : mode === 'register' ? '⭐' : '🔐'}
            </span>
            <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
              {mode === 'deposit'
                ? 'QUICK TOP-UP / DEPOSIT'
                : mode === 'register'
                ? 'CREATE CAS9i ACCOUNT'
                : 'LOGIN TO CAS9i'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="p-2 bg-[#020e06] border-b border-zinc-800 flex gap-1">
          <button
            onClick={() => {
              soundManager.playClick();
              setErrorMsg(null);
              setMode('login');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
              mode === 'login' ? 'bg-[#00ad3a] text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              setErrorMsg(null);
              setMode('register');
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
              mode === 'register' ? 'bg-[#00ad3a] text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Register
          </button>
          {user.isLoggedIn && (
            <button
              onClick={() => {
                soundManager.playClick();
                setErrorMsg(null);
                setMode('deposit');
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all ${
                mode === 'deposit' ? 'bg-[#00ad3a] text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Top-Up ($)
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {errorMsg && (
            <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-xs font-bold p-2.5 rounded-xl">
              {errorMsg}
            </div>
          )}

          {mode === 'deposit' ? (
            <div className="space-y-4">
              <div className="text-center">
                <span className="text-xs text-zinc-400 block">Current Balance</span>
                <span className="text-3xl font-black text-[#00e700] tabular-nums">
                  ${user.balance.toFixed(2)}
                </span>
              </div>

              {depositSuccess ? (
                <div className="bg-[#00ad3a] text-black font-black p-3 rounded-xl text-center flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  <span>FUNDS ADDED SUCCESSFULLY!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-xs text-zinc-400 font-bold block">Select Demo Top-Up Amount:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[30000, 50000, 100000, 250000, 500000, 1000000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => handleDeposit(amt)}
                        className="py-2.5 rounded-xl bg-[#062416] hover:bg-[#00ad3a] border border-[#00e700]/30 hover:border-[#00e700] text-white hover:text-black font-black text-xs sm:text-sm transition-all shadow-sm active:scale-95 flex items-center justify-center gap-0.5"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>+{amt >= 1000000 ? '1M' : `${amt / 1000}k`}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full mt-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Default $100,000.00</span>
                  </button>
                </div>
              )}
            </div>
          ) : mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 font-bold block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-[#062416] border border-[#00e700]/30 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-bold block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-[#062416] border border-[#00e700]/30 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-95 transition-all mt-2"
              >
                Login
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 font-bold block mb-1">
                  Choose Avatar:
                </label>
                <div className="flex gap-1.5 justify-center py-1.5 bg-[#020e06] rounded-xl px-2 border border-zinc-800">
                  {avatars.map(av => (
                    <button
                      type="button"
                      key={av}
                      onClick={() => {
                        soundManager.playClick();
                        setSelectedAvatar(av);
                      }}
                      className={`text-xl p-1 rounded-lg transition-transform ${
                        selectedAvatar === av ? 'bg-[#00ad3a]/40 ring-2 ring-[#00e700] scale-110' : 'hover:scale-105'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-bold block mb-1">Username</label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    placeholder="e.g. ApexPlayer"
                    className="w-full bg-[#062416] border border-[#00e700]/30 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-bold block mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="player@example.com"
                    className="w-full bg-[#062416] border border-[#00e700]/30 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-bold block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="Create a password"
                    className="w-full bg-[#062416] border border-[#00e700]/30 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-95 transition-all mt-1"
              >
                Complete Registration
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
