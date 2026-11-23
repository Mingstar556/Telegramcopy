import React from 'react';
import {
  X,
  Play,
  HelpCircle,
  Settings,
  Activity,
  Trash2,
  Terminal,
  Bot,
  Zap,
  Info,
  Sparkles,
  SquareMousePointer
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface BotCommand {
  command: string;
  description: string;
  icon: React.ReactNode;
  isInlineButtonAction?: boolean;
}

interface BotCommandsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (command: string) => void;
  botName?: string;
  onOpenCreateInlineButton?: () => void;
}

const DEFAULT_COMMANDS: BotCommand[] = [
  {
    command: '/inline_button',
    description: 'Create and send interactive inline buttons',
    icon: <SquareMousePointer className="w-4 h-4 text-[var(--color-accent)]" />,
    isInlineButtonAction: true
  },
  {
    command: '/start',
    description: 'Start or restart the bot session',
    icon: <Play className="w-4 h-4 text-emerald-400" />
  },
  {
    command: '/help',
    description: 'Get command reference and operator manual',
    icon: <HelpCircle className="w-4 h-4 text-blue-400" />
  },
  {
    command: '/status',
    description: 'Check Django backend and database health',
    icon: <Activity className="w-4 h-4 text-amber-400" />
  },
  {
    command: '/settings',
    description: 'Open appearance and theme customizer',
    icon: <Settings className="w-4 h-4 text-purple-400" />
  },
  {
    command: '/profile',
    description: 'Inspect active bot operator identity',
    icon: <Bot className="w-4 h-4 text-[var(--color-accent)]" />
  },
  {
    command: '/clear',
    description: 'Clear current conversation history',
    icon: <Trash2 className="w-4 h-4 text-red-400" />
  }
];

export const BotCommandsMenu: React.FC<BotCommandsMenuProps> = ({
  isOpen,
  onClose,
  onSelectCommand,
  botName = 'Bot',
  onOpenCreateInlineButton
}) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const isGold = theme === 'black-gold';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Menu Capsule Container */}
      <div
        style={{ transformOrigin: 'bottom left' }}
        className={`absolute bottom-16 left-2 sm:left-4 w-72 sm:w-80 rounded-3xl p-3 z-50 border shadow-2xl backdrop-blur-2xl flex flex-col animate-pop-in ${
          isGold
            ? 'bg-[#0f0e0a]/95 border-[#38301a] text-[#f5f2eb] shadow-[0_12px_45px_rgba(0,0,0,0.85)]'
            : 'bg-[#121318]/95 border-white/10 text-white shadow-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold tracking-tight text-[var(--color-accent)]">
            <Terminal className="w-4 h-4" />
            <span>{botName} Menu</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Featured Bot Holder Tool: Create Inline Button */}
        <div className="p-2.5 mb-2 rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/20 via-[var(--color-accent)]/10 to-transparent border border-[var(--color-accent)]/30 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--color-accent)] flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Bot Holder Action
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-semibold">
              Interactive UI
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCreateInlineButton?.();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--color-accent)] text-black font-bold text-xs hover:brightness-110 active:scale-[0.98] transition shadow-md btn-press"
          >
            <SquareMousePointer className="w-3.5 h-3.5" />
            <span>Create Inline Button</span>
          </button>
        </div>

        {/* Command List */}
        <div className="space-y-1">
          {DEFAULT_COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => {
                onClose();
                if (cmd.isInlineButtonAction) {
                  onOpenCreateInlineButton?.();
                } else {
                  onSelectCommand(cmd.command);
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-white/5 active:bg-white/10 transition text-left group btn-press"
            >
              <div className="w-7 h-7 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                {cmd.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs font-bold text-white group-hover:text-[var(--color-accent)] transition">
                  {cmd.command}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {cmd.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
