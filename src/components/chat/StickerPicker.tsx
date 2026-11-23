import React, { useState } from 'react';
import { Smile, Sparkles, Clock, X, Plus, Trash2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';
import { PREINSTALLED_STICKER_PACKS } from '../../assets/stickers/stickerPacks';
import { StickerItem } from '../../types/chat';
import { getStoredItem, setStoredItem } from '../../utils/storage';
import { StickerCreatorModal } from './StickerCreatorModal';

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (sticker: StickerItem) => void;
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

export const StickerPicker: React.FC<StickerPickerProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectSticker
}) => {
  const { theme } = useTheme();
  const { customStickers, deleteCustomSticker } = useChat();

  const [activeTab, setActiveTab] = useState<'stickers' | 'emojis' | 'recent'>('stickers');
  const [selectedPackId, setSelectedPackId] = useState<string>('my-stickers');
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  const [recentStickers, setRecentStickers] = useState<StickerItem[]>(() =>
    getStoredItem<StickerItem[]>('tg_recent_stickers', [])
  );
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() =>
    getStoredItem<string[]>('tg_recent_emojis', ['❤️', '👍', '🔥', '😂', '🎉', '👏'])
  );

  if (!isOpen) return null;

  const isGold = theme === 'black-gold';

  // Include user's custom sticker pack
  const isMyStickers = selectedPackId === 'my-stickers';
  const currentPack = PREINSTALLED_STICKER_PACKS.find(p => p.id === selectedPackId) || PREINSTALLED_STICKER_PACKS[0];

  const handleEmojiClick = (emoji: string) => {
    onSelectEmoji(emoji);
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 24);
    setRecentEmojis(updated);
    setStoredItem('tg_recent_emojis', updated);
  };

  const handleStickerClick = (sticker: StickerItem) => {
    onSelectSticker(sticker);
    const updated = [sticker, ...recentStickers.filter(s => s.id !== sticker.id)].slice(0, 16);
    setRecentStickers(updated);
    setStoredItem('tg_recent_stickers', updated);
    onClose();
  };

  return (
    <>
      <div
        style={{ transformOrigin: 'bottom right' }}
        className={`fixed sm:absolute bottom-16 left-2 right-2 sm:left-auto sm:right-6 w-auto sm:w-96 max-w-sm mx-auto sm:mx-0 rounded-3xl border shadow-2xl z-40 backdrop-blur-2xl flex flex-col overflow-hidden animate-pop-in ${
          isGold
            ? 'bg-[#0f0e0a]/95 border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
            : 'bg-[#121318]/95 border-white/10 text-white shadow-2xl'
        }`}
      >
        {/* Top Main Navigation Tabs */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('stickers')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'stickers'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stickers</span>
            </button>

            <button
              onClick={() => setActiveTab('emojis')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'emojis'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Emojis</span>
            </button>

            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'recent'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-white p-1 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STICKERS TAB */}
        {activeTab === 'stickers' && (
          <div className="flex flex-col h-72">
            {/* Sticker Pack Selector Header with Create Button */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 overflow-x-auto bg-black/10 select-none">
              {/* "+ Create Sticker" Button */}
              <button
                onClick={() => setIsCreatorOpen(true)}
                className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/30 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40 transition flex-shrink-0 btn-press"
                title="Create 512x512 Telegram-compatible sticker"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Create</span>
              </button>

              {/* My Custom Stickers Pack */}
              <button
                onClick={() => setSelectedPackId('my-stickers')}
                className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 transition flex-shrink-0 ${
                  isMyStickers
                    ? 'bg-white/15 text-white font-bold ring-1 ring-[var(--color-accent)]/50'
                    : 'text-[var(--color-text-muted)] hover:bg-white/5'
                }`}
              >
                <span>🎨</span>
                <span>My Stickers ({customStickers.length})</span>
              </button>

              {/* Preinstalled Packs */}
              {PREINSTALLED_STICKER_PACKS.map(pack => (
                <button
                  key={pack.id}
                  onClick={() => setSelectedPackId(pack.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 transition flex-shrink-0 ${
                    selectedPackId === pack.id
                      ? 'bg-white/15 text-white font-bold ring-1 ring-[var(--color-accent)]/50'
                      : 'text-[var(--color-text-muted)] hover:bg-white/5'
                  }`}
                >
                  <span>{pack.icon}</span>
                  <span>{pack.title}</span>
                </button>
              ))}
            </div>

            {/* Custom Stickers Pack View */}
            {isMyStickers ? (
              <div className="p-3 overflow-y-auto flex-1">
                {customStickers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center mb-2">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="font-semibold text-xs text-white">No custom stickers yet</div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1 max-w-[200px]">
                      Create your own 512x512 transparent sticker that Telegram recognizes!
                    </p>
                    <button
                      onClick={() => setIsCreatorOpen(true)}
                      className="mt-3 px-3.5 py-1.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-xs font-bold flex items-center gap-1.5 btn-press shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Create Sticker</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {customStickers.map(sticker => (
                      <div
                        key={sticker.id}
                        className="relative group flex flex-col items-center justify-center"
                      >
                        <button
                          onClick={() => handleStickerClick(sticker)}
                          className="aspect-square w-full p-1.5 rounded-2xl hover:bg-white/10 active:scale-95 transition-all flex flex-col items-center justify-center"
                          title={sticker.name}
                        >
                          {sticker.url ? (
                            <img
                              src={sticker.url}
                              alt={sticker.name}
                              className="w-14 h-14 object-contain transition-transform group-hover:scale-110 drop-shadow-md"
                            />
                          ) : (
                            <div className="text-3xl">{sticker.emoji}</div>
                          )}
                          <span className="text-[9px] text-[var(--color-text-muted)] mt-1 truncate max-w-full">
                            {sticker.name}
                          </span>
                        </button>

                        {/* Delete custom sticker button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomSticker(sticker.id);
                          }}
                          className="absolute -top-1 -right-1 p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 shadow-md"
                          title="Delete Sticker"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Preinstalled Stickers Grid */
              <div className="p-3 overflow-y-auto flex-1 grid grid-cols-4 gap-2">
                {currentPack.stickers.map(sticker => (
                  <button
                    key={sticker.id}
                    onClick={() => handleStickerClick(sticker)}
                    className="aspect-square p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition-all flex flex-col items-center justify-center group relative"
                    title={sticker.name}
                  >
                    {sticker.svgContent ? (
                      <div
                        className="w-14 h-14 transition-transform group-hover:scale-110 drop-shadow-md"
                        dangerouslySetInnerHTML={{ __html: sticker.svgContent }}
                      />
                    ) : (
                      <div className="text-3xl group-hover:scale-125 transition-transform">
                        {sticker.emoji}
                      </div>
                    )}
                    <span className="text-[9px] text-[var(--color-text-muted)] mt-1 truncate max-w-full">
                      {sticker.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EMOJIS TAB */}
        {activeTab === 'emojis' && (
          <div className="p-3 h-72 overflow-y-auto space-y-3">
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
        )}

        {/* RECENT TAB */}
        {activeTab === 'recent' && (
          <div className="p-3 h-72 overflow-y-auto space-y-4">
            <div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 px-1">
                Recently Used Stickers
              </div>
              {recentStickers.length === 0 ? (
                <div className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                  No recent stickers yet. Pick one from the Stickers tab!
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {recentStickers.map(sticker => (
                    <button
                      key={sticker.id}
                      onClick={() => handleStickerClick(sticker)}
                      className="aspect-square p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition-all flex flex-col items-center justify-center group"
                      title={sticker.name}
                    >
                      {sticker.url ? (
                        <img
                          src={sticker.url}
                          alt={sticker.name}
                          className="w-14 h-14 object-contain transition-transform group-hover:scale-110 drop-shadow-md"
                        />
                      ) : sticker.svgContent ? (
                        <div
                          className="w-14 h-14 transition-transform group-hover:scale-110 drop-shadow-md"
                          dangerouslySetInnerHTML={{ __html: sticker.svgContent }}
                        />
                      ) : (
                        <div className="text-3xl">{sticker.emoji}</div>
                      )}
                      <span className="text-[9px] text-[var(--color-text-muted)] mt-1 truncate">
                        {sticker.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 px-1">
                Frequently Used Emojis
              </div>
              <div className="grid grid-cols-8 gap-1">
                {recentEmojis.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleEmojiClick(emoji)}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:scale-125 transition-transform active:scale-95 rounded-lg hover:bg-white/10"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Telegram Sticker Studio Creator Modal */}
      <StickerCreatorModal
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onStickerCreated={(newSticker) => {
          setSelectedPackId('my-stickers');
        }}
      />
    </>
  );
};
