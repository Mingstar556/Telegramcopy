import React from 'react';
import { X, Sparkles, MessageSquare, Send, ShieldAlert } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';

interface SpecialChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpecialChatModal: React.FC<SpecialChatModalProps> = ({ isOpen, onClose }) => {
  const { openSpecialChat } = useChat();
  const { theme } = useTheme();

  if (!isOpen) return null;

  const isGold = theme === 'black-gold';

  const handleStartSpecialChat = () => {
    openSpecialChat();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-2xl p-6 border shadow-2xl relative ${
          isGold
            ? 'bg-[#100e0a] border-[#38301a] text-[#f5f2eb] shadow-[0_0_50px_rgba(212,175,55,0.15)]'
            : 'bg-[#17212b] border-[#242f3d] text-white'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--color-text-muted)] hover:text-white p-1 rounded-full hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isGold ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-[#2aabee]/20 text-[#2aabee]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Special Direct Channel</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Direct client-to-bot interactive session
            </p>
          </div>
        </div>

        <div className="space-y-3.5 my-5 text-xs text-[var(--color-text-muted)]">
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
            <div className="font-semibold text-[var(--color-text-main)] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Normal Chat Mode Enabled</span>
            </div>
            <p className="leading-relaxed">
              In this channel, the client talks directly to the Telegram bot engine just like a normal chat. Test commands, prompt triggers, or converse in real time.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>Messages in this room are dispatched to Django with action: "send_message"</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold border border-white/10 hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleStartSpecialChat}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              isGold
                ? 'bg-[#d4af37] text-black hover:bg-[#f3c853]'
                : 'bg-[#2aabee] text-white hover:bg-[#229ad6]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Open Special Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
