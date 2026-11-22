import React, { useEffect, useRef } from 'react';
import {
  UserCircle,
  Sparkles,
  Settings as SettingsIcon,
  LogOut,
  Bookmark,
  SquareMousePointer,
  Bell,
  BellOff,
  Eraser,
  Trash2
} from 'lucide-react';
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
  const { theme } = useTheme();
  const {
    activeChat,
    toggleMuteChat,
    openUserProfile,
    clearChat,
    deleteChat,
    openSavedMessages,
    openCreateInlineButton
  } = useChat();
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
  const isMuted = Boolean(activeChat?.isMuted);
  const fullName = activeChat
    ? `${activeChat.user.firstName} ${activeChat.user.lastName || ''}`.trim()
    : '';

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
      <div className="px-3.5 py-2 mb-1 border-b border-white/5">
        <div className="text-xs font-semibold truncate text-[var(--color-text-main)]">
          {account?.botName || 'Telegram Bot'}
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)] truncate font-mono mt-0.5">
          ID: {account?.userId}
        </div>
      </div>

      {/* Chat Specific Section (Mute, View Profiles, Clear History, Delete Chat) */}
      <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
        {activeChat ? `Chat: ${activeChat.user.firstName}` : 'Chat Actions'}
      </div>

      {/* 1. Mute / Unmute */}
      <button
        onClick={() => {
          if (activeChat) {
            toggleMuteChat(activeChat.id);
            onClose();
          }
        }}
        disabled={!activeChat}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition-colors btn-press text-left ${
          !activeChat ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.06]'
        }`}
        title={!activeChat ? 'Select a chat first to mute' : undefined}
      >
        <div className="flex items-center gap-3">
          {isMuted ? (
            <Bell className="w-4 h-4 text-emerald-400" />
          ) : (
            <BellOff className="w-4 h-4 text-[var(--color-text-muted)]" />
          )}
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
          {activeChat ? (isMuted ? 'Muted' : 'Sound on') : 'No chat'}
        </span>
      </button>

      {/* 2. View Profiles */}
      <button
        onClick={() => {
          onClose();
          if (activeChat) {
            openUserProfile(activeChat.user);
          } else {
            onOpenAccount();
          }
        }}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <div className="flex items-center gap-3">
          <UserCircle className="w-4 h-4 text-[#2aabee]" />
          <span>View Profiles</span>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
          {activeChat ? activeChat.user.firstName : 'Accounts'}
        </span>
      </button>

      {/* 3. Clear History */}
      <button
        onClick={() => {
          if (!activeChat) return;
          onClose();
          if (window.confirm(`Are you sure you want to clear chat history with ${fullName}?`)) {
            clearChat(activeChat.id);
          }
        }}
        disabled={!activeChat}
        className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors btn-press text-left ${
          !activeChat
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-amber-500/10 text-amber-400/90 hover:text-amber-300'
        }`}
        title={!activeChat ? 'Select a chat first' : undefined}
      >
        <Eraser className="w-4 h-4" />
        <span>Clear History</span>
      </button>

      {/* 4. Delete Chat */}
      <button
        onClick={() => {
          if (!activeChat) return;
          onClose();
          if (window.confirm(`Delete chat with ${fullName}? This cannot be undone.`)) {
            deleteChat(activeChat.id);
          }
        }}
        disabled={!activeChat}
        className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl transition-colors btn-press text-left ${
          !activeChat
            ? 'opacity-40 cursor-not-allowed'
            : 'hover:bg-red-500/10 text-red-400 hover:text-red-300'
        }`}
        title={!activeChat ? 'Select a chat first' : undefined}
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete Chat</span>
      </button>

      <div className="my-1 border-t border-white/5" />

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
