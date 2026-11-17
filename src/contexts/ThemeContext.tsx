import React, { createContext, useContext, useEffect, useState } from 'react';
import { ChatSettings, FontFamily, ThemeContextValue, ThemeMode } from '../types/theme';

const DEFAULT_SETTINGS: ChatSettings = {
  fontSize: 15,
  fontFamily: 'sans',
  enterToSend: true,
  soundEnabled: true,
  backgroundPattern: 'doodles',
  compactMode: false
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('tg_theme') as ThemeMode;
    return saved === 'black-gold' ? 'black-gold' : 'simple-black';
  });

  const [settings, setSettingsState] = useState<ChatSettings>(() => {
    try {
      const saved = localStorage.getItem('tg_chat_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

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
    root.classList.remove('theme-simple-black', 'theme-black-gold');
    root.classList.add(`theme-${theme}`);
    if (theme === 'black-gold') {
      root.classList.add('dark');
    } else {
      root.classList.add('dark');
    }
  }, [theme]);

  // Sync font size and font family to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--tg-chat-font-size', `${settings.fontSize}px`);

    let fontVal = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    if (settings.fontFamily === 'inter') {
      fontVal = '"Inter", system-ui, sans-serif';
    } else if (settings.fontFamily === 'roboto') {
      fontVal = '"Roboto", sans-serif';
    } else if (settings.fontFamily === 'mono') {
      fontVal = '"JetBrains Mono", Menlo, Monaco, Consolas, monospace';
    }
    root.style.setProperty('--tg-chat-font-family', fontVal);
  }, [settings.fontSize, settings.fontFamily]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, settings, updateSettings, resetSettings }}>
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
