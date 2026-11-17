import React, { useEffect, useRef } from 'react';
import { Bot, MessageCircle } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MessageBubble } from './MessageBubble';

export const MessageList: React.FC = () => {
  const { activeMessages, activeChat } = useChat();
  const { theme } = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const isGold = theme === 'black-gold';

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--color-text-muted)] select-none">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isGold ? 'bg-[#d4af37]/15 text-[#d4af37]' : 'bg-[#2aabee]/15 text-[#2aabee]'
          }`}
        >
          <MessageCircle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-[var(--color-text-main)]">
          Select a chat to start messaging
        </h3>
        <p className="text-xs max-w-sm mt-1">
          As a Telegram bot operator, you can respond to users who interact with your bot.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 flex flex-col justify-start">
      {/* Encryption & Bot notice header */}
      <div className="flex justify-center my-3">
        <div className="px-3.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/5 text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5 shadow-sm">
          <Bot className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          <span>Bot session with {activeChat.user.firstName}</span>
        </div>
      </div>

      {/* Messages */}
      {activeMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-xs text-[var(--color-text-muted)]">
          No messages yet. Send a message to start the conversation!
        </div>
      ) : (
        activeMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))
      )}

      <div ref={bottomRef} />
    </div>
  );
};
