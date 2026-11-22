import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

export interface PhotoItem {
  url: string;
  caption?: string;
}

interface PhotoLightboxModalProps {
  isOpen: boolean;
  photos: PhotoItem[];
  initialIndex?: number;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  photos,
  initialIndex = 0,
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Sync index when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1)));
    }
  }, [isOpen, initialIndex, photos.length]);

  // Keyboard navigation: Escape to close, Left/Right arrows to flip photos
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, photos.length, onClose]);

  if (!isOpen || photos.length === 0 || typeof document === 'undefined') {
    return null;
  }

  const currentPhoto = photos[currentIndex] || photos[0];
  const count = photos.length;
  const hasMultiple = count > 1;

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : count - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev < count - 1 ? prev + 1 : 0));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Top Floating Glass Header */}
      <div
        className="w-full flex items-center justify-between z-50 px-2 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo Counter Pill (shown for albums) */}
        {hasMultiple ? (
          <div className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-white/90 flex items-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <span>
              Photo {currentIndex + 1} of {count}
            </span>
          </div>
        ) : (
          <div />
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2 ml-auto">
          <a
            href={currentPhoto.url}
            download={`photo_${currentIndex + 1}.jpg`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition btn-press border border-white/10 shadow-md"
            title="Download Photo"
          >
            <Download className="w-4 h-4" />
          </a>
          <a
            href={currentPhoto.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition btn-press border border-white/10 shadow-md"
            title="Open Original in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition btn-press border border-white/10 shadow-md"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Center Stage with Exact Viewport Centering */}
      <div
        className="relative flex-1 flex flex-col items-center justify-center w-full max-h-[76vh] sm:max-h-[80vh] my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStartX !== null && hasMultiple) {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            if (diff > 50) {
              handleNext();
            } else if (diff < -50) {
              handlePrev();
            }
            setTouchStartX(null);
          }
        }}
      >
        {/* Previous Button (Album Only) */}
        {hasMultiple && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 sm:left-6 z-50 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/15 hover:scale-110 transition-all btn-press shadow-2xl"
            title="Previous Photo (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}

        {/* Centerpiece Image */}
        <div className="relative flex flex-col items-center justify-center max-w-full max-h-full">
          <img
            key={currentPhoto.url}
            src={currentPhoto.url}
            alt={currentPhoto.caption || `Photo ${currentIndex + 1}`}
            className="max-w-[92vw] sm:max-w-[85vw] max-h-[72vh] sm:max-h-[78vh] object-contain rounded-2xl shadow-2xl border border-white/10 ring-1 ring-white/10 animate-in zoom-in-95 duration-200 select-none"
          />

          {/* Optional Caption */}
          {currentPhoto.caption && (
            <div className="mt-2.5 px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs sm:text-sm text-white/90 text-center max-w-[85vw] sm:max-w-xl truncate shadow-lg">
              {currentPhoto.caption}
            </div>
          )}
        </div>

        {/* Next Button (Album Only) */}
        {hasMultiple && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 sm:right-6 z-50 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/15 hover:scale-110 transition-all btn-press shadow-2xl"
            title="Next Photo (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip (Album Only) */}
      {hasMultiple ? (
        <div
          className="w-full flex items-center justify-center z-50 pb-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-w-[94vw] sm:max-w-2xl overflow-x-auto flex items-center gap-2 p-2 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl scrollbar-none">
            {photos.map((p, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(pIdx);
                }}
                className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all duration-200 border-2 ${
                  currentIndex === pIdx
                    ? 'border-[var(--color-accent)] scale-105 shadow-lg opacity-100 ring-2 ring-[var(--color-accent)]/30'
                    : 'border-transparent opacity-50 hover:opacity-90 hover:scale-102'
                }`}
              >
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>,
    document.body
  );
};
