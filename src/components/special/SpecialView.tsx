import React from 'react';
import { Tag, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export const SpecialView: React.FC = () => {
  const { theme } = useTheme();
  const isGold = theme === 'black-gold';

  return (
    <div
      data-agent-tag="AGENT_HOOK_SPECIAL_TAB_V2"
      className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200"
    >
      {/* 
        ============================================================
        [AGENT_HOOK: SPECIAL_FEATURE_SLOT_V2]
        This tab is intentionally left blank for the next agent to implement
        future bot special extensions, quick commands, or custom pipelines.
        ============================================================
      */}
      <div
        className={`max-w-md w-full p-8 rounded-3xl border shadow-xl flex flex-col items-center text-center transition-all ${
          isGold
            ? 'bg-[#0f0e0a] border-[#38301a] text-[#f5f2eb] shadow-[0_0_40px_rgba(212,175,55,0.1)]'
            : 'bg-[#141d27] border-[#222e3d] text-white shadow-xl'
        }`}
      >
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
            isGold ? 'bg-[#d4af37]/20 text-[#d4af37]' : 'bg-[#2aabee]/20 text-[#2aabee]'
          }`}
        >
          <Sparkles className="w-7 h-7" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-[var(--color-accent)] mb-3">
          <Tag className="w-3 h-3" />
          <span>TAG: AGENT_HOOK_SPECIAL_TAB_V2</span>
        </div>

        <h3 className="text-lg font-bold">Special Tab</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5 leading-relaxed max-w-xs">
          This tab is blank and tagged for the next agent to attach custom commands, features, or automated workflows.
        </p>
      </div>
    </div>
  );
};
