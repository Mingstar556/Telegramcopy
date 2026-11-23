import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  ExternalLink,
  Zap,
  Send,
  Eye,
  LayoutGrid,
  Sparkles,
  Link2,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Columns,
  Rows
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotification } from '../../contexts/NotificationContext';
import { InlineKeyboardButton, TelegramUser } from '../../types/chat';

export interface InlineButtonItem {
  id: string;
  text: string;
  type: 'url' | 'callback_data';
  value: string;
  row: number; // 0-indexed row
}

interface CreateInlineButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (messageText: string, inlineKeyboard: InlineKeyboardButton[][]) => Promise<void>;
  targetUser?: TelegramUser;
  availableUsers?: TelegramUser[];
  onSelectUser?: (user: TelegramUser) => void;
}

const TEMPLATE_PRESETS = [
  {
    name: 'Website & Channel',
    desc: 'Links to official web portal and channel',
    text: 'Welcome! Explore our official resources and stay up to date:',
    buttons: [
      { id: '1', text: '🌐 Official Website', type: 'url' as const, value: 'https://telegram.org', row: 0 },
      { id: '2', text: '📢 News Channel', type: 'url' as const, value: 'https://t.me/telegram', row: 1 }
    ]
  },
  {
    name: 'Customer Support',
    desc: 'Quick callback to request agent or browse FAQ',
    text: 'How can our team assist you today? Please tap an option below:',
    buttons: [
      { id: '1', text: '💬 Talk to Agent', type: 'callback_data' as const, value: 'action_human_agent', row: 0 },
      { id: '2', text: '❓ View FAQ', type: 'url' as const, value: 'https://telegram.org/faq', row: 0 }
    ]
  },
  {
    name: 'Action Confirmation',
    desc: 'Interactive Yes / No callback options',
    text: 'Please confirm your request to proceed with verification:',
    buttons: [
      { id: '1', text: '✅ Confirm & Proceed', type: 'callback_data' as const, value: 'confirm_yes', row: 0 },
      { id: '2', text: '❌ Cancel Request', type: 'callback_data' as const, value: 'cancel_no', row: 0 }
    ]
  },
  {
    name: 'Promotion / Offer',
    desc: 'High-conversion CTA for promotional announcements',
    text: '🎁 Exclusive Member Bonus! Claim your special rewards voucher before expiration:',
    buttons: [
      { id: '1', text: '🎉 Claim Bonus Now', type: 'url' as const, value: 'https://telegram.org', row: 0 },
      { id: '2', text: '📜 Terms & Conditions', type: 'callback_data' as const, value: 'bonus_terms', row: 1 }
    ]
  }
];

