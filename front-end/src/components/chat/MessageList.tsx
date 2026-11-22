import React, { useEffect, useRef } from 'react';
import { Bot, MessageCircle, Sparkles, Radio } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MessageBubble } from './MessageBubble';

export const MessageList: React.FC = () => {
  const { activeMessages, activeChat, typingStatus, isLoading } = useChat();
  const { theme } = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message or active typing bubble
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, typingStatus]);

  const isGold = theme === 'black-gold';

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--color-text-muted)] select-none animate-pop-in">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:scale-105 shadow-xl ${
            isGold
              ? 'bg-[#d4af37]/15 text-[#e5b842] border border-[#d4af37]/30 shadow-[#e5b842]/10'
              : 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 shadow-[var(--color-accent)]/10'
          }`}
        >
          <MessageCircle className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h3 className="text-base font-bold text-[var(--color-text-main)] tracking-tight">
          Select a chat to start messaging
        </h3>
        <p className="text-xs max-w-sm mt-1.5 leading-relaxed text-[var(--color-text-muted)]">
          As a Telegram bot operator, all client interactions sync here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 flex flex-col justify-start">
      {/* Encryption & Bot notice header */}
      <div className="flex justify-center my-2.5">
        <div className="px-3.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5 shadow-sm">
          <Bot className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span>Bot session with {activeChat.user.firstName}</span>
        </div>
      </div>

      {/* Messages or Skeleton Loading State */}
      {isLoading ? (
        <div className="space-y-4 py-2">
          <div className="flex justify-start">
            <div className="w-48 h-10 rounded-2xl rounded-bl-sm skeleton-shimmer" />
          </div>
          <div className="flex justify-end">
            <div className="w-56 h-12 rounded-2xl rounded-br-sm skeleton-shimmer" />
          </div>
          <div className="flex justify-start">
            <div className="w-64 h-14 rounded-2xl rounded-bl-sm skeleton-shimmer" />
          </div>
          <div className="flex justify-end">
            <div className="w-40 h-10 rounded-2xl rounded-br-sm skeleton-shimmer" />
          </div>
        </div>
      ) : activeMessages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-xs text-[var(--color-text-muted)] my-12 animate-pop-in">
          <Sparkles className="w-6 h-6 text-[var(--color-accent)] mb-2 animate-soft-pulse" />
          <p>No messages yet. Send a message to start the conversation!</p>
        </div>
      ) : (
        activeMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))
      )}

      {/* Live Animated Telegram Typing Bubble with Pulsing Aura */}
      {typingStatus && (
        <div className="flex items-center gap-2 my-2 animate-msg-in">
          <div
            className="px-4 py-2.5 rounded-2xl rounded-bl-sm border backdrop-blur-xl flex items-center gap-3 shadow-lg bg-[var(--color-bg-bubble-in)] border-[var(--color-border)] animate-typing-aura"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-typing-dot-1" />
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-typing-dot-2" />
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-typing-dot-3" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] font-medium">
              <Radio className="w-3 h-3 text-[var(--color-accent)] animate-pulse" />
              <span>{activeChat.user.firstName || 'Client'} is typing...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
