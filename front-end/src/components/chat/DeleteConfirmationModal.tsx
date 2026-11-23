import React, { useState, useEffect } from 'react';
import { Check, Trash2, Eraser, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export type DeleteModalMode = 'message' | 'clear_history' | 'delete_chat';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  mode: DeleteModalMode;
  targetName?: string;
  isSavedMessages?: boolean;
  onClose: () => void;
  onConfirm: (deleteForEveryone: boolean) => void;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  mode,
  targetName = 'User',
  isSavedMessages = false,
  onClose,
  onConfirm
}) => {
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const [deleteForEveryone, setDeleteForEveryone] = useState(true);

  // Reset default whenever opened
  useEffect(() => {
    if (isOpen) {
      setDeleteForEveryone(true);
    }
  }, [isOpen]);

  // Global Esc to close, Enter to confirm
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(isSavedMessages ? false : deleteForEveryone);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, deleteForEveryone, isSavedMessages, onClose, onConfirm]);

  if (!isOpen) return null;

  const firstName = targetName.split(' ')[0] || targetName;

  const getTitle = () => {
    switch (mode) {
      case 'message':
        return 'Delete message?';
      case 'clear_history':
        return 'Clear history';
      case 'delete_chat':
        return 'Delete chat';
    }
  };

  const getBodyText = () => {
    switch (mode) {
      case 'message':
        return 'Are you sure you want to delete this message?';
      case 'clear_history':
        return `Are you sure you want to clear the chat history with ${targetName}?`;
      case 'delete_chat':
        return `Are you sure you want to delete the chat with ${targetName}?`;
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'clear_history':
        return 'This will clear all messages in this chat.';
      case 'delete_chat':
        return 'This will delete all messages and remove the chat from your chat list.';
      default:
        return null;
    }
  };

  const getCheckboxLabel = () => {
    switch (mode) {
      case 'message':
        return `Also delete for ${firstName}`;
      case 'clear_history':
        return `Also clear for ${firstName}`;
      case 'delete_chat':
        return `Also delete for ${firstName}`;
    }
  };

  const getActionLabel = () => {
    return mode === 'clear_history' ? 'Clear' : 'Delete';
  };

  const handleActionClick = () => {
    onConfirm(isSavedMessages ? false : deleteForEveryone);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl p-5 border shadow-2xl flex flex-col animate-pop-in ${
          isGold
            ? 'bg-[#12110c] border-[#38301a] text-[#f5f2eb] shadow-[0_16px_50px_rgba(0,0,0,0.9)]'
            : 'bg-[#181c24] border-white/10 text-white shadow-[0_16px_50px_rgba(0,0,0,0.8)]'
        }`}
      >
        {/* Header with Telegram Icon */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              mode === 'clear_history'
                ? 'bg-amber-500/15 text-amber-400'
                : 'bg-red-500/15 text-red-400'
            }`}
          >
            {mode === 'clear_history' ? (
              <Eraser className="w-5 h-5" />
            ) : mode === 'delete_chat' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </div>
          <h3 className="font-bold text-base tracking-tight text-[var(--color-text-main)]">
            {getTitle()}
          </h3>
        </div>

        {/* Body Description */}
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-1 mb-2">
          {getBodyText()}
        </p>

        {getSubtitle() && (
          <p className="text-[11px] text-[var(--color-text-muted)]/80 italic mb-2">
            {getSubtitle()}
          </p>
        )}

        {/* Telegram Checkbox Option: "Also delete for [User]" */}
        {!isSavedMessages && (
          <div
            onClick={() => setDeleteForEveryone(!deleteForEveryone)}
            className="flex items-center gap-3 px-3 py-2.5 my-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 cursor-pointer transition select-none btn-press"
          >
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                deleteForEveryone
                  ? isGold
                    ? 'bg-[#e5b842] text-black shadow-sm'
                    : 'bg-[#2481cc] text-white shadow-sm'
                  : 'border border-white/20 bg-transparent'
              }`}
            >
              {deleteForEveryone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
            <span className="text-xs font-medium text-[var(--color-text-main)] flex-1">
              {getCheckboxLabel()}
            </span>
          </div>
        )}

        {/* Footer Buttons (Telegram Right-Aligned Style) */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition btn-press"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleActionClick}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition btn-press ${
              mode === 'clear_history'
                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
            }`}
          >
            {getActionLabel()}
          </button>
        </div>
      </div>
    </div>
  );
};
