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
  languageCode?: string;
  isPremium?: boolean;
}

export interface MediaItem {
  type: 'photo' | 'video' | 'voice' | 'file';
  url: string;
  duration?: number; // for audio/video in seconds
  fileName?: string;
  fileSize?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  preview_blur?: string;
  waveform?: number[];
  file_hash?: string;
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
  seqno?: number;
  pts?: number;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  toUser: string;
  message: string;
  timestamp: number;
  isOutgoing: boolean; // true if sent by the bot (logged-in user)
  status: 'pending' | 'sent' | 'delivered' | 'read';
  action?: 'send_message' | 'send_sticker' | 'send_media' | 'send_photo' | 'send_video' | 'send_file' | 'typing' | 'status_check' | 'reaction' | 'delete_message' | 'read_receipt';
  file_hash?: string;
  preview_blur?: string;
  waveform?: number[];
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
  mediaGroupId?: string;
  forwardedFrom?: string;
  replyTo?: {
    id: string;
    senderName: string;
    message: string;
  };
  reactions?: MessageReaction[];
  reaction?: {
    message_id: string;
    emoji: string;
    old_emoji?: string;
    is_removed?: boolean;
  };
  is_removed?: boolean;
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
  isMuted?: boolean;
}

export interface OutgoingBackendPayload {
  "User-ID": string;
  "to-user": string;
  "message": string;
  "action": string;
  "employee_id"?: string;
  "to_userid"?: string;
  "file"?: string;
  "video"?: string;
  "caption"?: string;
  "Action"?: string;
  "token"?: string;
  "session_token"?: string;
  "sticker"?: {
    id: string;
    packId: string;
    emoji: string;
    url?: string;
  };
  "media"?: MediaItem;
  "album"?: MediaItem[];
  "media_group_id"?: string;
  "forwarded_from"?: string;
  "message_id"?: string;
  "delete_for_everyone"?: boolean;
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
