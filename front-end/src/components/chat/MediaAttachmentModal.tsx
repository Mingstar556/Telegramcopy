import React, { useRef } from 'react';
import { Image, Video, FileText, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface MediaAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (file: File, type: 'photo' | 'video') => void;
}

export const MediaAttachmentModal: React.FC<MediaAttachmentModalProps> = ({
  isOpen,
  onClose,
  onSelectMedia
}) => {
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectMedia(file, 'photo');
      onClose();
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectMedia(file, 'video');
      onClose();
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={photoInputRef}
        accept="image/*"
        onChange={handlePhotoChange}
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        onChange={handleVideoChange}
        className="hidden"
      />

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Attachment Menu Popup */}
      <div
        style={{ transformOrigin: 'bottom left' }}
        className={`absolute bottom-16 left-3 sm:left-14 w-60 rounded-3xl p-2.5 z-50 border shadow-2xl backdrop-blur-2xl animate-pop-in ${
          isGold
            ? 'bg-[#0f0e0a]/95 border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
            : 'bg-[#121318]/95 border-white/10 text-white shadow-2xl'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 mb-1 text-xs font-semibold text-[var(--color-text-muted)]">
          <span>Attach Media</span>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. Send Photo */}
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition text-left active:scale-95"
        >
          <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
            <Image className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Photo</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">PNG, JPG, WebP</div>
          </div>
        </button>

        {/* 2. Send Video */}
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition text-left active:scale-95"
        >
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Video</div>
            <div className="text-[11px] text-[var(--color-text-muted)]">MP4, WebM, MOV</div>
          </div>
        </button>
      </div>
    </>
  );
};
