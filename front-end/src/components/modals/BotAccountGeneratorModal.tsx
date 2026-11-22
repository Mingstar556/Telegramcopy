import React, { useState, useMemo } from 'react';
import {
  X,
  Bot,
  KeyRound,
  ShieldCheck,
  Check,
  Copy,
  Download,
  FileText,
  Sparkles,
  Loader2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  UserCheck,
  Plus,
  RefreshCw,
  LogIn
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { GeneratedAccount, GenerateAccountsPayload } from '../../types/auth';

interface BotAccountGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAccountForLogin?: (userId: string, password: string) => void;
}

export const BotAccountGeneratorModal: React.FC<BotAccountGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSelectAccountForLogin
}) => {
  const { theme } = useTheme();
  const { login } = useAuth();
  const isGold = theme === 'black-gold';

  // Form State
  const [tokenCount, setTokenCount] = useState<number>(1);
  const [rawTokens, setRawTokens] = useState<string>('');
  const [idPrefix, setIdPrefix] = useState<string>('auto');
  const [passwordType, setPasswordType] = useState<'memorable' | 'random' | 'custom'>('memorable');
  const [customPassword, setCustomPassword] = useState<string>('');
  const [fetchTelegramInfo, setFetchTelegramInfo] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Execution State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedAccounts, setGeneratedAccounts] = useState<GeneratedAccount[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Parse detected tokens
  const detectedTokens = useMemo(() => {
    return rawTokens
      .split(/[\r\n,]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && !t.startsWith('#'));
  }, [rawTokens]);

  const activeCount = detectedTokens.length > 0 ? detectedTokens.length : tokenCount;

  if (!isOpen) return null;

  const handleCopy = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const payload: GenerateAccountsPayload = {
        tokens: detectedTokens.length > 0 ? detectedTokens : undefined,
        count: detectedTokens.length === 0 ? tokenCount : undefined,
        idPrefix,
        passwordType,
        customPassword: passwordType === 'custom' ? customPassword : '',
        fetchTelegramInfo,
        overwrite: true
      };

      const res = await api.generateBotAccounts(payload);
      if (res.status === 'success' && res.accounts) {
        setGeneratedAccounts(res.accounts);
      } else {
        setErrorMsg(res.message || 'Failed to generate accounts.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Server connection error during account generation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAll = () => {
    if (generatedAccounts.length === 0) return;
    const header = `=== TELEGRAM WEB OPERATOR ACCOUNTS (${generatedAccounts.length} Total) ===\nGenerated on: ${new Date().toLocaleString()}\n\n`;
    const body = generatedAccounts
      .map(
        (a, i) =>
          `[Account #${i + 1}]\n` +
          `User-ID   : ${a.userId}\n` +
          `Password  : ${a.password}\n` +
          `Bot Name  : ${a.botName} (@${a.botUsername})\n` +
          `Bot Token : ${a.botToken}\n` +
          `-----------------------------------------`
      )
      .join('\n\n');
    navigator.clipboard.writeText(header + body);
    handleCopy(header + body, 'copy-all');
  };

  const handleExportCSV = () => {
    if (generatedAccounts.length === 0) return;
    const headers = ['User-ID', 'Password', 'Bot Name', 'Bot Username', 'Telegram Bot Key', 'Verified', 'Status'];
    const rows = generatedAccounts.map(a => [
      `"${a.userId}"`,
      `"${a.password}"`,
      `"${a.botName}"`,
      `"@${a.botUsername}"`,
      `"${a.botToken}"`,
      `"${a.telegramVerified ? 'Yes' : 'No'}"`,
      `"${a.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tbot_accounts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTXT = () => {
    if (generatedAccounts.length === 0) return;
    const header = `=== TELEGRAM WEB OPERATOR ACCOUNTS ===\nTotal Accounts: ${generatedAccounts.length}\nDate: ${new Date().toLocaleString()}\n\n`;
    const body = generatedAccounts
      .map(
        (a, i) =>
          `Account #${i + 1}\n` +
          `User-ID     : ${a.userId}\n` +
          `Password    : ${a.password}\n` +
          `Bot Name    : ${a.botName}\n` +
          `Username    : @${a.botUsername}\n` +
          `Bot Token   : ${a.botToken}\n` +
          `Verified    : ${a.telegramVerified ? 'YES' : 'NO'}\n` +
          `----------------------------------------------------`
      )
      .join('\n\n');
    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tbot_accounts_${new Date().toISOString().slice(0, 10)}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDirectLogin = async (acc: GeneratedAccount) => {
    if (onSelectAccountForLogin) {
      onSelectAccountForLogin(acc.userId, acc.password);
      onClose();
    } else {
      try {
        await login({ userId: acc.userId, password: acc.password });
        onClose();
      } catch (err: any) {
        alert(`Login failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[26px] border shadow-2xl overflow-hidden transition-all duration-200 ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_0_50px_rgba(212,175,55,0.15)]'
            : 'bg-[#12161f] border-[#222e3d] text-white shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                isGold
                  ? 'bg-gradient-to-tr from-[#997d26] to-[#f3c853] text-black'
                  : 'bg-gradient-to-tr from-[#229ad6] to-[#2aabee] text-white'
              }`}
            >
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight">Bot Account Generator</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                  ADMIN TOOL
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Input your Telegram Bot keys to automatically generate web operator logins.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* GENERATED RESULTS VIEW */}
          {generatedAccounts.length > 0 ? (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Success Banner & Actions */}
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">
                      Successfully Generated {generatedAccounts.length} Web Account{generatedAccounts.length > 1 ? 's' : ''}!
                    </h4>
                    <p className="text-[11px] text-emerald-200/70">
                      Accounts are live in the database. Staff can log in immediately with their User-ID and Password.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyAll}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                  >
                    {copiedKey === 'copy-all' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'copy-all' ? 'Copied!' : 'Copy All'}</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                    title="Export CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={handleExportTXT}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                    title="Export TXT"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>TXT</span>
                  </button>
                </div>
              </div>

              {/* Account Cards */}
              <div className="space-y-3">
                {generatedAccounts.map((acc, index) => {
                  const isPwRevealed = !!revealedPasswords[acc.userId];
                  return (
                    <div
                      key={acc.userId + index}
                      className={`p-4 rounded-2xl border transition-all ${
                        isGold ? 'bg-[#15130b] border-[#38301a]' : 'bg-[#171d26] border-[#253242]'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Bot Identity */}
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {acc.avatar ? (
                              <img src={acc.avatar} alt={acc.botName} className="w-11 h-11 rounded-2xl object-cover" />
                            ) : (
                              <div className="w-11 h-11 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                                {acc.botName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#171d26]" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{acc.botName}</span>
                              <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                                @{acc.botUsername}
                              </span>
                              {acc.telegramVerified && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                                  Telegram Verified
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5 font-mono">
                              Key: {acc.botTokenMasked}
                            </div>
                          </div>
                        </div>

                        {/* Direct Login Button */}
                        <button
                          type="button"
                          onClick={() => handleDirectLogin(acc)}
                          className={`self-start sm:self-center px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md ${
                            isGold
                              ? 'bg-gradient-to-r from-[#d4af37] to-[#f3c853] text-black hover:brightness-110'
                              : 'bg-[#2aabee] hover:bg-[#229ad6] text-white'
                          }`}
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>Log In Now</span>
                        </button>
                      </div>

                      {/* Credentials Row */}
                      <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* User-ID */}
                        <div className="p-2.5 rounded-xl bg-black/40 flex items-center justify-between border border-white/5">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">User-ID</div>
                            <div className="font-mono font-semibold text-white mt-0.5">{acc.userId}</div>
                          </div>
                          <button
                            onClick={() => handleCopy(acc.userId, `uid-${acc.userId}`)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition"
                            title="Copy User-ID"
                          >
                            {copiedKey === `uid-${acc.userId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Password */}
                        <div className="p-2.5 rounded-xl bg-black/40 flex items-center justify-between border border-white/5">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Password</div>
                            <div className="font-mono font-semibold text-white mt-0.5">
                              {isPwRevealed ? acc.password : '••••••••••••'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(acc.userId)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition"
                              title={isPwRevealed ? 'Hide Password' : 'Show Password'}
                            >
                              {isPwRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopy(acc.password, `pw-${acc.userId}`)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition"
                              title="Copy Password"
                            >
                              {copiedKey === `pw-${acc.userId}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reset to generate more */}
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => setGeneratedAccounts([])}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate Another Batch</span>
                </button>
              </div>
            </div>
          ) : (
            /* CONFIGURATION & INPUT FORM */
            <form onSubmit={handleGenerate} className="space-y-5">
              {/* Step 1: Number of Keys */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                  1. How many Telegram-Bot keys do you have?
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-black/40 rounded-2xl border border-white/10 p-1">
                    <button
                      type="button"
                      onClick={() => setTokenCount(prev => Math.max(1, prev - 1))}
                      className="w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center font-bold text-lg text-zinc-400 hover:text-white transition"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={tokenCount}
                      onChange={e => setTokenCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 text-center bg-transparent font-bold text-base outline-none text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setTokenCount(prev => prev + 1)}
                      className="w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center font-bold text-lg text-zinc-400 hover:text-white transition"
                    >
                      +
                    </button>
                  </div>

                  {/* Preset count pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[1, 2, 3, 5, 10].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setTokenCount(cnt)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          tokenCount === cnt && detectedTokens.length === 0
                            ? isGold
                              ? 'bg-[#d4af37]/20 border border-[#d4af37] text-[#f3c853]'
                              : 'bg-[#2aabee]/20 border border-[#2aabee] text-[#2aabee]'
                            : 'bg-white/5 border border-white/5 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {cnt} {cnt === 1 ? 'Key' : 'Keys'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 2: Paste Telegram Bot Tokens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    2. Paste Telegram Bot Tokens / Keys
                  </label>
                  {detectedTokens.length > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{detectedTokens.length} token(s) detected</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    value={rawTokens}
                    onChange={e => setRawTokens(e.target.value)}
                    placeholder="Paste tokens here (one per line, e.g.):&#10;9197397912:AAHC1HOhNvV-exC9uzRBsHZ6BJbmTFEoXyo&#10;9273467556:AAGsimmiJEQIoiuep62Xtuw_VcXOzaHWB3U"
                    className={`w-full p-3.5 rounded-2xl text-xs font-mono outline-none transition border resize-none ${
                      isGold
                        ? 'bg-[#15130b] border-[#38301a] text-white focus:border-[#d4af37]'
                        : 'bg-[#19222c] border-[#253242] text-white focus:border-[#2aabee]'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                  Tip: Get your bot tokens from Telegram&apos;s <strong>@BotFather</strong>. If left blank, demo/simulated bot accounts will be generated.
                </p>
              </div>

              {/* Collapsible Advanced Settings */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(prev => !prev)}
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--color-accent)] hover:opacity-80 transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{showAdvanced ? 'Hide Advanced Options' : 'Configure ID & Password Format'}</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-4 rounded-2xl bg-black/30 border border-white/5 space-y-4 text-xs animate-in fade-in duration-150">
                    {/* User ID Naming Strategy */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[var(--color-text-muted)] mb-1.5">
                        User-ID Format
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'auto', label: 'Bot Username', desc: 'e.g. ah_fu_bot' },
                          { key: 'op_', label: 'Operator Index', desc: 'e.g. op_1, op_2' },
                          { key: 'bot_', label: 'Bot Prefix', desc: 'e.g. bot_1, bot_2' }
                        ].map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setIdPrefix(opt.key)}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              idPrefix === opt.key
                                ? isGold
                                  ? 'border-[#d4af37] bg-[#d4af37]/10 text-white font-bold'
                                  : 'border-[#2aabee] bg-[#2aabee]/10 text-white font-bold'
                                : 'border-white/5 bg-white/[0.02] text-zinc-400'
                            }`}
                          >
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Password Type */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-[var(--color-text-muted)] mb-1.5">
                        Password Style
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'memorable', label: 'Memorable Code', desc: 'e.g. BotPass_7821' },
                          { key: 'random', label: 'High Entropy', desc: 'e.g. k9J_mX2qL' },
                          { key: 'custom', label: 'Unified Password', desc: 'Specify manually' }
                        ].map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setPasswordType(opt.key as any)}
                            className={`p-2.5 rounded-xl border text-left transition ${
                              passwordType === opt.key
                                ? isGold
                                  ? 'border-[#d4af37] bg-[#d4af37]/10 text-white font-bold'
                                  : 'border-[#2aabee] bg-[#2aabee]/10 text-white font-bold'
                                : 'border-white/5 bg-white/[0.02] text-zinc-400'
                            }`}
                          >
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{opt.desc}</div>
                          </button>
                        ))}
                      </div>

                      {passwordType === 'custom' && (
                        <div className="mt-2.5">
                          <input
                            type="text"
                            value={customPassword}
                            onChange={e => setCustomPassword(e.target.value)}
                            placeholder="Enter password for all generated accounts"
                            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {/* Fetch live bot data toggle */}
                    <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={fetchTelegramInfo}
                        onChange={e => setFetchTelegramInfo(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-500"
                      />
                      <span className="text-[11px] text-zinc-300">
                        Query Telegram Bot API to fetch actual Bot Name, Username, and Avatar photo
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-4 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition active:scale-[0.98] ${
                  isGold
                    ? 'bg-gradient-to-r from-[#d4af37] via-[#f3c853] to-[#d4af37] text-black hover:brightness-110 shadow-[#d4af37]/25'
                    : 'bg-[#2aabee] hover:bg-[#229ad6] text-white shadow-[#2aabee]/25'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating Keys & Generating Accounts...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>
                      Generate {activeCount} Web Operator Account{activeCount > 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
