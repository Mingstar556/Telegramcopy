import React from 'react';
import { ArrowLeft, MoreVertical, Search, Bot } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Avatar } from '../common/Avatar';
import { ChatBar } from '../chat/ChatBar';
import { MessageList } from '../chat/MessageList';

interface ChatAreaProps {
  onBackToSidebar: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onBackToSidebar }) => {
  const { activeChat } = useChat();
  const { theme, settings } = useTheme();

  const isGold = theme === 'black-gold';

  let wallpaperClass = '';
  if (settings.backgroundPattern === 'doodles') {
    wallpaperClass = 'tg-wallpaper-doodles';
  } else if (settings.backgroundPattern === 'stars') {
    wallpaperClass = 'tg-wallpaper-stars';
  }

  const fullName = activeChat
    ? `${activeChat.user.firstName} ${activeChat.user.lastName || ''}`.trim()
    : '';

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden relative">
      {/* Top Glass Header */}
      {activeChat ? (
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-[var(--color-border)] glass-header select-none z-10 transition-colors duration-200">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Back button on mobile */}
            <button
              onClick={onBackToSidebar}
              className="md:hidden p-2 -ml-1.5 text-[var(--color-text-muted)] hover:text-white rounded-full transition btn-press"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <Avatar
              id={activeChat.user.id}
              name={fullName}
              avatarUrl={activeChat.user.avatar}
              size="sm"
              isOnline={activeChat.user.online}
              isSavedMessages={activeChat.isSavedMessages}
            />

            <div className="min-w-0">
              <div className="font-semibold text-sm truncate flex items-center gap-1.5 tracking-tight">
                <span>{fullName}</span>
                {activeChat.isSavedMessages && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-[#38bdf8]">
                    Cloud
                  </span>
                )}
                {activeChat.user.isBot && !activeChat.isSavedMessages && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                    BOT
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] truncate flex items-center gap-1">
                {activeChat.isSavedMessages ? (
                  <span className="text-[var(--color-text-muted)]">Your personal notes and cloud media</span>
                ) : activeChat.user.online ? (
                  <span className="text-emerald-400 font-medium">online</span>
                ) : (
                  <span>{activeChat.user.lastSeen || 'last seen recently'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 hover:text-white transition btn-press"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 hover:text-white transition btn-press"
              title="Info"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="h-16 border-b border-[var(--color-border)] glass-header flex items-center px-6">
          <div className="text-xs text-[var(--color-text-muted)]">Telegram Bot Workspace</div>
        </div>
      )}

      {/* Message Feed Canvas with Ambient Wallpaper */}
      <div
        className={`flex-1 flex flex-col overflow-hidden relative ${wallpaperClass} transition-colors duration-200 ${
          isGold ? 'bg-[#020202]' : 'bg-[#060608]'
        }`}
      >
        <MessageList />
      </div>

      {/* Bottom Composer */}
      {activeChat && <ChatBar />}
    </main>
  );
};
