import React, { useState, useMemo } from 'react';
import { Sparkles, X, Copy, Check, Bookmark, FileText, MessageSquare, Clock, User, Bot } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ChatMessage } from '../../types/chat';

interface ChatSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatSummaryModal: React.FC<ChatSummaryModalProps> = ({ isOpen, onClose }) => {
  const { activeChat, activeMessages, sendMessage } = useChat();
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [savedToNotes, setSavedToNotes] = useState(false);

  const isGold = theme === 'black-gold';

  // Compute conversation analytics & summary
  const summaryData = useMemo(() => {
    if (!activeMessages || activeMessages.length === 0) {
      return {
        total: 0,
        inbound: 0,
        outbound: 0,
        mediaCount: 0,
        keyPoints: ['No message history recorded yet.'],
        summaryText: 'This conversation has no recorded messages to summarize.'
      };
    }

    const inboundMsgs = activeMessages.filter((m: ChatMessage) => !m.isOutgoing && (m.message || '').trim());
    const outboundMsgs = activeMessages.filter((m: ChatMessage) => m.isOutgoing && (m.message || '').trim());
    const mediaMsgs = activeMessages.filter((m: ChatMessage) => m.media || m.sticker);

    const clientName = activeChat?.user?.firstName || 'Client';

    // Key topic highlights
    const highlights: string[] = [];
    if (inboundMsgs.length > 0) {
      highlights.push(`Initial client contact: "${inboundMsgs[0].message.slice(0, 80)}${inboundMsgs[0].message.length > 80 ? '...' : ''}"`);
    }
    if (inboundMsgs.length > 1) {
      highlights.push(`Latest client query: "${inboundMsgs[inboundMsgs.length - 1].message.slice(0, 80)}${inboundMsgs[inboundMsgs.length - 1].message.length > 80 ? '...' : ''}"`);
    }
    if (mediaMsgs.length > 0) {
      highlights.push(`Shared attachments: ${mediaMsgs.length} media item(s) exchanged during discussion.`);
    }
    if (outboundMsgs.length > 0) {
      highlights.push(`Operator response status: ${outboundMsgs.length} reply/replies provided by support.`);
    }

    const generatedSummary = `Conversation Summary with ${clientName} (ID: ${activeChat?.id || 'Unknown'}):
• Total Exchanges: ${activeMessages.length} (${inboundMsgs.length} from client, ${outboundMsgs.length} from operator)
• Key Inquiries: ${inboundMsgs.slice(-3).map((m: ChatMessage) => `"${m.message}"`).join('; ') || 'None'}
• Resolution Status: ${outboundMsgs.length >= inboundMsgs.length ? 'Followed up and answered' : 'Awaiting operator follow-up'}`;

    return {
      total: activeMessages.length,
      inbound: inboundMsgs.length,
      outbound: outboundMsgs.length,
      mediaCount: mediaMsgs.length,
      keyPoints: highlights,
      summaryText: generatedSummary
    };
  }, [activeMessages, activeChat]);

  if (!isOpen || !activeChat) return null;

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(summaryData.summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveToSavedMessages = async () => {
    try {
      const noteText = `📋 [SUMMARY NOTE] ${activeChat.user.firstName} (@${activeChat.user.username || activeChat.id}):\n${summaryData.summaryText}`;
      // Switch or send note
      await sendMessage(noteText);
      setSavedToNotes(true);
      setTimeout(() => setSavedToNotes(false), 2500);
    } catch (e) {
      console.error('Failed to save summary note:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl relative select-none transition-colors ${
          isGold
            ? 'bg-[#0f0e0a] border-[#38301a] text-[#f5f2eb] shadow-[0_0_50px_rgba(212,175,55,0.1)]'
            : 'bg-[#15171e] border-white/10 text-white shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isGold ? 'bg-[#d4af37]/20 text-[#f3c853]' : 'bg-[#2aabee]/20 text-[#2aabee]'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">AI Chat Summary</h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {activeChat.user.firstName} {activeChat.user.lastName || ''} (@{activeChat.user.username || activeChat.id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5 my-4">
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block mb-0.5">Total Msgs</span>
            <span className="text-lg font-extrabold text-[var(--color-text-main)]">{summaryData.total}</span>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block mb-0.5">From Client</span>
            <span className="text-lg font-extrabold text-blue-400">{summaryData.inbound}</span>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block mb-0.5">Operator</span>
            <span className="text-lg font-extrabold text-emerald-400">{summaryData.outbound}</span>
          </div>
        </div>

        {/* Key Highlights */}
        <div className="space-y-3 mb-5">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
            Discussion Highlights
          </span>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-xs leading-relaxed">
            {summaryData.keyPoints.map((pt, i) => (
              <div key={i} className="flex items-start gap-2 text-[var(--color-text-main)]">
                <span className="text-[var(--color-accent)] mt-0.5">•</span>
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold flex items-center justify-center gap-2 btn-press transition text-[var(--color-text-main)]"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>

          <button
            onClick={handleSaveToSavedMessages}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 btn-press transition ${
              isGold
                ? 'bg-[#d4af37] text-black hover:bg-[#f3c853]'
                : 'bg-[#2aabee] text-white hover:bg-[#229ed9]'
            }`}
          >
            {savedToNotes ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span>Post as Note</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
