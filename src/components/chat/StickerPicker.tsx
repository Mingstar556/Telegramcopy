import React, { useState } from 'react';
import { Smile, Sparkles, X } from 'lucide-react';
import { PREINSTALLED_STICKER_PACKS } from '../../assets/stickers/stickerPacks';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { StickerItem } from '../../types/chat';

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '👏', '😍', '🤔', '🚀', '💯', '🙏', '⚡', '✨', '👌', '😎', '🤩'];

export const StickerPicker: React.FC<StickerPickerProps> = ({ isOpen, onClose, onSelectEmoji }) => {
  const { sendSticker } = useChat();
  const { theme } = useTheme();
  const [activePackId, setActivePackId] = useState<string>(PREINSTALLED_STICKER_PACKS[0].id);

  if (!isOpen) return null;

  const isGold = theme === 'black-gold';
  const activePack = PREINSTALLED_STICKER_PACKS.find(p => p.id === activePackId) || PREINSTALLED_STICKER_PACKS[0];

  const handleStickerClick = (sticker: StickerItem) => {
    sendSticker(sticker);
    onClose();
  };

  return (
    <div
      style={{ transformOrigin: 'bottom right' }}
      className={`absolute bottom-16 right-2 sm:right-6 w-80 sm:w-96 rounded-3xl border shadow-2xl z-40 backdrop-blur-2xl flex flex-col overflow-hidden animate-pop-in ${
        isGold
          ? 'bg-[#0f0e0a]/95 border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
          : 'bg-[#121318]/95 border-white/10 text-white shadow-2xl'
      }`}
    >
      {/* Header & Quick Emojis */}
      <div className="p-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
          <span>Stickers & Reactions</span>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-white p-1 rounded-full hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Emoji Bar */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {COMMON_EMOJIS.map((emoji, idx) => (
          <button
            key={idx}
            onClick={() => onSelectEmoji(emoji)}
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-lg hover:scale-125 transition active:scale-95 rounded-lg hover:bg-white/5"
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Stickers Grid */}
      <div className="p-3 h-64 overflow-y-auto">
        <div className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>{activePack.title} Pack</span>
          <span className="text-[10px] text-[var(--color-accent)] font-bold">PRE-INSTALLED</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {activePack.stickers.map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => handleStickerClick(sticker)}
              className="group p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition flex flex-col items-center justify-center relative active:scale-95"
              title={`${sticker.name} (${sticker.emoji})`}
            >
              <div
                className="w-16 h-16 transition-transform group-hover:scale-110 drop-shadow flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: sticker.svgContent || '' }}
              />
              <span className="text-[10px] text-[var(--color-text-muted)] group-hover:text-white mt-1 truncate max-w-full">
                {sticker.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Pack Tabs Bottom Bar */}
      <div className="px-3 py-2 border-t border-white/5 flex items-center gap-1.5 bg-black/20">
        {PREINSTALLED_STICKER_PACKS.map((pack) => (
          <button
            key={pack.id}
            onClick={() => setActivePackId(pack.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              activePackId === pack.id
                ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{pack.icon}</span>
            <span className="hidden sm:inline">{pack.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
