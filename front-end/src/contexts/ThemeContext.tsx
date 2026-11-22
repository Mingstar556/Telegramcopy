import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  ChatSettings,
  FontFamily,
  ThemeContextValue,
  ThemeMode,
  AccentColor
} from '../types/theme';

const DEFAULT_SETTINGS: ChatSettings = {
  fontSize: 15,
  fontFamily: 'sans',
  accentColor: 'default',
  bubbleStyle: 'modern',
  enterToSend: true,
  soundEnabled: true,
  backgroundPattern: 'doodles',
  compactMode: false,
  animationsEnabled: true,
  animationStyle: 'snappy'
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Web Audio API sound generator - 0 network dependencies, 0 latency
const createAudioContext = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return AudioCtx ? new AudioCtx() : null;
  } catch {
    return null;
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('tg_theme') as ThemeMode;
    const validThemes: ThemeMode[] = [
      'simple-black',
      'black-gold',
      'cyber-emerald',
      'midnight-purple',
      'sunset-amber',
      'rose-quartz',
      'oled-pure',
      'cloud-light'
    ];
    return validThemes.includes(saved) ? saved : 'simple-black';
  });

  const [settings, setSettingsState] = useState<ChatSettings>(() => {
    try {
      const saved = localStorage.getItem('tg_chat_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = createAudioContext();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  };

  const playSendSound = () => {
    if (!settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Audio playback silently caught
    }
  };

  const playReceiveSound = () => {
    if (!settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio playback silently caught
    }
  };

  const playNotificationSound = () => {
    if (!settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Two-tone bright pleasant chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.09); // A5

      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(1174.66, now + 0.09);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch {
      // Audio playback silently caught
    }
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('tg_theme', newTheme);
  };

  const updateSettings = (newSettings: Partial<ChatSettings>) => {
    setSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('tg_chat_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const resetSettings = () => {
    setSettingsState(DEFAULT_SETTINGS);
    localStorage.setItem('tg_chat_settings', JSON.stringify(DEFAULT_SETTINGS));
  };

  // Sync theme with root HTML class
  useEffect(() => {
    const root = document.documentElement;
    const themeClasses = [
      'theme-simple-black',
      'theme-black-gold',
      'theme-cyber-emerald',
      'theme-midnight-purple',
      'theme-sunset-amber',
      'theme-rose-quartz',
      'theme-oled-pure',
      'theme-cloud-light'
    ];
    root.classList.remove(...themeClasses);
    root.classList.add(`theme-${theme}`);

    if (theme === 'cloud-light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme]);

  // Sync font size and font family to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tg-chat-font-size', `${settings.fontSize}px`);

    let fontVal = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';
    if (settings.fontFamily === 'inter') {
      fontVal = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else if (settings.fontFamily === 'jakarta') {
      fontVal = '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else if (settings.fontFamily === 'outfit') {
      fontVal = '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else if (settings.fontFamily === 'rounded') {
      fontVal = '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else if (settings.fontFamily === 'roboto') {
      fontVal = '"Roboto", -apple-system, BlinkMacSystemFont, sans-serif';
    } else if (settings.fontFamily === 'mono') {
      fontVal = '"JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas, monospace';
    }
    root.style.setProperty('--tg-chat-font-family', fontVal);
  }, [settings.fontSize, settings.fontFamily]);

  // Sync custom accent color if user overrides default
  useEffect(() => {
    const root = document.documentElement;
    const accent = settings.accentColor;

    if (accent === 'default') {
      root.style.removeProperty('--custom-accent');
      root.style.removeProperty('--custom-accent-hover');
      root.style.removeProperty('--custom-accent-glow');
      root.style.removeProperty('--custom-secondary');
      root.style.removeProperty('--custom-secondary-hover');
      root.style.removeProperty('--custom-secondary-glow');
    } else {
      const ACCENT_MAP: Record<
        Exclude<AccentColor, 'default'>,
        { base: string; hover: string; glow: string; secondary: string; secondaryHover: string; secondaryGlow: string }
      > = {
        cyan: {
          base: '#2aabee',
          hover: '#38bdf8',
          glow: 'rgba(42, 171, 238, 0.35)',
          secondary: '#a855f7',
          secondaryHover: '#c084fc',
          secondaryGlow: 'rgba(168, 85, 247, 0.45)'
        },
        gold: {
          base: '#e5b842',
          hover: '#f3c853',
          glow: 'rgba(229, 184, 66, 0.35)',
          secondary: '#f97316',
          secondaryHover: '#fb923c',
          secondaryGlow: 'rgba(249, 115, 22, 0.45)'
        },
        emerald: {
          base: '#10b981',
          hover: '#34d399',
          glow: 'rgba(16, 185, 129, 0.35)',
          secondary: '#06b6d4',
          secondaryHover: '#22d3ee',
          secondaryGlow: 'rgba(6, 182, 212, 0.45)'
        },
        purple: {
          base: '#a855f7',
          hover: '#c084fc',
          glow: 'rgba(168, 85, 247, 0.35)',
          secondary: '#ec4899',
          secondaryHover: '#f472b6',
          secondaryGlow: 'rgba(236, 72, 153, 0.45)'
        },
        amber: {
          base: '#f59e0b',
          hover: '#fbbf24',
          glow: 'rgba(245, 158, 11, 0.35)',
          secondary: '#ef4444',
          secondaryHover: '#f87171',
          secondaryGlow: 'rgba(239, 68, 68, 0.45)'
        },
        rose: {
          base: '#f43f5e',
          hover: '#fb7185',
          glow: 'rgba(244, 63, 94, 0.35)',
          secondary: '#c084fc',
          secondaryHover: '#d8b4fe',
          secondaryGlow: 'rgba(192, 132, 252, 0.45)'
        },
        crimson: {
          base: '#ef4444',
          hover: '#f87171',
          glow: 'rgba(239, 68, 68, 0.35)',
          secondary: '#f59e0b',
          secondaryHover: '#fbbf24',
          secondaryGlow: 'rgba(245, 158, 11, 0.45)'
        }
      };

      const selected = ACCENT_MAP[accent];
      if (selected) {
        root.style.setProperty('--custom-accent', selected.base);
        root.style.setProperty('--custom-accent-hover', selected.hover);
        root.style.setProperty('--custom-accent-glow', selected.glow);
        root.style.setProperty('--custom-secondary', selected.secondary);
        root.style.setProperty('--custom-secondary-hover', selected.secondaryHover);
        root.style.setProperty('--custom-secondary-glow', selected.secondaryGlow);
      }
    }
  }, [settings.accentColor]);

  // Sync bubble style attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-bubble-style', settings.bubbleStyle || 'modern');
  }, [settings.bubbleStyle]);

  // Sync animation style attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-animation-style', settings.animationStyle || 'snappy');
  }, [settings.animationStyle]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        settings,
        updateSettings,
        resetSettings,
        playNotificationSound,
        playSendSound,
        playReceiveSound
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
