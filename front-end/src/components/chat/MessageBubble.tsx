import React, { useState, useEffect } from 'react';
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
  SmilePlus,
  Trash2,
  Forward,
  FileText,
  Download,
  AlertCircle,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { PREINSTALLED_STICKER_PACKS } from '../../assets/stickers/stickerPacks';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { ChatMessage, MediaItem } from '../../types/chat';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { formatFileSize } from '../../utils/imageCompressor';
import { resolveMediaUrl } from '../../services/api';
import { PhotoLightboxModal, PhotoItem } from './PhotoLightboxModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface MessageBubbleProps {
  message: ChatMessage;
  onForward?: (message: ChatMessage) => void;
}

const QUICK_REACTIONS = ['❤️', '👍', '👎', '🔥', '😂', '🎉', '👏', '⚡', '🤩', '🙏'];

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({ message, onForward }) => {
  const { theme, settings } = useTheme();
  const { saveMessageToSaved, activeChat, toggleReaction, deleteMessage } = useChat();
  const { account } = useAuth();
  const { notify } = useNotification();

  const [lightboxPhotos, setLightboxPhotos] = useState<PhotoItem[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isGold = theme === 'black-gold';
  const isOutgoing = message.isOutgoing;
  const isInsideSavedMessages = activeChat?.id === 'saved_messages';
  const fontSizePx = settings.fontSize || 15;

  const handleSaveToIndividual = (e: React.MouseEvent) => {
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

  const handleCopyImage = async (imageUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      if (blob.type === 'image/png') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        canvas.toBlob(async (pngBlob) => {
          if (pngBlob) {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
          }
        }, 'image/png');
      }
      notify({
        title: 'Image Copied',
        message: 'Image copied to clipboard',
        type: 'info',
        duration: 2000
      });
    } catch {
      navigator.clipboard.writeText(imageUrl);
      notify({
        title: 'Image Link Copied',
        message: 'Direct link copied to clipboard',
        type: 'info',
        duration: 2000
      });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = (deleteForEveryone: boolean) => {
    setShowDeleteModal(false);
    if (activeChat) {
      deleteMessage(activeChat.id, message.id, deleteForEveryone);
    }
  };

  const handleForwardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onForward) {
      onForward(message);
    }
  };

  const handleSelectReaction = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeChat) {
      toggleReaction(activeChat.id, message.id, emoji);
    }
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

  // Common Action Toolbar
  const renderActionToolbar = () => (
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

      {/* Copy Button */}
      <button
        onClick={
          message.media?.type === 'photo'
            ? (e) => handleCopyImage(message.media!.url, e)
            : handleCopyText
        }
        title={message.media?.type === 'photo' ? 'Copy Image' : 'Copy Text'}
        className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white btn-press"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400 animate-pop-in" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Forward Button */}
      {onForward && (
        <button
          onClick={handleForwardClick}
          title="Forward"
          className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] btn-press"
        >
          <Forward className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Save to Individual Notes Button */}
      {!isInsideSavedMessages && (
        <button
          onClick={handleSaveToIndividual}
          title="Save to Individual Notes"
          className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] btn-press"
        >
          {isSavedToast ? (
            <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400 animate-pop-in" />
          ) : (
            <Bookmark className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {/* Delete Message Button */}
      <button
        onClick={handleDelete}
        title="Delete Message"
        className="p-1.5 rounded-full hover:bg-red-500/20 text-[var(--color-text-muted)] hover:text-red-400 btn-press"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // Reaction Badges Footer
  const renderReactionBadges = () => {
    if (!message.reactions || message.reactions.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1 animate-pop-in">
        {message.reactions.map((r) => {
          const hasUserReacted = Boolean(
            account?.userId && r.users.includes(account.userId)
          );
          return (
            <button
              key={r.emoji}
              onClick={(e) => handleSelectReaction(r.emoji, e)}
              className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border transition active:scale-95 animate-pop-in ${
                hasUserReacted
                  ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50 text-white'
                  : 'bg-black/60 border-white/10 text-white/90 hover:bg-white/10'
              }`}
            >
              <span>{r.emoji}</span>
              <span className="text-[10px] font-mono">{r.count}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Inline Keyboard Buttons Handler & Renderer
  const handleInlineButtonClick = (btn: { text: string; url?: string; callback_data?: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    if (btn.url) {
      const lower = btn.url.toLowerCase();
      if (
        lower.startsWith('javascript:') ||
        lower.startsWith('data:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')
      ) {
        notify({
          title: 'Blocked Link',
          message: 'Unsafe link scheme was blocked.',
          type: 'alert'
        });
        return;
      }
      window.open(btn.url, '_blank', 'noopener,noreferrer');
    } else if (btn.callback_data) {
      notify({
        title: 'Inline Action Triggered',
        message: `Button: "${btn.text}" • Callback: [${btn.callback_data}]`,
        type: 'info',
        duration: 3000
      });
    }
  };

  const renderInlineKeyboard = () => {
    const keyboard = message.reply_markup?.inline_keyboard;
    if (!keyboard || keyboard.length === 0) return null;

    return (
      <div className="mt-2 flex flex-col gap-1.5 w-full">
        {keyboard.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-1.5 w-full">
            {row.map((btn, btnIdx) => (
              <button
                key={btnIdx}
                type="button"
                onClick={(e) => handleInlineButtonClick(btn, e)}
                className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition active:scale-95 shadow-sm truncate btn-press ${
                  isGold
                    ? 'bg-[#2b2413]/85 hover:bg-[#3d3319] border-[#e5b842]/35 text-[#f5f2eb] hover:border-[#e5b842]/60'
                    : 'bg-white/10 hover:bg-white/20 border-white/10 text-white hover:border-white/20'
                }`}
                title={btn.url ? `Open ${btn.url}` : `Trigger callback: ${btn.callback_data}`}
              >
                <span className="truncate">{btn.text}</span>
                {btn.url ? (
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--color-accent)] opacity-80 flex-shrink-0" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-[var(--color-accent)] opacity-80 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Standalone reaction events are rendered on their parent message, never as independent bubbles
  if (message.action === 'reaction') {
    return null;
  }

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
      <div className={`flex w-full my-1.5 animate-msg-in group items-center gap-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        {renderActionToolbar()}
        <div className="relative group max-w-[200px] flex flex-col items-center select-none">
          {stickerSvg ? (
            <div
              className="w-32 h-32 transition-transform duration-200 hover:scale-105 active:scale-95 drop-shadow-lg cursor-pointer"
              dangerouslySetInnerHTML={{ __html: stickerSvg }}
            />
          ) : message.sticker?.url ? (
            <img
              src={resolveMediaUrl(message.sticker.url)}
              alt={message.sticker.name || 'Sticker'}
              className="w-32 h-32 object-contain transition-transform duration-200 hover:scale-105 active:scale-95 drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)] cursor-pointer select-none"
            />
          ) : (
            <div className="text-6xl p-2 hover:scale-110 active:scale-95 transition-transform duration-150 cursor-pointer">
              {message.sticker?.emoji || '✨'}
            </div>
          )}

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
          {renderReactionBadges()}
        </div>
      </div>
    );
  }

  // 2. VOICE NOTE MESSAGE
  if (message.media?.type === 'voice') {
    return (
      <div className={`flex w-full my-1 animate-msg-in group items-center gap-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        {renderActionToolbar()}
        <div className="relative max-w-[85%] sm:max-w-[340px]">
          <div
            className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} px-4 py-2.5 shadow-md border transition-all duration-150 ${
              isOutgoing
                ? 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)] text-white'
                : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)] text-[var(--color-text-main)]'
            }`}
          >
            {message.forwardedFrom && (
              <div className="text-[10px] text-[var(--color-accent)] font-semibold mb-1 flex items-center gap-1">
                <Forward className="w-2.5 h-2.5" />
                <span>Forwarded from {message.forwardedFrom}</span>
              </div>
            )}

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
          {renderReactionBadges()}
        </div>
      </div>
    );
  }

  // 3. MULTI-PHOTO ALBUM GALLERY MESSAGE
  if (message.album && message.album.length > 1) {
    const photos = message.album;
    const count = photos.length;

    return (
      <div className={`flex w-full my-2 animate-msg-in group items-center gap-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        {renderActionToolbar()}
        <div className="relative max-w-[88%] sm:max-w-[380px]">
          <div
            className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} overflow-hidden shadow-lg border p-1.5 ${
              isOutgoing
                ? 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)]'
                : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)]'
            }`}
          >
            {message.forwardedFrom && (
              <div className="text-[10px] text-[var(--color-accent)] font-semibold mb-1 px-1 flex items-center gap-1">
                <Forward className="w-2.5 h-2.5" />
                <span>Forwarded from {message.forwardedFrom}</span>
              </div>
            )}

            {/* Gallery Layout */}
            <div className={`grid gap-1 rounded-2xl overflow-hidden ${count === 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {photos.slice(0, 4).map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setLightboxPhotos(
                      photos.map((p) => ({
                        url: resolveMediaUrl(p.url),
                        caption: (p as any).caption || (message.message && !message.message.startsWith('[') ? message.message : undefined)
                      }))
                    );
                    setLightboxIndex(idx);
                  }}
                  className={`relative cursor-pointer group/img overflow-hidden bg-black/40 ${count === 3 && idx === 0 ? 'col-span-2 aspect-[2/1]' : 'aspect-square'}`}
                >
                  <img
                    src={resolveMediaUrl(p.url)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover/img:scale-105"
                  />
                  {count > 4 && idx === 3 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center font-bold text-white text-lg">
                      +{count - 4}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Caption & Timestamp */}
            {message.message && !message.message.startsWith('[') ? (
              <div className="p-2.5 pb-1 flex flex-col">
                <div
                  style={{ fontSize: `${fontSizePx}px` }}
                  className="text-white leading-relaxed whitespace-pre-wrap select-text break-words"
                >
                  {renderSafeContent(message.message)}
                </div>
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-white/75 font-mono self-end">
                  <span>{timeStr}</span>
                  {isOutgoing && (
                    <CheckCheck className="w-3 h-3 text-[var(--color-accent)]" />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-end pr-1 pt-1 text-[10px] text-white/75 font-mono">
                <span>{timeStr}</span>
                {isOutgoing && (
                  <CheckCheck className="w-3 h-3 text-[var(--color-accent)] ml-1" />
                )}
              </div>
            )}
          </div>
          {renderInlineKeyboard()}
          {renderReactionBadges()}
        </div>

        {/* Clean Centered Lightbox Modal */}
        <PhotoLightboxModal
          isOpen={!!lightboxPhotos}
          photos={lightboxPhotos || []}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxPhotos(null)}
        />
      </div>
    );
  }

  // 4. SINGLE PHOTO MESSAGE
  if (message.media?.type === 'photo') {
    const hasCaption = message.message && message.message !== '[Photo]';

    return (
      <div className={`flex w-full my-1.5 animate-msg-in group items-center gap-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        {renderActionToolbar()}
        <div className="relative max-w-[88%] sm:max-w-md md:max-w-lg">
          <div
            className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} overflow-hidden shadow-lg border ${
              isOutgoing
                ? 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)]'
                : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)]'
            }`}
          >
            {message.forwardedFrom && (
              <div className="text-[10px] text-[var(--color-accent)] font-semibold p-2 pb-0 flex items-center gap-1">
                <Forward className="w-2.5 h-2.5" />
                <span>Forwarded from {message.forwardedFrom}</span>
              </div>
            )}

            <div
              className="relative group cursor-pointer bg-black/40 flex items-center justify-center overflow-hidden"
              onClick={() => {
                setLightboxPhotos([{ url: resolveMediaUrl(message.media!.url), caption: hasCaption ? message.message : undefined }]);
                setLightboxIndex(0);
              }}
            >
              {!imgLoaded && (
                message.preview_blur || message.media?.preview_blur ? (
                  <img
                    src={message.preview_blur || message.media?.preview_blur}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover filter blur-lg scale-110 opacity-75"
                  />
                ) : (
                  <div className="absolute inset-0 min-h-[160px] skeleton-shimmer" />
                )
              )}
              <img
                src={resolveMediaUrl(message.media.url)}
                alt={message.message || 'Photo'}
                loading="lazy"
                decoding="async"
                crossOrigin="anonymous"
                onLoad={() => setImgLoaded(true)}
                className={`max-w-full max-h-[65vh] w-auto h-auto object-contain transition-all duration-300 ${
                  imgLoaded ? 'opacity-100' : 'opacity-0'
                } group-hover:scale-[1.01]`}
              />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-sm shadow-md">
                  <Maximize2 className="w-4 h-4" />
                </span>
              </div>
            </div>

            {hasCaption ? (
              <div className="p-3 pb-2 flex flex-col bg-black/40">
                <div
                  style={{ fontSize: `${fontSizePx}px` }}
                  className="text-white leading-relaxed whitespace-pre-wrap select-text break-words"
                >
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
              <div className="absolute right-2 bottom-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1 shadow-sm font-mono pointer-events-none">
                <span>{timeStr}</span>
                {isOutgoing && (
                  <CheckCheck className="w-3 h-3 text-[var(--color-accent)] animate-pop-in" />
                )}
              </div>
            )}
          </div>
          {renderInlineKeyboard()}
          {renderReactionBadges()}
        </div>

        {/* Clean Centered Lightbox Modal */}
        <PhotoLightboxModal
          isOpen={!!lightboxPhotos}
          photos={lightboxPhotos || []}
          initialIndex={0}
          onClose={() => setLightboxPhotos(null)}
        />
      </div>
    );
  }

  // 5. VIDEO MESSAGE (With working playback & error recovery)
  if (message.media?.type === 'video') {
    const hasCaption = message.message && message.message !== '[Video]';

    return (
      <div className={`flex w-full my-1.5 animate-msg-in group items-center gap-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        {renderActionToolbar()}
        <div className="relative max-w-[85%] sm:max-w-[340px]">
          <div
            className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} overflow-hidden shadow-lg border ${
              isOutgoing
                ? 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)]'
                : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)]'
            }`}
          >
            {message.forwardedFrom && (
              <div className="text-[10px] text-[var(--color-accent)] font-semibold p-2 pb-0 flex items-center gap-1">
                <Forward className="w-2.5 h-2.5" />
                <span>Forwarded from {message.forwardedFrom}</span>
              </div>
            )}

            {videoError ? (
              <div className="p-6 bg-black/60 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                <div className="text-xs font-semibold text-white">Video format not directly playable in browser</div>
                <a
                  href={resolveMediaUrl(message.media.url)}
                  download={message.media.fileName || 'video.mp4'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download / Open Video</span>
                </a>
              </div>
            ) : (
              <video
                src={resolveMediaUrl(message.media.url)}
                controls
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
                onError={() => setVideoError(true)}
                className="w-full max-h-72 object-cover bg-black"
              />
            )}

            {hasCaption ? (
              <div className="p-3 pb-2 flex flex-col bg-black/40">
                <div
                  style={{ fontSize: `${fontSizePx}px` }}
                  className="text-white leading-relaxed whitespace-pre-wrap select-text break-words"
                >
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
              <div className="flex justify-end p-2 text-[10px] text-white/75 font-mono">
                <span>{timeStr}</span>
                {isOutgoing && (
                  <CheckCheck className="w-3 h-3 text-[var(--color-accent)] ml-1" />
                )}
              </div>
            )}
          </div>
          {renderInlineKeyboard()}
          {renderReactionBadges()}
        </div>
      </div>
    );
  }

  // 6. DOCUMENT / FILE MESSAGE
  if (message.media?.type === 'file') {
    const fileName = message.media.fileName || 'Document';
    const fileSize = message.media.fileSize || '';

    return (
      <div className={`flex w-full my-1 animate-msg-in group items-center gap-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        {renderActionToolbar()}
        <div className="relative max-w-[85%] sm:max-w-[340px]">
          <div
            className={`chat-bubble ${isOutgoing ? 'chat-bubble-out' : 'chat-bubble-in'} p-3 shadow-md border ${
              isOutgoing
                ? 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)] text-white'
                : 'bg-[var(--color-bg-bubble-in)] border-[var(--color-border)] text-[var(--color-text-main)]'
            }`}
          >
            {message.forwardedFrom && (
              <div className="text-[10px] text-[var(--color-accent)] font-semibold mb-1 flex items-center gap-1">
                <Forward className="w-2.5 h-2.5" />
                <span>Forwarded from {message.forwardedFrom}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate">{fileName}</div>
                <div className="text-[10px] opacity-75 font-mono mt-0.5">{fileSize}</div>
              </div>
              <a
                href={message.media.url}
                download={fileName}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex-shrink-0 btn-press"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </div>

            {message.message && !message.message.startsWith('[File:') && (
              <div
                style={{ fontSize: `${fontSizePx}px` }}
                className="mt-2 text-xs leading-relaxed whitespace-pre-wrap select-text"
              >
                {renderSafeContent(message.message)}
              </div>
            )}

            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75 font-mono">
              <span>{timeStr}</span>
              {isOutgoing && (
                <CheckCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              )}
            </div>
          </div>
          {renderInlineKeyboard()}
          {renderReactionBadges()}
        </div>
      </div>
    );
  }

  // 7. STANDARD TEXT MESSAGE
  return (
    <div
      className={`flex w-full my-1 animate-msg-in group items-center gap-1.5 relative ${
        isOutgoing ? 'justify-end' : 'justify-start'
      }`}
    >
      {renderActionToolbar()}

      <div className="relative max-w-[88%] sm:max-w-[75%] min-w-[70px]">
        <div
          style={{ fontSize: `${fontSizePx}px` }}
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
          {/* Forwarded Header */}
          {message.forwardedFrom && (
            <div className="text-[10px] text-[var(--color-accent)] font-semibold mb-1 flex items-center gap-1 opacity-90">
              <Forward className="w-2.5 h-2.5" />
              <span>Forwarded from {message.forwardedFrom}</span>
            </div>
          )}

          {/* Message Text with natural wrapping */}
          <div className="leading-relaxed whitespace-pre-wrap select-text tracking-tight break-words [overflow-wrap:anywhere] w-full">
            {renderSafeContent(message.message)}
          </div>

          {/* Timestamp and delivery checkmarks */}
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

        {/* Inline Keyboard Buttons */}
        {renderInlineKeyboard()}

        {/* Selected Emoji Reactions Floating Badges */}
        {renderReactionBadges()}
      </div>

      {/* Telegram-style Delete Message Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          mode="message"
          targetName={activeChat?.user?.firstName || 'User'}
          isSavedMessages={Boolean(activeChat?.isSavedMessages)}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
};

export const MessageBubble = React.memo(MessageBubbleComponent);
