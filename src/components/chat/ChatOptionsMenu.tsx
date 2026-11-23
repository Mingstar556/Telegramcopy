import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, UserCircle, Eraser, Trash2, Pin } from 'lucide-react';
import { ChatConversation } from '../../types/chat';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DeleteConfirmationModal, DeleteModalMode } from './DeleteConfirmationModal';

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
  const { toggleMuteChat, togglePinChat, openUserProfile, clearChat, deleteChat } = useChat();
  const { theme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const [modalMode, setModalMode] = useState<DeleteModalMode | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !modalMode) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose, modalMode]);

  const isGold = theme === 'black-gold';
  const fullName = `${chat.user.firstName} ${chat.user.lastName || ''}`.trim();
  const isMuted = Boolean(chat.isMuted);
  const isPinned = Boolean(chat.isPinned);

  const handleTogglePin = () => {
    togglePinChat(chat.id);
    onClose();
  };

  const handleToggleMute = () => {
    toggleMuteChat(chat.id);
    onClose();
  };

  const handleViewProfile = () => {
    onClose();
    openUserProfile(chat.user);
  };

  const handleClearHistoryClick = () => {
    setModalMode('clear_history');
  };

  const handleDeleteChatClick = () => {
    setModalMode('delete_chat');
  };

  const handleConfirmAction = (deleteForEveryone: boolean) => {
    if (modalMode === 'clear_history') {
      clearChat(chat.id, deleteForEveryone);
    } else if (modalMode === 'delete_chat') {
      deleteChat(chat.id, deleteForEveryone);
    }
    setModalMode(null);
    onClose();
  };

  return (
    <>
      {isOpen && (
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

          {/* 1. Pin / Unpin Chat */}
          {!chat.isSavedMessages && (
            <button
              onClick={handleTogglePin}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
            >
              <div className="flex items-center gap-3">
                <Pin
                  className={`w-4 h-4 ${
                    isPinned
                      ? isGold
                        ? 'text-[#e5b842] fill-[#e5b842]'
                        : 'text-[var(--color-accent)] fill-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                />
                <span>{isPinned ? 'Unpin from Top' : 'Pin to Top'}</span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                {isPinned ? 'Pinned' : ''}
              </span>
            </button>
          )}

          {/* 2. Mute / Unmute */}
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

          {/* 3. View Profile */}
          <button
            onClick={handleViewProfile}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/[0.06] transition-colors btn-press text-left"
          >
            <UserCircle className="w-4 h-4 text-[#2aabee]" />
            <span>View Profile</span>
          </button>

          <div className="my-1 border-t border-white/5" />

          {/* 4. Clear History */}
          <button
            onClick={handleClearHistoryClick}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-amber-500/10 text-amber-400/90 hover:text-amber-300 transition-colors btn-press text-left"
          >
            <Eraser className="w-4 h-4" />
            <span>Clear History</span>
          </button>

          {/* 5. Delete Chat */}
          {!chat.isSavedMessages && (
            <button
              onClick={handleDeleteChatClick}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-red-500/10 text-red-400/90 hover:text-red-300 transition-colors btn-press text-left"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Chat</span>
            </button>
          )}
        </div>
      )}

      {/* Telegram-style Delete / Clear History Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(modalMode)}
        mode={modalMode || 'clear_history'}
        targetName={fullName}
        isSavedMessages={Boolean(chat.isSavedMessages)}
        onClose={() => setModalMode(null)}
        onConfirm={handleConfirmAction}
      />
    </>
  );
};
