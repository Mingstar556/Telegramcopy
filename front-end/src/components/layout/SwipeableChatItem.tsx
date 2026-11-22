import React, { useRef, useState } from 'react';
import { Archive, Bot, Pin, Bookmark } from 'lucide-react';
import { ChatConversation } from '../../types/chat';
import { Avatar } from '../common/Avatar';
import { useTheme } from '../../contexts/ThemeContext';

interface SwipeableChatItemProps {
  chat: ChatConversation;
  isActive: boolean;
  onSelect: () => void;
  onArchive: (chatId: string) => void;
  onUnarchive?: (chatId: string) => void;
  isArchivedMode?: boolean;
  isUnseen?: boolean;
}

const SwipeableChatItemComponent: React.FC<SwipeableChatItemProps> = ({
  chat,
  isActive,
  onSelect,
  onArchive,
  onUnarchive,
  isArchivedMode = false,
  isUnseen: isUnseenProp
}) => {
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  // Secondary glowing state: active when someone text the bot and user hasn't seen that person
  const isUnseen = !isActive && (isUnseenProp ?? (chat.unreadCount > 0 && !chat.lastMessage?.isOutgoing));

  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const isHorizontalGestureRef = useRef<boolean | null>(null);

  const fullName = `${chat.user.firstName} ${chat.user.lastName || ''}`.trim();
  const lastMsgTime = chat.lastMessage
    ? new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  // Apple-style rubberband resistance
  const rubberband = (distance: number, dimension = 150, constant = 0.55) => {
    return (distance * dimension * constant) / (dimension + constant * Math.abs(distance));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button
    if (e.button !== 0) return;

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
    isHorizontalGestureRef.current = null;
    setIsSwiping(true);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore if setPointerCapture fails on some browsers
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSwiping) return;

    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    // Detect direction intent (horizontal swipe vs vertical scroll)
    if (isHorizontalGestureRef.current === null) {
      if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
        isHorizontalGestureRef.current = Math.abs(dx) > Math.abs(dy);
      }
    }

    if (!isHorizontalGestureRef.current) return;

    // We only swipe right to archive (dx > 0)
    const now = Date.now();
    const dt = now - lastTimeRef.current || 16;
    velocityRef.current = (dx - translateX) / dt;
    lastTimeRef.current = now;

    if (dx > 0) {
      if (dx > 110) {
        // Apply Apple rubberband past threshold
        const excess = dx - 110;
        setTranslateX(110 + rubberband(excess, 80));
      } else {
        setTranslateX(dx);
      }
    } else {
      // Small resistance leftwards
      setTranslateX(Math.max(-20, dx * 0.2));
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSwiping) return;
    setIsSwiping(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const wasSwipe = isHorizontalGestureRef.current === true;
    const finalX = translateX;
    const velocity = velocityRef.current;

    // If swipe right threshold exceeded (>85px or quick velocity flick > 0.35)
    if (wasSwipe && (finalX > 85 || (finalX > 40 && velocity > 0.35))) {
      setIsArchiving(true);
      setTranslateX(380); // Slide fully out

      setTimeout(() => {
        if (isArchivedMode && onUnarchive) {
          onUnarchive(chat.id);
        } else {
          onArchive(chat.id);
        }
      }, 180);
    } else {
      // Tap or cancel: Spring back to 0
      setTranslateX(0);

      // If user tapped without dragging (< 6px), open conversation
      if (!wasSwipe && Math.abs(e.clientX - startXRef.current) < 6) {
        onSelect();
      }
    }

    isHorizontalGestureRef.current = null;
  };

  const archiveRatio = Math.min(1, Math.max(0, translateX / 90));

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl select-none transition-all duration-200 ${
        isArchiving ? 'opacity-0 scale-95 max-h-0 py-0 my-0 overflow-hidden' : 'my-0.5'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Background Archive Action Reveal */}
      <div
        className={`absolute inset-0 flex items-center px-5 rounded-2xl transition-colors duration-150 z-0 ${
          isArchivedMode
            ? isGold
              ? 'bg-[#3b321a]'
              : 'bg-blue-600'
            : isGold
            ? 'bg-[#d4af37]'
            : 'bg-emerald-600'
        }`}
        style={{
          opacity: Math.max(0.15, archiveRatio),
          transform: `scale(${0.96 + archiveRatio * 0.04})`
        }}
      >
        <div
          className="flex items-center gap-2 font-bold text-xs"
          style={{
            transform: `scale(${0.85 + archiveRatio * 0.25}) translateX(${archiveRatio * 8}px)`,
            color: isGold && !isArchivedMode ? '#000000' : '#ffffff'
          }}
        >
          <Archive className="w-5 h-5 stroke-[2.4]" />
          <span className="tracking-wide uppercase text-[11px] font-extrabold">
            {isArchivedMode ? 'Unarchive' : 'Archive'}
          </span>
        </div>
      </div>

      {/* Front Foreground Chat Item */}
      <div
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: isSwiping ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease, box-shadow 300ms ease, border-color 300ms ease'
        }}
        className={`relative z-10 w-full p-2.5 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all duration-300 ${
          isActive
            ? isGold
              ? 'bg-[#1c180e] border border-[#e5b842]/35 shadow-sm'
              : 'bg-[var(--color-active-item)] border border-[var(--color-accent)]/30 shadow-sm'
            : isUnseen
            ? 'unseen-person-item border border-[var(--color-secondary-border)]'
            : 'hover:bg-white/[0.04] border border-transparent'
        }`}
      >
        {/* Avatar with optional Secondary Glow Beacon */}
        <Avatar
          id={chat.user.id}
          name={fullName}
          avatarUrl={chat.user.avatar}
          size="md"
          isOnline={chat.user.online}
          isSavedMessages={chat.isSavedMessages}
          isGlow={isUnseen}
        />

        {/* Content Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-sm truncate flex items-center gap-1.5 tracking-tight">
              {/* Secondary Aura Beacon Dot when Unseen */}
              {isUnseen && (
                <span className="relative flex h-2 w-2 mr-0.5 flex-shrink-0" title="New unseen message">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-secondary)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-secondary)] shadow-[0_0_8px_var(--color-secondary)]" />
                </span>
              )}

              <span className={isUnseen ? 'text-white font-bold' : ''}>{fullName}</span>

              {chat.isSavedMessages && (
                <Bookmark className="w-3.5 h-3.5 text-[#2aabee] fill-[#2aabee] inline flex-shrink-0" />
              )}

              {chat.user.isBot && !chat.isSavedMessages && (
                <Bot className="w-3.5 h-3.5 text-[var(--color-accent)] inline flex-shrink-0" />
              )}
            </span>

            <span className={`text-[11px] flex-shrink-0 ml-1 font-mono ${
              isUnseen ? 'text-[var(--color-secondary)] font-semibold' : 'text-[var(--color-text-muted)]'
            }`}>
              {lastMsgTime}
            </span>
          </div>

          {/* Subtitle & Last Message */}
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1.5 truncate pr-2">
              <p className={`truncate leading-relaxed ${isUnseen ? 'text-zinc-200 font-medium' : ''}`}>
                {chat.lastMessage?.isOutgoing && (
                  <span className="text-[var(--color-accent)] font-medium mr-1">You:</span>
                )}
                {chat.lastMessage?.message || (chat.isSavedMessages ? 'Tap to view saved notes' : 'Tap to message')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {chat.isPinned && (
                <Pin
                  className={`w-3 h-3 rotate-45 ${
                    isGold
                      ? 'text-[#e5b842] fill-[#e5b842]'
                      : 'text-[var(--color-accent)] fill-[var(--color-accent)]'
                  }`}
                />
              )}

              {chat.unreadCount > 0 && (
                <span
                  className={`min-w-4 h-4 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-300 ${
                    isUnseen
                      ? 'bg-[var(--color-secondary)] text-white font-extrabold shadow-[0_0_12px_var(--color-secondary-glow)] animate-pulse'
                      : isGold
                      ? 'bg-[#e5b842] text-black font-extrabold shadow-[#e5b842]/20'
                      : 'bg-[var(--color-unread-badge)] text-[var(--color-accent-text)] shadow-[var(--color-accent-glow)]'
                  }`}
                >
                  {chat.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SwipeableChatItem = React.memo(SwipeableChatItemComponent);
