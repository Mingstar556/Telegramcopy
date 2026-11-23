import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import { AuthState, BotAccount, LoginCredentials } from '../types/auth';
import { getStoredItem, setStoredItem } from '../utils/storage';

interface AuthContextValue extends AuthState {
  login: (creds: LoginCredentials) => Promise<void>;
  addAccount: (creds: LoginCredentials) => Promise<void>;
  switchAccount: (userId: string) => void;
  removeAccount: (userId: string) => void;
  logout: () => void;
  refreshUserData: () => Promise<void>;
  updateBotAvatar: (file: File) => Promise<string>;
  removeBotAvatar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const savedAccount = localStorage.getItem('tg_bot_account');
    const savedToken = localStorage.getItem('tg_bot_token');
    const savedAccounts = getStoredItem<BotAccount[]>('tg_saved_accounts', []);

    let parsedAccount: BotAccount | null = null;
    try {
      parsedAccount = savedAccount ? JSON.parse(savedAccount) : null;
    } catch {
      parsedAccount = null;
    }

    // Ensure active account is in accounts list
    let allAccounts = savedAccounts;
    if (parsedAccount && !allAccounts.some(a => a.userId === parsedAccount?.userId)) {
      allAccounts = [parsedAccount, ...allAccounts];
      setStoredItem('tg_saved_accounts', allAccounts);
    }

    return {
      isAuthenticated: Boolean(parsedAccount && savedToken),
      account: parsedAccount,
      token: savedToken || null,
      accounts: allAccounts,
      isLoading: false,
      error: null
    };
  });

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (authState.isAuthenticated && authState.account?.userId) {
      wsService.connect(authState.account.userId, authState.token);
    } else {
      wsService.disconnect();
    }
  }, [authState.isAuthenticated, authState.account?.userId, authState.token]);

  // Sync session state across multiple browser windows / tabs in real time
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tg_bot_account' || e.key === 'tg_bot_token' || e.key === 'tg_saved_accounts') {
        const savedAccount = localStorage.getItem('tg_bot_account');
        const savedToken = localStorage.getItem('tg_bot_token');
        const savedAccounts = getStoredItem<BotAccount[]>('tg_saved_accounts', []);

        let parsedAccount: BotAccount | null = null;
        try {
          parsedAccount = savedAccount ? JSON.parse(savedAccount) : null;
        } catch {
          parsedAccount = null;
        }

        setAuthState(prev => ({
          ...prev,
          isAuthenticated: Boolean(parsedAccount && savedToken),
          account: parsedAccount,
          token: savedToken || null,
          accounts: savedAccounts.length > 0 ? savedAccounts : prev.accounts
        }));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = async (creds: LoginCredentials) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { account, token } = await api.login(creds);
      localStorage.setItem('tg_bot_account', JSON.stringify(account));
      localStorage.setItem('tg_bot_token', token);
      localStorage.setItem(`tg_bot_token_${account.userId}`, token);

      setAuthState(prev => {
        const otherAccounts = prev.accounts.filter(a => a.userId !== account.userId);
        const updatedAccounts = [account, ...otherAccounts];
        setStoredItem('tg_saved_accounts', updatedAccounts);

        return {
          ...prev,
          isAuthenticated: true,
          account,
          token,
          accounts: updatedAccounts,
          isLoading: false,
          error: null
        };
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

  const addAccount = async (creds: LoginCredentials) => {
    await login(creds);
  };

  const switchAccount = (userId: string) => {
    const target = authState.accounts.find(a => a.userId === userId);
    if (!target) return;

    const targetToken = localStorage.getItem(`tg_bot_token_${userId}`) || target.assignedToken || '';

    localStorage.setItem('tg_bot_account', JSON.stringify(target));
    localStorage.setItem('tg_bot_token', targetToken);

    wsService.disconnect();

    setAuthState(prev => ({
      ...prev,
      account: target,
      token: targetToken,
      isAuthenticated: true
    }));
  };

  const removeAccount = (userId: string) => {
    const updated = authState.accounts.filter(a => a.userId !== userId);
    setStoredItem('tg_saved_accounts', updated);
    localStorage.removeItem(`tg_bot_token_${userId}`);

    if (authState.account?.userId === userId) {
      if (updated.length > 0) {
        switchAccount(updated[0].userId);
      } else {
        logout();
      }
    } else {
      setAuthState(prev => ({ ...prev, accounts: updated }));
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
      accounts: [],
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
      setAuthState(prev => {
        const updatedAccounts = prev.accounts.map(a =>
          a.userId === updatedAccount.userId ? updatedAccount : a
        );
        setStoredItem('tg_saved_accounts', updatedAccounts);
        return {
          ...prev,
          account: updatedAccount,
          accounts: updatedAccounts
        };
      });
    } catch (e) {
      console.warn('Failed to refresh bot user data:', e);
    }
  };

  const updateBotAvatar = async (file: File): Promise<string> => {
    if (!authState.account?.userId) throw new Error('Not authenticated');
    const { avatarUrl } = await api.updateBotAvatar(file, authState.token || undefined, authState.account.userId);
    const updatedAccount: BotAccount = { ...authState.account, avatar: avatarUrl };
    localStorage.setItem('tg_bot_account', JSON.stringify(updatedAccount));
    setAuthState(prev => {
      const updatedAccounts = prev.accounts.map(a =>
        a.userId === updatedAccount.userId ? updatedAccount : a
      );
      setStoredItem('tg_saved_accounts', updatedAccounts);
      return {
        ...prev,
        account: updatedAccount,
        accounts: updatedAccounts
      };
    });
    return avatarUrl;
  };

  const removeBotAvatar = async (): Promise<void> => {
    if (!authState.account?.userId) throw new Error('Not authenticated');
    await api.removeBotAvatar(authState.token || undefined, authState.account.userId);
    const updatedAccount: BotAccount = { ...authState.account, avatar: '' };
    localStorage.setItem('tg_bot_account', JSON.stringify(updatedAccount));
    setAuthState(prev => {
      const updatedAccounts = prev.accounts.map(a =>
        a.userId === updatedAccount.userId ? updatedAccount : a
      );
      setStoredItem('tg_saved_accounts', updatedAccounts);
      return {
        ...prev,
        account: updatedAccount,
        accounts: updatedAccounts
      };
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        addAccount,
        switchAccount,
        removeAccount,
        logout,
        refreshUserData,
        updateBotAvatar,
        removeBotAvatar
      }}
    >
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
