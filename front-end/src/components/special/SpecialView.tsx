import React, { useState } from 'react';
import {
  Activity,
  Bot,
  Check,
  Copy,
  Cpu,
  MessageSquare,
  Radio,
  Send,
  Shield,
  Sparkles,
  Zap
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';

interface QuickTemplate {
  id: string;
  category: string;
  text: string;
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 't1',
    category: 'Greeting',
    text: 'Hello! Welcome to our customer support channel. How may we assist you today?'
  },
  {
    id: 't2',
    category: 'Acknowledgement',
    text: 'Thank you for reaching out. A dedicated support operator is reviewing your request.'
  },
  {
    id: 't3',
    category: 'Verification',
    text: 'Your credentials and verification token have been successfully confirmed. You are all set!'
  },
  {
    id: 't4',
    category: 'Business Hours',
    text: 'Our primary operating hours are Monday through Friday, 09:00 - 18:00 UTC.'
  },
  {
    id: 't5',
    category: 'Security',
    text: 'Security Reminder: Official staff will never ask for your private passwords or 2FA keys.'
  }
];

export const SpecialView: React.FC = () => {
  const { account, isMockMode } = useAuth();
  const { activeChat, sendMessage, triggerShowcaseEvent } = useChat();
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSendToActive = async (id: string, text: string) => {
    if (!activeChat) return;
    setSendingId(id);
    try {
      await sendMessage(text);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Banner */}
        <div
          className={`p-6 rounded-3xl border shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
            isGold
              ? 'bg-[#0f0e0a] border-[#38301a] text-[#f5f2eb] shadow-[0_0_35px_rgba(212,175,55,0.08)]'
              : 'bg-[#121318] border-white/10 text-white shadow-xl'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                isGold ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-[#2aabee]/20 text-[#2aabee]'
              }`}
            >
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">Telegram Bot Quick Tools</h2>
                {isGold && <Sparkles className="w-4 h-4 text-[#e5b842]" />}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Real-time gateway diagnostics, bot session metadata & canned reply tools.
              </p>
            </div>
          </div>

          {/* Connection Status Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Shared Bot Gateway Active</span>
          </div>
        </div>

        {/* System & Connectivity Diagnostics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Bot Identity & Mode */}
          <div
            className={`p-4 rounded-2xl border ${
              isGold ? 'bg-[#0a0907] border-[#38301a]/70' : 'bg-[#15161d] border-white/5'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] mb-3">
              <Shield className="w-4 h-4 text-[var(--color-accent)]" />
              <span>BOT IDENTIFIER & AUTH</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[var(--color-text-muted)]">Bot Username</span>
                <span className="font-mono font-bold text-[var(--color-text-main)]">
                  {account?.botName || 'Telegram Shared Bot'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[var(--color-text-muted)]">Operator EMP ID</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  EMP #{account?.userId || '1234'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--color-text-muted)]">Gateway Mode</span>
                <span className="font-mono text-[var(--color-accent)]">
                  {isMockMode ? 'Local Mock Mode' : 'Django Channels Live'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Transport & Latency */}
          <div
            className={`p-4 rounded-2xl border ${
              isGold ? 'bg-[#0a0907] border-[#38301a]/70' : 'bg-[#15161d] border-white/5'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)] mb-3">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>TRANSPORT CHANNELS</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[var(--color-text-muted)]">REST API Base</span>
                <span className="font-mono text-emerald-400 font-semibold">127.0.0.1:8000 (HTTP)</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-white/5">
                <span className="text-[var(--color-text-muted)]">WebSocket Pub/Sub</span>
                <span className="font-mono text-emerald-400 font-semibold">/ws/chat/ (Live)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--color-text-muted)]">Multi-Device Sync</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Concurrent Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Simulation Testing Controls */}
        <div
          className={`p-5 rounded-2xl border ${
            isGold ? 'bg-[#0a0907] border-[#38301a]/70' : 'bg-[#15161d] border-white/5'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)]">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>LOCAL SIMULATED CLIENT EVENTS</span>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Target: {activeChat ? activeChat.user.firstName : 'First client'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => triggerShowcaseEvent?.('text')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 btn-press transition ${
                isGold
                  ? 'bg-[#18150d] border-[#38301a] text-[#f7f4ec] hover:border-[#e5b842]'
                  : 'bg-white/5 border-white/10 hover:border-[var(--color-accent)] text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Simulate Text Msg</span>
            </button>
            <button
              onClick={() => triggerShowcaseEvent?.('voice')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 btn-press transition ${
                isGold
                  ? 'bg-[#18150d] border-[#38301a] text-[#f7f4ec] hover:border-[#e5b842]'
                  : 'bg-white/5 border-white/10 hover:border-[#e5b842] text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>Simulate Voice Note</span>
            </button>
            <button
              onClick={() => triggerShowcaseEvent?.('typing')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 btn-press transition ${
                isGold
                  ? 'bg-[#18150d] border-[#38301a] text-[#f7f4ec] hover:border-[#e5b842]'
                  : 'bg-white/5 border-white/10 hover:border-emerald-400 text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate Typing</span>
            </button>
          </div>
        </div>

        {/* Canned Quick-Response Message Templates */}
        <div
          className={`p-5 rounded-2xl border ${
            isGold ? 'bg-[#0a0907] border-[#38301a]/70' : 'bg-[#15161d] border-white/5'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)]">
              <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />
              <span>CANNED QUICK-RESPONSE TEMPLATES</span>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              One-click copy or direct insert
            </span>
          </div>

          <div className="space-y-2.5">
            {QUICK_TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                  isGold
                    ? 'bg-[#12110c] border-[#38301a]/60 hover:border-[#e5b842]/40'
                    : 'bg-white/[0.03] border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-[var(--color-accent)] inline-block mb-1">
                    {tmpl.category}
                  </span>
                  <p className="text-xs text-[var(--color-text-main)] leading-relaxed select-text">
                    "{tmpl.text}"
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(tmpl.id, tmpl.text)}
                    className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium flex items-center gap-1.5 btn-press transition text-[var(--color-text-muted)] hover:text-white"
                    title="Copy template to clipboard"
                  >
                    {copiedId === tmpl.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {/* Send Button if chat is active */}
                  {activeChat && (
                    <button
                      onClick={() => handleSendToActive(tmpl.id, tmpl.text)}
                      disabled={sendingId === tmpl.id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 btn-press transition ${
                        isGold
                          ? 'bg-[#e5b842] text-black hover:bg-[#f3c853]'
                          : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
                      }`}
                      title={`Send directly to ${activeChat.user.firstName}`}
                    >
                      <Send className="w-3 h-3" />
                      <span>{sendingId === tmpl.id ? 'Sending...' : 'Send'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
