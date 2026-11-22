export interface TelegramUser {
  id: string; // The to-user or User-ID
  username?: string;
  firstName: string;
  lastName?: string;
  avatar?: string;
  isBot?: boolean;
  online?: boolean;
  lastSeen?: string;
  employeeBadge?: string;
}

export interface MediaItem {
  type: 'photo' | 'video' | 'voice';
  url: string;
  duration?: number; // for audio/video in seconds
  fileName?: string;
  fileSize?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  toUser: string;
  message: string;
  timestamp: number;
  isOutgoing: boolean; // true if sent by the bot (logged-in user)
  status: 'pending' | 'sent' | 'delivered' | 'read';
  action?: 'send_message' | 'send_sticker' | 'send_media' | 'send_photo' | 'typing' | 'status_check';
  sticker?: {
    id: string;
    packId: string;
    url: string;
    emoji: string;
    name: string;
  };
  media?: MediaItem;
  forwardedFrom?: string;
}

export interface ChatConversation {
  id: string; // matches the target user's id
  user: TelegramUser;
  unreadCount: number;
  lastMessage?: ChatMessage;
  draft?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  isSavedMessages?: boolean;
}

export interface OutgoingBackendPayload {
  "User-ID": string;
  "to-user": string;
  "message": string;
  "action": string;
  "employee_id"?: string;
  "to_userid"?: string;
  "file"?: string;
  "caption"?: string;
  "Action"?: string;
  "sticker"?: {
    id: string;
    packId: string;
    emoji: string;
  };
  "media"?: MediaItem;
}

export interface StickerItem {
  id: string;
  packId: string;
  emoji: string;
  name: string;
  svgContent?: string;
}

export interface StickerPack {
  id: string;
  title: string;
  icon: string;
  stickers: StickerItem[];
}

