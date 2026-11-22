import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useChat } from './contexts/ChatContext';
import { LoginModal } from './components/auth/LoginModal';
import { Sidebar } from './components/layout/Sidebar';
import { ChatArea } from './components/layout/ChatArea';
import { BottomNavBar, MobileTab } from './components/layout/BottomNavBar';
import { AccountModal } from './components/modals/AccountModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { NoSignalScreen } from './components/common/NoSignalScreen';
import { NotificationToastContainer } from './components/common/NotificationToast';
import { api } from './services/api';
import { Loader2, Radio } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { activeChat, selectChat } = useChat();

  const [mobileTab, setMobileTab] = useState<MobileTab>('chats');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Connection & Signal status: 'checking' | 'connected' | 'no_signal'
  const [signalStatus, setSignalStatus] = useState<'checking' | 'connected' | 'no_signal'>('checking');
  const [signalError, setSignalError] = useState<string>('');

  // Initial connection probe on app launch
  useEffect(() => {
    let isMounted = true;

    const probeSignal = async () => {
      const res = await api.checkHealth();
      if (!isMounted) return;

      if (res.status === 'ok') {
        setSignalStatus('connected');
      } else {
        setSignalError(res.message || 'Server or database is not hosted');
        setSignalStatus('no_signal');
      }
    };

    probeSignal();

    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Initial Connecting Handshake Screen
  if (signalStatus === 'checking') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0c] text-white select-none">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-500/30 flex items-center justify-center animate-pulse">
              <Radio className="w-8 h-8 text-red-400 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          </div>

          <div className="text-center">
            <h2 className="text-lg font-bold tracking-tight text-zinc-100">UserBot Chat</h2>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2 justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              <span>Connecting to Server & Database...</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. NO SIGNAL SCREEN (when host/DB is offline)
  if (signalStatus === 'no_signal') {
    return (
      <NoSignalScreen
        initialError={signalError}
        onConnected={() => setSignalStatus('connected')}
      />
    );
  }

  // 3. If not authenticated, render Login Modal with test account & red error screen
  if (!isAuthenticated) {
    return <LoginModal />;
  }

  const handleMobileTabChange = (tab: MobileTab) => {
    setMobileTab(tab);
    if (tab === 'settings') {
      setIsSettingsOpen(true);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen overflow-hidden bg-[var(--color-bg-base)] text-[var(--color-text-main)] select-none">
      {/* 
        Cross-Platform Responsive Split Layout:
        - Mobile: Toggle between Sidebar, SpecialView, or ChatArea
        - Tablet & Desktop: Dual column split view (Telegram Web style)
      */}

      {/* Main Viewport Container */}
      <div className="flex-1 flex overflow-hidden w-full h-full relative">
        {/* Conversation List / Sidebar */}
        <div
          className={`w-full md:w-80 lg:w-96 h-full flex-col ${
            activeChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          <Sidebar
            onOpenAccount={() => setIsAccountOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        {/* Active Chat Conversation Feed */}
        <div
          className={`flex-1 h-full flex-col transition-all duration-200 ${
            !activeChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ChatArea onBackToSidebar={() => selectChat('')} />
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Visible on mobile when no active chat is open) */}
      {!activeChat && (
        <BottomNavBar
          currentTab={mobileTab}
          onChangeTab={handleMobileTabChange}
        />
      )}

      {/* Modals triggered from 3-dots menu or tabs */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          if (mobileTab === 'settings') {
            setMobileTab('chats');
          }
        }}
      />

      {/* Global In-App Animated Notification Toasts */}
      <NotificationToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;
