import { BotAccount, LoginCredentials, GenerateAccountsPayload, GenerateAccountsResponse, GeneratedAccount } from '../types/auth';
import { ChatConversation, ChatMessage, OutgoingBackendPayload } from '../types/chat';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('userbot_server_url');
    if (saved) return saved.replace(/\/+$/, '');
    if ((window as any).__USERBOT_CONFIG__?.apiBaseUrl) {
      return (window as any).__USERBOT_CONFIG__.apiBaseUrl.replace(/\/+$/, '');
    }
    // Dynamic network host detection: if accessed via LAN IP/hostname, point to that host on port 8000
    if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
}

export function setApiBaseUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    localStorage.setItem('userbot_server_url', clean);
  }
}

export function getWsBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const savedWs = localStorage.getItem('userbot_ws_url');
    if (savedWs) return savedWs;
    const apiBase = getApiBaseUrl();
    try {
      const parsed = new URL(apiBase);
      const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${parsed.host}/ws/chat/`;
    } catch {
      // fallback
    }
  }
  return import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8000/ws/chat/';
}

export function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Local object blobs and base64 data URIs
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Telegram Media API URLs (videos, photos, voices, files)
  // Proxy them through Django backend endpoint to bypass browser CORS and force inline streaming playback
  if (trimmed.includes('api.telegram.org/file/')) {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    return `${base}/api/media/proxy/?url=${encodeURIComponent(trimmed)}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const base = getApiBaseUrl().replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

export interface HealthCheckResult {
  status: 'ok' | 'error';
  database?: 'connected' | 'disconnected';
  message: string;
  botsCount?: number;
  serverUrl?: string;
}

class ApiService {
  public getBaseUrl(): string {
    return getApiBaseUrl();
  }

  /**
   * Check connection to Django backend and active database probe
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const base = this.getBaseUrl();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${base}/api/health/`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.database !== 'disconnected' && data.status !== 'error') {
        return {
          status: 'ok',
          database: 'connected',
          message: 'Connected to UserBot Server and Database',
          botsCount: data.bots_configured,
          serverUrl: base
        };
      }

      return {
        status: 'error',
        database: 'disconnected',
        message: data.error || (res.status === 503 ? 'Database is offline or locked' : `Server returned status ${res.status}`),
        serverUrl: base
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      return {
        status: 'error',
        database: 'disconnected',
        message: isTimeout
          ? `Connection timed out reaching ${base}`
          : `Cannot reach server at ${base}. Host appears offline.`,
        serverUrl: base
      };
    }
  }

  /**
   * User logs in with User-ID and Password assigned to the Telegram Bot
   */
  async login(creds: LoginCredentials): Promise<{ account: BotAccount; token: string }> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/api/auth/login/`, {
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
        avatar: resolveMediaUrl(data.avatar),
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
    const base = this.getBaseUrl();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${base}/api/user/profile/?User-ID=${encodeURIComponent(userId)}`, {
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
      avatar: resolveMediaUrl(data.avatar),
      description: data.description,
      connectedAt: data.connected_at
    };
  }

  /**
   * Change bot profile photo on Telegram and backend
   */
  async updateBotAvatar(file: File | Blob, token?: string, userId?: string): Promise<{ success: boolean; avatarUrl: string }> {
    const base = this.getBaseUrl();
    const formData = new FormData();
    formData.append('avatar', file);
    if (userId) formData.append('User-ID', userId);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${base}/api/user/profile/avatar/`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update bot avatar');
    }

    const data = await res.json();
    return {
      success: true,
      avatarUrl: resolveMediaUrl(data.avatar || data.avatar_url)
    };
  }

  /**
   * Remove bot profile photo
   */
  async removeBotAvatar(token?: string, userId?: string): Promise<{ success: boolean }> {
    const base = this.getBaseUrl();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const userParam = userId ? `?User-ID=${encodeURIComponent(userId)}` : '';

    const res = await fetch(`${base}/api/user/profile/avatar/${userParam}`, {
      method: 'DELETE',
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to remove bot avatar');
    }

    return { success: true };
  }

  /**
   * Fetch chat list from Django backend with optional Telegram auto-sync
   */
  async fetchConversations(userId: string, token?: string, sync?: boolean): Promise<ChatConversation[]> {
    const base = this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const syncParam = sync ? '&sync=true' : '';
    const res = await fetch(`${base}/api/chats/?User-ID=${encodeURIComponent(userId)}${syncParam}`, {
      headers
    });

    if (!res.ok) {
      throw new Error('Failed to retrieve chat conversations');
    }

    const rawConvs = await res.json();
    return (rawConvs || []).map((conv: ChatConversation) => ({
      ...conv,
      user: {
        ...conv.user,
        avatar: resolveMediaUrl(conv.user.avatar)
      },
      lastMessage: conv.lastMessage ? {
        ...conv.lastMessage,
        senderAvatar: resolveMediaUrl(conv.lastMessage.senderAvatar),
        media: conv.lastMessage.media ? {
          ...conv.lastMessage.media,
          url: resolveMediaUrl(conv.lastMessage.media.url)
        } : undefined
      } : undefined
    }));
  }

  /**
   * Fetch message history for a specific conversation
   */
  async fetchMessages(userId: string, toUser: string, token?: string): Promise<ChatMessage[]> {
    const base = this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `${base}/api/messages/?User-ID=${encodeURIComponent(userId)}&to-user=${encodeURIComponent(toUser)}`,
      { headers }
    );

    if (!res.ok) {
      throw new Error('Failed to fetch chat history');
    }

    const rawMsgs = await res.json();
    return (rawMsgs || []).map((msg: any) => ({
      ...msg,
      senderAvatar: resolveMediaUrl(msg.senderAvatar),
      media: msg.media ? {
        ...msg.media,
        url: resolveMediaUrl(msg.media.url)
      } : undefined,
      album: Array.isArray(msg.album) ? msg.album.map((item: any) => ({
        ...item,
        url: resolveMediaUrl(item.url)
      })) : undefined,
      mediaGroupId: msg.mediaGroupId || msg.media_group_id
    }));
  }

  /**
   * Send message to backend matching exact requirement:
   * { "User-ID": ..., "to-user": ..., "message": ..., "action": ... }
   */
  async sendMessage(payload: OutgoingBackendPayload, token?: string): Promise<{ success: boolean; messageId?: string }> {
    const base = this.getBaseUrl();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${base}/api/messages/send/`, {
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
   * Check if media already exists on server by SHA-256 hash
   */
  async checkMediaHash(fileHash: string): Promise<{ exists: boolean; url?: string; preview_blur?: string; waveform?: number[] }> {
    try {
      const base = this.getBaseUrl();
      const res = await fetch(`${base}/api/media/check-hash/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_hash: fileHash })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[checkMediaHash] lookup error:', e);
    }
    return { exists: false };
  }

  /**
   * Upload media file (photo, video, voice note) to backend with deduplication support
   */
  async uploadMedia(
    file: File | Blob,
    filename: string,
    token?: string,
    meta?: { file_hash?: string; preview_blur?: string; waveform?: number[] }
  ): Promise<{ success: boolean; url: string; preview_blur?: string; waveform?: number[] }> {
    try {
      const base = this.getBaseUrl();
      const formData = new FormData();
      formData.append('file', file, filename);
      if (meta?.file_hash) formData.append('file_hash', meta.file_hash);
      if (meta?.preview_blur) formData.append('preview_blur', meta.preview_blur);
      if (meta?.waveform) formData.append('waveform', JSON.stringify(meta.waveform));

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${base}/api/media/upload/`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      return { success: true, url: data.url, preview_blur: data.preview_blur };
    } catch (err) {
      console.warn('Backend upload failed, falling back to local ObjectURL:', err);
      return { success: true, url: URL.createObjectURL(file) };
    }
  }

  /**
   * Send photo to backend endpoint /api/send_photo/
   * Schema:
   * employee_id: string
   * to_userid: string
   * file: string (URL or path) or File object
   * caption?: string
   * Action: "send_photo"
   */
  async sendPhoto(payload: {
    employee_id: string;
    to_userid: string;
    file: string | File;
    caption?: string;
    action?: string;
  }, token?: string): Promise<{ success: boolean; messageId?: string }> {
    const base = this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let body: BodyInit;
    if (typeof payload.file !== 'string') {
      const formData = new FormData();
      formData.append('employee_id', payload.employee_id);
      formData.append('to_userid', payload.to_userid);
      formData.append('file', payload.file, payload.file.name);
      formData.append('Action', payload.action || 'send_photo');
      if (payload.caption) formData.append('caption', payload.caption);
      body = formData;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        employee_id: payload.employee_id,
        to_userid: payload.to_userid,
        file: payload.file,
        caption: payload.caption || '',
        Action: payload.action || 'send_photo'
      });
    }

    const res = await fetch(`${base}/api/send_photo/`, {
      method: 'POST',
      headers,
      body
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || 'Failed to send photo to backend');
    }

    const data = await res.json();
    return { success: true, messageId: data.message_id || data.id };
  }

  /**
   * Automatic Telegram Bot Account Generator
   * Generates web operator accounts from Telegram bot keys
   */
  async generateBotAccounts(payload: GenerateAccountsPayload): Promise<GenerateAccountsResponse> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/api/admin/generate-accounts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens: payload.tokens,
        count: payload.count,
        id_prefix: payload.idPrefix,
        password_type: payload.passwordType,
        custom_password: payload.customPassword,
        fetch_telegram_info: payload.fetchTelegramInfo ?? true,
        overwrite: payload.overwrite ?? true
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.detail || `Server returned error ${res.status}`);
    }

    const data = await res.json();
    return {
      status: data.status,
      message: data.message,
      totalRequested: data.total_requested,
      totalGenerated: data.total_generated,
      accounts: (data.accounts || []).map((a: any) => ({
        userId: a.user_id,
        password: a.password,
        botName: a.bot_name,
        botUsername: a.bot_username,
        botToken: a.bot_token,
        botTokenMasked: a.bot_token_masked,
        avatar: a.avatar,
        status: a.status,
        telegramVerified: a.telegram_verified,
        telegramError: a.telegram_error
      })),
      errors: data.errors
    };
  }

  async deleteMessage(userId: string, chatId: string, messageId: string, deleteForEveryone: boolean = true): Promise<{ success: boolean }> {
    const base = this.getBaseUrl();
    try {
      const res = await fetch(`${base}/api/messages/delete/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "User-ID": userId,
          "chat_id": chatId,
          "message_id": messageId,
          "delete_for_everyone": deleteForEveryone
        })
      });
      return { success: res.ok };
    } catch {
      return { success: false };
    }
  }

  async wipeChatHistory(userId: string, toUser?: string, wipeAll?: boolean, deleteChat?: boolean): Promise<{ success: boolean; deletedCount?: number }> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/api/chats/wipe/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "User-ID": userId,
        "to_user": toUser,
        "wipe_all": wipeAll ?? false,
        "delete_chat": deleteChat ?? false
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to wipe chat history');
    }
    const data = await res.json();
    return { success: true, deletedCount: data.deleted_count };
  }

  async listBotAccounts(): Promise<GeneratedAccount[]> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/api/admin/bot-accounts/`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    return (data.accounts || []).map((a: any) => ({
      userId: a.user_id,
      password: '***',
      botName: a.bot_name,
      botUsername: a.bot_username,
      botToken: a.bot_token_masked,
      botTokenMasked: a.bot_token_masked,
      avatar: a.avatar,
      status: a.is_active ? 'created' : 'updated',
      telegramVerified: true
    }));
  }
}

export const api = new ApiService();
