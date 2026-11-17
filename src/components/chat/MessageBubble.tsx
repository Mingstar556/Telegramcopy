import React, { useState } from 'react';
import { Check, CheckCheck, Clock, X, Maximize2, Bookmark, BookmarkCheck } from 'lucide-react';
import { PREINSTALLED_STICKER_PACKS } from '../../assets/stickers/stickerPacks';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';
import { ChatMessage } from '../../types/chat';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';

interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { theme, settings } = useTheme();
  const { saveMessageToSaved, activeChat } = useChat();
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const [isSavedToast, setIsSavedToast] = useState(false);

  const isGold = theme === 'black-gold';
  const isOutgoing = message.isOutgoing;
  const isInsideSavedMessages = activeChat?.id === 'saved_messages';

  const handleSaveToCloud = (e: React.MouseEvent) => {
    e.stopPropagation();
    saveMessageToSaved(message);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 1600);
  };

  // Format time HH:MM
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // 1. STICKER MESSAGE
  if (message.sticker || message.action === 'send_sticker') {
    let stickerSvg: string | null = null;

    if (message.sticker?.id) {
      for (const pack of PREINSTALLED_STICKER_PACKS) {
        const found = pack.stickers.find(s => s.id === message.sticker?.id);
        if (found?.svgContent) {
          stickerSvg = found.svgContent;
          break;
        }
      }
    }

    return (
      <div className={`flex w-full my-1.5 animate-msg-in ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        <div className="relative group max-w-[200px] flex flex-col items-center select-none">
          {stickerSvg ? (
            <div
              className="w-32 h-32 transition-transform duration-150 hover:scale-105 drop-shadow-md"
              dangerouslySetInnerHTML={{ __html: stickerSvg }}
            />
          ) : (
            <div className="text-6xl p-2 hover:scale-110 transition duration-150">
              {message.sticker?.emoji || '✨'}
            </div>
          )}

          {/* Timestamp chip */}
          <div className="mt-1 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white/80 flex items-center gap-1 shadow-sm">
            <span>{timeStr}</span>
            {isOutgoing && (
              message.status === 'pending' ? (
                <Clock className="w-2.5 h-2.5 opacity-60" />
              ) : (
                <CheckCheck className={`w-3 h-3 ${isGold ? 'text-[#f3c853]' : 'text-[#38bdf8]'}`} />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. VOICE NOTE MESSAGE
  if (message.media?.type === 'voice') {
    return (
      <div className={`flex w-full my-1 animate-msg-in ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`relative px-4 py-2.5 rounded-[22px] shadow-sm border transition-all duration-150 ${
            isOutgoing
              ? isGold
                ? 'bg-[#27200a] border-[#e5b842]/30 text-[#fbf7ee]'
                : 'bg-[#22476b] border-white/10 text-white'
              : isGold
              ? 'bg-[#14120b] border-[#e5b842]/15 text-[#f5f2eb]'
              : 'bg-[#16181d] border-white/[0.07] text-white'
          }`}
        >
          <VoiceMessagePlayer
            audioUrl={message.media.url}
            duration={message.media.duration}
            isOutgoing={isOutgoing}
          />

          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75 font-mono">
            <span>{timeStr}</span>
            {isOutgoing && (
              message.status === 'pending' ? (
                <Clock className="w-2.5 h-2.5" />
              ) : (
                <CheckCheck className={`w-3.5 h-3.5 ${isGold ? 'text-[#f3c853]' : 'text-[#38bdf8]'}`} />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. PHOTO MESSAGE
  if (message.media?.type === 'photo') {
    return (
      <div className={`flex w-full my-1.5 animate-msg-in ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`relative max-w-[85%] sm:max-w-[320px] rounded-[22px] overflow-hidden shadow-md border ${
            isOutgoing
              ? isGold ? 'border-[#e5b842]/30 bg-[#27200a]' : 'border-white/10 bg-[#22476b]'
              : isGold ? 'border-[#e5b842]/15 bg-[#14120b]' : 'border-white/[0.07] bg-[#16181d]'
          }`}
        >
          <div className="relative group cursor-pointer" onClick={() => setIsPhotoExpanded(true)}>
            <img
              src={message.media.url}
              alt={message.message || 'Photo'}
              className="w-full max-h-72 object-cover transition-transform group-hover:scale-[1.02] duration-200"
            />
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
              <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-sm shadow-md">
                <Maximize2 className="w-4 h-4" />
              </span>
            </div>
          </div>

          {message.message && message.message !== '[Photo]' && (
            <div className="p-2.5 text-xs text-white leading-relaxed">
              {message.message}
            </div>
          )}

          <div className="absolute right-2 bottom-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1 shadow-sm font-mono">
            <span>{timeStr}</span>
            {isOutgoing && (
              <CheckCheck className={`w-3 h-3 ${isGold ? 'text-[#f3c853]' : 'text-[#38bdf8]'}`} />
            )}
          </div>
        </div>

        {/* Fullscreen Photo Lightbox Modal */}
        {isPhotoExpanded && (
          <div
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setIsPhotoExpanded(false)}
          >
            <button
              onClick={() => setIsPhotoExpanded(false)}
              className="absolute top-5 right-5 text-white/80 hover:text-white p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition btn-press"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={message.media.url}
              alt="Full view"
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        )}
      </div>
    );
  }

  // 4. VIDEO MESSAGE
  if (message.media?.type === 'video') {
    return (
      <div className={`flex w-full my-1.5 animate-msg-in ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`relative max-w-[85%] sm:max-w-[340px] rounded-[22px] overflow-hidden shadow-md border ${
            isOutgoing
              ? isGold ? 'border-[#e5b842]/30 bg-[#27200a]' : 'border-white/10 bg-[#22476b]'
              : isGold ? 'border-[#e5b842]/15 bg-[#14120b]' : 'border-white/[0.07] bg-[#16181d]'
          }`}
        >
          <video
            src={message.media.url}
            controls
            className="w-full max-h-72 object-cover bg-black"
          />

          {message.message && message.message !== '[Video]' && (
            <div className="p-2.5 text-xs text-white leading-relaxed">
              {message.message}
            </div>
          )}

          <div className="absolute right-2 bottom-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1 pointer-events-none shadow-sm font-mono">
            <span>{timeStr}</span>
            {isOutgoing && (
              <CheckCheck className={`w-3 h-3 ${isGold ? 'text-[#f3c853]' : 'text-[#38bdf8]'}`} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // 5. STANDARD TEXT MESSAGE
  return (
    <div className={`flex w-full my-1 animate-msg-in group items-center gap-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      {/* Save to Saved Messages Action (for incoming messages on hover) */}
      {isOutgoing && !isInsideSavedMessages && (
        <button
          onClick={handleSaveToCloud}
          title="Save to Saved Messages"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] btn-press"
        >
          {isSavedToast ? <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      )}

      <div
        style={{ fontSize: `${settings.fontSize}px` }}
        className={`relative max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-[22px] shadow-sm transition-all duration-150 break-words border ${
          isOutgoing
            ? isGold
              ? 'bg-[#27200a] border-[#e5b842]/30 text-[#fbf7ee]'
              : 'bg-[#22476b] border-white/10 text-white'
            : isGold
            ? 'bg-[#14120b] border-[#e5b842]/15 text-[#f5f2eb]'
            : 'bg-[#16181d] border-white/[0.07] text-white'
        }`}
      >
        {/* Forwarded Header (if saved or forwarded) */}
        {message.forwardedFrom && (
          <div className="text-[10px] text-[var(--color-accent)] font-semibold mb-1 flex items-center gap-1 opacity-90">
            <Bookmark className="w-2.5 h-2.5" />
            <span>Saved from {message.forwardedFrom}</span>
          </div>
        )}

        <div className="leading-relaxed whitespace-pre-wrap select-text pr-14 tracking-tight">
          {message.message}
        </div>

        <div className="absolute right-3 bottom-1.5 flex items-center gap-1 select-none pointer-events-none opacity-75 font-mono">
          <span className="text-[10px] font-normal leading-none tracking-tight">
            {timeStr}
          </span>
          {isOutgoing && (
            <span className="flex items-center">
              {message.status === 'pending' ? (
                <Clock className="w-2.5 h-2.5" />
              ) : message.status === 'sent' ? (
                <Check className="w-3 h-3" />
              ) : (
                <CheckCheck className={`w-3.5 h-3.5 ${isGold ? 'text-[#f3c853]' : 'text-[#38bdf8]'}`} />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Save to Saved Messages Action (for incoming messages on hover) */}
      {!isOutgoing && !isInsideSavedMessages && (
        <button
          onClick={handleSaveToCloud}
          title="Save to Saved Messages"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] btn-press"
        >
          {isSavedToast ? <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Saved Toast notification */}
      {isSavedToast && (
        <span className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-lg animate-pop-in flex items-center gap-1">
          <BookmarkCheck className="w-3 h-3" />
          <span>Saved to Saved Messages</span>
        </span>
      )}
    </div>
  );
};
