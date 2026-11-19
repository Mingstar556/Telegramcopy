import React, { useState } from 'react';
import { Bot, KeyRound, Loader2, Sparkles, User, ShieldCheck, Database, AlertOctagon, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export const LoginModal: React.FC = () => {
  const { login, isLoading, error, isMockMode, setMockMode } = useAuth();
  const { theme, setTheme } = useTheme();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showRedErrorScreen, setShowRedErrorScreen] = useState(false);
  const [redScreenErrorMsg, setRedScreenErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      triggerRedErrorScreen('Please enter both User ID and Password.');
      return;
    }

    try {
      await login({ userId: userId.trim(), password: password.trim() });
    } catch {
      triggerRedErrorScreen('Access Denied: Invalid User ID or Password (Test Account: 1234 / 1234)');
    }
  };

  const triggerRedErrorScreen = (msg: string) => {
    setRedScreenErrorMsg(msg);
    setShowRedErrorScreen(true);
  };

  const handleDismissRedScreen = () => {
    setShowRedErrorScreen(false);
  };

  const handleQuickDemoFill = (id = '1234', pass = '1234') => {
    setUserId(id);
    setPassword(pass);
    setShowRedErrorScreen(false);
  };

  const isGold = theme === 'black-gold';

  // ----------------------------------------------------
  // LOADING RED ERROR SCREEN (when login credentials fail)
  // ----------------------------------------------------
  if (showRedErrorScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-950/95 backdrop-blur-xl animate-in fade-in duration-200">
        <div className="w-full max-w-md rounded-3xl p-8 border border-red-500/50 bg-[#1c0707] text-white shadow-[0_0_60px_rgba(239,68,68,0.4)] text-center flex flex-col items-center animate-bounce-short">
          {/* Pulsing red alert icon */}
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-5 animate-pulse">
            <AlertOctagon className="w-10 h-10 text-red-400 stroke-[2.3]" />
          </div>

          <h2 className="text-2xl font-extrabold text-red-200 tracking-tight">
            Authentication Failed
          </h2>

          <p className="text-sm text-red-300/90 mt-2 leading-relaxed">
            {redScreenErrorMsg}
          </p>

          <div className="my-5 p-3.5 rounded-2xl bg-red-900/30 border border-red-500/30 text-xs text-red-200 w-full space-y-1">
            <div className="font-semibold text-white">Valid Test Account Credentials:</div>
            <div>User ID: <span className="font-mono font-bold text-yellow-300">1234</span></div>
            <div>Password: <span className="font-mono font-bold text-yellow-300">1234</span></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={() => handleQuickDemoFill('1234', '1234')}
              className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Autofill 1234</span>
            </button>

            <button
              type="button"
              onClick={handleDismissRedScreen}
              className="py-3 px-5 rounded-xl border border-red-500/40 hover:bg-red-900/40 text-red-200 font-semibold text-sm transition active:scale-95 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // STANDARD TELEGRAM LOGIN GATE (EMPLOYEE ONLY)
  // ----------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div
        className={`w-full max-w-md rounded-[28px] p-6 sm:p-8 border shadow-2xl transition-all duration-300 ${
          isGold
            ? 'bg-[#0d0c08] border-[#38301a] text-[#f5f2eb] shadow-[0_0_40px_rgba(212,175,55,0.12)]'
            : 'bg-[#141b24] border-[#222e3d] text-white shadow-2xl'
        }`}
      >
        {/* Telegram Icon & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          {/* Employee Access Only Pill Badge */}
          <div className="mb-3 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">Employee Portal • Staff Only</span>
          </div>

          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 transition-transform hover:scale-105 ${
              isGold
                ? 'bg-gradient-to-tr from-[#997d26] via-[#d4af37] to-[#f3c853] text-black shadow-lg shadow-[#d4af37]/20'
                : 'bg-gradient-to-tr from-[#229ad6] to-[#2aabee] text-white shadow-lg shadow-[#2aabee]/25'
            }`}
          >
            <Bot className="w-8 h-8 stroke-[2.2]" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight">
            Telegram Operator Terminal
          </h2>
          <p className="text-xs sm:text-sm mt-1 text-[var(--color-text-muted)]">
            Authorized employee portal to manage live chats, groups, and customer queries.
          </p>
        </div>

        {/* Backend Mode & Theme Switcher Badges */}
        <div className="flex items-center justify-between mb-5 px-3 py-2 rounded-2xl bg-black/40 border border-white/5 text-xs">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[var(--color-text-muted)]">Backend:</span>
            <span className="font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
              Django Live
            </span>
          </div>

          <button
            type="button"
            onClick={() => setTheme(isGold ? 'simple-black' : 'black-gold')}
            className="flex items-center gap-1 text-[var(--color-accent)] hover:opacity-80 transition font-medium"
            title="Switch Theme"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGold ? 'Gold Theme' : 'Black Theme'}</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--color-text-muted)]">
              Employee User ID
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="1234"
                autoFocus
                className={`w-full pl-10 pr-4 py-3 rounded-2xl text-base sm:text-sm outline-none transition duration-200 border ${
                  isGold
                    ? 'bg-[#15130b] border-[#38301a] text-white focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]'
                    : 'bg-[#19222c] border-[#253242] text-white focus:border-[#2aabee] focus:ring-1 focus:ring-[#2aabee]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--color-text-muted)]">
              Operator Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className={`w-full pl-10 pr-4 py-3 rounded-2xl text-base sm:text-sm outline-none transition duration-200 border ${
                  isGold
                    ? 'bg-[#15130b] border-[#38301a] text-white focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]'
                    : 'bg-[#19222c] border-[#253242] text-white focus:border-[#2aabee] focus:ring-1 focus:ring-[#2aabee]'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3.5 px-4 rounded-full font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition duration-200 active:scale-[0.98] ${
              isGold
                ? 'bg-gradient-to-r from-[#d4af37] via-[#f3c853] to-[#d4af37] text-black hover:brightness-110 shadow-[#d4af37]/20 font-bold'
                : 'bg-[#2aabee] hover:bg-[#229ad6] text-white shadow-[#2aabee]/25'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Log In as Staff Operator</span>
              </>
            )}
          </button>
        </form>

        {/* 1-click test fill: 1234 / 1234 */}
        <div className="mt-5 flex items-center justify-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => handleQuickDemoFill('1234', '1234')}
            className="px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[var(--color-accent)] hover:bg-white/10 transition font-medium flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Staff Test Account (1234 / 1234)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
