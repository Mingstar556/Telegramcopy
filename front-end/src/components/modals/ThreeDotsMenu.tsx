import React, { useEffect, useRef } from 'react';
import { UserCircle, Sparkles, Settings as SettingsIcon, LogOut, Check, Bookmark, Users, UserPlus, SquareMousePointer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';

interface ThreeDotsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenSettings: () => void;
}

export const ThreeDotsMenu: React.FC<ThreeDotsMenuProps> = ({
  isOpen,
  onClose,
  onOpenAccount,
  onOpenSettings
}) => {
  const { logout, account } = useAuth();
  const { theme, setTheme } = useTheme();
  const { openSavedMessages, openCreateInlineButton } = useChat();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isGold = theme === 'black-gold';

  return (
    <div
      ref={menuRef}
      style={{ transformOrigin: 'top right' }}
      className={`absolute right-2 top-14 w-60 rounded-2xl p-1.5 shadow-2xl border z-50 backdrop-blur-2xl animate-pop-in ${
        isGold
          ? 'bg-[#0f0e0a]/95 border-[#38301a] text-[#f5f2eb] shadow-[0_12px_40px_rgba(0,0,0,0.85)]'
          : 'bg-[#12141a]/95 border-white/10 text-white shadow-2xl'
      }`}
    >
      {/* Bot Identity Header */}
      <div className="px-3.5 py-2.5 mb-1 border-b border-white/5">
        <div className="text-xs font-semibold truncate text-[var(--color-text-main)]">
          {account?.botName || 'Telegram Bot'}
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)] truncate font-mono mt-0.5">
          ID: {account?.userId}
        </div>
      </div>

      {/* Saved Messages */}
      <button
        onClick={() => {
          onClose();
          openSavedMessages();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <Bookmark className="w-4 h-4 text-[#2aabee]" />
        <span>Saved Messages</span>
      </button>

      {/* Account & Multi-Accounts */}
      <button
        onClick={() => {
          onClose();
          onOpenAccount();
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <div className="flex items-center gap-3">
          <UserCircle className="w-4 h-4 text-[var(--color-accent)]" />
          <span>Accounts</span>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">Switch / Add</span>
      </button>

      {/* Settings */}
      <button
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <SettingsIcon className="w-4 h-4 text-[var(--color-accent)]" />
        <span>Settings</span>
      </button>

      {/* Create Inline Button (Bot Tool) */}
      <button
        onClick={() => {
          onClose();
          openCreateInlineButton();
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left text-white hover:text-[var(--color-accent)]"
      >
        <div className="flex items-center gap-3">
          <SquareMousePointer className="w-4 h-4 text-[var(--color-accent)]" />
          <span>Create Inline Button</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent)] font-mono font-bold">
          Bot
        </span>
      </button>


      <div className="my-1 border-t border-white/5" />

      {/* Themes & Customization */}
      <button
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full border border-white/40 shadow-sm"
            style={{ backgroundColor: 'var(--color-accent)' }}
          />
          <span className="text-xs">Customize Theme</span>
        </div>
        <span className="text-[10px] text-[var(--color-accent)] font-semibold">8 Styles</span>
      </button>

      <div className="my-1 border-t border-white/5" />

      {/* Logout */}
      <button
        onClick={() => {
          onClose();
          logout();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors btn-press text-left"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out</span>
      </button>
    </div>
  );
};
