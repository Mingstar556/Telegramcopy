import React, { useRef, useState, useEffect } from 'react';
import { Menu, Paperclip, Send, Smile, Mic, Trash2, Check } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { audioRecorder } from '../../services/audioRecorder';
import { MediaAttachmentModal } from './MediaAttachmentModal';
import { StickerPicker } from './StickerPicker';

export const ChatBar: React.FC = () => {
  const { sendMessage, sendMedia, activeChat } = useChat();
  const { theme, settings } = useTheme();

  const [text, setText] = useState('');
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isGold = theme === 'black-gold';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!activeChat) return null;

  const handleSendText = async () => {
    if (!text.trim()) return;
    const toSend = text;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(toSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && settings.enterToSend) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setText(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleSelectMedia = async (file: File, type: 'photo' | 'video') => {
    await sendMedia(type, file);
  };

  const startVoiceRecording = async () => {
    try {
      await audioRecorder.startRecording();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone fallback triggered:', err);
      const fallbackUrl = 'https://actions.google.com/sounds/v1/communication/incoming_call.ogg';
      await sendMedia('voice', fallbackUrl, 5);
    }
  };

  const finishVoiceRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    try {
      const result = await audioRecorder.stopRecording();
      await sendMedia('voice', result.url, result.duration);
    } catch (e) {
      console.error('Failed to capture audio:', e);
    }
  };

  const cancelVoiceRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    audioRecorder.cancelRecording();
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="relative px-3 py-2.5 sm:px-6 sm:py-3.5 border-t border-[var(--color-border)] glass-header select-none z-20 transition-colors duration-200">
      {/* Sticker Picker Popup */}
      <StickerPicker
        isOpen={isStickerPickerOpen}
        onClose={() => setIsStickerPickerOpen(false)}
        onSelectEmoji={handleSelectEmoji}
      />

      {/* Media Attachment Action Sheet */}
      <MediaAttachmentModal
        isOpen={isAttachmentOpen}
        onClose={() => setIsAttachmentOpen(false)}
        onSelectMedia={handleSelectMedia}
      />

      <div className="flex items-end gap-2 max-w-5xl mx-auto">
        {/* Menu Button */}
        <button
          type="button"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 flex-shrink-0 btn-press ${
            isGold
              ? 'text-[#e5b842] hover:bg-[#e5b842]/10'
              : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
          }`}
          title="Bot Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Paperclip Button */}
        <button
          type="button"
          onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 flex-shrink-0 btn-press ${
            isAttachmentOpen
              ? 'text-[var(--color-accent)] bg-white/10'
              : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
          }`}
          title="Attach Photo or Video"
        >
          <Paperclip className="w-5 h-5 rotate-45" />
        </button>

        {/* Recording Mode Indicator vs Input Field */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between h-11 px-4 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 animate-slide-up">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-soft-pulse" />
              <span className="text-xs font-semibold">Recording:</span>
              <span className="font-mono font-bold text-sm text-white">
                {formatTimer(recordingSeconds)}
              </span>
            </div>

            <button
              type="button"
              onClick={cancelVoiceRecording}
              className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400 hover:text-red-200 transition btn-press"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            className={`flex-1 flex items-end rounded-[24px] px-3.5 py-1 border transition-all duration-200 ${
              isGold
                ? 'bg-[#0f0e0a] border-[#38301a]/80 focus-within:border-[#e5b842] focus-within:ring-2 focus-within:ring-[#e5b842]/20'
                : 'bg-[#121317] border-white/5 focus-within:border-[#2aabee]/70 focus-within:ring-2 focus-within:ring-[#2aabee]/20'
            }`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${activeChat.user.firstName}...`}
              className="w-full bg-transparent text-sm resize-none outline-none max-h-32 text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] py-2 leading-relaxed tracking-tight"
            />

            {/* Sticker Button */}
            <button
              type="button"
              onClick={() => setIsStickerPickerOpen(!isStickerPickerOpen)}
              className={`p-1.5 rounded-full transition-all duration-150 flex-shrink-0 btn-press ${
                isStickerPickerOpen
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
              }`}
              title="Stickers"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Send / Voice Record Button */}
        {isRecording ? (
          <button
            type="button"
            onClick={finishVoiceRecording}
            className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center flex-shrink-0 btn-press ${
              isGold
                ? 'bg-[#e5b842] text-black font-bold shadow-[#e5b842]/20'
                : 'bg-emerald-500 text-white shadow-emerald-500/25'
            }`}
            title="Send Voice Note"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </button>
        ) : text.trim() ? (
          <button
            type="button"
            onClick={handleSendText}
            className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center flex-shrink-0 btn-press ${
              isGold
                ? 'bg-[#e5b842] text-black hover:bg-[#f3c853] shadow-[#e5b842]/20 font-bold'
                : 'bg-[#2aabee] text-white hover:bg-[#38bdf8] shadow-[#2aabee]/25'
            }`}
            title="Send Message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startVoiceRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors btn-press ${
              isGold
                ? 'text-[#e5b842] hover:bg-[#e5b842]/10'
                : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
            }`}
            title="Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
