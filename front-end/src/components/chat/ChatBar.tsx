import React, { useRef, useState, useEffect } from 'react';
import { Menu, Paperclip, Send, Smile, Mic, Trash2, Check } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotification } from '../../contexts/NotificationContext';
import { audioRecorder } from '../../services/audioRecorder';
import { MediaAttachmentModal } from './MediaAttachmentModal';
import { StickerPicker } from './StickerPicker';

export const ChatBar: React.FC = () => {
  const { sendMessage, sendMedia, activeChat } = useChat();
  const { theme, settings } = useTheme();
  const { notify } = useNotification();

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
      // Only expand if multiple lines, capped cleanly at 110px
      if (e.target.value.includes('\n') || textareaRef.current.scrollHeight > 40) {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 110)}px`;
      }
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
    } catch (err: unknown) {
      console.warn('Microphone start error:', err);
      const errMsg = err instanceof Error ? err.message : 'Microphone not accessible';
      const isPermissionDenied = errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('allowed');

      notify({
        title: isPermissionDenied ? 'Microphone Permission Needed' : 'Microphone Unavailable',
        message: isPermissionDenied
          ? 'Please enable microphone access in your browser or device settings.'
          : 'Microphone hardware was not detected or is busy in another app.',
        type: 'alert',
        duration: 4000
      });
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
      if (result.duration < 0.6) {
        notify({
          title: 'Voice Recording',
          message: 'Audio too short. Hold or click to record a longer message.',
          type: 'alert',
          duration: 2500
        });
        return;
      }
      await sendMedia('voice', result.blob, result.duration);
    } catch (err) {
      console.error('Error stopping recording:', err);
      notify({
        title: 'Recording Error',
        message: 'Failed to capture voice audio.',
        type: 'alert'
      });
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

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="relative px-2.5 sm:px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[var(--color-bg-chat)] border-t border-[var(--color-border)] select-none transition-colors duration-200">
      {/* Sticker and Emoji Picker popover */}
      <StickerPicker
        isOpen={isStickerPickerOpen}
        onClose={() => setIsStickerPickerOpen(false)}
        onSelectEmoji={handleSelectEmoji}
      />

      {/* Media Attachment Modal */}
      <MediaAttachmentModal
        isOpen={isAttachmentOpen}
        onClose={() => setIsAttachmentOpen(false)}
        onSelectMedia={handleSelectMedia}
      />

      {/* Main Single Row Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 max-w-5xl mx-auto w-full">
        {/* Bot Menu Button - Hidden on mobile so input capsule has maximum width and consistent line */}
        <button
          type="button"
          className="hidden sm:flex w-11 h-11 rounded-full items-center justify-center transition-all duration-150 flex-shrink-0 btn-press text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
          title="Bot Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 flex-shrink-0 btn-press ${
            isAttachmentOpen
              ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/15 ring-1 ring-[var(--color-accent)]/30'
              : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
          }`}
          title="Attach Photo or Video"
        >
          <Paperclip className="w-5 h-5 rotate-45" />
        </button>

        {/* Recording Mode Pill vs Text Capsule */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between h-11 px-4 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 animate-slide-up shadow-inner">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold">Recording:</span>
              <span className="font-mono font-bold text-sm text-white">
                {formatTimer(recordingSeconds)}
              </span>

              {/* Live Animated Equalizer Soundwaves */}
              <div className="hidden sm:flex items-center gap-1 h-5 px-2">
                <span className="w-1 bg-red-400 rounded-full animate-soundwave-1" />
                <span className="w-1 bg-red-400 rounded-full animate-soundwave-2" />
                <span className="w-1 bg-red-400 rounded-full animate-soundwave-3" />
                <span className="w-1 bg-red-400 rounded-full animate-soundwave-4" />
                <span className="w-1 bg-red-400 rounded-full animate-soundwave-5" />
              </div>
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
            className={`flex-1 flex items-center rounded-full sm:rounded-[24px] px-3.5 py-1 min-h-[44px] max-h-36 border transition-all duration-200 shadow-sm ${
              isGold
                ? 'bg-[#0f0e0a] border-[#38301a]/80 focus-within:border-[#e5b842] focus-within:ring-2 focus-within:ring-[#e5b842]/20'
                : 'bg-[var(--color-bg-input)] border-[var(--color-border)] focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[var(--color-accent-glow)]'
            }`}
          >
            {/* Native Appearance Stripped Textarea (No native browser inset box) */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${activeChat.user.firstName}...`}
              style={{
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
                background: 'transparent'
              }}
              className="w-full bg-transparent border-0 outline-none shadow-none ring-0 focus:ring-0 focus:outline-none appearance-none text-base sm:text-sm resize-none max-h-32 text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] py-1.5 leading-snug tracking-tight"
            />

            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setIsStickerPickerOpen(!isStickerPickerOpen)}
              className={`p-1.5 rounded-full transition-all duration-150 flex-shrink-0 btn-press ml-1 ${
                isStickerPickerOpen
                  ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/15'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
              }`}
              title="Emojis"
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
            className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center flex-shrink-0 btn-press bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-400"
            title="Send Voice Note"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </button>
        ) : text.trim() ? (
          <button
            type="button"
            onClick={handleSendText}
            className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center flex-shrink-0 btn-press btn-glow animate-send-pop bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)] shadow-[var(--color-accent-glow)] font-bold"
            title="Send Message"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startVoiceRecording}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors btn-press text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
            title="Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
