export interface BotAccount {
  userId: string; // The User-ID
  botName: string;
  botUsername: string;
  avatar?: string;
  description?: string;
  assignedToken?: string;
  connectedAt?: string;
  bio?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  account: BotAccount | null;
  token: string | null;
  accounts: BotAccount[]; // All registered/saved accounts for multi-account switcher
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  userId: string;
  password: string;
}

export interface GeneratedAccount {
  userId: string;
  password: string;
  botName: string;
  botUsername: string;
  botToken: string;
  botTokenMasked: string;
  avatar?: string;
  status: 'created' | 'updated';
  telegramVerified: boolean;
  telegramError?: string | null;
}

export interface GenerateAccountsPayload {
  tokens?: string[];
  count?: number;
  idPrefix?: string;
  passwordType?: 'memorable' | 'random' | 'custom';
  customPassword?: string;
  fetchTelegramInfo?: boolean;
  overwrite?: boolean;
}

export interface GenerateAccountsResponse {
  status: 'success' | 'error';
  message: string;
  totalRequested: number;
  totalGenerated: number;
  accounts: GeneratedAccount[];
  errors?: string[] | null;
}

