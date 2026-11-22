import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Bot,
  ShieldCheck,
  CheckCircle2,
  Copy,
  UserPlus,
  Users,
  Check,
  Trash2,
  Lock,
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotification } from '../../contexts/NotificationContext';
import { Avatar } from '../common/Avatar';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose }) => {
  const { account, accounts, switchAccount, addAccount, removeAccount, refreshUserData } = useAuth();
  const { theme } = useTheme();
  const { notify } = useNotification();

  const [activeView, setActiveView] = useState<'profile' | 'accounts' | 'add'>('profile');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Add Account form state
  const [newUserId, setNewUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

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

  const handleSwitchAccount = (id: string) => {
    if (id === account.userId) return;
    switchAccount(id);
    notify({
      title: 'Account Switched',
      message: `Switched active bot session`,
      type: 'success'
    });
  };

  const handleAddNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim() || !newPassword.trim()) {
      setAddError('Please enter both User ID and Password');
      return;
    }

    setAddLoading(true);
    setAddError('');
    try {
      await addAccount({ userId: newUserId.trim(), password: newPassword.trim() });
      notify({
        title: 'Account Added',
        message: 'Successfully connected new bot account',
        type: 'success'
      });
      setNewUserId('');
      setNewPassword('');
      setActiveView('accounts');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAddError(msg === 'INVALID_CREDENTIALS' ? 'Invalid User-ID or Password' : msg);
    } finally {
      setAddLoading(false);
    }
  };

  const fillTestCredentials = (uid: string, pass: string) => {
    setNewUserId(uid);
    setNewPassword(pass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl relative flex flex-col max-h-[90vh] animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_0_50px_rgba(212,175,55,0.15)]'
            : 'bg-[#121318] border-white/10 text-white'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--color-text-muted)] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition btn-press z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1.5 pb-3 border-b border-white/10 mb-4 select-none">
          <button
            onClick={() => setActiveView('profile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              activeView === 'profile'
                ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>

          <button
            onClick={() => setActiveView('accounts')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              activeView === 'accounts'
                ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Accounts ({accounts.length})</span>
          </button>

          <button
            onClick={() => setActiveView('add')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              activeView === 'add'
                ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>
        </div>

        {/* 1. ACTIVE PROFILE VIEW */}
        {activeView === 'profile' && (
          <div className="overflow-y-auto flex-1">
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

            <div className="py-4 space-y-3 text-xs">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/30 border border-white/5">
                <div>
                  <div className="text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-semibold">
                    Staff Operator ID
                  </div>
                  <div className="font-mono text-sm font-semibold mt-0.5 text-white flex items-center gap-2">
                    <span>EMP-{account.userId}</span>
                  </div>
                </div>
                <button
                  onClick={copyUserId}
                  className="p-2 rounded-xl hover:bg-white/10 text-[var(--color-accent)] transition btn-press"
                  title="Copy User ID"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/30 border border-white/5">
                <div className="text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] font-semibold">
                  Description / Role
                </div>
                <div className="mt-1 text-[var(--color-text-main)] leading-relaxed">
                  {account.description || 'Interactive Telegram bot operator instance connected to Python/Django backend.'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
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
                <span>Sync Profile</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. SAVED ACCOUNTS LIST VIEW */}
        {activeView === 'accounts' && (
          <div className="overflow-y-auto flex-1 space-y-3">
            <div className="text-xs text-[var(--color-text-muted)]">
              Switch between connected Telegram operator accounts without re-entering credentials.
            </div>

            <div className="space-y-2">
              {accounts.map((acc) => {
                const isActive = acc.userId === account.userId;
                return (
                  <div
                    key={acc.userId}
                    onClick={() => handleSwitchAccount(acc.userId)}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer group ${
                      isActive
                        ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 ring-1 ring-[var(--color-accent)]/20'
                        : 'bg-black/30 border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        id={acc.userId}
                        name={acc.botName}
                        avatarUrl={acc.avatar}
                        size="sm"
                        isOnline={true}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                          <span>{acc.botName}</span>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">
                          EMP-{acc.userId} • @{acc.botUsername}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isActive ? (
                        <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center">
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAccount(acc.userId);
                          }}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-[var(--color-text-muted)] hover:text-red-400 transition"
                          title="Remove Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setActiveView('add')}
              className="w-full py-2.5 rounded-2xl border border-dashed border-white/20 hover:border-[var(--color-accent)]/50 text-xs font-semibold flex items-center justify-center gap-2 text-[var(--color-text-muted)] hover:text-white transition btn-press mt-3"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Another Account</span>
            </button>
          </div>
        )}

        {/* 3. ADD NEW ACCOUNT FORM VIEW */}
        {activeView === 'add' && (
          <form onSubmit={handleAddNewAccount} className="overflow-y-auto flex-1 space-y-4">
            <div className="text-xs text-[var(--color-text-muted)]">
              Sign in to another bot instance to seamlessly switch between multiple Telegram accounts.
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                {addError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] block mb-1">
                  User ID / Bot ID
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 focus-within:border-[var(--color-accent)]">
                  <UserIcon className="w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="e.g. 1234 or bot_id"
                    className="w-full bg-transparent border-0 outline-none text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--color-text-muted)] block mb-1">
                  Password / Secret Key
                </label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 focus-within:border-[var(--color-accent)]">
                  <Lock className="w-4 h-4 text-zinc-500" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-transparent border-0 outline-none text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Quick Demo Helper */}
            <div className="p-3 rounded-2xl bg-black/30 border border-white/5 text-[11px]">
              <span className="text-zinc-400">Quick Test Credentials:</span>
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => fillTestCredentials('1234', '1234')}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 font-mono text-zinc-300"
                >
                  UID: 1234
                </button>
                <button
                  type="button"
                  onClick={() => fillTestCredentials('bot_89201948', 'django_secret_pass')}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 font-mono text-zinc-300"
                >
                  Django Bot
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={addLoading}
              className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)] font-semibold text-xs flex items-center justify-center gap-2 shadow-md btn-press hover:bg-[var(--color-accent-hover)]"
            >
              {addLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span>Connect & Switch Account</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
