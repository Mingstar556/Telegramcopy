import React, { useState } from 'react';
import {
  MoreVertical,
  Search,
  Sparkles,
  X,
  Archive,
  ChevronDown,
  ChevronRight,
  Shield,
  Bookmark
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Avatar } from '../common/Avatar';
import { QuickAppearancePopover } from '../common/QuickAppearancePopover';
import { ThreeDotsMenu } from '../modals/ThreeDotsMenu';
import { SwipeableChatItem } from './SwipeableChatItem';

interface SidebarProps {
  onOpenAccount: () => void;
  onOpenSettings: () => void;
  onOpenGenerator?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenAccount,
  onOpenSettings,
  onOpenGenerator
}) => {
  const { account } = useAuth();
  const {
    conversations,
    archivedConversations,
    activeChat,
    selectChat,
    isChatUnseen,
    searchQuery,
    setSearchQuery,
    archiveChat,
    openSavedMessages,
    isLoading
  } = useChat();
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

  // Filter unarchived conversations
  const filteredChats = conversations.filter(c => {
    const query = searchQuery.toLowerCase();
    const fullName = `${c.user.firstName} ${c.user.lastName || ''}`.toLowerCase();
    const username = (c.user.username || '').toLowerCase();
    const lastMsg = (c.lastMessage?.message || '').toLowerCase();
    return fullName.includes(query) || username.includes(query) || lastMsg.includes(query);
  });

  return (
    <aside
      className="w-full md:w-80 lg:w-[370px] flex flex-col h-full border-r border-[var(--color-border)] select-none transition-colors duration-200 bg-[var(--color-bg-sidebar)]"
    >
      {/* Top Header - Employee Portal Identifier */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[var(--color-border)] glass-header relative z-20">
        <div
          onClick={onOpenAccount}
          className="flex items-center gap-3 min-w-0 cursor-pointer hover:opacity-85 transition group"
          title="Manage Accounts & Profile"
        >
          <Avatar
            id={account?.userId || 'bot'}
            name={account?.botName || 'Bot'}
            avatarUrl={account?.avatar}
            size="sm"
            isOnline={true}
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate flex items-center gap-1.5 tracking-tight">
              <span>{account?.botName || 'Telegram Bot'}</span>
              {isGold && <Sparkles className="w-3.5 h-3.5 text-[#e5b842]" />}
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)] truncate flex items-center gap-1.5 font-mono">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </span>
              <span>•</span>
              <span className="text-[var(--color-text-muted)]">
                @{account?.botUsername || 'bot'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Header Icons */}
        <div className="flex items-center gap-1.5">
          {/* Quick Appearance Customizer for PC */}
          <QuickAppearancePopover onOpenFullSettings={onOpenSettings} className="hidden sm:block" />

          {/* 3-Dots Menu Trigger */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`w-9 h-9 rounded-full flex items-center justify-center btn-press transition ${
                isMenuOpen
                  ? 'bg-white/10 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
              }`}
              title="Menu"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <ThreeDotsMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              onOpenAccount={onOpenAccount}
              onOpenSettings={onOpenSettings}
              onOpenGenerator={onOpenGenerator}
            />
          </div>
        </div>
      </div>

      {/* Modern Search Bar */}
      <div className="px-3 pt-2.5 pb-2">
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border text-xs transition-all duration-200 ${
            isGold
              ? 'bg-[#12110c] border-[#38301a]/70 focus-within:border-[#e5b842] focus-within:ring-2 focus-within:ring-[#e5b842]/20'
              : 'bg-[var(--color-bg-input)] border-[var(--color-border)] focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[var(--color-accent-glow)]'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats & messages..."
            className="w-full bg-transparent outline-none text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[var(--color-text-muted)] hover:text-white p-0.5 rounded-full hover:bg-white/10"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List Scroll Area (pb-28 on mobile so bottom chats are never covered by floating nav bar) */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1 pb-28 md:pb-3">
        {/* Archived Chats Folder (if any chats are archived) */}
        {archivedConversations.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setIsArchivedOpen(!isArchivedOpen)}
              className={`w-full p-2.5 rounded-2xl flex items-center justify-between text-xs font-semibold transition-all duration-150 btn-press ${
                isArchivedOpen
                  ? isGold
                    ? 'bg-[#1f1a10] text-[#e5b842]'
                    : 'bg-white/10 text-white'
                  : 'bg-white/[0.03] text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isGold
                      ? 'bg-[#d4af37]/20 text-[#e5b842]'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  <Archive className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-xs text-white">Archived Chats</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    Swipe right to restore
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white">
                  {archivedConversations.length}
                </span>
                {isArchivedOpen ? (
                  <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
              </div>
            </button>

            {/* Expanded Archived Chats List */}
            {isArchivedOpen && (
              <div className="mt-1 pl-2 border-l-2 border-[var(--color-border)] space-y-1">
                {archivedConversations.map(chat => (
                  <SwipeableChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={activeChat?.id === chat.id}
                    isUnseen={isChatUnseen(chat.id)}
                    onSelect={() => selectChat(chat.id)}
                    onArchive={() => {}}
                    onUnarchive={(id) => archiveChat(id, false)}
                    isArchivedMode={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Regular Active Chats */}
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.02]">
                <div className="w-12 h-12 rounded-full skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-3.5 w-28 rounded-md skeleton-shimmer" />
                  <div className="h-2.5 w-44 rounded-md skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="p-10 text-center text-xs text-[var(--color-text-muted)]">
            No chats found
          </div>
        ) : (
          filteredChats.map((chat) => (
            <SwipeableChatItem
              key={chat.id}
              chat={chat}
              isActive={activeChat?.id === chat.id}
              isUnseen={isChatUnseen(chat.id)}
              onSelect={() => selectChat(chat.id)}
              onArchive={(id) => archiveChat(id, true)}
            />
          ))
        )}
      </div>

      {/* Swipe Gesture Hint at Bottom of Sidebar */}
      <div className="px-4 py-2 border-t border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-muted)] flex items-center justify-between font-mono">
        <span className="flex items-center gap-1.5">
          <Archive className="w-3 h-3 text-[var(--color-accent)]" />
          <span>Swipe right on chat to Archive</span>
        </span>
        <button
          onClick={openSavedMessages}
          className="hover:text-white transition flex items-center gap-1"
          title="Open Saved Messages"
        >
          <Bookmark className="w-3 h-3 text-[var(--color-accent)]" />
          <span>Saved</span>
        </button>
      </div>
    </aside>
  );
};
