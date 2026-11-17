import React, { useEffect, useRef } from 'react';
import { UserCircle, Sparkles, Settings as SettingsIcon, LogOut, Check, Bookmark } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';

interface ThreeDotsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenSpecial: () => void;
  onOpenSettings: () => void;
}

export const ThreeDotsMenu: React.FC<ThreeDotsMenuProps> = ({
  isOpen,
  onClose,
  onOpenAccount,
  onOpenSpecial,
  onOpenSettings
}) => {
  const { logout, account } = useAuth();
  const { theme, setTheme } = useTheme();
  const { openSavedMessages } = useChat();
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

      {/* Account */}
      <button
        onClick={() => {
          onClose();
          onOpenAccount();
        }}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <UserCircle className="w-4 h-4 text-[var(--color-accent)]" />
        <span>Account</span>
      </button>

      {/* Special */}
      <button
        onClick={() => {
          onClose();
          onOpenSpecial();
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
          <span>Special</span>
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-mono">
          SLOT
        </span>
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

      <div className="my-1 border-t border-white/5" />

      {/* Quick Theme Toggle */}
      <button
        onClick={() => setTheme(isGold ? 'simple-black' : 'black-gold')}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full border ${
              isGold ? 'bg-[#e5b842] border-[#f3c853]' : 'bg-[#2aabee] border-white/40'
            }`}
          />
          <span className="text-xs">{isGold ? 'Black & Gold' : 'Simple Black'}</span>
        </div>
        <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />
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
