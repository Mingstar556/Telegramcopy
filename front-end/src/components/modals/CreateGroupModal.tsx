import React, { useState } from 'react';
import { Users, X, Check, FolderPlus, Sparkles, Shield, Tag } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MOCK_USERS } from '../../services/mockData';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_CATEGORIES = [
  'Customer Support',
  'Technical Ops',
  'VIP Clients',
  'Internal Staff',
  'Billing & Sales',
  'Bot Automations'
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose }) => {
  const { createGroup, conversations } = useChat();
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const [groupName, setGroupName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Customer Support');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupType, setGroupType] = useState<'group' | 'category'>('group');
  const [searchMember, setSearchMember] = useState('');

  if (!isOpen) return null;

  const handleToggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const finalCategory = isCustomCategory
      ? (customCategory.trim() || 'General')
      : selectedCategory;

    createGroup(groupName.trim(), finalCategory, selectedMembers);
    onClose();

    // Reset form
    setGroupName('');
    setCustomCategory('');
    setIsCustomCategory(false);
  };

  const candidateUsers = conversations.length > 0
    ? conversations.filter(c => !c.isGroup && !c.isSavedMessages && c.user).map(c => c.user)
    : MOCK_USERS;

  const filteredUsers = candidateUsers.filter(u => {
    if (u.id === 'saved_messages') return false;
    const name = `${u.firstName} ${u.lastName || ''} ${u.username || ''}`.toLowerCase();
    return name.includes(searchMember.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-[28px] p-6 sm:p-7 border shadow-2xl transition-all duration-300 animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f7f4ec] shadow-[0_0_50px_rgba(229,184,66,0.12)]'
            : 'bg-[#121318] border-white/10 text-white shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)] mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isGold
                  ? 'bg-gradient-to-tr from-[#997d26] to-[#f3c853] text-black shadow-md shadow-[#d4af37]/20'
                  : 'bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/25'
              }`}
            >
              {groupType === 'group' ? <Users className="w-5 h-5 stroke-[2.2]" /> : <FolderPlus className="w-5 h-5 stroke-[2.2]" />}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-1.5">
                <span>{groupType === 'group' ? 'New Group Chat' : 'New Group Category'}</span>
                {isGold && <Sparkles className="w-3.5 h-3.5 text-[#e5b842]" />}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Internal employee dispatch & team collaboration
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Toggle Pills */}
        <div className="flex p-1 rounded-2xl bg-black/40 border border-white/5 mb-5">
          <button
            type="button"
            onClick={() => setGroupType('group')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
              groupType === 'group'
                ? isGold
                  ? 'bg-[#e5b842] text-black font-bold shadow-sm'
                  : 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Group Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setGroupType('category')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
              groupType === 'category'
                ? isGold
                  ? 'bg-[#e5b842] text-black font-bold shadow-sm'
                  : 'bg-indigo-600 text-white shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Group Category Tag</span>
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Group / Category Title */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--color-text-muted)]">
              {groupType === 'group' ? 'Group Name' : 'Category Name'}
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={groupType === 'group' ? 'e.g. Support Squad Beta 🎧' : 'e.g. VIP Escalation Desk'}
              autoFocus
              className={`w-full px-4 py-3 rounded-2xl text-sm outline-none transition duration-200 border ${
                isGold
                  ? 'bg-[#15130b] border-[#38301a] text-white focus:border-[#e5b842] focus:ring-1 focus:ring-[#e5b842]'
                  : 'bg-[#181920] border-white/10 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
              }`}
            />
          </div>

          {/* Category Selector Chips */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--color-text-muted)] flex items-center justify-between">
              <span>Category Classification</span>
              <span className="text-[10px] text-[var(--color-text-muted)] lowercase font-mono">
                {isCustomCategory ? 'custom tag' : selectedCategory}
              </span>
            </label>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {DEFAULT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setIsCustomCategory(false);
                  }}
                  className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all duration-150 border ${
                    !isCustomCategory && selectedCategory === cat
                      ? isGold
                        ? 'bg-[#e5b842]/20 border-[#e5b842] text-[#f7f4ec] font-semibold'
                        : 'bg-indigo-500/25 border-indigo-400 text-white font-semibold'
                      : 'bg-white/5 border-white/5 text-[var(--color-text-muted)] hover:border-white/20'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setIsCustomCategory(true)}
                className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all duration-150 border ${
                  isCustomCategory
                    ? isGold
                      ? 'bg-[#e5b842]/20 border-[#e5b842] text-[#f7f4ec]'
                      : 'bg-indigo-500/25 border-indigo-400 text-white'
                    : 'bg-white/5 border-dashed border-white/20 text-[var(--color-text-muted)] hover:border-white/30'
                }`}
              >
                + Custom Tag
              </button>
            </div>

            {isCustomCategory && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter custom category name..."
                className="mt-2 w-full px-3.5 py-2 rounded-xl text-xs bg-white/5 border border-white/10 outline-none text-white focus:border-[var(--color-accent)]"
              />
            )}
          </div>

          {/* Member Picker (for group chats) */}
          {groupType === 'group' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Add Members ({selectedMembers.length} selected)
                </label>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>Staff Verified</span>
                </span>
              </div>

              <input
                type="text"
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                placeholder="Search staff & clients to add..."
                className="w-full px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 outline-none text-white mb-2"
              />

              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {filteredUsers.map(user => {
                  const isChecked = selectedMembers.includes(user.id);
                  const fullName = `${user.firstName} ${user.lastName || ''}`.trim();

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleToggleMember(user.id)}
                      className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition text-xs border ${
                        isChecked
                          ? isGold
                            ? 'bg-[#241f12] border-[#e5b842]/40 text-white'
                            : 'bg-indigo-950/40 border-indigo-500/40 text-white'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px]">
                          {fullName.charAt(0)}
                        </div>
                        <div className="truncate">
                          <span className="font-semibold text-white truncate mr-1.5">{fullName}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">@{user.username || 'user'}</span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                          isChecked
                            ? isGold
                              ? 'bg-[#e5b842] border-[#e5b842] text-black'
                              : 'bg-indigo-500 border-indigo-500 text-white'
                            : 'border-white/20'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition btn-press"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!groupName.trim()}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-md btn-press disabled:opacity-50 disabled:cursor-not-allowed ${
                isGold
                  ? 'bg-gradient-to-r from-[#d4af37] via-[#e5b842] to-[#d4af37] text-black font-extrabold shadow-[#d4af37]/20'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-indigo-500/25'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{groupType === 'group' ? 'Create Group Chat' : 'Save Category Tag'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
