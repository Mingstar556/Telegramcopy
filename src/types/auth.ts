export interface BotAccount {
  userId: string; // The User-ID
  botName: string;
  botUsername: string;
  avatar?: string;
  description?: string;
  assignedToken?: string;
  connectedAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  account: BotAccount | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  userId: string;
  password: string;
}
