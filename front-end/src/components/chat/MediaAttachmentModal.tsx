import React, { useRef } from 'react';
import { Image, Video, FileText, X, Layers } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface MediaAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhotos: (files: File[]) => void;
  onSelectVideo: (file: File) => void;
  onSelectFile: (file: File) => void;
}

export const MediaAttachmentModal: React.FC<MediaAttachmentModalProps> = ({
  isOpen,
  onClose,
  onSelectPhotos,
  onSelectVideo,
  onSelectFile
}) => {
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onSelectPhotos(Array.from(files));
      onClose();
    }
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectVideo(file);
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
      onClose();
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={photoInputRef}
        accept="image/*,.heic,.heif,.webp,.svg,.gif"
        multiple
        onChange={handlePhotoChange}
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*,video/mp4,video/webm,video/quicktime,video/x-msvideo"
        onChange={handleVideoChange}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="*/*"
        onChange={handleFileChange}
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
        className={`absolute bottom-16 left-3 sm:left-14 w-64 rounded-3xl p-3 z-50 border shadow-2xl backdrop-blur-2xl animate-pop-in ${
          isGold
            ? 'bg-[#0f0e0a]/95 border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
            : 'bg-[#121318]/95 border-white/10 text-white shadow-2xl'
        }`}
      >
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 mb-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
          <span>Attach</span>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/70 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. Photos / Multi-photo Album */}
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition text-left active:scale-95 group"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Image className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-[var(--color-accent)] transition">
              Photos & Albums
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              Single or multiple compressed photos
            </div>
          </div>
        </button>

        {/* 2. Video */}
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition text-left active:scale-95 group"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
              Video
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              MP4, WebM, MOV with playback controls
            </div>
          </div>
        </button>

        {/* 3. Document / Any File */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition text-left active:scale-95 group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-amber-400 transition">
              File / Document
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">
              PDF, ZIP, DOCX, APK, spreadsheets
            </div>
          </div>
        </button>
      </div>
    </>
  );
};
