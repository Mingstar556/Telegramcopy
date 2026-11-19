import { ChatMessage, OutgoingBackendPayload } from '../types/chat';

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8000/ws/chat/';

export type MessageListener = (message: ChatMessage) => void;
export type StatusListener = (connected: boolean) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private isConnected: boolean = false;
  private reconnectTimer: number | null = null;
  private currentUserId: string | null = null;
  private isEnabled: boolean = true;

  public connect(userId: string) {
    this.currentUserId = userId;
    if (!this.isEnabled) return;

    try {
      const url = `${WS_BASE}?user_id=${encodeURIComponent(userId)}`;
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('[WebSocket] Connected to Django Channels:', url);
        this.isConnected = true;
        this.notifyStatus(true);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const isOutgoing = data["is_outgoing"] !== undefined
            ? Boolean(data["is_outgoing"])
            : (data["User-ID"] === userId && data.action === 'sent');

          const incomingMessage: ChatMessage = {
            id: data.id || 'ws_' + Date.now(),
            senderId: isOutgoing ? userId : (data["sender_id"] || data["from_user"] || data["to-user"]),
            senderName: data.sender_name,
            toUser: isOutgoing ? (data["to-user"] || data["to_user"]) : (data["User-ID"] || userId),
            message: data.message || '',
            timestamp: data.timestamp ? Number(data.timestamp) : Date.now(),
            isOutgoing,
            status: data.status || 'delivered',
            action: data.action,
            sticker: data.sticker,
            media: data.media
          };
          this.notifyMessage(incomingMessage);
        } catch (err) {
          console.warn('[WebSocket] Error parsing incoming message:', err);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = (error) => {
        console.warn('[WebSocket] Connection error (Django Channels offline or unreachable):', error);
        this.socket?.close();
      };
    } catch (e) {
      console.warn('[WebSocket] Could not instantiate WebSocket:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentUserId && this.isEnabled) {
        this.connect(this.currentUserId);
      }
    }, 5000);
  }

  public disconnect() {
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
