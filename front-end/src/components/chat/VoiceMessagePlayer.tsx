import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  isOutgoing?: boolean;
}

// Generate consistent visual waveform bars
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
  const [audioDuration, setAudioDuration] = useState(duration);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

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

  const progress = audioDuration > 0 ? (currentTime / audioDuration) : 0;

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
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md btn-press ${
          isOutgoing
            ? isGold
              ? 'bg-[#e5b842] text-black hover:bg-[#f3c853]'
              : 'bg-[#54bbf8] text-[#142333] hover:bg-[#72cbfb]'
            : isGold
            ? 'bg-[#e5b842]/20 text-[#e5b842] border border-[#e5b842]/40'
            : 'bg-[#2aabee] text-white hover:bg-[#38bdf8]'
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
        {/* Waveform Bars */}
        <div className="flex items-center gap-[2px] h-6 cursor-pointer">
          {WAVE_BARS.map((height, i) => {
            const barFraction = i / WAVE_BARS.length;
            const isFilled = barFraction <= progress;

            return (
              <span
                key={i}
                style={{ height: `${height}%` }}
                className={`w-[3px] rounded-full transition-colors duration-150 ${
                  isFilled
                    ? isGold
                      ? 'bg-[#f3c853]'
                      : 'bg-[#54bbf8]'
                    : 'bg-white/25'
                }`}
              />
            );
          })}
        </div>

        {/* Time duration */}
        <div className="flex items-center justify-between text-[11px] text-white/70 font-mono tracking-tight leading-none">
          <span>{formatSecs(currentTime > 0 ? currentTime : audioDuration)}</span>
          <span className="text-[10px] opacity-75">Voice</span>
        </div>
      </div>
    </div>
  );
};
