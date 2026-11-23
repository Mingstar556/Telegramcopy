import { ChatMessage, OutgoingBackendPayload } from '../types/chat';
import { getWsBaseUrl, resolveMediaUrl } from './api';

export type MessageListener = (message: ChatMessage) => void;
export type StatusListener = (connected: boolean) => void;

export interface ConnectionDiagnostics {
  connected: boolean;
  readyState: number;
  targetUrl: string;
  reconnectAttempts: number;
  queuedMessages: number;
  lastPing: number | null;
  lastPong: number | null;
  latencyMs: number;
  lastCloseCode: number | null;
  lastCloseReason: string | null;
}

function getCloseReasonText(code: number): string {
  switch (code) {
    case 1000: return 'Normal closure';
    case 1001: return 'Going away (client or server restart)';
    case 1002: return 'Protocol error';
    case 1003: return 'Unsupported data';
    case 1006: return 'Abnormal closure (network drop, TCP RST, or unreachable host)';
    case 1015: return 'TLS handshake failure (invalid or untrusted certificate)';
    case 4001: return 'Unauthorized session or expired bot token';
    case 4003: return 'Forbidden connection';
    default: return `Closed with code ${code}`;
  }
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private isConnected: boolean = false;
  private reconnectTimer: number | null = null;
  private connectTimeoutTimer: number | null = null;
  private pingInterval: number | null = null;
  private pongWatchdogTimer: number | null = null;
  private reconnectAttempts: number = 0;
  private currentUserId: string | null = null;
  private isEnabled: boolean = true;
  private hasBoundEvents: boolean = false;

  // Local unsent message queue
  private outgoingQueue: OutgoingBackendPayload[] = [];
  private readonly maxQueueSize: number = 100;

  // Diagnostics
  private targetUrl: string = '';
  private lastPingTime: number | null = null;
  private lastPongTime: number | null = null;
  private latencyMs: number = 0;
  private lastCloseCode: number | null = null;
  private lastCloseReason: string | null = null;

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

    // Cleanly tear down socket when network interface drops
    window.addEventListener('offline', () => {
      console.warn('[WebSocket] Network offline detected; pausing socket');
      this.disconnectSocketOnly();
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
    const resolvedToken = token || (typeof window !== 'undefined' ? localStorage.getItem('tg_bot_token') : null);
    if (!this.isEnabled) return;

    // Close any dead or transitioning socket before opening a new one
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      if (this.isConnected) return;
    }

    this.clearTimers();

    try {
      const wsBase = getWsBaseUrl();
      const tokenParam = resolvedToken ? `&token=${encodeURIComponent(resolvedToken)}` : '';
      const url = `${wsBase}?user_id=${encodeURIComponent(userId)}${tokenParam}`;
      this.targetUrl = wsBase;

      console.log(`[WebSocket] Connecting to ${wsBase} (attempt ${this.reconnectAttempts + 1})`);
      this.socket = new WebSocket(url);

      // Explicit connect timeout: 8 seconds (abort hung sockets)
      this.connectTimeoutTimer = window.setTimeout(() => {
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          console.warn(`[WebSocket] Connect timeout (8s) reaching ${wsBase}. Aborting socket.`);
          this.socket.close(1006, 'Connect timeout');
        }
      }, 8000);

      this.socket.onopen = () => {
        if (this.connectTimeoutTimer) {
          clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }
        console.log('[WebSocket] Connected with low-latency channel:', wsBase);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.lastCloseCode = null;
        this.lastCloseReason = null;
        this.notifyStatus(true);
        this.startHeartbeat();

        // Flush locally queued unsent messages
        this.flushOutgoingQueue();
      };

      this.socket.onmessage = (event) => {
        // Clear pong watchdog whenever server sends data
        if (this.pongWatchdogTimer) {
          clearTimeout(this.pongWatchdogTimer);
          this.pongWatchdogTimer = null;
        }

        try {
          const data = JSON.parse(event.data);

          // Handle heartbeat pong response
          if (data.type === 'pong' || data.action === 'pong') {
            this.lastPongTime = Date.now();
            if (this.lastPingTime) {
              this.latencyMs = this.lastPongTime - this.lastPingTime;
            }
            return;
          }

          // Handle server Quick ACK with seqno / pts
          if (data.action === 'ack') {
            if (data.id && (data.seqno || data.status)) {
              this.notifyMessage({
                id: data.id,
                seqno: data.seqno || data.pts,
                pts: data.pts || data.seqno,
                senderId: userId,
                toUser: '',
                message: '',
                timestamp: Date.now(),
                isOutgoing: true,
                status: (data.status === 'sent' ? 'sent' : 'delivered'),
                action: 'status_check'
              });
            }
            return;
          }

          const isOutgoing = data["is_outgoing"] !== undefined
            ? Boolean(data["is_outgoing"])
            : (data["User-ID"] === userId && data.action === 'sent');

          const rawMedia = data.media;
          const rawAlbum = data.album;
          const incomingMessage: ChatMessage = {
            id: data.id || 'ws_' + Date.now(),
            seqno: data.seqno || data.pts,
            pts: data.pts || data.seqno,
            senderId: isOutgoing ? userId : (data["sender_id"] || data["from_user"] || data["to-user"] || data.userId),
            senderName: data.sender_name,
            senderAvatar: resolveMediaUrl(data.sender_avatar || data.senderAvatar || data.avatar),
            toUser: isOutgoing ? (data["to-user"] || data["to_user"] || data.chatId) : (data["User-ID"] || userId || data.chatId),
            message: data.message || '',
            timestamp: data.timestamp ? Number(data.timestamp) : Date.now(),
            isOutgoing,
            status: data.status || 'delivered',
            action: data.action,
            file_hash: data.file_hash || (rawMedia && rawMedia.file_hash),
            preview_blur: data.preview_blur || (rawMedia && rawMedia.preview_blur),
            waveform: data.waveform || (rawMedia && rawMedia.waveform),
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

      this.socket.onclose = (event) => {
        this.lastCloseCode = event.code;
        this.lastCloseReason = event.reason || getCloseReasonText(event.code);
        console.warn(`[WebSocket] Closed: code ${event.code} (${this.lastCloseReason}) on ${this.targetUrl}`);

        this.isConnected = false;
        this.stopHeartbeat();
        this.notifyStatus(false);
        this.scheduleReconnect();
      };

      this.socket.onerror = (error) => {
        console.warn('[WebSocket] Connection error (Channels unreachable / TLS error):', error);
        this.socket?.close();
      };
    } catch (e) {
      console.warn('[WebSocket] Could not instantiate WebSocket:', e);
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    // Keep connection hot every 20 seconds, avoiding NAT/firewall drop
    this.pingInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.socket.send(JSON.stringify({ type: 'ping', timestamp: this.lastPingTime }));

        // Heartbeat watchdog: expect pong/message within 12s
        if (this.pongWatchdogTimer) clearTimeout(this.pongWatchdogTimer);
        this.pongWatchdogTimer = window.setTimeout(() => {
          console.warn('[WebSocket] Heartbeat timeout - no pong received in 12s. Reconnecting.');
          this.socket?.close(1006, 'Heartbeat timeout');
        }, 12000);
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongWatchdogTimer) {
      clearTimeout(this.pongWatchdogTimer);
      this.pongWatchdogTimer = null;
    }
  }

  private clearTimers() {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    // Exponential backoff with jitter: base 1000ms -> 1500ms -> 2250ms -> max 10000ms
    const baseDelay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    const jitter = 0.8 + Math.random() * 0.4; // 80% to 120% jitter
    const delay = Math.round(baseDelay * jitter);
    this.reconnectAttempts++;

    console.log(`[WebSocket] Scheduled reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.currentUserId && this.isEnabled) {
        this.connect(this.currentUserId);
      }
    }, delay);
  }

  public reconnectNow() {
    this.clearTimers();
    this.reconnectAttempts = 0;
    if (this.currentUserId && this.isEnabled) {
      this.connect(this.currentUserId);
    }
  }

  private disconnectSocketOnly() {
    this.stopHeartbeat();
    this.clearTimers();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.notifyStatus(false);
  }

  public disconnect() {
    this.disconnectSocketOnly();
    this.currentUserId = null;
    this.outgoingQueue = [];
  }

  public isLive(): boolean {
    return this.isConnected && this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Send payload via WebSocket. If offline, buffer locally and flush when reconnected.
   */
  public send(payload: OutgoingBackendPayload): boolean {
    if (this.isLive()) {
      this.socket!.send(JSON.stringify(payload));
      return true;
    }

    // Buffer outgoing message while disconnected
    if (this.outgoingQueue.length < this.maxQueueSize) {
      this.outgoingQueue.push(payload);
      console.log(`[WebSocket] Message buffered while offline (Queue size: ${this.outgoingQueue.length})`);
    } else {
      console.warn('[WebSocket] Outgoing buffer full (100 messages). Dropping oldest.');
      this.outgoingQueue.shift();
      this.outgoingQueue.push(payload);
    }
    return false;
  }

  private flushOutgoingQueue() {
    if (this.outgoingQueue.length === 0 || !this.isLive()) return;
    console.log(`[WebSocket] Flushing ${this.outgoingQueue.length} buffered messages`);
    const queued = [...this.outgoingQueue];
    this.outgoingQueue = [];
    for (const item of queued) {
      this.socket!.send(JSON.stringify(item));
    }
  }

  public getDiagnostics(): ConnectionDiagnostics {
    return {
      connected: this.isConnected,
      readyState: this.socket ? this.socket.readyState : WebSocket.CLOSED,
      targetUrl: this.targetUrl,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.outgoingQueue.length,
      lastPing: this.lastPingTime,
      lastPong: this.lastPongTime,
      latencyMs: this.latencyMs,
      lastCloseCode: this.lastCloseCode,
      lastCloseReason: this.lastCloseReason
    };
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
