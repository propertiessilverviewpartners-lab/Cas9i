import React, { useState, useEffect } from 'react';
import { PlacedBet, FXPosition, UserProfile } from '../types';
import {
  User,
  ShieldCheck,
  Receipt,
  LogOut,
  Save,
  CheckCircle,
  LogIn,
  UserPlus,
  Dice5,
  TrendingUp
} from 'lucide-react';
import { soundManager } from '../services/soundEffects';
import { virtualEngine } from '../services/virtualEngine';

interface ProfileViewProps {
  user: UserProfile;
  placedBets: PlacedBet[];
  fxPositions: FXPosition[];
  onUpdateUser: (updatedUser: Partial<UserProfile>) => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenCheckBets: () => void;
  onOpenAdminDashboard: () => void;
  onNavigateTab: (tab: 'sports' | 'casino') => void;
  onLogout: () => void;
}

const AVATAR_OPTIONS = ['🦁', '👑', '⚡', '💎', '⚽', '🎯', '🚀', '🔥'];

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  placedBets,
  fxPositions,
  onUpdateUser,
  onOpenAuth,
  onOpenCheckBets,
  onOpenAdminDashboard,
  onNavigateTab,
  onLogout
}) => {
  const [fullName, setFullName] = useState(user.fullName || '');
  const [username, setUsername] = useState(user.username || '');
  const [avatar, setAvatar] = useState(user.avatar || '🦁');
  const [phone, setPhone] = useState(user.phone || '');
  const [country, setCountry] = useState(user.country || '');
  const [city, setCity] = useState(user.city || '');
  const [address, setAddress] = useState(user.address || '');
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.fullName || '');
    setUsername(user.username || '');
    setAvatar(user.avatar || '🦁');
    setPhone(user.phone || '');
    setCountry(user.country || '');
    setCity(user.city || '');
    setAddress(user.address || '');
    setDateOfBirth(user.dateOfBirth || '');
    setSaveMessage(null);
    setErrorMessage(null);
  }, [user.id, user.fullName, user.username, user.avatar, user.phone, user.country, user.city, user.address, user.dateOfBirth]);

  if (!user.isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto px-3 pt-4 pb-24">
        <div className="bg-[#051c10] border border-[#00e700]/25 rounded-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#03150b] border border-[#00e700]/30 flex items-center justify-center text-[#00e700]">
            <User className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Your Personal Profile</h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              Every player account is strictly private. Sign in or create an account to view your personal balance, profile details, and your own Check Bets history.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenAuth('login');
              }}
              className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              <span>Login to Account</span>
            </button>
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenAuth('register');
              }}
              className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/35 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>Create Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const openSoccerCount = placedBets.filter(b => b.status === 'OPEN').length;
  const openFxCount = fxPositions.filter(p => p.status === 'OPEN').length;
  const settledCount =
    placedBets.filter(b => b.status !== 'OPEN').length +
    fxPositions.filter(p => p.status !== 'OPEN').length;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || user.isAdmin) return;
    setErrorMessage(null);
    setSaveMessage(null);

    if (!username.trim() || !fullName.trim()) {
      setErrorMessage('Full Name and Username cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await virtualEngine.updateOwnProfile(user.id, {
        username: username.trim(),
        fullName: fullName.trim(),
        avatar,
        phone: phone.trim(),
        country: country.trim(),
        city: city.trim(),
        address: address.trim(),
        dateOfBirth: dateOfBirth.trim(),
      });
      soundManager.playBetPlaced();
      onUpdateUser({
        username: updated.username,
        fullName: updated.fullName,
        avatar: updated.avatar,
        phone: updated.phone,
        country: updated.country,
        city: updated.city,
        address: updated.address,
        dateOfBirth: updated.dateOfBirth,
      });
      setSaveMessage('Profile saved successfully.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 px-3 pt-3">
      {/* Profile Identity Header */}
      <div className="bg-[#051c10] border border-[#00e700]/25 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-[#03150b] border border-[#00e700]/35 flex items-center justify-center text-3xl shrink-0">
            {user.avatar}
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-black text-white truncate">
              {user.fullName || user.username}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
              <span className="font-bold text-zinc-300">@{user.username}</span>
              <span aria-hidden="true">·</span>
              {user.isAdmin ? (
                <span className="font-bold text-[#00e700]">Administrator</span>
              ) : (
                <span className="font-mono font-bold text-[#00e700] tabular-nums">ID #{user.id}</span>
              )}
              <span aria-hidden="true">·</span>
              <span>{user.accountTier || 'Standard'}</span>
            </div>
            <span className="text-[11px] text-zinc-500 block truncate mt-0.5">{user.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {user.isAdmin && (
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenAdminDashboard();
              }}
              className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Dashboard</span>
            </button>
          )}
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenCheckBets();
            }}
            className="min-h-[44px] px-4 rounded-xl bg-[#062416] hover:bg-[#0e4425] border border-[#00e700]/35 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
          >
            <Receipt className="w-4 h-4 text-[#00e700]" />
            <span>Check Bets</span>
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              onLogout();
            }}
            className="min-h-[44px] px-4 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-200 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Private Account Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#051c10] border border-[#00e700]/20 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-zinc-400 block">Balance</span>
          <span className="text-lg sm:text-xl font-black text-[#00e700] tabular-nums mt-0.5 block">
            ${user.balance.toFixed(2)}
          </span>
        </div>
        <div className="bg-[#051c10] border border-[#00e700]/20 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-zinc-400 block">Live Bets &amp; FX</span>
          <span className="text-lg sm:text-xl font-black text-white tabular-nums mt-0.5 block">
            {openSoccerCount + openFxCount}
          </span>
        </div>
        <div className="bg-[#051c10] border border-[#00e700]/20 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-zinc-400 block">Settled</span>
          <span className="text-lg sm:text-xl font-black text-emerald-300 tabular-nums mt-0.5 block">
            {settledCount}
          </span>
        </div>
        <div className="bg-[#051c10] border border-[#00e700]/20 rounded-xl p-3.5">
          <span className="text-[11px] font-bold text-zinc-400 block">Total Won</span>
          <span className="text-lg sm:text-xl font-black text-amber-400 tabular-nums mt-0.5 block">
            ${user.totalWon.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Quick Navigation Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <button
          onClick={() => {
            soundManager.playClick();
            onNavigateTab('sports');
          }}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#051c10] hover:bg-[#082c1a] border border-[#00e700]/25 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <TrendingUp className="w-4 h-4 text-[#00e700]" />
          <span>Sports &amp; FX</span>
        </button>
        <button
          onClick={() => {
            soundManager.playClick();
            onNavigateTab('casino');
          }}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#051c10] hover:bg-[#082c1a] border border-[#00e700]/25 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Dice5 className="w-4 h-4 text-amber-400" />
          <span>Casino Games</span>
        </button>
        <button
          onClick={() => {
            soundManager.playClick();
            onOpenCheckBets();
          }}
          className="col-span-2 sm:col-span-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#051c10] hover:bg-[#082c1a] border border-[#00e700]/25 text-xs font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Receipt className="w-4 h-4 text-[#00e700]" />
          <span>My Check Bets ({placedBets.length + fxPositions.length})</span>
        </button>
      </div>

      {/* Individual User Editable Details (Hidden for Admin) */}
      {!user.isAdmin && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-[#051c10] border border-[#00e700]/25 rounded-2xl p-4 sm:p-5 space-y-4"
        >
          <div className="border-b border-[#00e700]/15 pb-3">
            <h3 className="text-sm sm:text-base font-black text-white">Personal Information</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Only visible and editable on your own account
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-xs font-bold p-2.5 rounded-xl">
              {errorMessage}
            </div>
          )}

          {saveMessage && (
            <div className="bg-[#00ad3a]/20 border border-[#00e700]/50 text-[#00e700] text-xs font-bold p-2.5 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-zinc-400 block mb-1.5">Avatar</label>
            <div className="flex flex-wrap gap-1.5 bg-[#03150b] p-2 rounded-xl border border-zinc-800">
              {AVATAR_OPTIONS.map(av => (
                <button
                  type="button"
                  key={av}
                  onClick={() => {
                    soundManager.playClick();
                    setAvatar(av);
                  }}
                  className={`w-11 h-11 rounded-lg text-lg flex items-center justify-center transition-all ${
                    avatar === av ? 'bg-[#00ad3a]/40 ring-2 ring-[#00e700]' : 'hover:bg-white/5'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full min-h-[44px] bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full min-h-[44px] bg-[#03150b] border border-[#00e700]/30 rounded-xl px-3 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Email</label>
              <input
                type="email"
                readOnly
                value={user.email}
                className="w-full min-h-[44px] bg-[#020e07] border border-zinc-800 rounded-xl px-3 text-xs sm:text-sm font-bold text-zinc-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Enter phone number"
                className="w-full min-h-[44px] bg-[#03150b] border border-zinc-700 rounded-xl px-3 text-xs sm:text-sm font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="Enter country"
                className="w-full min-h-[44px] bg-[#03150b] border border-zinc-700 rounded-xl px-3 text-xs sm:text-sm font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Enter city"
                className="w-full min-h-[44px] bg-[#03150b] border border-zinc-700 rounded-xl px-3 text-xs sm:text-sm font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                className="w-full min-h-[44px] bg-[#03150b] border border-zinc-700 rounded-xl px-3 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Home Address</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Enter street address"
                className="w-full min-h-[44px] bg-[#03150b] border border-zinc-700 rounded-xl px-3 text-xs sm:text-sm font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-[#00e700]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
