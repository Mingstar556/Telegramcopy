import React, { useState } from 'react';
import { X, RefreshCw, Bot, ShieldCheck, CheckCircle2, Copy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Avatar } from '../common/Avatar';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { account, refreshUserData, isMockMode } = useAuth();
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !account) return null;

  const isGold = theme === 'black-gold';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUserData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(account.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl relative animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_0_50px_rgba(212,175,55,0.15)]'
            : 'bg-[#121318] border-white/10 text-white'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--color-text-muted)] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition btn-press"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold flex items-center gap-2 tracking-tight">
            <Bot className="w-5 h-5 text-[var(--color-accent)]" />
            <span>Staff Bot Profile</span>
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3 h-3" />
            <span>EMPLOYEE ONLY</span>
          </span>
        </div>

        {/* Avatar & Bot Identity */}
        <div className="flex flex-col items-center text-center pb-5 border-b border-white/5">
          <div className="mb-3">
            <Avatar
              id={account.userId}
              name={account.botName}
              avatarUrl={account.avatar}
              size="xl"
              isOnline={true}
            />
          </div>
          <h4 className="text-xl font-bold tracking-tight">{account.botName}</h4>
          <span className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">
            @{account.botUsername}
          </span>
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-soft-pulse" />
            <span>Active Telegram Bot Session</span>
          </div>
        </div>

        {/* Details list */}
        <div className="py-4 space-y-3 text-xs">
          {/* User ID & Employee Role */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/30 border border-white/5">
            <div>
              <div className="text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-semibold">
                Staff Operator ID / Department
              </div>
              <div className="font-mono text-sm font-semibold mt-0.5 text-white flex items-center gap-2">
                <span>EMP-{account.userId}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-sans font-medium">Customer Operations</span>
              </div>
            </div>
            <button
              onClick={copyUserId}
              className="p-2 rounded-xl hover:bg-white/10 text-[var(--color-accent)] transition flex items-center gap-1 btn-press"
              title="Copy User ID"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Description */}
          <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5">
            <div className="text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-semibold">
              Description / Role
            </div>
            <div className="mt-1 text-[var(--color-text-main)] leading-relaxed">
              {account.description || 'Interactive Telegram bot operator instance connected to Python/Django backend.'}
            </div>
          </div>

          {/* Connection */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/30 border border-white/5">
            <div>
              <div className="text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-semibold">
                Backend Connection
              </div>
              <div className="font-semibold text-xs mt-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Live Django REST + WebSocket</span>
              </div>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
              {account.connectedAt || 'Connected'}
            </span>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition btn-press ${
              isGold
                ? 'bg-[#18150d] border-[#38301a] text-[#e5b842] hover:bg-[#252014]'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Check Data from Django</span>
          </button>

          <button
            onClick={onClose}
            className={`py-2.5 px-5 rounded-xl text-xs font-semibold transition btn-press ${
              isGold
                ? 'bg-[#e5b842] text-black hover:bg-[#f3c853]'
                : 'bg-[#2aabee] text-white hover:bg-[#38bdf8]'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
