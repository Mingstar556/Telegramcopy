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
  bio?: string;
  phone?: string;
}

export interface MediaItem {
  type: 'photo' | 'video' | 'voice' | 'file';
  url: string;
  duration?: number; // for audio/video in seconds
  fileName?: string;
  fileSize?: string;
  thumbnailUrl?: string;
  mimeType?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs who reacted
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  toUser: string;
  message: string;
  timestamp: number;
  isOutgoing: boolean; // true if sent by the bot (logged-in user)
  status: 'pending' | 'sent' | 'delivered' | 'read';
  action?: 'send_message' | 'send_sticker' | 'send_media' | 'send_photo' | 'typing' | 'status_check' | 'reaction' | 'delete_message';
  sticker?: {
    id: string;
    packId: string;
    url: string;
    emoji: string;
    name: string;
    isCustom?: boolean;
  };
  media?: MediaItem;
  album?: MediaItem[]; // For multiple images / media gallery
  forwardedFrom?: string;
  replyTo?: {
    id: string;
    senderName: string;
    message: string;
  };
  reactions?: MessageReaction[];
  reply_markup?: InlineKeyboardMarkup;
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
  "album"?: MediaItem[];
  "forwarded_from"?: string;
  "reaction"?: {
    message_id: string;
    emoji: string;
  };
  "reply_markup"?: InlineKeyboardMarkup;
}

export interface StickerItem {
  id: string;
  packId: string;
  emoji: string;
  name: string;
  svgContent?: string;
  url?: string;
  isCustom?: boolean;
}

export interface StickerPack {
  id: string;
  title: string;
  icon: string;
  stickers: StickerItem[];
}
