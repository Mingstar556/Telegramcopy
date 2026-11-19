import { BotAccount, LoginCredentials } from '../types/auth';
import { ChatConversation, ChatMessage, OutgoingBackendPayload } from '../types/chat';
import { INITIAL_MOCK_CONVERSATIONS, INITIAL_MOCK_MESSAGES, MOCK_BOT_USER } from './mockData';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const USE_MOCK_DEFAULT = import.meta.env.VITE_USE_MOCK !== 'false';

class ApiService {
  private useMock: boolean = USE_MOCK_DEFAULT;

  public setMockMode(enabled: boolean) {
    this.useMock = enabled;
  }

  public isMockMode(): boolean {
    return this.useMock;
  }

  /**
   * Check connection to Django backend
   */
  async checkHealth(): Promise<{ status: 'ok' | 'error'; message: string }> {
    if (this.useMock) {
      return { status: 'ok', message: 'Running in Local Mock Mode' };
    }
    try {
      const res = await fetch(`${API_BASE}/api/health/`, { method: 'GET' });
      if (res.ok) {
        return { status: 'ok', message: 'Django Backend Connected' };
      }
      return { status: 'error', message: `Server responded with ${res.status}` };
    } catch {
      return { status: 'error', message: 'Cannot reach Django at ' + API_BASE };
    }
  }

  /**
   * User logs in with User-ID and Password assigned to the Telegram Bot
   */
  async login(creds: LoginCredentials): Promise<{ account: BotAccount; token: string }> {
    if (this.useMock) {
      // Simulate network request
      await new Promise(r => setTimeout(r, 600));

      const isTestAccount = creds.userId === '1234' && creds.password === '1234';
      const isLegacyTest = creds.userId === 'bot_89201948' && creds.password === 'django_secret_pass';

      if (!isTestAccount && !isLegacyTest) {
        throw new Error('INVALID_CREDENTIALS');
      }

      const botName = isTestAccount ? 'Telegram Operator (1234)' : MOCK_BOT_USER.botName;
      const botUsername = isTestAccount ? 'test_bot_1234' : MOCK_BOT_USER.botUsername;

      const account: BotAccount = {
        userId: creds.userId,
        botName: botName,
        botUsername: botUsername,
        avatar: MOCK_BOT_USER.avatar,
        description: 'Telegram bot operator session actively connected to Python/Django backend.',
        assignedToken: 'tg_sec_token_' + Math.random().toString(36).substring(2, 10),
        connectedAt: new Date().toLocaleTimeString()
      };
      return { account, token: account.assignedToken! };
    }

    const res = await fetch(`${API_BASE}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "User-ID": creds.userId,
        password: creds.password
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'INVALID_CREDENTIALS');
    }

    const data = await res.json();
    return {
      account: {
        userId: data["User-ID"] || creds.userId,
        botName: data.bot_name || data.name || 'Telegram Bot',
        botUsername: data.bot_username || data.username || 'bot',
        avatar: data.avatar,
        description: data.description,
        assignedToken: data.token,
        connectedAt: new Date().toLocaleTimeString()
      },
      token: data.token
    };
  }

  /**
   * Request / Check bot user data from backend
   */
  async checkUserData(userId: string, token?: string): Promise<BotAccount> {
    if (this.useMock) {
      await new Promise(r => setTimeout(r, 200));
      return {
        ...MOCK_BOT_USER,
        userId: userId || MOCK_BOT_USER.userId
      };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/user/profile/?User-ID=${encodeURIComponent(userId)}`, {
      headers
    });

    if (!res.ok) {
      throw new Error('Failed to fetch user data from Django');
    }

    const data = await res.json();
    return {
      userId: data["User-ID"] || userId,
      botName: data.bot_name || 'Telegram Bot',
      botUsername: data.bot_username || 'bot',
      avatar: data.avatar,
      description: data.description,
      connectedAt: data.connected_at
    };
  }

  /**
   * Fetch chat list from Django backend
   */
  async fetchConversations(userId: string, token?: string): Promise<ChatConversation[]> {
    if (this.useMock) {
      return INITIAL_MOCK_CONVERSATIONS;
    }

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/chats/?User-ID=${encodeURIComponent(userId)}`, {
      headers
    });

    if (!res.ok) {
      throw new Error('Failed to retrieve chat conversations');
    }

    return await res.json();
  }

  /**
   * Fetch message history for a specific conversation
   */
  async fetchMessages(userId: string, toUser: string, token?: string): Promise<ChatMessage[]> {
    if (this.useMock) {
      return INITIAL_MOCK_MESSAGES[toUser] || [];
    }

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `${API_BASE}/api/messages/?User-ID=${encodeURIComponent(userId)}&to-user=${encodeURIComponent(toUser)}`,
      { headers }
    );

    if (!res.ok) {
      throw new Error('Failed to fetch chat history');
    }

    return await res.json();
  }

  /**
   * Send message to backend matching exact requirement:
   * { "User-ID": ..., "to-user": ..., "message": ..., "action": ... }
   */
  async sendMessage(payload: OutgoingBackendPayload, token?: string): Promise<{ success: boolean; messageId?: string }> {
    console.log('[API Outgoing Payload]', payload);

    if (this.useMock) {
      // Return simulated success
      await new Promise(r => setTimeout(r, 150));
      return { success: true, messageId: 'msg_' + Date.now() };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/messages/send/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to send message to Django backend');
    }

    const data = await res.json();
    return { success: true, messageId: data.message_id || data.id };
  }

  /**
   * Upload media file (photo, video, voice note) to backend
   */
  async uploadMedia(file: File | Blob, filename: string, token?: string): Promise<{ success: boolean; url: string }> {
    if (this.useMock) {
      const url = URL.createObjectURL(file);
      return { success: true, url };
    }

    try {
      const formData = new FormData();
      formData.append('file', file, filename);

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/media/upload/`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      return { success: true, url: data.url };
    } catch (err) {
      console.warn('Backend upload failed, falling back to local ObjectURL:', err);
      return { success: true, url: URL.createObjectURL(file) };
    }
  }
}

export const api = new ApiService();