export const CreateInlineButtonModal: React.FC<CreateInlineButtonModalProps> = ({
  isOpen,
  onClose,
  onSend,
  targetUser,
  availableUsers,
  onSelectUser
}) => {
  const { theme, settings } = useTheme();
  const { notify } = useNotification();
  const isGold = theme === 'black-gold';

  const [messageText, setMessageText] = useState('Welcome! Click a button below to get started:');
  const [buttons, setButtons] = useState<InlineButtonItem[]>([
    { id: 'btn_1', text: '🌐 Visit Website', type: 'url', value: 'https://telegram.org', row: 0 },
    { id: 'btn_2', text: '💬 Contact Support', type: 'callback_data', value: 'action_support', row: 1 }
  ]);
  const [layoutMode, setLayoutMode] = useState<'custom' | 'grid2'>('custom');
  const [isSending, setIsSending] = useState(false);
  const [previewClickedData, setPreviewClickedData] = useState<string | null>(null);

  if (!isOpen) return null;

  // Add a new button
  const handleAddButton = () => {
    const nextId = 'btn_' + Date.now();
    // Default to the last row or a new row
    const maxRow = buttons.reduce((max, b) => Math.max(max, b.row), 0);
    const newBtn: InlineButtonItem = {
      id: nextId,
      text: 'New Button',
      type: 'url',
      value: 'https://',
      row: layoutMode === 'grid2' ? Math.floor(buttons.length / 2) : maxRow + 1
    };
    setButtons([...buttons, newBtn]);
  };

  // Remove a button
  const handleRemoveButton = (id: string) => {
    if (buttons.length <= 1) {
      notify({
        title: 'At Least One Button Required',
        message: 'An inline keyboard message needs at least one button.',
        type: 'alert'
      });
      return;
    }
    setButtons(buttons.filter(b => b.id !== id));
  };

  // Update a single button field
  const handleUpdateButton = (id: string, updates: Partial<InlineButtonItem>) => {
    setButtons(prev =>
      prev.map(b => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  // Apply a template preset
  const handleApplyPreset = (preset: typeof TEMPLATE_PRESETS[0]) => {
    setMessageText(preset.text);
    setButtons(
      preset.buttons.map((b, idx) => ({
        ...b,
        id: `preset_${idx}_${Date.now()}`
      }))
    );
    notify({
      title: 'Preset Applied',
      message: `Loaded template: "${preset.name}"`,
      type: 'info',
      duration: 2000
    });
  };

  // Arrange into 2-columns grid
  const handleSet2Columns = () => {
    setLayoutMode('grid2');
    setButtons(prev =>
      prev.map((btn, index) => ({
        ...btn,
        row: Math.floor(index / 2)
      }))
    );
  };

  // Arrange into 1-column stacked
  const handleSet1Column = () => {
    setLayoutMode('custom');
    setButtons(prev =>
      prev.map((btn, index) => ({
        ...btn,
        row: index
      }))
    );
  };

  // Compile buttons into Telegram inline_keyboard format (array of rows)
  const buildInlineKeyboard = (): InlineKeyboardButton[][] => {
    // Group by row index
    const rowsMap = new Map<number, InlineKeyboardButton[]>();

    buttons.forEach(btn => {
      const trimmedText = btn.text.trim();
      const trimmedValue = btn.value.trim();
      if (!trimmedText) return;

      const btnObj: InlineKeyboardButton = {
        text: trimmedText
      };

      if (btn.type === 'url') {
        let url = trimmedValue;
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('tg://')) {
          url = 'https://' + url;
        }
        btnObj.url = url;
      } else {
        btnObj.callback_data = trimmedValue || 'callback_action';
      }

      const rowArr = rowsMap.get(btn.row) || [];
      rowArr.push(btnObj);
      rowsMap.set(btn.row, rowArr);
    });

    // Sort rows by row index
    const sortedRowIndices = Array.from(rowsMap.keys()).sort((a, b) => a - b);
    return sortedRowIndices.map(idx => rowsMap.get(idx)!);
  };

  const handleSend = async () => {
    const trimmedText = messageText.trim();
    if (!trimmedText) {
      notify({
        title: 'Message Text Required',
        message: 'Please write a message or caption to accompany your inline button.',
        type: 'alert'
      });
      return;
    }

    const keyboard = buildInlineKeyboard();
    if (keyboard.length === 0 || keyboard.flat().length === 0) {
      notify({
        title: 'Valid Buttons Required',
        message: 'Please provide at least one valid button with label and URL/action.',
        type: 'alert'
      });
      return;
    }

    setIsSending(true);
    try {
      await onSend(trimmedText, keyboard);
      notify({
        title: 'Inline Buttons Sent',
        message: `Dispatched ${keyboard.flat().length} interactive button(s) successfully.`,
        type: 'info'
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      notify({
        title: 'Send Error',
        message: msg,
        type: 'alert'
      });
    } finally {
      setIsSending(false);
    }
  };

  const compiledKeyboard = buildInlineKeyboard();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden animate-pop-in ${
          isGold
            ? 'bg-[#0f0e0a] border-[#38301a] text-[#f5f2eb] shadow-[0_20px_60px_rgba(0,0,0,0.9)]'
            : 'bg-[#12131a] border-white/10 text-white shadow-2xl'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>Create Inline Button</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                  Bot Tool
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] truncate">
                {targetUser ? (
                  <span>
                    Sending to <strong className="text-white">{targetUser.firstName}</strong> ({targetUser.id})
                  </span>
                ) : (
                  <span>Attach interactive URL and callback buttons underneath a message</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
          {/* Preset Templates Pill Bar */}
          <div>
            <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>Quick Presets</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TEMPLATE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-[var(--color-accent)]/40 transition text-left group btn-press flex flex-col justify-between"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-[var(--color-accent)] transition truncate">
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] truncate mt-1">
                    {preset.buttons.length} buttons
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message Text Input */}
          <div>
            <label className="block text-xs font-semibold text-white mb-1.5">
              Message Content / Caption <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="Enter message text that will display above the inline buttons..."
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition resize-none"
            />
            <div className="text-[10px] text-[var(--color-text-muted)] mt-1 flex justify-between">
              <span>Supports emoji, markdown, and multi-line descriptions</span>
              <span>{messageText.length} characters</span>
            </div>
          </div>

          {/* Button Rows Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-[var(--color-accent)]" />
                <span>Inline Buttons ({buttons.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Column layout switchers */}
                <button
                  type="button"
                  onClick={handleSet1Column}
                  title="Stack all buttons in single rows"
                  className={`px-2 py-1 rounded-xl text-[11px] font-medium border flex items-center gap-1 transition ${
                    layoutMode === 'custom'
                      ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)]'
                      : 'bg-white/5 border-white/10 text-[var(--color-text-muted)] hover:text-white'
                  }`}
                >
                  <Rows className="w-3 h-3" />
                  <span className="hidden sm:inline">1 Col</span>
                </button>
                <button
                  type="button"
                  onClick={handleSet2Columns}
                  title="Arrange buttons in 2 columns side-by-side"
                  className={`px-2 py-1 rounded-xl text-[11px] font-medium border flex items-center gap-1 transition ${
                    layoutMode === 'grid2'
                      ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)]'
                      : 'bg-white/5 border-white/10 text-[var(--color-text-muted)] hover:text-white'
                  }`}
                >
                  <Columns className="w-3 h-3" />
                  <span className="hidden sm:inline">2 Cols</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddButton}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[var(--color-accent)] text-black hover:brightness-110 active:scale-95 transition flex items-center gap-1 btn-press"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Button</span>
                </button>
              </div>
            </div>

            {/* Buttons List */}
            <div className="space-y-2.5">
              {buttons.map((btn, index) => (
                <div
                  key={btn.id}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-white/10 text-white/80">
                        #{index + 1}
                      </span>
                      {/* Row Selector */}
                      <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                        <span>Row:</span>
                        <select
                          value={btn.row}
                          onChange={e => handleUpdateButton(btn.id, { row: parseInt(e.target.value) || 0 })}
                          className="bg-black/60 border border-white/10 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[var(--color-accent)]"
                        >
                          <option value={0}>Row 1</option>
                          <option value={1}>Row 2</option>
                          <option value={2}>Row 3</option>
                          <option value={3}>Row 4</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Type Toggle */}
                    <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-xl border border-white/10 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleUpdateButton(btn.id, { type: 'url', value: btn.value.startsWith('http') ? btn.value : 'https://' })}
                        className={`px-2 py-0.5 rounded-lg transition flex items-center gap-1 ${
                          btn.type === 'url'
                            ? 'bg-[var(--color-accent)] text-black font-semibold shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:text-white'
                        }`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>URL Link</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateButton(btn.id, { type: 'callback_data', value: btn.value.startsWith('http') ? 'action_btn' : btn.value })}
                        className={`px-2 py-0.5 rounded-lg transition flex items-center gap-1 ${
                          btn.type === 'callback_data'
                            ? 'bg-[var(--color-accent)] text-black font-semibold shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:text-white'
                        }`}
                      >
                        <Zap className="w-3 h-3" />
                        <span>Callback Data</span>
                      </button>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveButton(btn.id)}
                      className="p-1.5 rounded-xl text-red-400/80 hover:text-red-300 hover:bg-red-500/10 transition btn-press"
                      title="Delete Button"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Inputs row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Button Label Input */}
                    <div>
                      <input
                        type="text"
                        value={btn.text}
                        onChange={e => handleUpdateButton(btn.id, { text: e.target.value })}
                        placeholder="Button Label (e.g. 🌐 Official Site)"
                        className="w-full px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-accent)]"
                      />
                    </div>

                    {/* URL or Callback Input */}
                    <div>
                      <input
                        type="text"
                        value={btn.value}
                        onChange={e => handleUpdateButton(btn.id, { value: e.target.value })}
                        placeholder={
                          btn.type === 'url'
                            ? 'Target URL (e.g. https://example.com)'
                            : 'Callback Query Payload (e.g. verify_user)'
                        }
                        className="w-full px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-accent)] font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-Time Live Telegram Preview Card */}
          <div>
            <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>Telegram Message Live Preview</span>
            </div>

            <div className="p-4 rounded-3xl bg-black/60 border border-white/10 shadow-inner">
              <div className="max-w-md mx-auto">
                {/* Outgoing Bubble */}
                <div
                  className={`chat-bubble chat-bubble-out px-4 py-3 rounded-2xl shadow-lg border ${
                    isGold
                      ? 'bg-[#27200a] border-[#e5b842]/35 text-[#fbf7ee]'
                      : 'bg-[var(--color-bg-bubble-out)] border-[var(--color-border)] text-white'
                  }`}
                >
                  <div className="text-xs leading-relaxed whitespace-pre-wrap select-text break-words">
                    {messageText || '(Empty message text)'}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75 font-mono">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-[var(--color-accent)]">✓✓</span>
                  </div>
                </div>

                {/* Inline Buttons Preview Under Bubble */}
                {compiledKeyboard.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5 w-full">
                    {compiledKeyboard.map((row, rIdx) => (
                      <div key={rIdx} className="flex items-center gap-1.5 w-full">
                        {row.map((b, bIdx) => (
                          <button
                            key={bIdx}
                            type="button"
                            onClick={() => {
                              if (b.url) {
                                window.open(b.url, '_blank', 'noopener,noreferrer');
                              } else {
                                setPreviewClickedData(b.callback_data || 'clicked');
                                setTimeout(() => setPreviewClickedData(null), 2500);
                              }
                            }}
                            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition active:scale-95 shadow-sm truncate ${
                              isGold
                                ? 'bg-[#2b2413]/80 hover:bg-[#3d3319] border-[#e5b842]/30 text-[#f5f2eb]'
                                : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
                            }`}
                          >
                            <span className="truncate">{b.text}</span>
                            {b.url ? (
                              <ExternalLink className="w-3 h-3 text-[var(--color-accent)] opacity-80 flex-shrink-0" />
                            ) : (
                              <Zap className="w-3 h-3 text-[var(--color-accent)] opacity-80 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Simulated Callback Query Toast */}
                {previewClickedData && (
                  <div className="mt-2 p-2 rounded-xl bg-blue-500/20 border border-blue-500/40 text-[11px] text-blue-300 text-center animate-fade-in font-mono">
                    ⚡ Callback triggered: <strong>{previewClickedData}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/5 bg-black/20 flex-shrink-0">
          <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted Telegram Bot API Dispatch</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition btn-press"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !messageText.trim() || buttons.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--color-accent)] text-black hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 shadow-md btn-press disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Send with Inline Buttons'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
