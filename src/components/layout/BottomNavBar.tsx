import React, { useState } from 'react';
import { MessageSquare, Sparkles, Settings, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../contexts/ChatContext';

export type MobileTab = 'chats' | 'special' | 'settings';

interface BottomNavBarProps {
  currentTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentTab, onChangeTab }) => {
  const { theme } = useTheme();
  const { conversations } = useChat();
  const isGold = theme === 'black-gold';

  const [lastBouncedTab, setLastBouncedTab] = useState<MobileTab | null>(currentTab);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const handleTabClick = (key: MobileTab) => {
    setLastBouncedTab(key);
    onChangeTab(key);
  };

  const tabs: {
    key: MobileTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    sparkle?: string;
  }[] = [
    { key: 'chats', label: 'Chats', icon: MessageSquare, badge: totalUnread, sparkle: '✦' },
    { key: 'special', label: 'Special', icon: Sparkles, sparkle: '★' },
    { key: 'settings', label: 'Settings', icon: Settings, sparkle: '⚙' }
  ];

  return (
    <div className="fixed bottom-3 left-0 right-0 z-40 flex justify-center px-4 md:hidden pointer-events-none">
      <nav
        className={`pointer-events-auto flex items-center justify-between w-full max-w-sm px-2 py-1.5 rounded-full border shadow-[0_12px_40px_rgba(0,0,0,0.65)] select-none backdrop-blur-2xl transition-all duration-300 ${
          isGold
            ? 'bg-[#0f0e0a]/92 border-[#e5b842]/30 shadow-[#e5b842]/10'
            : 'bg-[#12131a]/92 border-white/15 shadow-[#2aabee]/15'
        }`}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.key;
          const isBounced = lastBouncedTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabClick(tab.key)}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all duration-200 active:scale-85 ${
                isActive
                  ? isGold
                    ? 'text-black font-extrabold'
                    : 'text-white font-extrabold'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              {/* Anime Floating Active Aura Pill */}
              {isActive && (
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-300 -z-10 ${
                    isGold
                      ? 'bg-gradient-to-r from-[#d4af37] via-[#f3c853] to-[#e5b842] shadow-[0_0_20px_rgba(229,184,66,0.5)]'
                      : 'bg-gradient-to-r from-[#229ad6] via-[#2aabee] to-[#38bdf8] shadow-[0_0_20px_rgba(42,171,238,0.5)]'
                  }`}
                >
                  {/* Subtle anime energetic aura shimmer */}
                  <span className="absolute inset-0 rounded-full bg-white/20 animate-aura-glow" />
                </div>
              )}

              {/* Icon Container with Anime Bounce */}
              <div className="relative">
                <div className={isActive && isBounced ? 'animate-anime-bounce' : ''}>
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'
                    }`}
                  />
                </div>

                {/* Anime Sparkle Burst on Active */}
                {isActive && (
                  <span
                    className={`absolute -top-1.5 -right-2 text-[10px] animate-star-burst pointer-events-none select-none font-bold ${
                      isGold ? 'text-black' : 'text-yellow-300'
                    }`}
                  >
                    {tab.sparkle}
                  </span>
                )}

                {/* Unread Badge (Anime style bouncy pill) */}
                {tab.badge !== undefined && tab.badge > 0 && !isActive && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white font-mono font-black text-[9px] flex items-center justify-center shadow-md animate-bounce">
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Text Label */}
              <span
                className={`text-[10px] mt-0.5 tracking-tight transition-all duration-150 ${
                  isActive ? 'font-black scale-105' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
