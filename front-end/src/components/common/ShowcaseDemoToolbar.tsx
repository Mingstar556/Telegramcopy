import React, { useState } from 'react';
import { MessageSquare, Mic, Image as ImageIcon, Loader2, Sparkles, Server, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

export const ShowcaseDemoToolbar: React.FC = () => {
  const { triggerShowcaseEvent, refreshChats } = useChat();
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  const [isOpen, setIsOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeMode, setActiveMode] = useState<'mock' | 'server'>(api.isMockMode() ? 'mock' : 'server');

  const handleTrigger = async (type: 'text' | 'voice' | 'photo' | 'typing') => {
    if (!triggerShowcaseEvent) return;
    setIsSimulating(true);
    try {
      await triggerShowcaseEvent(type);
    } finally {
      setTimeout(() => setIsSimulating(false), 400);
    }
  };

  const toggleBackendMode = () => {
    const newMode = activeMode === 'mock' ? 'server' : 'mock';
    api.setMockMode(newMode === 'mock');
    setActiveMode(newMode);
    refreshChats();
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6 select-none font-sans">
      {/* Expanded Toolbar Panel */}
      {isOpen ? (
        <div className="flex flex-col gap-2 p-3 rounded-2xl glass-header border border-white/10 shadow-2xl backdrop-blur-xl animate-slide-up w-72 text-white">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide">
              <Sparkles className={`w-3.5 h-3.5 ${isGold ? 'text-[#e5b842]' : 'text-cyan-400'}`} />
              <span>Showcase Test Control</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition"
              title="Minimize Toolbar"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-between bg-black/30 p-2 rounded-xl text-xs">
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-white/80">Backend:</span>
              <span className="font-semibold text-emerald-400">
                {activeMode === 'server' ? 'Local Test Server (8000)' : 'Mock Simulator'}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleBackendMode}
              className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition font-medium text-white/90"
            >
              Switch
            </button>
          </div>

          <p className="text-[10px] text-white/50 leading-tight">
            Trigger instant incoming test events during meeting demos:
          </p>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleTrigger('text')}
              className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium transition active:scale-95 btn-press ${
                isGold
                  ? 'bg-[#e5b842]/15 text-[#e5b842] hover:bg-[#e5b842]/25 border border-[#e5b842]/30'
                  : 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/30'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Simulate Text</span>
            </button>

            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleTrigger('voice')}
              className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium transition active:scale-95 btn-press ${
                isGold
                  ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Simulate Voice</span>
            </button>

            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleTrigger('photo')}
              className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium transition active:scale-95 btn-press ${
                isGold
                  ? 'bg-[#e5b842]/15 text-[#e5b842] hover:bg-[#e5b842]/25 border border-[#e5b842]/30'
                  : 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Simulate Photo</span>
            </button>

            <button
              type="button"
              disabled={isSimulating}
              onClick={() => handleTrigger('typing')}
              className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium transition active:scale-95 btn-press ${
                isGold
                  ? 'bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25 border border-yellow-500/30'
                  : 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30'
              }`}
            >
              {isSimulating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              <span>Client Typing</span>
            </button>
          </div>
        </div>
      ) : (
        /* Collapsed Floating Pill */
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-2xl backdrop-blur-xl border transition-all hover:scale-105 active:scale-95 btn-press ${
            isGold
              ? 'bg-[#18140c]/90 border-[#e5b842]/40 text-[#e5b842]'
              : 'bg-[#121b24]/90 border-[#2aabee]/40 text-[#38bdf8]'
          }`}
          title="Open Showcase Test Controls"
        >
          <Sparkles className="w-4 h-4 animate-spin-slow" />
          <span className="text-xs font-semibold tracking-tight">Showcase Tools</span>
          <ChevronUp className="w-3.5 h-3.5 opacity-60" />
        </button>
      )}
    </div>
  );
};
