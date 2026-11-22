import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Plus, Trash2, Smile, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { formatFileSize } from '../../utils/imageCompressor';

export interface PendingMediaItem {
  file: File;
  previewUrl: string;
  type: 'photo' | 'video' | 'file';
  caption?: string;
  duration?: number;
}

interface MediaPreviewModalProps {
  isOpen: boolean;
  items: PendingMediaItem[];
  initialCaption?: string;
  onClose: () => void;
  onSend: (items: PendingMediaItem[], generalCaption: string, videoDuration?: number) => void;
  onAddMore?: (files: FileList | File[]) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  items,
  initialCaption = '',
  onClose,
  onSend,
  onAddMore
}) => {
  const { theme, settings } = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caption, setCaption] = useState(initialCaption);
  const [videoDuration, setVideoDuration] = useState<number | undefined>(undefined);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setCaption(initialCaption || '');
      setVideoDuration(undefined);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, initialCaption]);

  if (!isOpen || items.length === 0) return null;

  const isGold = theme === 'black-gold';
  const activeItem = items[selectedIndex] || items[0];

  const handleSend = () => {
    onSend(items, caption, videoDuration || activeItem.duration);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onAddMore) {
      onAddMore(e.target.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-xl max-h-[90vh] rounded-3xl p-5 border shadow-2xl flex flex-col relative animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
            : 'bg-[#121318] border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">
              {items.length > 1
                ? `Send ${items.length} Files`
                : activeItem.type === 'video'
                ? 'Send Video'
                : activeItem.type === 'file'
                ? 'Send File'
                : 'Send Photo'}
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-mono">
              ({formatFileSize(activeItem.file.size)})
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition btn-press"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Preview Stage */}
        <div className="flex-1 min-h-[220px] max-h-[380px] my-3 rounded-2xl bg-black/50 border border-white/5 flex items-center justify-center overflow-hidden relative select-none">
          {activeItem.type === 'photo' ? (
            <img
              src={activeItem.previewUrl}
              alt="Preview"
              className="max-w-full max-h-[360px] object-contain rounded-xl"
            />
          ) : activeItem.type === 'video' ? (
            <video
              src={activeItem.previewUrl}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const dur = Math.round(e.currentTarget.duration || 0);
                if (dur > 0) setVideoDuration(dur);
              }}
              className="max-w-full max-h-[360px] object-contain rounded-xl"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2">
                <ImageIcon className="w-8 h-8" />
              </div>
              <div className="font-semibold text-sm max-w-xs truncate">{activeItem.file.name}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 font-mono">
                {formatFileSize(activeItem.file.size)}
              </div>
            </div>
          )}
        </div>

        {/* Multi-Item Thumbnail Carousel (if > 1 item) */}
        {items.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 select-none">
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border-2 transition relative ${
                  selectedIndex === idx
                    ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 scale-105'
                    : 'border-white/10 opacity-60 hover:opacity-100'
                }`}
              >
                {item.type === 'photo' ? (
                  <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                    {item.type.toUpperCase()}
                  </div>
                )}
              </button>
            ))}

            {/* Add more button */}
            <input
              type="file"
              ref={addMoreInputRef}
              multiple
              accept="image/*,video/*"
              onChange={handleAddMoreFiles}
              className="hidden"
            />
            <button
              onClick={() => addMoreInputRef.current?.click()}
              className="w-14 h-14 rounded-xl border border-dashed border-white/20 hover:border-white/40 flex items-center justify-center text-[var(--color-text-muted)] hover:text-white flex-shrink-0 transition btn-press"
              title="Add more photos"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Caption & Send Action Footer */}
        <div className="pt-2 flex items-center gap-2">
          <div className="flex-1 flex items-center rounded-full px-4 py-2 bg-black/40 border border-white/10 focus-within:border-[var(--color-accent)] transition">
            <input
              ref={inputRef}
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeItem.type === 'video'
                  ? 'Add a caption for this video...'
                  : activeItem.type === 'photo'
                  ? 'Add a caption for this photo...'
                  : 'Add a caption...'
              }
              className="w-full bg-transparent border-0 outline-none text-sm text-white placeholder-zinc-500"
            />
          </div>

          <button
            onClick={handleSend}
            className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center flex-shrink-0 btn-press bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)] shadow-[var(--color-accent-glow)] font-bold"
            title="Send"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
