import React, { useState } from 'react';
import {
  MoreVertical,
  Search,
  Bot,
  Sparkles,
  X,
  Plus,
  Archive,
  ChevronDown,
  ChevronRight,
  Shield,
  Bookmark,
  Users
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Avatar } from '../common/Avatar';
import { ThreeDotsMenu } from '../modals/ThreeDotsMenu';
import { SwipeableChatItem } from './SwipeableChatItem';
import { CreateGroupModal } from '../modals/CreateGroupModal';

interface SidebarProps {
  onOpenAccount: () => void;
  onOpenSpecial: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenAccount,
  onOpenSpecial,
  onOpenSettings
}) => {
  const { account, isMockMode } = useAuth();
  const {
    conversations,
    archivedConversations,
    activeChat,
    selectChat,
    searchQuery,
    setSearchQuery,
    archiveChat,
    categories,
    selectedCategory,
    setSelectedCategory,
    openSavedMessages
  } = useChat();
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

  // Filter unarchived conversations
  const filteredChats = conversations.filter(c => {
    // Category filter
    if (selectedCategory && selectedCategory !== 'ALL' && c.category !== selectedCategory) {
      return false;
    }

    const query = searchQuery.toLowerCase();
    const fullName = `${c.user.firstName} ${c.user.lastName || ''}`.toLowerCase();
    const username = (c.user.username || '').toLowerCase();
    const lastMsg = (c.lastMessage?.message || '').toLowerCase();
    const cat = (c.category || '').toLowerCase();
    return fullName.includes(query) || username.includes(query) || lastMsg.includes(query) || cat.includes(query);
  });

  return (
    <aside
      className={`w-full md:w-80 lg:w-[370px] flex flex-col h-full border-r border-[var(--color-border)] select-none transition-colors duration-200 ${
        isGold ? 'bg-[#090807]' : 'bg-[#0e0e11]'
      }`}
    >
      {/* Top Header - Employee Portal Identifier */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[var(--color-border)] glass-header relative z-20">
        <div className="flex items-center gap-3 min-w-0">
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
                <Shield className="w-3 h-3" />
                <span>EMP #{account?.userId || '1234'}</span>
              </span>
              <span>•</span>
              <span className={isMockMode ? 'text-amber-400' : 'text-emerald-400'}>
                {isMockMode ? 'Mock' : 'Django Live'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Header Icons */}
        <div className="flex items-center gap-1">
          {/* Quick Create Group / Category Button */}
          <button
            onClick={() => setIsCreateGroupOpen(true)}
            className={`w-9 h-9 rounded-full flex items-center justify-center btn-press transition ${
              isGold
                ? 'text-[#e5b842] hover:bg-[#e5b842]/10'
                : 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'
            }`}
            title="Create New Group or Category"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>

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
              onOpenSpecial={onOpenSpecial}
              onOpenSettings={onOpenSettings}
            />
          </div>
        </div>
      </div>

      {/* Modern Search Bar */}
      <div className="px-3 pt-2.5 pb-1">
        <div
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border text-xs transition-all duration-200 ${
            isGold
              ? 'bg-[#12110c] border-[#38301a]/70 focus-within:border-[#e5b842] focus-within:ring-2 focus-within:ring-[#e5b842]/20'
              : 'bg-[#15161b] border-white/5 focus-within:border-[#2aabee]/70 focus-within:ring-2 focus-within:ring-[#2aabee]/20'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats, groups & staff..."
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

      {/* Group Categories Filter Chips */}
      {categories.length > 0 && (
        <div className="px-3 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition ${
              !selectedCategory
                ? isGold
                  ? 'bg-[#e5b842] text-black font-bold'
                  : 'bg-[var(--color-accent)] text-white font-bold'
                : 'bg-white/5 text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition ${
                selectedCategory === cat
                  ? isGold
                    ? 'bg-[#e5b842] text-black font-bold'
                    : 'bg-indigo-600 text-white font-bold'
                  : 'bg-white/5 text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Chat List Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
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
        {filteredChats.length === 0 ? (
          <div className="p-10 text-center text-xs text-[var(--color-text-muted)]">
            No chats found
          </div>
        ) : (
          filteredChats.map((chat) => (
            <SwipeableChatItem
              key={chat.id}
              chat={chat}
              isActive={activeChat?.id === chat.id}
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

      {/* Group & Group Category Creator Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
      />
    </aside>
  );
};
