import React, { useState, useEffect } from 'react';
import { FXPosition, PlacedBet, UserProfile } from '../types';
import { X, Lock, Mail, User, ShieldCheck, KeyRound } from 'lucide-react';
import { soundManager } from '../services/soundEffects';
import { virtualEngine } from '../services/virtualEngine';
import {
  signInWithGooglePopup,
  signOutFirebase,
  isFirebaseAdminUser,
  ensureBootstrappedAdminRecord,
  findOrCreateGoogleUser,
} from '../services/firebaseSync';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  initialMode: 'login' | 'register';
  onUpdateUser: (updatedUser: Partial<UserProfile>, hydratedBets?: { placedBets: PlacedBet[]; fxPositions: FXPosition[] }) => void;
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
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦁');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration verification step state
  const [registerStep, setRegisterStep] = useState<'form' | 'verify'>('form');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [verificationCodeInput, setVerificationCodeInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setRegisterStep('form');
      setVerificationCodeInput('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const avatars = ['🦁', '👑', '⚡', '💎', '⚽', '🎯', '🚀', '🔥'];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (!normalizedEmail || !passwordInput) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await virtualEngine.login(normalizedEmail, passwordInput);
      if (!result.ok) {
        if (result.needsVerification) {
          setErrorMsg(result.error || 'Account pending verification. Complete verification in Register.');
        } else {
          setErrorMsg(result.error || 'Invalid credentials.');
        }
        return;
      }

      if (result.isAdmin) {
        soundManager.playBetPlaced();
        onUpdateUser({
          id: 'admin-cas9i',
          email: ADMIN_EMAIL,
          username: 'Admin',
          fullName: 'CAS9i Admin',
          avatar: '🛡️',
          balance: result.adminBalance ?? 100000,
          isLoggedIn: true,
          isAdmin: true,
          verified: true
        });
        onClose();
        if (onAdminLoginSuccess) onAdminLoginSuccess();
        return;
      }

      if (result.user) {
        soundManager.playBetPlaced();
        onUpdateUser(
          {
            id: result.user.id,
            email: result.user.email,
            username: result.user.username,
            fullName: result.user.fullName,
            avatar: result.user.avatar || selectedAvatar,
            balance: result.user.balance,
            phone: result.user.phone,
            country: result.user.country,
            city: result.user.city,
            address: result.user.address,
            dateOfBirth: result.user.dateOfBirth,
            kycIdNumber: result.user.kycIdNumber,
            accountTier: result.user.accountTier,
            createdAt: result.user.createdAt,
            totalBetsPlaced: result.user.totalBetsPlaced ?? 0,
            totalWon: result.user.totalWon ?? 0,
            verified: result.user.verified,
            isLoggedIn: true,
            isAdmin: false
          },
          {
            placedBets: result.placedBets || [],
            fxPositions: result.fxPositions || [],
          }
        );
        onClose();
        return;
      }

      setErrorMsg('Unable to load account profile.');
    } catch {
      setErrorMsg('Unable to reach server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (normalizedEmail === ADMIN_EMAIL) {
      setErrorMsg('This email is reserved. Please use the Login tab.');
      return;
    }
    if (!usernameInput.trim() || !fullNameInput.trim() || !normalizedEmail || !passwordInput) {
      setErrorMsg('Please complete all registration fields including Full Name.');
      return;
    }
    if (passwordInput.length < 4) {
      setErrorMsg('Password must be at least 4 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await virtualEngine.registerUser({
        username: usernameInput.trim(),
        fullName: fullNameInput.trim(),
        email: normalizedEmail,
        password: passwordInput,
        avatar: selectedAvatar
      });

      if (!res.ok) {
        setErrorMsg(res.error || 'Registration failed.');
        return;
      }

      soundManager.playClick();
      setPendingEmail(res.email || normalizedEmail);
      setPendingUserId(res.pendingUserId || '');
      setGeneratedCode(res.verificationCode || '');
      setVerificationCodeInput(res.verificationCode || '');
      setRegisterStep('verify');
    } catch {
      setErrorMsg('Unable to reach server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!verificationCodeInput.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await virtualEngine.verifyRegistration(pendingEmail, verificationCodeInput.trim());
      if (!res.ok || !res.user) {
        setErrorMsg(res.error || 'Invalid verification code.');
        return;
      }

      soundManager.playBetPlaced();
      onUpdateUser(
        {
          id: res.user.id,
          email: res.user.email,
          username: res.user.username,
          fullName: res.user.fullName,
          avatar: res.user.avatar,
          balance: 0,
          verified: res.user.verified,
          createdAt: res.user.createdAt,
          totalBetsPlaced: 0,
          totalWon: 0,
          isLoggedIn: true,
          isAdmin: false
        },
        {
          placedBets: res.placedBets || [],
          fxPositions: res.fxPositions || [],
        }
      );

      setRegisterStep('form');
      setPasswordInput('');
      setVerificationCodeInput('');
      onClose();
    } catch {
      setErrorMsg('Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);
    soundManager.playClick();

    try {
      const fbUser = await signInWithGooglePopup();

      if (isFirebaseAdminUser(fbUser)) {
        await ensureBootstrappedAdminRecord(fbUser);
        const idToken = await fbUser.getIdToken();
        const adminRes = await virtualEngine.loginWithGoogleAdmin(idToken);
        if (!adminRes.ok) {
          setErrorMsg(adminRes.error || 'Admin authorization failed.');
          return;
        }
        soundManager.playBetPlaced();
        onUpdateUser({
          id: 'admin-cas9i',
          email: adminRes.email || fbUser.email || ADMIN_EMAIL,
          username: 'Admin',
          fullName: 'CAS9i Admin',
          avatar: '🛡️',
          balance: adminRes.adminBalance ?? 100000,
          isLoggedIn: true,
          isAdmin: true,
          verified: true,
        });
        onClose();
        if (onAdminLoginSuccess) onAdminLoginSuccess();
        return;
      }

      const cloudRes = await findOrCreateGoogleUser(fbUser, selectedAvatar);
      if (cloudRes.deleted || !cloudRes.user) {
        await signOutFirebase().catch(() => {});
        setErrorMsg('This account has been permanently deleted by Admin.');
        return;
      }

      const idToken = await fbUser.getIdToken();
      const serverSync = await virtualEngine.syncGoogleUserSession(idToken, cloudRes.user);
      const finalUser = serverSync.user || cloudRes.user;

      soundManager.playBetPlaced();
      onUpdateUser(
        {
          id: finalUser.id,
          email: finalUser.email,
          username: finalUser.username,
          fullName: finalUser.fullName,
          avatar: finalUser.avatar || selectedAvatar,
          balance: finalUser.balance,
          phone: finalUser.phone,
          country: finalUser.country,
          city: finalUser.city,
          address: finalUser.address,
          dateOfBirth: finalUser.dateOfBirth,
          kycIdNumber: finalUser.kycIdNumber,
          accountTier: finalUser.accountTier,
          createdAt: finalUser.createdAt,
          totalBetsPlaced: finalUser.totalBetsPlaced ?? 0,
          totalWon: finalUser.totalWon ?? 0,
          verified: true,
          isLoggedIn: true,
          isAdmin: false,
        },
        {
          placedBets: serverSync.placedBets || [],
          fxPositions: serverSync.fxPositions || [],
        }
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (msg.includes('popup-closed-by-user') || msg.includes('cancelled-popup-request')) {
        setErrorMsg('Google sign-in popup was closed. Please try again.');
      } else {
        setErrorMsg('Unable to complete Google sign-in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-[#051c11] border border-[#00e700]/30 rounded-2xl shadow-[0_0_35px_rgba(0,231,0,0.2)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#03150b] border-b border-[#00e700]/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {mode === 'register' ? '⭐' : '🔐'}
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                {mode === 'register'
                  ? registerStep === 'verify'
                    ? 'VERIFY YOUR ACCOUNT'
                    : 'CREATE CAS9i ACCOUNT'
                  : 'LOGIN TO CAS9i'}
              </h3>
              {user.isLoggedIn && !user.isAdmin && user.id !== 'guest' && (
                <span className="text-[11px] font-mono font-bold text-[#00e700] block tabular-nums">
                  Player ID: #{user.id} {user.fullName ? `· ${user.fullName}` : ''}
                </span>
              )}
            </div>
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
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
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
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${
              mode === 'register' ? 'bg-[#00ad3a] text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {errorMsg && (
            <div className="bg-red-950/80 border border-red-600/60 text-red-200 text-xs font-bold p-2.5 rounded-xl">
              {errorMsg}
            </div>
          )}

          {mode === 'login' ? (
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
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-95 transition-all mt-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Signing In...' : 'Login'}
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-zinc-800" />
                <span className="px-2 text-[10px] font-bold uppercase text-zinc-500">or</span>
                <div className="flex-grow border-t border-zinc-800" />
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleGoogleSignIn}
                className="w-full h-10 rounded-xl bg-[#062416] hover:bg-[#0b3521] border border-[#00e700]/35 text-white font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="text-sm font-black text-[#00e700]">G</span>
                <span>Continue with Google</span>
              </button>
            </form>
          ) : registerStep === 'verify' ? (
            <form onSubmit={handleVerifyRegistration} className="space-y-3.5">
              <div className="bg-[#062416] border border-[#00e700]/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-[#00e700] text-xs font-black">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Account Created — Verification Required</span>
                </div>
                <p className="text-xs text-zinc-300">
                  Assigned ID: <span className="font-mono font-black text-white tabular-nums">#{pendingUserId}</span> · {pendingEmail}
                </p>
                {generatedCode && (
                  <div className="bg-[#03150b] border border-[#00e700]/25 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-bold">Verification Code:</span>
                    <span className="font-mono font-black text-sm text-[#00e700] tracking-widest tabular-nums">
                      {generatedCode}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-bold block mb-1">Enter 6-Digit Verification Code</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verificationCodeInput}
                    onChange={e => setVerificationCodeInput(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full bg-[#062416] border border-[#00e700]/30 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono font-black text-white tracking-widest focus:outline-none focus:border-[#00e700]"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setErrorMsg(null);
                    setRegisterStep('form');
                  }}
                  className="h-11 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs whitespace-nowrap"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify & Activate Account'}
                </button>
              </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs text-zinc-400 font-bold block mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullNameInput}
                      onChange={e => setFullNameInput(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-[#062416] border border-[#00e700]/30 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#00e700]"
                    />
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
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,231,0,0.4)] hover:brightness-110 active:scale-95 transition-all mt-1 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating Account...' : 'Continue to Verification'}
              </button>

              <div className="relative flex items-center py-0.5">
                <div className="flex-grow border-t border-zinc-800" />
                <span className="px-2 text-[10px] font-bold uppercase text-zinc-500">or</span>
                <div className="flex-grow border-t border-zinc-800" />
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleGoogleSignIn}
                className="w-full h-10 rounded-xl bg-[#062416] hover:bg-[#0b3521] border border-[#00e700]/35 text-white font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="text-sm font-black text-[#00e700]">G</span>
                <span>Register with Google</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
