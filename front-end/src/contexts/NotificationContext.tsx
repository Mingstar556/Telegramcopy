import React, { createContext, useContext, useState, useCallback } from 'react';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'alert' | 'message';
  avatar?: string;
  chatId?: string;
  duration?: number; // ms, default 3800
  actionLabel?: string;
  onAction?: () => void;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  notify: (notification: Omit<AppNotification, 'id'>) => string;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (notification: Omit<AppNotification, 'id'>) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newNotif: AppNotification = {
        id,
        duration: 4000,
        ...notification
      };

      setNotifications((prev) => [newNotif, ...prev.slice(0, 2)]); // Keep at most 3 notifications at once

      if (newNotif.duration && newNotif.duration > 0) {
        setTimeout(() => {
          dismissNotification(id);
        }, newNotif.duration);
      }

      return id;
    },
    [dismissNotification]
  );

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismissNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
