import React from 'react';
import { useNotification, AppNotification } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MessageSquare, CheckCircle2, AlertCircle, Info, X, ExternalLink } from 'lucide-react';

export const NotificationToastContainer: React.FC = () => {
  const { notifications, dismissNotification } = useNotification();
  const { theme } = useTheme();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center pointer-events-none px-4 space-y-2">
      {notifications.map((notif) => (
        <NotificationToastItem
          key={notif.id}
          notification={notif}
          onDismiss={() => dismissNotification(notif.id)}
          theme={theme}
        />
      ))}
    </div>
  );
};

interface NotificationToastItemProps {
  notification: AppNotification;
  onDismiss: () => void;
  theme: string;
}

const NotificationToastItem: React.FC<NotificationToastItemProps> = ({
  notification,
  onDismiss,
  theme
}) => {
  const isGold = theme === 'black-gold';

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
      case 'alert':
        return <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
      case 'message':
        return <MessageSquare className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-[var(--color-accent)] flex-shrink-0" />;
    }
  };

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-full max-w-sm sm:max-w-md rounded-2xl border backdrop-blur-xl p-3.5 shadow-2xl animate-notification-drop flex items-start gap-3 relative overflow-hidden transition-all duration-200 select-none ${
        isGold
          ? 'bg-[#12110c]/95 border-[#e5b842]/40 text-[#f5f2eb] shadow-[0_10px_35px_rgba(229,184,66,0.18)]'
          : 'bg-[var(--color-bg-header)] border-[var(--color-border)] text-[var(--color-text-main)] shadow-[0_12px_40px_rgba(0,0,0,0.55)]'
      }`}
    >
      {/* Top subtle glow highlight line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-80" />

      {/* Leading Icon or Avatar */}
      <div className="pt-0.5">
        {notification.avatar ? (
          <img
            src={notification.avatar}
            alt=""
            className="w-8 h-8 rounded-full object-cover border border-white/10"
          />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            {getIcon()}
          </div>
        )}
      </div>

      {/* Text Body */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-tight truncate text-[var(--color-text-main)]">
            {notification.title}
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">now</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2 leading-snug">
          {notification.message}
        </p>

        {/* Action Button if specified */}
        {notification.actionLabel && notification.onAction && (
          <button
            onClick={() => {
              notification.onAction?.();
              onDismiss();
            }}
            className="mt-2 text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1 btn-press"
          >
            <span>{notification.actionLabel}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={onDismiss}
        className="p-1 -mr-1 -mt-1 text-[var(--color-text-muted)] hover:text-white rounded-lg hover:bg-white/10 transition btn-press flex-shrink-0"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
