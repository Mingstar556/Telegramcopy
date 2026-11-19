import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useChat } from './contexts/ChatContext';
import { LoginModal } from './components/auth/LoginModal';
import { Sidebar } from './components/layout/Sidebar';
import { ChatArea } from './components/layout/ChatArea';
import { BottomNavBar, MobileTab } from './components/layout/BottomNavBar';
import { SpecialView } from './components/special/SpecialView';
import { AccountModal } from './components/modals/AccountModal';
import { SpecialChatModal } from './components/modals/SpecialChatModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ShowcaseDemoToolbar } from './components/common/ShowcaseDemoToolbar';

export const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { activeChat, selectChat } = useChat();

  const [mobileTab, setMobileTab] = useState<MobileTab>('chats');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSpecialOpen, setIsSpecialOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // If not authenticated, render Login Modal with test account & red error screen
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
        {/* Mobile Tab 2: Special View */}
        {mobileTab === 'special' && !activeChat && (
          <div className="md:hidden flex-1 flex flex-col h-full">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-header)] font-bold text-sm">
              <span>Special Extension Slot</span>
              <button
                onClick={() => setMobileTab('chats')}
                className="text-xs text-[var(--color-accent)] font-semibold"
              >
                Back to Chats
              </button>
            </div>
            <SpecialView />
          </div>
        )}

        {/* Conversation List / Sidebar */}
        <div
          className={`w-full md:w-80 lg:w-96 h-full flex-col ${
            activeChat || (mobileTab === 'special') ? 'hidden md:flex' : 'flex'
          }`}
        >
          <Sidebar
            onOpenAccount={() => setIsAccountOpen(true)}
            onOpenSpecial={() => setIsSpecialOpen(true)}
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

      <SpecialChatModal
        isOpen={isSpecialOpen}
        onClose={() => setIsSpecialOpen(false)}
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

      {/* Showcase Demo Toolbar for live meeting presentations */}
      <ShowcaseDemoToolbar />
    </div>
  );
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;
