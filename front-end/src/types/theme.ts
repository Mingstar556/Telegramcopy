export type ThemeMode =
  | 'simple-black'     // Classic Telegram Dark
  | 'black-gold'        // Stealth Luxury Gold
  | 'cyber-emerald'     // Cyberpunk / Matrix Mint
  | 'midnight-purple'   // Deep Violet / Lavender
  | 'sunset-amber'      // Warm Charcoal / Amber Sunset
  | 'rose-quartz'       // Velvet Slate / Coral Rose
  | 'oled-pure'         // True 000000 Pitch Black / Glacier Cyan
  | 'cloud-light';      // Clean Daytime Porcelain Light

export type FontFamily =
  | 'sans'      // Apple SF Pro / System UI
  | 'inter'     // Inter Modern
  | 'jakarta'   // Plus Jakarta Sans
  | 'outfit'    // Outfit Geometric
  | 'roboto'    // Roboto Clean
  | 'mono'      // JetBrains Mono
  | 'rounded';  // Nunito Friendly Rounded

export type AccentColor =
  | 'default'
  | 'cyan'
  | 'gold'
  | 'emerald'
  | 'purple'
  | 'amber'
  | 'rose'
  | 'crimson';

export type BubbleStyle = 'modern' | 'classic' | 'sharp' | 'pill';

export type BackgroundPattern = 'none' | 'doodles' | 'stars' | 'geometric' | 'mesh';

export type AnimationStyle = 'snappy' | 'bouncy' | 'smooth' | 'reduced';

export interface ChatSettings {
  fontSize: number; // e.g. 13 - 22 px
  fontFamily: FontFamily;
  accentColor: AccentColor;
  bubbleStyle: BubbleStyle;
  enterToSend: boolean;
  soundEnabled: boolean;
  backgroundPattern: BackgroundPattern;
  compactMode: boolean;
  animationsEnabled: boolean;
  animationStyle: AnimationStyle;
}

export interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  settings: ChatSettings;
  updateSettings: (newSettings: Partial<ChatSettings>) => void;
  resetSettings: () => void;
  playNotificationSound: () => void;
  playSendSound: () => void;
  playReceiveSound: () => void;
}
