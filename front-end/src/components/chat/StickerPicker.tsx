import React from 'react';
import { Smile, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    category: 'Smileys & Emotion',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕']
  },
  {
    category: 'Gestures & Reactions',
    emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '💪', '🙏', '👏', '🙌', '👐', '🤲', '✍️', '💅', '🤳', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '💯', '✨', '⚡', '🌟', '💥', '🎉', '🎊']
  },
  {
    category: 'Objects & Symbols',
    emojis: ['🚀', '✈️', '🚗', '🚕', '💡', '⏰', '📱', '💻', '📷', '📹', '🎥', '📞', '💬', '💭', '🔔', '📢', '📦', '🎁', '🎈', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🎯', '🎮', '🎲', '💰', '💵', '💳', '💎', '🔑', '🔒', '🔓', '✅', '❌', '⚠️', '❓', '❗', '⭐', '🌈', '☀️', '🌙', '☕', '🍕', '🍔', '🍟', '🍻', '🥂']
  }
];

export const StickerPicker: React.FC<EmojiPickerProps> = ({ isOpen, onClose, onSelectEmoji }) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const isGold = theme === 'black-gold';

  const handleEmojiClick = (emoji: string) => {
    onSelectEmoji(emoji);
  };

  return (
    <div
      style={{ transformOrigin: 'bottom right' }}
      className={`absolute bottom-16 right-2 sm:right-6 w-80 sm:w-88 rounded-3xl border shadow-2xl z-40 backdrop-blur-2xl flex flex-col overflow-hidden animate-pop-in ${
        isGold
          ? 'bg-[#0f0e0a]/95 border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
          : 'bg-[#121318]/95 border-white/10 text-white shadow-2xl'
      }`}
    >
      {/* Header */}
      <div className="p-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Smile className="w-4 h-4 text-[var(--color-accent)]" />
          <span>Emojis</span>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-white p-1 rounded-full hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Emoji Scroll Area */}
      <div className="p-3 h-64 overflow-y-auto space-y-3">
        {EMOJI_CATEGORIES.map((cat, cIdx) => (
          <div key={cIdx}>
            <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 px-1">
              {cat.category}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {cat.emojis.map((emoji, eIdx) => (
                <button
                  key={eIdx}
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95 rounded-lg hover:bg-white/10"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
