import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  X,
  Maximize2,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  ShieldCheck,
  Copy,
  SmilePlus
} from 'lucide-react';
import { PREINSTALLED_STICKER_PACKS } from '../../assets/stickers/stickerPacks';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';
import { useNotification } from '../../contexts/NotificationContext';
import { ChatMessage } from '../../types/chat';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';

interface MessageBubbleProps {
  message: ChatMessage;
}

const QUICK_REACTIONS = ['❤️', '👍', '🔥', '😂', '🎉', '👏'];

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { theme, settings } = useTheme();
  const { saveMessageToSaved, activeChat } = useChat();
  const { notify } = useNotification();

  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const isGold = theme === 'black-gold';
  const isOutgoing = message.isOutgoing;
  const isInsideSavedMessages = activeChat?.id === 'saved_messages';

  const handleSaveToCloud = (e: React.MouseEvent) => {
    e.stopPropagation();
    saveMessageToSaved(message);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 1600);
  };

  const handleCopyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (message.message) {
      navigator.clipboard.writeText(message.message);
      setCopied(true);
      notify({
        title: 'Copied',
        message: 'Message copied to clipboard',
        type: 'info',
        duration: 2000
      });
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleSelectReaction = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedReaction((prev) => (prev === emoji ? null : emoji));
    setShowReactionPicker(false);
  };

  // Format time HH:MM
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const renderSafeContent = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, idx) => {
      if (part.match(urlRegex)) {
        const lower = part.toLowerCase();
        // Block dangerous schemes strictly per 17-mobile-security
        if (
          lower.startsWith('javascript:') ||
          lower.startsWith('data:') ||
          lower.startsWith('vbscript:') ||
          lower.startsWith('file:')
        ) {
          return (
            <span
              key={idx}
              className="text-red-400 line-through select-all font-mono text-[11px]"
              title="Blocked Unsafe Scheme"
            >
              [Blocked Unsafe Link]
            </span>
          );
        }

        const isAbaPayment = lower.includes('payway.com.kh') || lower.includes('ababank.com');
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (
                !window.confirm(
                  `Opening external link:\n${part}\n\nVerify this destination is safe before proceeding.`
                )
              ) {
                e.preventDefault();
              }
            }}
            className={`inline-flex items-center gap-1 underline font-medium hover:opacity-85 transition break-all ${
              isAbaPayment
                ? 'text-emerald-400 font-semibold'
                : 'text-[var(--color-accent)]'
            }`}
          >
            {isAbaPayment ? (
              <ShieldCheck className="w-3 h-3 inline flex-shrink-0" />
            ) : (
              <ExternalLink className="w-2.5 h-2.5 inline flex-shrink-0" />
            )}
            <span>{part}</span>
          </a>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // 1. STICKER MESSAGE
  if (message.sticker || message.action === 'send_sticker') {
    let stickerSvg: string | null = null;

    if (message.sticker?.id) {
      for (const pack of PREINSTALLED_STICKER_PACKS) {
        const found = pack.stickers.find((s) => s.id === message.sticker?.id);
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
              className="w-32 h-32 transition-transform duration-200 hover:scale-105 active:scale-95 drop-shadow-lg cursor-pointer"
              dangerouslySetInnerHTML={{ __html: stickerSvg }}
            />
          ) : (
            <div className="text-6xl p-2 hover:scale-110 active:scale-95 transition-transform duration-150 cursor-pointer">
              {message.sticker?.emoji || '✨'}
            </div>
          )}

          {/* Timestamp chip */}
          <div className="mt-1 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white/80 flex items-center gap-1 shadow-sm font-mono">
            <span>{timeStr}</span>
            {isOutgoing && (
              message.status === 'pending' ? (
                <Clock className="w-2.5 h-2.5 opacity-60" />
              ) : (
                <CheckCheck className="w-3 h-3 text-[var(--color-accent)] animate-pop-in" />
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
          className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} relative px-4 py-2.5 shadow-md border transition-all duration-150 ${
            isOutgoing
              ? 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)] text-white'
              : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)] text-[var(--color-text-main)]'
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
                <CheckCheck className="w-3.5 h-3.5 text-[var(--color-accent)] animate-pop-in" />
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
          className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} relative max-w-[85%] sm:max-w-[320px] overflow-hidden shadow-lg border ${
            isOutgoing
              ? 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)]'
              : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)]'
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

          {message.message && message.message !== '[Photo]' ? (
            <div className="p-3 pb-2 flex flex-col bg-black/40">
              <div className="text-xs text-white leading-relaxed whitespace-pre-wrap select-text break-words [overflow-wrap:anywhere]">
                {renderSafeContent(message.message)}
              </div>
              <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-white/75 font-mono self-end">
                <span>{timeStr}</span>
                {isOutgoing && (
                  <CheckCheck className="w-3 h-3 text-[var(--color-accent)] animate-pop-in" />
                )}
              </div>
            </div>
          ) : (
            <div className="absolute right-2 bottom-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1 shadow-sm font-mono">
              <span>{timeStr}</span>
              {isOutgoing && (
                <CheckCheck className="w-3 h-3 text-[var(--color-accent)] animate-pop-in" />
              )}
            </div>
          )}
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
          className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} relative max-w-[85%] sm:max-w-[340px] overflow-hidden shadow-lg border ${
            isOutgoing
              ? 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)]'
              : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)]'
          }`}
        >
          <video
            src={message.media.url}
            controls
            className="w-full max-h-72 object-cover bg-black"
          />

          {message.message && message.message !== '[Video]' ? (
            <div className="p-3 pb-2 flex flex-col bg-black/40">
              <div className="text-xs text-white leading-relaxed whitespace-pre-wrap select-text break-words [overflow-wrap:anywhere]">
                {renderSafeContent(message.message)}
              </div>
              <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-white/75 font-mono self-end">
                <span>{timeStr}</span>
                {isOutgoing && (
                  <CheckCheck className="w-3 h-3 text-[var(--color-accent)] animate-pop-in" />
                )}
              </div>
            </div>
          ) : (
            <div className="absolute right-2 bottom-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1 pointer-events-none shadow-sm font-mono">
              <span>{timeStr}</span>
              {isOutgoing && (
                <CheckCheck className="w-3 h-3 text-[var(--color-accent)] animate-pop-in" />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. STANDARD TEXT MESSAGE
  return (
    <div
      className={`flex w-full my-1 animate-msg-in group items-center gap-1.5 relative ${
        isOutgoing ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Quick Action Toolbar (Hover on Desktop, Click on Mobile) */}
      <div
        className={`opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 ${
          isOutgoing ? 'order-first' : 'order-last'
        }`}
      >
        {/* Reaction Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowReactionPicker((prev) => !prev)}
            title="React"
            className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] btn-press"
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>

          {/* Floating Emoji Bar */}
          {showReactionPicker && (
            <div
              className={`absolute bottom-full mb-1 z-30 p-1.5 rounded-full bg-black/90 border border-white/15 backdrop-blur-xl shadow-2xl flex items-center gap-1 animate-pop-in ${
                isOutgoing ? 'right-0' : 'left-0'
              }`}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => handleSelectReaction(emoji, e)}
                  className="w-7 h-7 rounded-full hover:bg-white/20 active:scale-125 transition-transform text-sm flex items-center justify-center btn-press"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Copy Text Button */}
        <button
          onClick={handleCopyText}
          title="Copy Text"
          className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white btn-press"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 animate-pop-in" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Save to Cloud Button */}
        {!isInsideSavedMessages && (
          <button
            onClick={handleSaveToCloud}
            title="Save to Saved Messages"
            className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] btn-press"
          >
            {isSavedToast ? (
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400 animate-pop-in" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Main Message Bubble */}
      <div className="relative max-w-[88%] sm:max-w-[75%] min-w-[70px]">
        <div
          style={{ fontSize: `${settings.fontSize}px` }}
          className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} px-4 py-2.5 shadow-md transition-all duration-150 border flex flex-col ${
            isOutgoing
              ? isGold
                ? 'bg-[#27200a] border-[#e5b842]/35 text-[#fbf7ee]'
                : 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)] text-white'
              : isGold
              ? 'bg-[#14120b] border-[#e5b842]/20 text-[#f5f2eb]'
              : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)] text-[var(--color-text-main)]'
          }`}
        >
          {/* Forwarded Header (if saved or forwarded) */}
          {message.forwardedFrom && (
            <div className="text-[10px] text-[var(--color-accent)] font-semibold mb-1 flex items-center gap-1 opacity-90">
              <Bookmark className="w-2.5 h-2.5" />
              <span>Saved from {message.forwardedFrom}</span>
            </div>
          )}

          {/* Message Text with natural wrapping, never overlapping timestamp */}
          <div className="leading-relaxed whitespace-pre-wrap select-text tracking-tight break-words [overflow-wrap:anywhere] w-full">
            {renderSafeContent(message.message)}
          </div>

          {/* Timestamp and delivery checkmarks cleanly placed below the text */}
          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] select-none pointer-events-none opacity-75 font-mono self-end -mb-0.5">
            <span className="font-normal leading-none tracking-tight">
              {timeStr}
            </span>
            {isOutgoing && (
              <span className="flex items-center">
                {message.status === 'pending' ? (
                  <Clock className="w-2.5 h-2.5 opacity-60" />
                ) : message.status === 'sent' ? (
                  <Check className="w-3 h-3 text-[var(--color-accent)] animate-pop-in" />
                ) : (
                  <CheckCheck className="w-3.5 h-3.5 text-[var(--color-accent)] animate-pop-in" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Selected Emoji Reaction Floating Badge */}
        {selectedReaction && (
          <div
            className={`absolute -bottom-2 ${
              isOutgoing ? 'right-2' : 'left-2'
            } px-2 py-0.5 rounded-full bg-black/85 border border-white/20 text-xs shadow-md animate-reaction-float flex items-center gap-1 select-none cursor-pointer hover:scale-110 active:scale-95 transition-transform`}
            onClick={() => setSelectedReaction(null)}
            title="Click to remove reaction"
          >
            <span>{selectedReaction}</span>
            <span className="text-[9px] font-bold text-white/70">1</span>
          </div>
        )}
      </div>
    </div>
  );
};
