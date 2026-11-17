export type ThemeMode = 'simple-black' | 'black-gold';

export type FontFamily = 'sans' | 'inter' | 'roboto' | 'mono';

export interface ChatSettings {
  fontSize: number; // e.g. 14, 16, 18
  fontFamily: FontFamily;
  enterToSend: boolean;
  soundEnabled: boolean;
  backgroundPattern: 'none' | 'doodles' | 'stars' | 'geometric';
  compactMode: boolean;
}

export interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  settings: ChatSettings;
  updateSettings: (newSettings: Partial<ChatSettings>) => void;
  resetSettings: () => void;
}
