import React, { useState } from 'react';
import { X, Search, Forward, Send } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ChatMessage } from '../../types/chat';
import { Avatar } from '../common/Avatar';

interface ForwardModalProps {
  isOpen: boolean;
  message: ChatMessage | null;
  onClose: () => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  message,
  onClose
}) => {
  const { conversations, forwardMessage, selectChat } = useChat();
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);

  if (!isOpen || !message) return null;

  const isGold = theme === 'black-gold';

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    const name = `${c.user.firstName} ${c.user.lastName || ''}`.toLowerCase();
    const u = (c.user.username || '').toLowerCase();
    return name.includes(q) || u.includes(q);
  });

  const handleForwardTo = async (chatId: string) => {
    if (isForwarding) return;
    setIsForwarding(true);
    await forwardMessage(chatId, message);
    setIsForwarding(false);
    onClose();
    selectChat(chatId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md rounded-3xl p-5 border shadow-2xl flex flex-col max-h-[85vh] animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
            : 'bg-[#121318] border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Forward className="w-5 h-5 text-[var(--color-accent)]" />
            <h3 className="font-bold text-base tracking-tight">Forward Message</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition btn-press"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message preview snippet */}
        <div className="my-3 p-3 rounded-2xl bg-black/40 border border-white/5 text-xs text-[var(--color-text-muted)]">
          <span className="font-semibold text-white mr-1.5">
            {message.senderName || (message.isOutgoing ? 'You' : 'User')}:
          </span>
          <span className="line-clamp-2">
            {message.message || (message.media?.type === 'photo' ? '📷 Photo' : message.media?.type === 'video' ? '📹 Video' : message.media?.type === 'voice' ? '🎤 Voice note' : '📎 Attachment')}
          </span>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-black/30 border border-white/10 focus-within:border-[var(--color-accent)] mb-3">
          <Search className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipients..."
            className="w-full bg-transparent border-0 outline-none text-xs text-white placeholder-zinc-500"
          />
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-72">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
              No conversations found
            </div>
          ) : (
            filtered.map((conv) => {
              const name = `${conv.user.firstName} ${conv.user.lastName || ''}`.trim();
              return (
                <button
                  key={conv.id}
                  onClick={() => handleForwardTo(conv.id)}
                  disabled={isForwarding}
                  className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/5 active:bg-white/10 transition text-left group btn-press"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      id={conv.user.id}
                      name={name}
                      avatarUrl={conv.user.avatar}
                      size="sm"
                      isOnline={conv.user.online}
                      isSavedMessages={conv.isSavedMessages}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-white truncate group-hover:text-[var(--color-accent)] transition">
                        {name}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)] truncate font-mono">
                        {conv.isSavedMessages ? 'Personal Cloud' : `@${conv.user.username || conv.user.id}`}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded-full opacity-0 group-hover:opacity-100 bg-[var(--color-accent)]/15 text-[var(--color-accent)] transition">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
