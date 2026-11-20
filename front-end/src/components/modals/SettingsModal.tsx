import React, { useState } from 'react';
import { X, User, Palette, MessageSquare, Type, Sparkles, Check, Database, Sliders } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { FontFamily } from '../../types/theme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { account, isMockMode, setMockMode } = useAuth();
  const { theme, setTheme, settings, updateSettings, resetSettings } = useTheme();
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'theme'>('details');

  if (!isOpen) return null;

  const isGold = theme === 'black-gold';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_0_50px_rgba(212,175,55,0.15)]'
            : 'bg-[#121318] border-white/10 text-white shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-base font-bold flex items-center gap-2 tracking-tight">
            <Sliders className="w-4 h-4 text-[var(--color-accent)]" />
            <span>Settings</span>
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition btn-press"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Apple-style Rounded Segmented Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 bg-black/20 border-b border-white/5">
          <div className="flex p-1 rounded-full bg-black/40 border border-white/5 gap-1">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all btn-press ${
                activeTab === 'details'
                  ? isGold
                    ? 'bg-[#e5b842] text-black font-bold shadow-sm'
                    : 'bg-[var(--color-accent)] text-white font-bold shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Staff Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all btn-press ${
                activeTab === 'chat'
                  ? isGold
                    ? 'bg-[#e5b842] text-black font-bold shadow-sm'
                    : 'bg-[var(--color-accent)] text-white font-bold shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat Settings</span>
            </button>

            <button
              onClick={() => setActiveTab('theme')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all btn-press ${
                activeTab === 'theme'
                  ? isGold
                    ? 'bg-[#e5b842] text-black font-bold shadow-sm'
                    : 'bg-[var(--color-accent)] text-white font-bold shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Theme</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {/* TAB 1: USER DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="text-xs uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                  Bot Profile Data
                </div>

                <div className="flex justify-between items-center py-1 border-b border-white/5 text-xs">
                  <span className="text-[var(--color-text-muted)]">Employee ID</span>
                  <span className="font-mono font-bold text-white flex items-center gap-1.5">
                    <span>{account?.userId || '1234'}</span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-white/5 text-xs">
                  <span className="text-[var(--color-text-muted)]">Assigned Bot</span>
                  <span className="font-semibold">{account?.botName || 'Telegram Bot'}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-white/5 text-xs">
                  <span className="text-[var(--color-text-muted)]">Bot Handle</span>
                  <span className="text-[var(--color-accent)]">@{account?.botUsername || 'bot'}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-white/5 text-xs">
                  <span className="text-[var(--color-text-muted)]">Status</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-soft-pulse" /> Active Operator
                  </span>
                </div>
              </div>

              {/* Backend connection status */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-xs">Server Connection</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300">
                    ONLINE
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  WebSocket real-time messaging server actively connected.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CHAT SETTINGS */}
          {activeTab === 'chat' && (
            <div className="space-y-5">
              {/* Font Size Slider */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Type className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>Message Text Size</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--color-accent)] font-mono">
                    {settings.fontSize}px
                  </span>
                </div>
                <input
                  type="range"
                  min="13"
                  max="22"
                  step="1"
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                  className="w-full accent-[var(--color-accent)] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)]">
                  <span>Small (13px)</span>
                  <span>Standard (15px)</span>
                  <span>Large (22px)</span>
                </div>

                {/* Live Preview */}
                <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5">
                  <p style={{ fontSize: `${settings.fontSize}px` }} className="text-white/90">
                    Preview: Hey there! This is how your chat messages will look.
                  </p>
                </div>
              </div>

              {/* Font Family Selection */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="text-xs font-semibold">Chat Font Family</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'sans', label: 'Telegram Standard' },
                    { key: 'inter', label: 'Inter Modern' },
                    { key: 'roboto', label: 'Roboto Clean' },
                    { key: 'mono', label: 'JetBrains Code' }
                  ].map((font) => (
                    <button
                      key={font.key}
                      onClick={() => updateSettings({ fontFamily: font.key as FontFamily })}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all btn-press ${
                        settings.fontFamily === font.key
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold'
                          : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                      }`}
                    >
                      <span>{font.label}</span>
                      {settings.fontFamily === font.key && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallpaper Pattern */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="text-xs font-semibold">Chat Wallpaper Pattern</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { key: 'doodles', label: 'Doodles' },
                    { key: 'stars', label: 'Stars' },
                    { key: 'none', label: 'Solid' }
                  ].map((pat) => (
                    <button
                      key={pat.key}
                      onClick={() => updateSettings({ backgroundPattern: pat.key as 'none' | 'doodles' | 'stars' })}
                      className={`py-2 px-3 rounded-xl border text-center transition-all btn-press ${
                        settings.backgroundPattern === pat.key
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold'
                          : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                      }`}
                    >
                      {pat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enter to Send Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/30 border border-white/5">
                <div>
                  <div className="text-xs font-semibold">Send by Enter</div>
                  <div className="text-[11px] text-[var(--color-text-muted)]">
                    Press Shift + Enter for a new line
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enterToSend}
                  onChange={(e) => updateSettings({ enterToSend: e.target.checked })}
                  className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: THEME & COLORS */}
          {activeTab === 'theme' && (
            <div className="space-y-4">
              <div className="text-xs text-[var(--color-text-muted)]">
                Choose between the two dedicated Telegram themes:
              </div>

              {/* Option 1: Simple Black */}
              <button
                onClick={() => setTheme('simple-black')}
                className={`w-full p-4 rounded-2xl border text-left flex items-start gap-4 transition-all btn-press ${
                  theme === 'simple-black'
                    ? 'border-[#2aabee] bg-[#141b24] shadow-lg shadow-[#2aabee]/10 ring-1 ring-[#2aabee]'
                    : 'border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#09090b] border border-white/10 flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 rounded-full bg-[#2aabee]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">Simple Black Theme</span>
                    {theme === 'simple-black' && (
                      <span className="text-xs font-semibold text-[#2aabee] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Classic Telegram OLED dark interface with deep obsidian backgrounds and crisp Telegram blue accents.
                  </p>
                </div>
              </button>

              {/* Option 2: Black & Gold */}
              <button
                onClick={() => setTheme('black-gold')}
                className={`w-full p-4 rounded-2xl border text-left flex items-start gap-4 transition-all btn-press ${
                  theme === 'black-gold'
                    ? 'border-[#e5b842] bg-[#1a170f] shadow-lg shadow-[#e5b842]/15 ring-1 ring-[#e5b842]'
                    : 'border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#050505] border border-[#38301a] flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-r from-[#e5b842] to-[#f3c853]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#f5f2eb] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#e5b842]" />
                      <span>Black & Gold Theme</span>
                    </span>
                    {theme === 'black-gold' && (
                      <span className="text-xs font-semibold text-[#e5b842] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9c927f] mt-1">
                    Luxury stealth black theme paired with radiant metallic gold buttons, highlights, badges, and sent bubbles.
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 flex justify-between items-center bg-black/20">
          <button
            onClick={resetSettings}
            className="text-xs text-[var(--color-text-muted)] hover:text-white transition"
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            className={`py-2 px-5 rounded-xl text-xs font-semibold transition btn-press ${
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
