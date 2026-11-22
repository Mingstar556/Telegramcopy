import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  Type,
  Sparkles,
  Zap,
  Activity,
  Wind,
  Minus,
  Plus,
  Sliders,
  Check,
  EyeOff
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotification } from '../../contexts/NotificationContext';
import { ThemeMode, FontFamily, AnimationStyle } from '../../types/theme';

interface QuickAppearancePopoverProps {
  onOpenFullSettings?: () => void;
  className?: string;
}

export const QuickAppearancePopover: React.FC<QuickAppearancePopoverProps> = ({
  onOpenFullSettings,
  className = ''
}) => {
  const { theme, setTheme, settings, updateSettings } = useTheme();
  const { notify } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const THEMES: { key: ThemeMode; name: string; color: string; accent: string; secondary: string }[] = [
    { key: 'simple-black', name: 'Black', color: '#09090b', accent: '#2aabee', secondary: '#a855f7' },
    { key: 'black-gold', name: 'Gold', color: '#050505', accent: '#e5b842', secondary: '#f97316' },
    { key: 'cyber-emerald', name: 'Emerald', color: '#040907', accent: '#10b981', secondary: '#06b6d4' },
    { key: 'midnight-purple', name: 'Purple', color: '#090612', accent: '#a855f7', secondary: '#ec4899' },
    { key: 'sunset-amber', name: 'Amber', color: '#0c0806', accent: '#f59e0b', secondary: '#ef4444' },
    { key: 'rose-quartz', name: 'Rose', color: '#0d080a', accent: '#f43f5e', secondary: '#c084fc' },
    { key: 'oled-pure', name: 'OLED', color: '#000000', accent: '#00d2ff', secondary: '#7c3aed' },
    { key: 'cloud-light', name: 'Light', color: '#f8fafc', accent: '#2563eb', secondary: '#7c3aed' }
  ];

  const FONTS: { key: FontFamily; label: string }[] = [
    { key: 'sans', label: 'Default' },
    { key: 'inter', label: 'Inter' },
    { key: 'jakarta', label: 'Jakarta' },
    { key: 'outfit', label: 'Outfit' },
    { key: 'roboto', label: 'Roboto' },
    { key: 'rounded', label: 'Nunito' },
    { key: 'mono', label: 'Mono' }
  ];

  const ANIMATIONS: { key: AnimationStyle; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'snappy', label: 'Snappy', icon: Zap },
    { key: 'bouncy', label: 'Bouncy', icon: Sparkles },
    { key: 'smooth', label: 'Smooth', icon: Wind },
    { key: 'reduced', label: 'Reduced', icon: EyeOff }
  ];

  const handleAdjustFontSize = (delta: number) => {
    const next = Math.min(22, Math.max(13, settings.fontSize + delta));
    updateSettings({ fontSize: next });
  };

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      {/* PC Trigger Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Quick Appearance Customizer (Themes, Fonts, Animations)"
        className={`px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition btn-press ${
          isOpen
            ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] border-[var(--color-accent)] shadow-md shadow-[var(--color-accent-glow)]'
            : 'bg-white/5 border-white/10 text-[var(--color-text-main)] hover:bg-white/10 hover:border-white/20'
        }`}
      >
        <Palette className="w-3.5 h-3.5 text-[var(--color-accent)]" />
        <span className="hidden xl:inline">Appearance</span>
      </button>

      {/* Floating Popover Container */}
      {isOpen && (
        <div
          style={{ transformOrigin: 'top right' }}
          className="absolute right-0 top-11 w-72 sm:w-80 rounded-2xl p-4 shadow-2xl border z-50 backdrop-blur-2xl animate-pop-in bg-[var(--color-modal-bg)] border-[var(--color-border)] text-[var(--color-text-main)] shadow-[0_16px_40px_rgba(0,0,0,0.65)] select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Quick Appearance Customizer</span>
            </div>
            <span className="text-[10px] text-[var(--color-accent)] font-mono font-bold uppercase">
              PC Mode
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            {/* 1. Theme Swatches */}
            <div>
              <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 flex items-center justify-between">
                <span>Theme Preset</span>
                <span className="capitalize font-mono text-[10px] text-[var(--color-accent)] font-bold">
                  {theme.replace('-', ' ')}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {THEMES.map((th) => {
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
                          duration: 1800
                        });
                      }}
                      className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all btn-press ${
                        isSelected
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 shadow-sm ring-1 ring-[var(--color-accent)]'
                          : 'border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-0.5">
                        <span
                          style={{ backgroundColor: th.color }}
                          className="w-3 h-3 rounded-full border border-white/20"
                          title="Base Background"
                        />
                        <span
                          style={{ backgroundColor: th.accent }}
                          className="w-3 h-3 rounded-full border border-white/20 shadow-sm"
                          title="Primary Accent"
                        />
                        <span
                          style={{ backgroundColor: th.secondary }}
                          className="w-2.5 h-2.5 rounded-full border border-white/25 shadow-sm ring-1 ring-white/10"
                          title={`Secondary Glow: ${th.secondary}`}
                        />
                      </div>
                      <span className="text-[10px] font-medium leading-none truncate max-w-full">
                        {th.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Font Family Chips */}
            <div>
              <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 flex items-center justify-between">
                <span>Font Family</span>
                <span className="capitalize font-mono text-[10px] text-[var(--color-accent)] font-bold">
                  {settings.fontFamily}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {FONTS.map((f) => {
                  const isSelected = settings.fontFamily === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => updateSettings({ fontFamily: f.key })}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-all btn-press ${
                        isSelected
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-text)] font-bold shadow-sm'
                          : 'border-white/10 hover:bg-white/5 text-[var(--color-text-muted)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Font Size Stepper */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5">
              <div className="flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span className="text-[11px] font-semibold">Message Size</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustFontSize(-1)}
                  disabled={settings.fontSize <= 13}
                  className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition btn-press"
                  title="Smaller"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono text-xs font-bold text-[var(--color-accent)] w-8 text-center">
                  {settings.fontSize}px
                </span>
                <button
                  type="button"
                  onClick={() => handleAdjustFontSize(1)}
                  disabled={settings.fontSize >= 22}
                  className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center transition btn-press"
                  title="Larger"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 4. Animation Feel & Speed */}
            <div>
              <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1.5 flex items-center justify-between">
                <span>Animation Feel</span>
                <span className="capitalize font-mono text-[10px] text-[var(--color-accent)] font-bold">
                  {settings.animationStyle || 'snappy'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {ANIMATIONS.map((anim) => {
                  const Icon = anim.icon;
                  const isSelected = (settings.animationStyle || 'snappy') === anim.key;
                  return (
                    <button
                      key={anim.key}
                      onClick={() => {
                        updateSettings({ animationStyle: anim.key });
                        notify({
                          title: 'Animation Updated',
                          message: `Motion tuned to ${anim.label}`,
                          type: 'info',
                          duration: 1600
                        });
                      }}
                      className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all btn-press ${
                        isSelected
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-bold ring-1 ring-[var(--color-accent)]'
                          : 'border-white/10 hover:bg-white/5 text-[var(--color-text-muted)]'
                      }`}
                      title={anim.label}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px]">{anim.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer with link to Full Settings Modal */}
          {onOpenFullSettings && (
            <div className="mt-3.5 pt-2.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-[var(--color-text-muted)]">
                More wallpapers & sounds
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenFullSettings();
                }}
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1 btn-press"
              >
                <Sliders className="w-3 h-3" />
                <span>All Settings</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
