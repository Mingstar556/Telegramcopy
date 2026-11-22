import React, { useEffect, useRef } from 'react';
import { Bell, BellOff, UserCircle, Eraser, Trash2, Check } from 'lucide-react';
import { ChatConversation } from '../../types/chat';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';

interface ChatOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ChatConversation;
}

export const ChatOptionsMenu: React.FC<ChatOptionsMenuProps> = ({
  isOpen,
  onClose,
  chat
}) => {
  const { toggleMuteChat, openUserProfile, clearChat, deleteChat } = useChat();
  const { theme } = useTheme();
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
  const fullName = `${chat.user.firstName} ${chat.user.lastName || ''}`.trim();
  const isMuted = Boolean(chat.isMuted);

  const handleToggleMute = () => {
    toggleMuteChat(chat.id);
    onClose();
  };

  const handleViewProfile = () => {
    onClose();
    openUserProfile(chat.user);
  };

  const handleClearHistory = () => {
    onClose();
    if (window.confirm(`Are you sure you want to clear chat history with ${fullName}?`)) {
      clearChat(chat.id);
    }
  };

  const handleDeleteChat = () => {
    onClose();
    if (window.confirm(`Delete chat with ${fullName}? This cannot be undone.`)) {
      deleteChat(chat.id);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ transformOrigin: 'top right' }}
      className={`absolute right-2 top-14 w-56 rounded-2xl p-1.5 shadow-2xl border z-50 backdrop-blur-2xl animate-pop-in ${
        isGold
          ? 'bg-[#0f0e0a]/95 border-[#38301a] text-[#f5f2eb] shadow-[0_12px_40px_rgba(0,0,0,0.85)]'
          : 'bg-[#12141a]/95 border-white/10 text-white shadow-2xl'
      }`}
    >
      {/* Header Info */}
      <div className="px-3.5 py-2 mb-1 border-b border-white/5">
        <div className="text-xs font-semibold truncate text-[var(--color-text-main)]">
          {fullName}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] truncate font-mono mt-0.5">
          @{chat.user.username || `id_${chat.user.id}`}
        </div>
      </div>

      {/* 1. Mute / Unmute */}
      <button
        onClick={handleToggleMute}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
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
          {isMuted ? 'Muted' : 'Sound on'}
        </span>
      </button>

      {/* 2. View Profile(s) */}
      <button
        onClick={handleViewProfile}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
      >
        <UserCircle className="w-4 h-4 text-[#2aabee]" />
        <span>View Profile</span>
      </button>

      <div className="my-1 border-t border-white/5" />

      {/* 3. Clear History */}
      <button
        onClick={handleClearHistory}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-amber-500/10 text-amber-400/90 hover:text-amber-300 transition-colors btn-press text-left"
      >
        <Eraser className="w-4 h-4" />
        <span>Clear History</span>
      </button>

      {/* 4. Delete Chat */}
      <button
        onClick={handleDeleteChat}
        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors btn-press text-left"
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete Chat</span>
      </button>
    </div>
  );
};
