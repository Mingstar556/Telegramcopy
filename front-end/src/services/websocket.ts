import { ChatMessage, OutgoingBackendPayload } from '../types/chat';
import { getWsBaseUrl, resolveMediaUrl } from './api';

export type MessageListener = (message: ChatMessage) => void;
export type StatusListener = (connected: boolean) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private isConnected: boolean = false;
  private reconnectTimer: number | null = null;
  private pingInterval: number | null = null;
  private reconnectAttempts: number = 0;
  private currentUserId: string | null = null;
  private isEnabled: boolean = true;
  private hasBoundEvents: boolean = false;

  constructor() {
    this.setupLifecycleListeners();
  }

  private setupLifecycleListeners() {
    if (typeof window === 'undefined' || this.hasBoundEvents) return;
    this.hasBoundEvents = true;

    // Immediately re-establish live socket when browser reconnects to internet
    window.addEventListener('online', () => {
      console.log('[WebSocket] Network back online; triggering fast reconnect');
      this.reconnectNow();
    });

    // Immediately wake up and reconnect when user tabs back or unlocks screen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (!this.isConnected && this.currentUserId && this.isEnabled) {
          console.log('[WebSocket] Tab focused/visible; triggering instant reconnect');
          this.reconnectNow();
        }
      }
    });
  }

  public connect(userId: string, token?: string | null) {
    this.currentUserId = userId;
    const resolvedToken = token || localStorage.getItem('tg_bot_token');
    if (!this.isEnabled) return;

    // Close any dead or transitioning socket before opening a new one
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      if (this.isConnected) return;
    }

    try {
      const wsBase = getWsBaseUrl();
      const tokenParam = resolvedToken ? `&token=${encodeURIComponent(resolvedToken)}` : '';
      const url = `${wsBase}?user_id=${encodeURIComponent(userId)}${tokenParam}`;
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('[WebSocket] Connected with low-latency channel:', url);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyStatus(true);
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle heartbeat pong response silently
          if (data.type === 'pong' || data.action === 'pong') {
            return;
          }

          // Handle server ACK
          if (data.action === 'ack') {
            return;
          }

          const isOutgoing = data["is_outgoing"] !== undefined
            ? Boolean(data["is_outgoing"])
            : (data["User-ID"] === userId && data.action === 'sent');

          const rawMedia = data.media;
          const rawAlbum = data.album;
          const incomingMessage: ChatMessage = {
            id: data.id || 'ws_' + Date.now(),
            senderId: isOutgoing ? userId : (data["sender_id"] || data["from_user"] || data["to-user"] || data.userId),
            senderName: data.sender_name,
            senderAvatar: resolveMediaUrl(data.sender_avatar || data.senderAvatar || data.avatar),
            toUser: isOutgoing ? (data["to-user"] || data["to_user"] || data.chatId) : (data["User-ID"] || userId || data.chatId),
            message: data.message || '',
            timestamp: data.timestamp ? Number(data.timestamp) : Date.now(),
            isOutgoing,
            status: data.status || 'delivered',
            action: data.action,
            reaction: data.reaction || (data.messageId ? {
              message_id: data.messageId,
              emoji: data.emoji || data.message || '',
              old_emoji: data.old_emoji || data.oldEmoji,
              is_removed: Boolean(data.is_removed || data.isRemoved)
            } : undefined),
            is_removed: Boolean(data.is_removed || data.isRemoved || data.reaction?.is_removed),
            sticker: data.action === 'reaction' ? undefined : data.sticker,
            media: rawMedia ? {
              ...rawMedia,
              url: resolveMediaUrl(rawMedia.url)
            } : undefined,
            mediaGroupId: data.media_group_id || data.mediaGroupId,
            album: Array.isArray(rawAlbum) ? rawAlbum.map((item: any) => ({
              ...item,
              url: resolveMediaUrl(item.url)
            })) : undefined
          };
          this.notifyMessage(incomingMessage);
        } catch (err) {
          console.warn('[WebSocket] Error parsing incoming message:', err);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = (error) => {
        console.warn('[WebSocket] Connection error (Channels unreachable):', error);
        this.socket?.close();
      };
    } catch (e) {
      console.warn('[WebSocket] Could not instantiate WebSocket:', e);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Keep connection hot every 20 seconds, avoiding proxy timeouts
    this.pingInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    // Fast exponential backoff: 800ms -> 1200ms -> 1800ms -> max 3500ms
    const delay = Math.min(800 * Math.pow(1.5, this.reconnectAttempts), 3500);
    this.reconnectAttempts++;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentUserId && this.isEnabled) {
        this.connect(this.currentUserId);
      }
    }, delay);
  }

  public reconnectNow() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    if (this.currentUserId && this.isEnabled) {
      this.connect(this.currentUserId);
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.notifyStatus(false);
  }

  public isLive(): boolean {
    return this.isConnected && this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public send(payload: OutgoingBackendPayload): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  public onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  public onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyMessage(msg: ChatMessage) {
    this.messageListeners.forEach(listener => listener(msg));
  }

  private notifyStatus(status: boolean) {
    this.statusListeners.forEach(listener => listener(status));
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.disconnect();
    } else if (this.currentUserId) {
      this.connect(this.currentUserId);
    }
  }
}

export const wsService = new WebSocketService();
