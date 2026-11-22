import React, { useState } from 'react';
import {
  X,
  User,
  Palette,
  Type,
  Sparkles,
  Check,
  Database,
  Sliders,
  Volume2,
  VolumeX,
  Layers,
  CircleDot,
  CheckCheck,
  EyeOff,
  Sun,
  Moon,
  Minus,
  Plus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotification } from '../../contexts/NotificationContext';
import {
  FontFamily,
  FontWeight,
  FontSpacing,
  ThemeMode,
  AccentColor,
  BubbleStyle,
  BackgroundPattern
} from '../../types/theme';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { account } = useAuth();
  const {
    theme,
    setTheme,
    settings,
    updateSettings,
    resetSettings,
    playNotificationSound
  } = useTheme();
  const { notify } = useNotification();

  const [activeTab, setActiveTab] = useState<'theme' | 'chat' | 'details'>('theme');
  const [themeFilter, setThemeFilter] = useState<'all' | 'dark' | 'light'>('all');
  const [previewText, setPreviewText] = useState('Hey there! Customize this typography to fit your style.');

  if (!isOpen) return null;

  const isGold = theme === 'black-gold';

  const THEMES: {
    key: ThemeMode;
    name: string;
    description: string;
    isDark: boolean;
    previewColors: string[];
    accentName: string;
    secondaryName: string;
    secondaryColor: string;
  }[] = [
    {
      key: 'simple-black',
      name: 'Simple Black',
      description: 'Classic Telegram OLED dark with obsidian cyan accents',
      isDark: true,
      previewColors: ['#09090b', '#16181e', '#1e3b5a', '#2aabee'],
      accentName: 'Cyan',
      secondaryName: 'Violet Glow',
      secondaryColor: '#a855f7'
    },
    {
      key: 'black-gold',
      name: 'Black & Gold',
      description: 'Stealth luxury theme with radiant metallic gold buttons',
      isDark: true,
      previewColors: ['#050505', '#14120b', '#27200a', '#e5b842'],
      accentName: 'Gold',
      secondaryName: 'Amber Glow',
      secondaryColor: '#f97316'
    },
    {
      key: 'cyber-emerald',
      name: 'Cyber Emerald',
      description: 'Futuristic matrix theme with electric mint neon',
      isDark: true,
      previewColors: ['#040907', '#0d1e15', '#113c27', '#10b981'],
      accentName: 'Mint',
      secondaryName: 'Cyan Glow',
      secondaryColor: '#06b6d4'
    },
    {
      key: 'midnight-purple',
      name: 'Midnight Purple',
      description: 'Deep royal violet with luminous lavender glow',
      isDark: true,
      previewColors: ['#090612', '#181130', '#3b1d6f', '#a855f7'],
      accentName: 'Violet',
      secondaryName: 'Pink Glow',
      secondaryColor: '#ec4899'
    },
    {
      key: 'sunset-amber',
      name: 'Sunset Amber',
      description: 'Warm espresso charcoal paired with radiant amber tones',
      isDark: true,
      previewColors: ['#0c0806', '#1f140e', '#4c260b', '#f59e0b'],
      accentName: 'Amber',
      secondaryName: 'Flame Glow',
      secondaryColor: '#ef4444'
    },
    {
      key: 'rose-quartz',
      name: 'Rose Quartz',
      description: 'Velvet graphite with dusty coral rose highlights',
      isDark: true,
      previewColors: ['#0d080a', '#221319', '#4a1a2e', '#f43f5e'],
      accentName: 'Rose',
      secondaryName: 'Lilac Glow',
      secondaryColor: '#c084fc'
    },
    {
      key: 'oled-pure',
      name: 'OLED Pure Black',
      description: 'Absolute 100% black pixels with glacier ice cyan',
      isDark: true,
      previewColors: ['#000000', '#111111', '#162534', '#00d2ff'],
      accentName: 'Glacier',
      secondaryName: 'Ultra Glow',
      secondaryColor: '#7c3aed'
    },
    {
      key: 'cloud-light',
      name: 'Cloud Light',
      description: 'Crisp porcelain day mode with royal blue accents',
      isDark: false,
      previewColors: ['#f8fafc', '#ffffff', '#e2e8f0', '#2563eb'],
      accentName: 'Royal',
      secondaryName: 'Iris Glow',
      secondaryColor: '#7c3aed'
    }
  ];

  const ACCENTS: { key: AccentColor; label: string; color: string }[] = [
    { key: 'default', label: 'Theme Default', color: 'transparent' },
    { key: 'cyan', label: 'Cyan Blue', color: '#2aabee' },
    { key: 'gold', label: 'Gold', color: '#e5b842' },
    { key: 'emerald', label: 'Emerald', color: '#10b981' },
    { key: 'purple', label: 'Purple', color: '#a855f7' },
    { key: 'amber', label: 'Amber', color: '#f59e0b' },
    { key: 'rose', label: 'Rose', color: '#f43f5e' },
    { key: 'crimson', label: 'Crimson', color: '#ef4444' },
    { key: 'indigo', label: 'Indigo', color: '#6366f1' },
    { key: 'lime', label: 'Lime', color: '#84cc16' }
  ];

  const FONTS: {
    key: FontFamily;
    label: string;
    preview: string;
    sample: string;
    cssFamily: string;
  }[] = [
    {
      key: 'sans',
      label: 'Apple SF / System',
      preview: 'Native Apple SF Pro & System UI',
      sample: 'Aa Bb 123',
      cssFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    {
      key: 'inter',
      label: 'Inter Modern',
      preview: 'Clean, neutral & ultra-legible',
      sample: 'Aa Bb 123',
      cssFamily: '"Inter", sans-serif'
    },
    {
      key: 'jakarta',
      label: 'Plus Jakarta Sans',
      preview: 'Geometric & modern high-tech',
      sample: 'Aa Bb 123',
      cssFamily: '"Plus Jakarta Sans", sans-serif'
    },
    {
      key: 'outfit',
      label: 'Outfit Geometric',
      preview: 'Contemporary minimalist headline font',
      sample: 'Aa Bb 123',
      cssFamily: '"Outfit", sans-serif'
    },
    {
      key: 'roboto',
      label: 'Roboto Clean',
      preview: 'Standard Android & Google Material font',
      sample: 'Aa Bb 123',
      cssFamily: '"Roboto", sans-serif'
    },
    {
      key: 'rounded',
      label: 'Nunito Friendly',
      preview: 'Soft rounded corners & comfortable reading',
      sample: 'Aa Bb 123',
      cssFamily: '"Nunito", sans-serif'
    },
    {
      key: 'mono',
      label: 'JetBrains Code',
      preview: 'Monospaced developer terminal style',
      sample: 'Aa Bb 123',
      cssFamily: '"JetBrains Mono", monospace'
    }
  ];

  const FONT_WEIGHTS: { key: FontWeight; label: string; desc: string }[] = [
    { key: 'normal', label: 'Regular (400)', desc: 'Standard weight' },
    { key: 'medium', label: 'Medium (500)', desc: 'Balanced crispness' },
    { key: 'semibold', label: 'Semi-Bold (600)', desc: 'High emphasis' },
    { key: 'bold', label: 'Bold (700)', desc: 'Maximum contrast' }
  ];

  const FONT_SPACINGS: { key: FontSpacing; label: string; desc: string }[] = [
    { key: 'compact', label: 'Compact', desc: 'Dense message line height' },
    { key: 'normal', label: 'Standard', desc: 'Balanced natural reading' },
    { key: 'relaxed', label: 'Relaxed', desc: 'Spacious & easy on eyes' }
  ];

  const BUBBLE_STYLES: { key: BubbleStyle; label: string; description: string }[] = [
    { key: 'modern', label: 'Modern Rounded', description: 'Curved 20px corners with subtle tail' },
    { key: 'classic', label: 'Telegram Classic', description: 'Classic telegram bubble shape' },
    { key: 'sharp', label: 'Sharp Tech', description: 'Compact 10px rounded corners' },
    { key: 'pill', label: 'Floating Pill', description: 'Ultra soft 28px pill contours' }
  ];

  const filteredThemes = THEMES.filter(th => {
    if (themeFilter === 'dark') return th.isDark;
    if (themeFilter === 'light') return !th.isDark;
    return true;
  });

  const handlePlayChime = () => {
    playNotificationSound();
    notify({
      title: 'Sound Notification',
      message: 'Chime preview played successfully',
      type: 'info',
      duration: 2500
    });
  };

  const isNoAnimation = settings.animationStyle === 'none' || settings.animationsEnabled === false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-pop-in ${
          isGold
            ? 'bg-[#0e0d08] border-[#38301a] text-[#f5f2eb] shadow-[0_0_50px_rgba(212,175,55,0.15)]'
            : 'bg-[var(--color-modal-bg)] border-[var(--color-border)] text-[var(--color-text-main)] shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-bold flex items-center gap-2 tracking-tight">
            <Sliders className="w-4 h-4 text-[var(--color-accent)]" />
            <span>Customize Design & Themes</span>
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-white p-1.5 rounded-full hover:bg-white/10 transition btn-press"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 sm:px-6 pt-3 pb-2.5 bg-black/20 border-b border-[var(--color-border)]">
          <div className="flex p-1 rounded-full bg-black/40 border border-white/5 gap-1">
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all btn-press ${
                activeTab === 'theme'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-md'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Themes & Styling</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all btn-press ${
                activeTab === 'chat'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-md'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Fonts & Bubbles</span>
            </button>

            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 transition-all btn-press ${
                activeTab === 'details'
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-md'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Operator Profile</span>
            </button>
          </div>
        </div>

        {/* Scrollable Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {/* ========================================================================= */}
          {/* TAB 1: THEMES & STYLING                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'theme' && (
            <div className="space-y-5">
              {/* Theme Grid with Dark/Light Filter */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-tight text-[var(--color-text-main)]">
                      Theme Profiles ({THEMES.length} Options)
                    </span>
                  </div>

                  {/* Filter chips */}
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/40 border border-white/5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setThemeFilter('all')}
                      className={`px-2 py-0.5 rounded-md transition ${
                        themeFilter === 'all'
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold'
                          : 'text-[var(--color-text-muted)] hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setThemeFilter('dark')}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition ${
                        themeFilter === 'dark'
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold'
                          : 'text-[var(--color-text-muted)] hover:text-white'
                      }`}
                    >
                      <Moon className="w-2.5 h-2.5" />
                      <span>Dark</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setThemeFilter('light')}
                      className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition ${
                        themeFilter === 'light'
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold'
                          : 'text-[var(--color-text-muted)] hover:text-white'
                      }`}
                    >
                      <Sun className="w-2.5 h-2.5" />
                      <span>Light</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredThemes.map((th) => {
                    const isSelected = theme === th.key;
                    return (
                      <button
                        key={th.key}
                        onClick={() => {
                          setTheme(th.key);
                          notify({
                            title: 'Theme Applied',
                            message: `Switched to ${th.name}`,
                            type: 'info',
                            duration: 2000
                          });
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all btn-press flex flex-col justify-between ${
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 ring-2 ring-[var(--color-accent)]/30 shadow-md'
                            : 'border-white/5 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="font-bold text-xs text-[var(--color-text-main)] flex items-center gap-1.5">
                              {th.name}
                              {th.key === 'black-gold' && (
                                <Sparkles className="w-3 h-3 text-[#e5b842]" />
                              )}
                              {!th.isDark && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-500/20 text-blue-400">
                                  DAY
                                </span>
                              )}
                            </span>
                            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 leading-snug line-clamp-2">
                              {th.description}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-text)] flex items-center justify-center flex-shrink-0 animate-pop-in">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>

                        {/* Color preview swatch pill */}
                        <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-white/5">
                          <div className="flex items-center gap-1">
                            {th.previewColors.map((c, i) => (
                              <span
                                key={i}
                                style={{ backgroundColor: c }}
                                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                              />
                            ))}
                            {/* Secondary Glow Dot */}
                            <span
                              style={{ backgroundColor: th.secondaryColor }}
                              className="w-3 h-3 rounded-full border border-white/25 shadow-[0_0_6px_var(--color-secondary-glow)]"
                              title={`Secondary Glow: ${th.secondaryName}`}
                            />
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono ml-auto">
                            <span className="text-[var(--color-text-muted)]">{th.accentName}</span>
                            <span className="text-white/20">•</span>
                            <span
                              className="font-semibold flex items-center gap-1"
                              style={{ color: th.secondaryColor }}
                            >
                              {th.secondaryName}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color Customizer */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--color-text-main)]">
                      Accent Color Palette ({ACCENTS.length} Options)
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      Overrides the primary button, badge, and glow color
                    </div>
                  </div>
                  <span className="capitalize font-mono text-[11px] font-bold text-[var(--color-accent)]">
                    {settings.accentColor}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {ACCENTS.map((acc) => {
                    const isSelected = settings.accentColor === acc.key;
                    return (
                      <button
                        key={acc.key}
                        onClick={() => updateSettings({ accentColor: acc.key })}
                        className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-all btn-press ${
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 font-bold text-white ring-1 ring-[var(--color-accent)]'
                            : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                        }`}
                      >
                        {acc.color !== 'transparent' ? (
                          <span
                            style={{ backgroundColor: acc.color }}
                            className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <CircleDot className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                        )}
                        <span>{acc.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-[var(--color-accent)] ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chat Wallpaper Pattern & Opacity */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[var(--color-text-main)]">
                    Chat Wallpaper Pattern
                  </div>
                  <span className="capitalize font-mono text-[10px] text-[var(--color-accent)]">
                    {settings.backgroundPattern}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {[
                    { key: 'doodles', label: 'Doodles' },
                    { key: 'stars', label: 'Stars' },
                    { key: 'geometric', label: 'Grid' },
                    { key: 'mesh', label: 'Gradient Mesh' },
                    { key: 'none', label: 'Solid Pure' }
                  ].map((pat) => {
                    const isSelected = settings.backgroundPattern === pat.key;
                    return (
                      <button
                        key={pat.key}
                        onClick={() =>
                          updateSettings({ backgroundPattern: pat.key as BackgroundPattern })
                        }
                        className={`py-2 px-3 rounded-xl border text-center transition-all btn-press ${
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold ring-1 ring-[var(--color-accent)]'
                            : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                        }`}
                      >
                        {pat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Wallpaper Opacity Slider */}
                {settings.backgroundPattern !== 'none' && (
                  <div className="pt-2 border-t border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-text-muted)]">Pattern Intensity / Contrast</span>
                      <span className="font-mono font-bold text-[var(--color-accent)]">
                        {settings.backgroundOpacity ?? 60}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="100"
                      step="5"
                      value={settings.backgroundOpacity ?? 60}
                      onChange={(e) => updateSettings({ backgroundOpacity: Number(e.target.value) })}
                      className="w-full accent-[var(--color-accent)] cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FONTS, TYPOGRAPHY & BUBBLES                                        */}
          {/* ========================================================================= */}
          {activeTab === 'chat' && (
            <div className="space-y-5">
              {/* Font Family Selection with Live Font Rendering */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[var(--color-text-main)]">
                      Typography & Font Family ({FONTS.length} Options)
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      Select custom typeface applied across the entire workspace
                    </div>
                  </div>
                  <span className="capitalize font-mono text-[11px] font-bold text-[var(--color-accent)]">
                    {settings.fontFamily}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {FONTS.map((f) => {
                    const isSelected = settings.fontFamily === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => updateSettings({ fontFamily: f.key })}
                        style={{ fontFamily: f.cssFamily }}
                        className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all btn-press ${
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold ring-1 ring-[var(--color-accent)] shadow-sm'
                            : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-xs text-[var(--color-text-main)]">
                            {f.label}
                          </div>
                          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                            {f.preview}
                          </div>
                        </div>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/40 border border-white/5 flex-shrink-0">
                          {f.sample}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Weight & Line Spacing */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-4">
                {/* Weight */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[var(--color-text-main)]">
                      Font Weight (Thickness)
                    </span>
                    <span className="capitalize font-mono text-[10px] text-[var(--color-accent)] font-bold">
                      {settings.fontWeight || 'normal'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                    {FONT_WEIGHTS.map((fw) => {
                      const isSelected = (settings.fontWeight || 'normal') === fw.key;
                      return (
                        <button
                          key={fw.key}
                          type="button"
                          onClick={() => updateSettings({ fontWeight: fw.key })}
                          className={`p-2 rounded-xl border text-center transition-all btn-press ${
                            isSelected
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold'
                              : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                          }`}
                        >
                          <div className="text-[11px]">{fw.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Line Spacing */}
                <div className="pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[var(--color-text-main)]">
                      Line Spacing (Height)
                    </span>
                    <span className="capitalize font-mono text-[10px] text-[var(--color-accent)] font-bold">
                      {settings.fontSpacing || 'normal'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {FONT_SPACINGS.map((fs) => {
                      const isSelected = (settings.fontSpacing || 'normal') === fs.key;
                      return (
                        <button
                          key={fs.key}
                          type="button"
                          onClick={() => updateSettings({ fontSpacing: fs.key })}
                          className={`p-2 rounded-xl border text-center transition-all btn-press ${
                            isSelected
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold'
                              : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                          }`}
                        >
                          <div className="text-[11px] font-semibold">{fs.label}</div>
                          <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{fs.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Message Font Size Slider & Live Interactive Preview */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-main)]">
                    <Type className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>Message Text Size</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSettings({ fontSize: Math.max(13, settings.fontSize - 1) })}
                      disabled={settings.fontSize <= 13}
                      className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition btn-press"
                      title="Smaller"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-[var(--color-accent)] font-mono w-10 text-center">
                      {settings.fontSize}px
                    </span>
                    <button
                      type="button"
                      onClick={() => updateSettings({ fontSize: Math.min(22, settings.fontSize + 1) })}
                      disabled={settings.fontSize >= 22}
                      className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition btn-press"
                      title="Larger"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min="13"
                  max="22"
                  step="1"
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                  className="w-full accent-[var(--color-accent)] cursor-pointer"
                />

                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)]">
                  <span>Compact (13px)</span>
                  <span>Standard (15px)</span>
                  <span>Large (22px)</span>
                </div>

                {/* Live Message Preview Card with interactive typing input */}
                <div className="mt-3 p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                      Live Typography & Bubble Preview
                    </span>
                    <span className="text-[10px] text-[var(--color-accent)] font-mono">
                      {settings.fontFamily} • {settings.fontSize}px
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: `${settings.fontSize}px`,
                      lineHeight: settings.fontSpacing === 'compact' ? 1.3 : settings.fontSpacing === 'relaxed' ? 1.65 : 1.45,
                      fontWeight: settings.fontWeight === 'bold' ? 700 : settings.fontWeight === 'semibold' ? 600 : settings.fontWeight === 'medium' ? 500 : 400
                    }}
                    className="p-3.5 rounded-2xl bg-[var(--color-bg-bubble-out)] border border-white/10 text-white max-w-sm ml-auto shadow-md"
                  >
                    <p className="leading-relaxed">
                      {previewText}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-75 font-mono">
                      <span>12:45</span>
                      <CheckCheck className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    </div>
                  </div>

                  <div className="pt-2">
                    <input
                      type="text"
                      value={previewText}
                      onChange={(e) => setPreviewText(e.target.value)}
                      placeholder="Type custom text to preview your font..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-[var(--color-accent)]"
                    />
                  </div>
                </div>
              </div>

              {/* Bubble Shape Styles */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="text-xs font-bold text-[var(--color-text-main)] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[var(--color-accent)]" />
                  <span>Chat Bubble Corner Style</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {BUBBLE_STYLES.map((bs) => {
                    const isSelected = settings.bubbleStyle === bs.key;
                    return (
                      <button
                        key={bs.key}
                        onClick={() => updateSettings({ bubbleStyle: bs.key })}
                        className={`p-2.5 rounded-xl border text-left transition-all btn-press ${
                          isSelected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold ring-1 ring-[var(--color-accent)]'
                            : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                        }`}
                      >
                        <div className="font-semibold">{bs.label}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          {bs.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ===================================================================== */}
              {/* ANIMATION CHOICES: ONLY 2 (Normal vs Non-animation)                   */}
              {/* ===================================================================== */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[var(--color-text-main)] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                    <span>Animations (2 Modes)</span>
                  </div>
                  <span className="capitalize font-mono text-[11px] text-[var(--color-accent)] font-bold">
                    {isNoAnimation ? 'Non-animation' : 'Normal'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* Choice 1: Normal Animation */}
                  <button
                    type="button"
                    onClick={() => {
                      updateSettings({ animationStyle: 'normal', animationsEnabled: true });
                      notify({
                        title: 'Animations Enabled',
                        message: 'Normal smooth animations & transitions active',
                        type: 'info',
                        duration: 1800
                      });
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all btn-press flex flex-col justify-between ${
                      !isNoAnimation
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold ring-1 ring-[var(--color-accent)] shadow-md'
                        : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                        <span className="font-bold text-xs text-[var(--color-text-main)]">Normal Animation</span>
                      </div>
                      {!isNoAnimation && (
                        <span className="w-4 h-4 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-text)] flex items-center justify-center animate-pop-in">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      Fluid spring motion, message entrances, button tactile presses & soft glows.
                    </p>
                  </button>

                  {/* Choice 2: Non-animation (No Motion) */}
                  <button
                    type="button"
                    onClick={() => {
                      updateSettings({ animationStyle: 'none', animationsEnabled: false });
                      notify({
                        title: 'Animations Disabled',
                        message: 'Non-animation mode active (instant transitions, zero motion)',
                        type: 'info',
                        duration: 1800
                      });
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all btn-press flex flex-col justify-between ${
                      isNoAnimation
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold ring-1 ring-[var(--color-accent)] shadow-md'
                        : 'border-white/5 hover:bg-white/5 text-[var(--color-text-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-[var(--color-accent)]" />
                        <span className="font-bold text-xs text-[var(--color-text-main)]">Non-animation</span>
                      </div>
                      {isNoAnimation && (
                        <span className="w-4 h-4 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-text)] flex items-center justify-center animate-pop-in">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      Zero delay, instant transitions, and disabled motion for maximum performance and focus.
                    </p>
                  </button>
                </div>
              </div>

              {/* Toggles & Behavior */}
              <div className="space-y-2">
                {/* Sound Effects Toggle & Test */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/30 border border-white/5">
                  <div className="flex items-center gap-2.5">
                    {settings.soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-[var(--color-accent)]" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-[var(--color-text-muted)]" />
                    )}
                    <div>
                      <div className="text-xs font-semibold">Sound Notifications</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        Play chime audio on sent and incoming messages
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePlayChime}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-semibold text-white transition btn-press"
                    >
                      Play Chime
                    </button>
                    <input
                      type="checkbox"
                      checked={settings.soundEnabled}
                      onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                      className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Enter to Send Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/30 border border-white/5">
                  <div>
                    <div className="text-xs font-semibold">Send by Enter</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      Press Shift + Enter for a new line
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enterToSend}
                    onChange={(e) => updateSettings({ enterToSend: e.target.checked })}
                    className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: STAFF PROFILE & SESSION                                            */}
          {/* ========================================================================= */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                <div className="text-xs uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                  Bot Profile & Session
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-xs">
                  <span className="text-[var(--color-text-muted)]">Employee User ID</span>
                  <span className="font-mono font-bold text-white">
                    {account?.userId || '1234'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-xs">
                  <span className="text-[var(--color-text-muted)]">Assigned Telegram Bot</span>
                  <span className="font-semibold text-white">
                    {account?.botName || 'Telegram Bot'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-xs">
                  <span className="text-[var(--color-text-muted)]">Bot Handle</span>
                  <span className="text-[var(--color-accent)] font-semibold">
                    @{account?.botUsername || 'bot'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-xs">
                  <span className="text-[var(--color-text-muted)]">Operator Status</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Active Telegram Client
                  </span>
                </div>
              </div>

              {/* Server Connection Status */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-xs">Backend Connection</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300">
                    ONLINE
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Real-time WebSockets connected to Django Channels ASGI server.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--color-border)] flex justify-between items-center bg-black/20">
          <button
            onClick={() => {
              resetSettings();
              notify({
                title: 'Reset',
                message: 'All settings returned to default',
                type: 'info',
                duration: 2000
              });
            }}
            className="text-xs text-[var(--color-text-muted)] hover:text-white transition"
          >
            Reset Defaults
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl text-xs font-bold transition btn-press bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)] shadow-md shadow-[var(--color-accent-glow)]"
          >
            Save & Done
          </button>
        </div>
      </div>
    </div>
  );
};
