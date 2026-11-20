import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import { AuthState, BotAccount, LoginCredentials } from '../types/auth';

interface AuthContextValue extends AuthState {
  login: (creds: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  isMockMode: boolean;
  setMockMode: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const savedAccount = localStorage.getItem('tg_bot_account');
    const savedToken = localStorage.getItem('tg_bot_token');
    return {
      isAuthenticated: Boolean(savedAccount && savedToken),
      account: savedAccount ? JSON.parse(savedAccount) : null,
      token: savedToken || null,
      isLoading: false,
      error: null
    };
  });

  const [isMockMode, setIsMockModeState] = useState<boolean>(() => api.isMockMode());

  const setMockMode = (enabled: boolean) => {
    api.setMockMode(enabled);
    setIsMockModeState(enabled);
  };

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (authState.isAuthenticated && authState.account?.userId) {
      wsService.connect(authState.account.userId, authState.token);
    } else {
      wsService.disconnect();
    }
  }, [authState.isAuthenticated, authState.account?.userId, authState.token]);

  const login = async (creds: LoginCredentials) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { account, token } = await api.login(creds);
      localStorage.setItem('tg_bot_account', JSON.stringify(account));
      localStorage.setItem('tg_bot_token', token);

      setAuthState({
        isAuthenticated: true,
        account,
        token,
        isLoading: false,
        error: null
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: msg
      }));
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('tg_bot_account');
    localStorage.removeItem('tg_bot_token');
    wsService.disconnect();
    setAuthState({
      isAuthenticated: false,
      account: null,
      token: null,
      isLoading: false,
      error: null
    });
  };

  const refreshUserData = async () => {
    if (!authState.account?.userId) return;
    try {
      const refreshed = await api.checkUserData(authState.account.userId, authState.token || undefined);
      const updatedAccount: BotAccount = { ...authState.account, ...refreshed };
      localStorage.setItem('tg_bot_account', JSON.stringify(updatedAccount));
      setAuthState(prev => ({ ...prev, account: updatedAccount }));
    } catch (e) {
      console.warn('Failed to refresh bot user data:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, refreshUserData, isMockMode, setMockMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
