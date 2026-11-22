import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  AtSign,
  ShieldCheck,
  Image as ImageIcon,
  FileText,
  Mic,
  Trash2,
  BellOff,
  Bell,
  MessageCircle,
  Copy,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { TelegramUser, ChatMessage } from '../../types/chat';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';
import { Avatar } from '../common/Avatar';

interface UserProfileModalProps {
  user: TelegramUser | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose
}) => {
  const { theme } = useTheme();
  const { activeMessages, clearChat, selectChat } = useChat();
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'voice'>('media');
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !user) return null;

  const isGold = theme === 'black-gold';
  const fullName = `${user.firstName} ${user.lastName || ''}`.trim();

  // Filter media items from active conversation
  const sharedPhotos = activeMessages.filter(
    m => m.media?.type === 'photo' || (m.album && m.album.length > 0)
  );
  const sharedVideos = activeMessages.filter(m => m.media?.type === 'video');
  const sharedFiles = activeMessages.filter(m => m.media?.type === 'file');
  const sharedVoice = activeMessages.filter(m => m.media?.type === 'voice');

  const copyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm(`Are you sure you want to clear chat history with ${fullName}?`)) {
      clearChat(user.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl relative flex flex-col max-h-[90vh] animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
            : 'bg-[#121318] border-white/10 text-white'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--color-text-muted)] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition btn-press z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex flex-col items-center text-center pb-5 border-b border-white/5">
          <div className="mb-3 relative group">
            <Avatar
              id={user.id}
              name={fullName}
              avatarUrl={user.avatar}
              size="xl"
              isOnline={user.online}
            />
          </div>

          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span>{fullName}</span>
            {user.isPremium && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold flex items-center gap-1 border border-amber-400/30">
                ⭐ Premium
              </span>
            )}
            {user.languageCode && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-mono uppercase">
                {user.languageCode}
              </span>
            )}
            {user.isBot && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold">
                BOT
              </span>
            )}
          </h3>

          <div className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1 font-mono">
            {user.online ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                online
              </span>
            ) : (
              <span>{user.lastSeen || 'last seen recently'}</span>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                selectChat(user.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)] font-semibold text-xs flex items-center gap-1.5 shadow-md btn-press"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Message</span>
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs flex items-center gap-1.5 transition btn-press"
            >
              {isMuted ? <Bell className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4 text-zinc-400" />}
              <span>{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>
          </div>
        </div>

        {/* User Info Details */}
        <div className="py-3 space-y-2.5 text-xs">
          {/* Username & User ID */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/30 border border-white/5">
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
                Username / Identifier
              </div>
              <div className="font-mono text-sm font-semibold text-white mt-0.5 flex items-center gap-2">
                <span>@{user.username || 'user_' + user.id}</span>
                <span className="text-[10px] text-zinc-500">ID: {user.id}</span>
              </div>
            </div>
            <button
              onClick={copyId}
              className="p-2 rounded-xl hover:bg-white/10 text-[var(--color-accent)] transition btn-press"
              title="Copy ID"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Bio / Description */}
          <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
            <div className="text-[10px] text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
              Bio / Information
            </div>
            <div className="mt-1 text-[var(--color-text-main)] leading-relaxed">
              {user.bio || 'Telegram contact connected to userbot live session.'}
            </div>
          </div>
        </div>

        {/* Shared Media Tabs */}
        <div className="flex border-b border-white/10 mb-2">
          <button
            onClick={() => setActiveTab('media')}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'media'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Media ({sharedPhotos.length + sharedVideos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'files'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Files ({sharedFiles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'voice'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice ({sharedVoice.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto max-h-40 min-h-[100px] p-1">
          {activeTab === 'media' && (
            sharedPhotos.length === 0 && sharedVideos.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                No shared photos or videos
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {sharedPhotos.map((m, idx) => (
                  <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/5">
                    <img src={m.media?.url || m.album?.[0]?.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'files' && (
            sharedFiles.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                No shared files or documents
              </div>
            ) : (
              <div className="space-y-1.5">
                {sharedFiles.map((m, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                    <span className="truncate">{m.media?.fileName || 'Document'}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{m.media?.fileSize}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'voice' && (
            sharedVoice.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                No shared voice notes
              </div>
            ) : (
              <div className="space-y-1.5">
                {sharedVoice.map((m, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <Mic className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                      <span>Voice message</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">{m.media?.duration || 0}s</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between">
          <button
            onClick={handleClearHistory}
            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 py-1.5 px-3 rounded-xl hover:bg-red-500/10 transition btn-press"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear History</span>
          </button>

          <button
            onClick={onClose}
            className="text-xs py-1.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 transition font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
