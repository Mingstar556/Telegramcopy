import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

import { resolveMediaUrl } from '../../services/api';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  isOutgoing?: boolean;
}

// Visual waveform bars heights matching Telegram voice notes
const WAVE_BARS = [35, 60, 45, 90, 75, 40, 85, 95, 65, 45, 70, 80, 50, 60, 90, 40, 75, 55, 85, 45, 60, 40];

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration = 0,
  isOutgoing = false
}) => {
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration > 0 ? duration : 3);

  useEffect(() => {
    const resolved = resolveMediaUrl(audioUrl);
    const audio = new Audio(resolved);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      } else if (duration > 0) {
        setAudioDuration(duration);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      // For streams where duration is Infinity initially
      if (isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(Math.round(audio.duration));
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Audio playback prevented:', err);
      });
    }
  };

  const handleSeek = (index: number) => {
    if (!audioRef.current) return;
    const targetFraction = (index + 0.5) / WAVE_BARS.length;
    const targetTime = targetFraction * (audioDuration > 0 ? audioDuration : 3);
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
    if (!isPlaying) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const effectiveDuration = audioDuration > 0 ? audioDuration : (duration > 0 ? duration : 3);
  const progress = effectiveDuration > 0 ? (currentTime / effectiveDuration) : 0;

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 select-none min-w-[210px] max-w-[280px]">
      {/* Play / Pause Circular Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md transition-transform active:scale-95 btn-press ${
          isOutgoing
            ? isGold
              ? 'bg-[#e5b842] text-black hover:bg-[#f3c853]'
              : 'bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:opacity-90 shadow-sm'
            : isGold
            ? 'bg-[#e5b842]/20 text-[#e5b842] border border-[#e5b842]/40'
            : 'bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:opacity-90 shadow-sm'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Duration */}
      <div className="flex-1 flex flex-col justify-center gap-1.5">
        {/* Waveform Bars with click-to-seek */}
        <div 
          className="flex items-center gap-[2px] h-6 cursor-pointer py-1"
          title="Click to seek"
        >
          {WAVE_BARS.map((height, i) => {
            const barFraction = i / WAVE_BARS.length;
            const isFilled = barFraction <= progress;

            return (
              <span
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSeek(i);
                }}
                style={{ height: `${height}%` }}
                className={`w-[3px] rounded-full transition-all duration-150 hover:opacity-100 ${
                  isFilled
                    ? isGold
                      ? 'bg-[#f3c853]'
                      : 'bg-[var(--color-accent)]'
                    : 'bg-white/25 hover:bg-white/40'
                } ${isPlaying && isFilled ? 'animate-pulse' : ''}`}
              />
            );
          })}
        </div>

        {/* Time duration */}
        <div className="flex items-center justify-between text-[11px] text-white/70 font-mono tracking-tight leading-none">
          <span>{formatSecs(currentTime > 0 ? currentTime : effectiveDuration)}</span>
          <span className="text-[10px] opacity-75">Voice</span>
        </div>
      </div>
    </div>
  );
};
