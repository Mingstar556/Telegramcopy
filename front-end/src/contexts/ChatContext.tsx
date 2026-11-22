import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import { INITIAL_MOCK_CONVERSATIONS } from '../services/mockData';
import {
  ChatConversation,
  ChatMessage,
  InlineKeyboardButton,
  MediaItem,
  OutgoingBackendPayload,
  StickerItem,
  TelegramUser
} from '../types/chat';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useNotification } from './NotificationContext';
import { getStoredItem, setStoredItem } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';

interface ChatContextValue {
  conversations: ChatConversation[];
  archivedConversations: ChatConversation[];
  activeChat: ChatConversation | null;
  activeMessages: ChatMessage[];
  isLoading: boolean;
  typingStatus: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectChat: (chatId: string) => void;
  unseenChatIds: Record<string, boolean>;
  isChatUnseen: (chatId: string) => boolean;
  markChatSeen: (chatId: string) => void;
  sendMessage: (text: string) => Promise<void>;
  sendSticker: (sticker: StickerItem) => Promise<void>;
  sendMedia: (
    type: 'photo' | 'video' | 'voice' | 'file',
    fileOrUrl: File | Blob | string,
    duration?: number,
    caption?: string,
    fileName?: string,
    fileSize?: string
  ) => Promise<void>;
  sendAlbum: (
    photos: { file: File; caption?: string }[],
    generalCaption?: string
  ) => Promise<void>;
  toggleReaction: (chatId: string, messageId: string, emoji: string) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  undoDeleteMessage: () => boolean;
  canUndo: boolean;
  forwardMessage: (targetChatId: string, message: ChatMessage) => Promise<void>;
  archiveChat: (chatId: string, archive?: boolean) => void;
  saveMessageToSaved: (message: ChatMessage) => void;
  openSavedMessages: () => void;
  refreshChats: () => Promise<void>;
  clearChat: (chatId: string) => void;
  // Drafts
  setDraft: (chatId: string, draft: string) => void;
  getDraft: (chatId: string) => string;
  // User Profile
  selectedUserProfile: TelegramUser | null;
  openUserProfile: (user: TelegramUser) => void;
  closeUserProfile: () => void;
  // Inline Buttons Modal
  isInlineButtonModalOpen: boolean;
  openCreateInlineButton: () => void;
  closeCreateInlineButton: () => void;
  sendInlineButtonMessage: (text: string, inlineKeyboard: InlineKeyboardButton[][]) => Promise<void>;
  // Custom Stickers
  customStickers: StickerItem[];
  addCustomSticker: (sticker: StickerItem) => void;
  deleteCustomSticker: (stickerId: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { account, token, isAuthenticated } = useAuth();
  const { playSendSound, playReceiveSound } = useTheme();
  const { notify, dismissByChatId } = useNotification();

  const userId = account?.userId || '';

  // Local storage keys
  const CONVERSATIONS_KEY = `tg_convs_${userId}`;
  const MESSAGES_KEY = `tg_msgs_${userId}`;
  const DRAFTS_KEY = `tg_drafts_${userId}`;

  // State initialized with local storage cache so page refresh NEVER loses chats
  const [conversations, setConversations] = useState<ChatConversation[]>(() => {
    return userId ? getStoredItem<ChatConversation[]>(`tg_convs_${userId}`, []) : [];
  });

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(() => {
    return userId ? getStoredItem<Record<string, ChatMessage[]>>(`tg_msgs_${userId}`, {}) : {};
  });

  const [draftsByChat, setDraftsByChat] = useState<Record<string, string>>(() => {
    return userId ? getStoredItem<Record<string, string>>(`tg_drafts_${userId}`, {}) : {};
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typingChatIds, setTypingChatIds] = useState<Record<string, boolean>>({});
  const [unseenChatIds, setUnseenChatIds] = useState<Record<string, boolean>>({});

  // User Profile Modal state
  const [selectedUserProfile, setSelectedUserProfile] = useState<TelegramUser | null>(null);

  // Inline Button Modal state
  const [isInlineButtonModalOpen, setIsInlineButtonModalOpen] = useState<boolean>(false);
  const openCreateInlineButton = () => setIsInlineButtonModalOpen(true);
  const closeCreateInlineButton = () => setIsInlineButtonModalOpen(false);

  // Undo Delete message snapshot
  const lastDeletedRef = useRef<{ chatId: string; message: ChatMessage; index: number } | null>(null);
  const [canUndo, setCanUndo] = useState<boolean>(false);

  // Custom Stickers State (Persistent in local storage)
  const [customStickers, setCustomStickers] = useState<StickerItem[]>(() => {
    return getStoredItem<StickerItem[]>('tg_custom_stickers', []);
  });

  const addCustomSticker = (sticker: StickerItem) => {
    setCustomStickers(prev => {
      const updated = [sticker, ...prev.filter(s => s.id !== sticker.id)];
      setStoredItem('tg_custom_stickers', updated);
      return updated;
    });
    notify({
      title: 'Sticker Created',
      message: `"${sticker.name}" added to your Telegram sticker pack`,
      type: 'success'
    });
  };

  const deleteCustomSticker = (stickerId: string) => {
    setCustomStickers(prev => {
      const updated = prev.filter(s => s.id !== stickerId);
      setStoredItem('tg_custom_stickers', updated);
      return updated;
    });
    notify({
      title: 'Sticker Removed',
      message: 'Sticker removed from your collection',
      type: 'info'
    });
  };

  // Sync state to local storage when changed
  useEffect(() => {
    if (userId && conversations.length > 0) {
      setStoredItem(CONVERSATIONS_KEY, conversations);
    }
  }, [conversations, userId]);

  useEffect(() => {
    if (userId && Object.keys(messagesByChat).length > 0) {
      setStoredItem(MESSAGES_KEY, messagesByChat);
    }
  }, [messagesByChat, userId]);

  useEffect(() => {
    if (userId) {
      setStoredItem(DRAFTS_KEY, draftsByChat);
    }
  }, [draftsByChat, userId]);

  const markChatSeen = (chatId: string) => {
    setUnseenChatIds(prev => {
      if (!prev[chatId]) return prev;
      const copy = { ...prev };
      delete copy[chatId];
      return copy;
    });
    setConversations(prev =>
      prev.map(c => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    );
    dismissByChatId(chatId);
    const mock = INITIAL_MOCK_CONVERSATIONS.find(c => c.id === chatId);
    if (mock) {
      mock.unreadCount = 0;
    }
  };

  const isChatUnseen = (chatId: string) => {
    if (activeChatId === chatId) return false;
    if (unseenChatIds[chatId]) return true;
    const conv = conversations.find(c => c.id === chatId);
    return Boolean(conv && conv.unreadCount > 0 && !conv.lastMessage?.isOutgoing);
  };

  // Draft management
  const setDraft = (chatId: string, draft: string) => {
    setDraftsByChat(prev => ({ ...prev, [chatId]: draft }));
    setConversations(prev =>
      prev.map(c => (c.id === chatId ? { ...c, draft: draft.trim() ? draft : undefined } : c))
    );
  };

  const getDraft = (chatId: string) => {
    return draftsByChat[chatId] || '';
  };

  // Load conversations when authenticated or switched
  useEffect(() => {
    if (!isAuthenticated || !account?.userId) {
      setConversations([]);
      setActiveChatId(null);
      setMessagesByChat({});
      return;
    }

    // First load from cached storage
    const cachedConvs = getStoredItem<ChatConversation[]>(`tg_convs_${account.userId}`, []);
    const cachedMsgs = getStoredItem<Record<string, ChatMessage[]>>(`tg_msgs_${account.userId}`, {});
    const cachedDrafts = getStoredItem<Record<string, string>>(`tg_drafts_${account.userId}`, {});

    if (cachedConvs.length > 0) {
      setConversations(cachedConvs);
      if (!activeChatId && window.innerWidth >= 768) {
        setActiveChatId(cachedConvs[0].id);
      }
    }
    if (Object.keys(cachedMsgs).length > 0) {
      setMessagesByChat(cachedMsgs);
    }
    if (Object.keys(cachedDrafts).length > 0) {
      setDraftsByChat(cachedDrafts);
    }

    const loadConversations = async () => {
      // If we already have cached convs, don't show full blocking loader
      if (cachedConvs.length === 0) {
        setIsLoading(true);
      }
      try {
        const chats = await api.fetchConversations(account.userId, token || undefined, true);
        if (chats && Array.isArray(chats) && chats.length > 0) {
          // Merge drafts and pinned state
          setConversations(prev => {
            const merged = chats.map(remoteChat => {
              const existing = prev.find(p => p.id === remoteChat.id);
              const draft = cachedDrafts[remoteChat.id] || existing?.draft;
              const isCurrentlyActive = activeChatIdRef.current === remoteChat.id;
              const isLocallySeen = existing && existing.unreadCount === 0 && existing.lastMessage?.id === remoteChat.lastMessage?.id;
              const unreadCount = (isCurrentlyActive || isLocallySeen) ? 0 : remoteChat.unreadCount;
              return {
                ...remoteChat,
                unreadCount,
                isPinned: existing?.isPinned ?? remoteChat.isPinned,
                isArchived: existing?.isArchived ?? remoteChat.isArchived,
                draft: draft || remoteChat.draft
              };
            });
            return merged;
          });

          if (!activeChatId && window.innerWidth >= 768) {
            setActiveChatId(chats[0].id);
          }
        }
      } catch (err) {
        console.warn('Backend chat fetch failed, using local offline chats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, [isAuthenticated, account?.userId, token]);

  // Real-time synchronization loop: ensures fast updates just like normal Telegram
  useEffect(() => {
    if (!isAuthenticated || !account?.userId) return;

    let isMounted = true;

    const performSync = async () => {
      try {
        const chats = await api.fetchConversations(account.userId, token || undefined, true);
        if (!isMounted || !chats || !Array.isArray(chats)) return;

        setConversations(prev => {
          let changed = false;
          const merged = chats.map(remoteChat => {
            const existing = prev.find(p => p.id === remoteChat.id);
            const draft = draftsByChat[remoteChat.id] || existing?.draft;
            const isCurrentlyActive = activeChatIdRef.current === remoteChat.id;
            const isLocallySeen = existing && existing.unreadCount === 0 && existing.lastMessage?.id === remoteChat.lastMessage?.id;
            const unreadCount = (isCurrentlyActive || isLocallySeen) ? 0 : remoteChat.unreadCount;

            if (
              !existing ||
              existing.unreadCount !== unreadCount ||
              existing.lastMessage?.id !== remoteChat.lastMessage?.id ||
              existing.user.avatar !== remoteChat.user.avatar ||
              existing.user.online !== remoteChat.user.online
            ) {
              changed = true;
            }

            return {
              ...remoteChat,
              unreadCount,
              isPinned: existing?.isPinned ?? remoteChat.isPinned,
              isArchived: existing?.isArchived ?? remoteChat.isArchived,
              draft: draft || remoteChat.draft
            };
          });

          return changed ? merged : prev;
        });
      } catch (e) {
        // Silent catch during background sync
      }
    };

    // Continuous fast sync timer every 2500ms
    const intervalId = window.setInterval(performSync, 2500);

    // Instant sync whenever user switches to the tab or focuses window
    const handleFocus = () => {
      performSync();
      if (activeChatId) {
        api.fetchMessages(account.userId, activeChatId, token || undefined)
          .then(msgs => {
            if (isMounted && msgs && msgs.length > 0) {
              setMessagesByChat(prev => {
                const current = prev[activeChatId] || [];
                if (current.length !== msgs.length || (msgs.length > 0 && current[current.length - 1]?.id !== msgs[msgs.length - 1]?.id)) {
                  return { ...prev, [activeChatId]: msgs };
                }
                return prev;
              });
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener('focus', handleFocus);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isAuthenticated, account?.userId, token, activeChatId]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId || !account?.userId) return;

    // If active messages don't exist in memory/cache, fetch from server
    if (!messagesByChat[activeChatId] || messagesByChat[activeChatId].length === 0) {
      api.fetchMessages(account.userId, activeChatId, token || undefined)
        .then(msgs => {
          if (msgs && msgs.length > 0) {
            setMessagesByChat(prev => ({ ...prev, [activeChatId]: msgs }));
          }
        })
        .catch(err => {
          console.warn('Failed to load messages for chat', activeChatId, err);
        });
    }
  }, [activeChatId, account?.userId, token]);

  // Listen to incoming real-time WebSocket messages
  useEffect(() => {
    const unsubscribe = wsService.onMessage((incomingMsg) => {
      const chatId = incomingMsg.isOutgoing ? incomingMsg.toUser : incomingMsg.senderId;

      if (incomingMsg.action === 'typing') {
        setTypingChatIds(prev => ({ ...prev, [chatId]: true }));
        setTimeout(() => {
          setTypingChatIds(prev => ({ ...prev, [chatId]: false }));
        }, 3000);
        return;
      }

      setTypingChatIds(prev => ({ ...prev, [chatId]: false }));

      const isCurrentActive = activeChatIdRef.current === chatId;

      // Append message to chat
      let isDuplicate = false;
      setMessagesByChat(prev => {
        const chatMsgs = prev[chatId] || [];
        if (chatMsgs.some(m => m.id === incomingMsg.id)) {
          isDuplicate = true;
          return prev;
        }

        // Match pending local outgoing message to replace with confirmed server message
        if (incomingMsg.isOutgoing) {
          const matchIdx = chatMsgs.findIndex(
            m => m.isOutgoing && m.message === incomingMsg.message && Math.abs(m.timestamp - incomingMsg.timestamp) < 6000
          );
          if (matchIdx >= 0) {
            const updated = [...chatMsgs];
            updated[matchIdx] = { ...updated[matchIdx], id: incomingMsg.id, status: 'sent' };
            return { ...prev, [chatId]: updated };
          }
        }

        return {
          ...prev,
          [chatId]: [...chatMsgs, incomingMsg]
        };
      });

      if (isDuplicate) return;

      // Update conversations list (OR CREATE NEW CONVERSATION IF NEW USER TEXTS!)
      let senderName = incomingMsg.senderName || `User ${chatId}`;
      let senderAvatar = incomingMsg.senderAvatar;

      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c.id === chatId);

        if (existingIndex >= 0) {
          const updated = [...prev];
          const conv = { ...updated[existingIndex] };
          conv.lastMessage = incomingMsg;
          if (incomingMsg.senderAvatar && (!conv.user.avatar || conv.user.avatar !== incomingMsg.senderAvatar)) {
            conv.user = { ...conv.user, avatar: incomingMsg.senderAvatar };
          }
          senderName = `${conv.user.firstName} ${conv.user.lastName || ''}`.trim() || senderName;
          senderAvatar = conv.user.avatar || senderAvatar;

          if (!incomingMsg.isOutgoing && !isCurrentActive) {
            conv.unreadCount = (conv.unreadCount || 0) + 1;
          } else if (isCurrentActive) {
            conv.unreadCount = 0;
          }

          updated.splice(existingIndex, 1);
          return [conv, ...updated];
        } else {
          const newConv: ChatConversation = {
            id: chatId,
            user: {
              id: chatId,
              username: `user_${chatId}`,
              firstName: senderName,
              lastName: '',
              avatar: incomingMsg.senderAvatar || '',
              online: true,
              lastSeen: 'just now'
            },
            unreadCount: isCurrentActive ? 0 : 1,
            lastMessage: incomingMsg,
            isPinned: false,
            isArchived: false
          };

          return [newConv, ...prev];
        }
      });

      if (!incomingMsg.isOutgoing) {
        if (!isCurrentActive) {
          playReceiveSound();
          setUnseenChatIds(prevUnseen => ({ ...prevUnseen, [chatId]: true }));
          const mediaType = incomingMsg.media?.type;
          const previewText = incomingMsg.message && incomingMsg.message !== '[Photo]' && incomingMsg.message !== '[Video]' && incomingMsg.message !== '[Voice message]'
            ? (mediaType === 'video' ? `📹 ${incomingMsg.message}` : mediaType === 'photo' ? `📷 ${incomingMsg.message}` : incomingMsg.message)
            : (mediaType === 'voice' ? '🎤 Voice message' : mediaType === 'video' ? '📹 Video' : mediaType === 'photo' ? '📷 Photo' : mediaType === 'file' ? `📄 ${incomingMsg.media?.fileName || 'File'}` : 'New incoming message');

          notify({
            title: senderName,
            message: previewText,
            type: 'message',
            avatar: senderAvatar,
            chatId,
            actionLabel: 'Open Chat',
            onAction: () => selectChat(chatId)
          });
        } else {
          dismissByChatId(chatId);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    if (chatId) {
      markChatSeen(chatId);
    }
  };

  useEffect(() => {
    if (activeChatId) {
      markChatSeen(activeChatId);
    }
  }, [activeChatId]);

  // Fast auto-sync on window focus & online event
  useEffect(() => {
    const handleActiveSync = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && account?.userId) {
        refreshChats();
      }
    };
    document.addEventListener('visibilitychange', handleActiveSync);
    window.addEventListener('online', handleActiveSync);
    return () => {
      document.removeEventListener('visibilitychange', handleActiveSync);
      window.removeEventListener('online', handleActiveSync);
    };
  }, [isAuthenticated, account?.userId]);

  const openSavedMessages = () => {
    const savedId = 'saved_messages';
    const found = conversations.find(c => c.id === savedId);
    if (found) {
      selectChat(savedId);
    } else {
      const savedConv: ChatConversation = {
        id: savedId,
        user: {
          id: savedId,
          username: 'saved_messages',
          firstName: 'Saved Messages',
          lastName: '',
          avatar: '',
          online: true,
          lastSeen: 'Cloud Storage'
        },
        unreadCount: 0,
        isPinned: true,
        isSavedMessages: true
      };
      setConversations(prev => [savedConv, ...prev]);
      selectChat(savedId);
    }
  };

  const archiveChat = (chatId: string, archive = true) => {
    setConversations(prev =>
      prev.map(c => (c.id === chatId ? { ...c, isArchived: archive } : c))
    );
    if (activeChatId === chatId && archive) {
      const remaining = conversations.filter(c => c.id !== chatId && !c.isArchived);
      if (remaining.length > 0 && window.innerWidth >= 768) {
        setActiveChatId(remaining[0].id);
      } else {
        setActiveChatId(null);
      }
    }
  };

  const saveMessageToSaved = (message: ChatMessage) => {
    const savedId = 'saved_messages';
    const savedMsg: ChatMessage = {
      id: 'saved_' + Date.now(),
      senderId: account?.userId || 'me',
      senderName: account?.botName || 'You',
      toUser: savedId,
      message: message.message,
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'read',
      action: message.action || 'send_message',
      sticker: message.sticker,
      media: message.media,
      album: message.album,
      forwardedFrom: message.senderName || (message.isOutgoing ? 'You' : 'User')
    };

    setMessagesByChat(prev => ({
      ...prev,
      [savedId]: [...(prev[savedId] || []), savedMsg]
    }));

    setConversations(prev => {
      const existing = prev.find(c => c.id === savedId);
      if (existing) {
        return prev.map(c => (c.id === savedId ? { ...c, lastMessage: savedMsg } : c));
      }
      const savedConv: ChatConversation = {
        id: savedId,
        user: {
          id: savedId,
          username: 'saved_messages',
          firstName: 'Saved Messages',
          lastName: '',
          avatar: '',
          online: true,
          lastSeen: 'Cloud Storage'
        },
        unreadCount: 0,
        isPinned: true,
        isSavedMessages: true,
        lastMessage: savedMsg
      };
      return [savedConv, ...prev];
    });

    notify({
      title: 'Saved Messages',
      message: 'Message pinned to personal cloud notes',
      type: 'success'
    });
  };

  const refreshChats = async () => {
    if (!account?.userId) return;
    try {
      const chats = await api.fetchConversations(account.userId, token || undefined);
      if (chats && Array.isArray(chats)) {
        setConversations(chats);
      }
    } catch (e) {
      console.warn('Failed to refresh chats:', e);
    }
  };

  // SEND TEXT MESSAGE
  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeChatId || !account?.userId) return;

    const currentChatId = activeChatId;
    const msgId = 'msg_local_' + Date.now();

    const newLocalMessage: ChatMessage = {
      id: msgId,
      senderId: account.userId,
      senderName: account.botName,
      toUser: currentChatId,
      message: text.trim(),
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'pending',
      action: 'send_message'
    };

    playSendSound();

    // Clear draft for this chat
    setDraft(currentChatId, '');

    // Optimistically update message stream
    setMessagesByChat(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), newLocalMessage]
    }));

    // Update conversation snippet
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === currentChatId);
      if (idx >= 0) {
        const updated = [...prev];
        const conv = { ...updated[idx], lastMessage: newLocalMessage, draft: undefined };
        updated.splice(idx, 1);
        return [conv, ...updated];
      }
      return prev;
    });

    const payload: OutgoingBackendPayload = {
      "User-ID": account.userId,
      "to-user": currentChatId,
      "message": text.trim(),
      "action": "send_message"
    };

    try {
      const wsSent = wsService.send(payload);
      if (wsSent) {
        // Fast WebSocket dispatch (< 5ms response)
        setMessagesByChat(prev => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] || []).map(m =>
            m.id === msgId ? { ...m, status: 'sent' } : m
          )
        }));
      } else {
        // Fallback to REST API if WebSocket is offline or reconnecting
        await api.sendMessage(payload, token || undefined);
        setMessagesByChat(prev => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] || []).map(m =>
            m.id === msgId ? { ...m, status: 'delivered' } : m
          )
        }));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // SEND INLINE BUTTON MESSAGE
  const sendInlineButtonMessage = async (text: string, inlineKeyboard: InlineKeyboardButton[][]) => {
    if (!text.trim() || !activeChatId || !account?.userId) return;

    const currentChatId = activeChatId;
    const msgId = 'msg_inline_' + Date.now();

    const newLocalMessage: ChatMessage = {
      id: msgId,
      senderId: account.userId,
      senderName: account.botName,
      toUser: currentChatId,
      message: text.trim(),
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'pending',
      action: 'send_message',
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    };

    playSendSound();

    // Clear draft for this chat
    setDraft(currentChatId, '');

    // Optimistically update message stream
    setMessagesByChat(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), newLocalMessage]
    }));

    // Update conversation snippet
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === currentChatId);
      if (idx >= 0) {
        const updated = [...prev];
        const conv = { ...updated[idx], lastMessage: newLocalMessage, draft: undefined };
        updated.splice(idx, 1);
        return [conv, ...updated];
      }
      return prev;
    });

    const payload: OutgoingBackendPayload = {
      "User-ID": account.userId,
      "to-user": currentChatId,
      "message": text.trim(),
      "action": "send_message",
      "reply_markup": {
        "inline_keyboard": inlineKeyboard
      }
    };

    try {
      const wsSent = wsService.send(payload);
      if (wsSent) {
        setMessagesByChat(prev => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] || []).map(m =>
            m.id === msgId ? { ...m, status: 'sent' } : m
          )
        }));
      } else {
        await api.sendMessage(payload, token || undefined);
        setMessagesByChat(prev => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] || []).map(m =>
            m.id === msgId ? { ...m, status: 'delivered' } : m
          )
        }));
      }
    } catch (err) {
      console.error('Failed to send inline button message:', err);
      setMessagesByChat(prev => ({
        ...prev,
        [currentChatId]: (prev[currentChatId] || []).map(m =>
          m.id === msgId ? { ...m, status: 'pending' } : m
        )
      }));
      throw err;
    }
  };

  // SEND STICKER
  const sendSticker = async (sticker: StickerItem) => {
    if (!activeChatId || !account?.userId) return;

    playSendSound();
    const currentChatId = activeChatId;
    const msgId = 'sticker_' + Date.now();

    const newLocalStickerMsg: ChatMessage = {
      id: msgId,
      senderId: account.userId,
      senderName: account.botName,
      toUser: currentChatId,
      message: `[Sticker: ${sticker.name}]`,
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'pending',
      action: 'send_sticker',
      sticker: {
        id: sticker.id,
        packId: sticker.packId,
        url: sticker.url || '',
        emoji: sticker.emoji,
        name: sticker.name,
        isCustom: sticker.isCustom
      }
    };

    setMessagesByChat(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), newLocalStickerMsg]
    }));

    const payload: OutgoingBackendPayload = {
      "User-ID": account.userId,
      "to-user": currentChatId,
      "message": `[Sticker: ${sticker.name}]`,
      "action": "send_sticker",
      "file": sticker.url || '',
      "sticker": {
        id: sticker.id,
        packId: sticker.packId,
        emoji: sticker.emoji
      }
    };

    try {
      const wsSent = wsService.send(payload);
      if (wsSent) {
        // Fast WebSocket dispatch
        setMessagesByChat(prev => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] || []).map(m =>
            m.id === msgId ? { ...m, status: 'sent' } : m
          )
        }));
      } else {
        await api.sendMessage(payload, token || undefined);
        setMessagesByChat(prev => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] || []).map(m =>
            m.id === msgId ? { ...m, status: 'delivered' } : m
          )
        }));
      }
    } catch (e) {
      console.error('Failed to send sticker:', e);
    }
  };

  // SEND MEDIA (PHOTO, VIDEO, VOICE, FILE) WITH OPTIONAL CAPTION & COMPRESSION
  const sendMedia = async (
    type: 'photo' | 'video' | 'voice' | 'file',
    fileOrUrl: File | Blob | string,
    duration?: number,
    caption?: string,
    fileName?: string,
    fileSize?: string
  ) => {
    if (!activeChatId || !account?.userId) return;

    playSendSound();
    const currentChatId = activeChatId;
    const msgId = 'media_' + Date.now();

    let finalFileOrBlob = fileOrUrl;
    let previewDataUrl: string | undefined = undefined;

    // Automatic Client-Side Image Compression for Photos
    if (type === 'photo' && fileOrUrl instanceof File) {
      try {
        const compressed = await compressImage(fileOrUrl, 1600, 1600, 0.82);
        finalFileOrBlob = compressed.file;
        previewDataUrl = compressed.previewUrl;
      } catch (err) {
        console.warn('Image compression bypassed:', err);
      }
    }

    let mediaUrl = typeof finalFileOrBlob === 'string'
      ? finalFileOrBlob
      : previewDataUrl || URL.createObjectURL(finalFileOrBlob);

    const resolvedFileName = fileName || (typeof finalFileOrBlob === 'string'
      ? undefined
      : (finalFileOrBlob as File).name || (type === 'voice' ? 'voice.webm' : type === 'photo' ? 'photo.jpg' : 'media'));

    // Upload to server if live backend
    if (typeof finalFileOrBlob !== 'string' && !api.isMockMode()) {
      try {
        const uploadRes = await api.uploadMedia(
          finalFileOrBlob,
          resolvedFileName || 'upload',
          token || undefined
        );
        if (uploadRes?.url) {
          mediaUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('Backend upload failed, utilizing local ObjectURL:', err);
      }
    }

    const newLocalMediaMsg: ChatMessage = {
      id: msgId,
      senderId: account.userId,
      senderName: account.botName,
      toUser: currentChatId,
      message: caption?.trim() || (type === 'photo' ? '[Photo]' : type === 'video' ? '[Video]' : type === 'voice' ? '[Voice message]' : `[File: ${resolvedFileName}]`),
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'pending',
      action: type === 'photo' ? 'send_photo' : 'send_media',
      media: {
        type,
        url: mediaUrl,
        duration,
        fileName: resolvedFileName,
        fileSize
      }
    };

    setMessagesByChat(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), newLocalMediaMsg]
    }));

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === currentChatId);
      if (idx >= 0) {
        const updated = [...prev];
        const conv = { ...updated[idx], lastMessage: newLocalMediaMsg };
        updated.splice(idx, 1);
        return [conv, ...updated];
      }
      return prev;
    });

    const payload: OutgoingBackendPayload = {
      "User-ID": account.userId,
      "to-user": currentChatId,
      "employee_id": account.userId,
      "to_userid": currentChatId,
      "file": mediaUrl,
      "Action": type === 'photo' ? 'send_photo' : 'send_media',
      "message": caption?.trim() || '',
      "caption": caption?.trim() || '',
      "action": type === 'photo' ? 'send_photo' : 'send_media',
      "media": {
        type,
        url: mediaUrl,
        duration,
        fileName: resolvedFileName,
        fileSize
      }
    };

    try {
      wsService.send(payload);
      if (type === 'photo') {
        await api.sendPhoto({
          employee_id: account.userId,
          to_userid: currentChatId,
          file: mediaUrl,
          caption: caption || '',
          action: 'send_photo'
        }, token || undefined);
      } else {
        await api.sendMessage(payload, token || undefined);
      }

      setMessagesByChat(prev => ({
        ...prev,
        [currentChatId]: (prev[currentChatId] || []).map(m =>
          m.id === msgId ? { ...m, status: 'delivered' } : m
        )
      }));
    } catch (e) {
      console.error('Failed to send media:', e);
    }
  };

  // SEND MULTIPLE PHOTOS AS ALBUM
  const sendAlbum = async (
    photos: { file: File; caption?: string }[],
    generalCaption?: string
  ) => {
    if (!activeChatId || !account?.userId || photos.length === 0) return;

    playSendSound();
    const currentChatId = activeChatId;
    const msgId = 'album_' + Date.now();

    // Compress all photos concurrently
    const compressedList = await Promise.all(
      photos.map(p => compressImage(p.file, 1600, 1600, 0.82))
    );

    const mediaAlbum: MediaItem[] = compressedList.map((comp, idx) => ({
      type: 'photo',
      url: comp.previewUrl,
      fileName: comp.file.name,
      fileSize: `${Math.round(comp.compressedSize / 1024)} KB`
    }));

    const newAlbumMessage: ChatMessage = {
      id: msgId,
      senderId: account.userId,
      senderName: account.botName,
      toUser: currentChatId,
      message: generalCaption?.trim() || `[${photos.length} Photos]`,
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'pending',
      action: 'send_media',
      media: mediaAlbum[0],
      album: mediaAlbum
    };

    setMessagesByChat(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), newAlbumMessage]
    }));

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === currentChatId);
      if (idx >= 0) {
        const updated = [...prev];
        const conv = { ...updated[idx], lastMessage: newAlbumMessage };
        updated.splice(idx, 1);
        return [conv, ...updated];
      }
      return prev;
    });

    const payload: OutgoingBackendPayload = {
      "User-ID": account.userId,
      "to-user": currentChatId,
      "message": generalCaption?.trim() || '',
      "caption": generalCaption?.trim() || '',
      "action": "send_media",
      "album": mediaAlbum
    };

    try {
      const wsSent = wsService.send(payload);
      if (wsSent) {
        // Fast WebSocket dispatch
        setMessagesByChat(prev => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] || []).map(m =>
            m.id === msgId ? { ...m, status: 'sent' } : m
          )
        }));
      } else {
        await api.sendMessage(payload, token || undefined);
        setMessagesByChat(prev => ({
          ...prev,
          [currentChatId]: (prev[currentChatId] || []).map(m =>
            m.id === msgId ? { ...m, status: 'delivered' } : m
          )
        }));
      }
    } catch (e) {
      console.error('Failed to send album:', e);
    }
  };

  // TOGGLE REACTION (PERSISTENT & INSTANT)
  const toggleReaction = (chatId: string, messageId: string, emoji: string) => {
    if (!account?.userId) return;
    const currentUserId = account.userId;

    setMessagesByChat(prev => {
      const msgs = prev[chatId] || [];
      const updated = msgs.map(msg => {
        if (msg.id !== messageId) return msg;

        const currentReactions = msg.reactions ? [...msg.reactions] : [];
        const existingReactionIdx = currentReactions.findIndex(r => r.emoji === emoji);

        if (existingReactionIdx >= 0) {
          const r = { ...currentReactions[existingReactionIdx] };
          const userIndex = r.users.indexOf(currentUserId);
          if (userIndex >= 0) {
            // Remove user reaction
            r.users = r.users.filter(u => u !== currentUserId);
            r.count = r.count - 1;
          } else {
            // Add user reaction
            r.users = [...r.users, currentUserId];
            r.count = r.count + 1;
          }

          if (r.count <= 0) {
            currentReactions.splice(existingReactionIdx, 1);
          } else {
            currentReactions[existingReactionIdx] = r;
          }
        } else {
          // Add new emoji reaction
          currentReactions.push({
            emoji,
            count: 1,
            users: [currentUserId]
          });
        }

        return { ...msg, reactions: currentReactions };
      });

      return { ...prev, [chatId]: updated };
    });

    // Notify backend/WebSocket
    wsService.send({
      "User-ID": currentUserId,
      "to-user": chatId,
      "message": emoji,
      "action": "reaction",
      "reaction": {
        message_id: messageId,
        emoji
      }
    });
  };

  // UNDO LAST DELETED MESSAGE
  const undoDeleteMessage = (): boolean => {
    const snapshot = lastDeletedRef.current;
    if (!snapshot) return false;

    const { chatId, message, index } = snapshot;

    setMessagesByChat(prev => {
      const msgs = [...(prev[chatId] || [])];
      const insertAt = Math.min(Math.max(0, index), msgs.length);
      msgs.splice(insertAt, 0, message);

      // Restore conversation lastMessage if needed
      setConversations(prevConvs => {
        return prevConvs.map(c => {
          if (c.id === chatId) {
            return {
              ...c,
              lastMessage: msgs[msgs.length - 1]
            };
          }
          return c;
        });
      });

      return { ...prev, [chatId]: msgs };
    });

    lastDeletedRef.current = null;
    setCanUndo(false);

    notify({
      title: 'Message Restored',
      message: message.media?.type === 'video'
        ? 'Video message restored'
        : message.media?.type === 'voice'
        ? 'Voice note restored'
        : message.media?.type === 'photo'
        ? 'Photo restored'
        : 'Message restored to conversation',
      type: 'success',
      duration: 2500
    });

    return true;
  };

  // Global Ctrl+Z / Cmd+Z handler for undo message delete
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        const activeEl = document.activeElement;
        const isInput =
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl?.getAttribute('contenteditable') === 'true';
        if (!isInput) {
          e.preventDefault();
          undoDeleteMessage();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // DELETE MESSAGE (WITH UNDO SUPPORT & NOTIFICATION)
  const deleteMessage = (chatId: string, messageId: string) => {
    setMessagesByChat(prev => {
      const currentMsgs = prev[chatId] || [];
      const index = currentMsgs.findIndex(m => m.id === messageId);
      const msgToDelete = currentMsgs[index];

      if (msgToDelete) {
        lastDeletedRef.current = { chatId, message: msgToDelete, index };
        setCanUndo(true);
      }

      const filtered = currentMsgs.filter(m => m.id !== messageId);

      // If deleted message was last message in conversation, update lastMessage
      setConversations(prevConvs => {
        return prevConvs.map(c => {
          if (c.id === chatId && c.lastMessage?.id === messageId) {
            return {
              ...c,
              lastMessage: filtered.length > 0 ? filtered[filtered.length - 1] : undefined
            };
          }
          return c;
        });
      });

      // Notify backend/WebSocket
      if (account?.userId) {
        wsService.send({
          "User-ID": account.userId,
          "to-user": chatId,
          "message": "",
          "action": "delete_message",
          "media": undefined
        });
      }

      notify({
        title: 'Message Deleted',
        message: msgToDelete?.media?.type === 'video'
          ? 'Video message removed'
          : msgToDelete?.media?.type === 'voice'
          ? 'Voice note removed'
          : msgToDelete?.media?.type === 'photo'
          ? 'Photo removed'
          : 'Message removed from conversation',
        type: 'info',
        duration: 7000,
        actionLabel: 'Undo',
        onAction: () => {
          undoDeleteMessage();
        }
      });

      return { ...prev, [chatId]: filtered };
    });
  };

  // FORWARD MESSAGE
  const forwardMessage = async (targetChatId: string, message: ChatMessage) => {
    if (!account?.userId) return;

    playSendSound();
    const msgId = 'fwd_' + Date.now();
    const originalSender = message.forwardedFrom || message.senderName || (message.isOutgoing ? account.botName : 'User');

    const forwardedMsg: ChatMessage = {
      id: msgId,
      senderId: account.userId,
      senderName: account.botName,
      toUser: targetChatId,
      message: message.message,
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'pending',
      action: message.action || 'send_message',
      forwardedFrom: originalSender,
      media: message.media,
      album: message.album,
      sticker: message.sticker
    };

    setMessagesByChat(prev => ({
      ...prev,
      [targetChatId]: [...(prev[targetChatId] || []), forwardedMsg]
    }));

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === targetChatId);
      if (idx >= 0) {
        const updated = [...prev];
        const conv = { ...updated[idx], lastMessage: forwardedMsg };
        updated.splice(idx, 1);
        return [conv, ...updated];
      }
      return prev;
    });

    const payload: OutgoingBackendPayload = {
      "User-ID": account.userId,
      "to-user": targetChatId,
      "message": message.message,
      "action": message.action || 'send_message',
      "forwarded_from": originalSender,
      "media": message.media,
      "album": message.album,
      "sticker": message.sticker
    };

    try {
      wsService.send(payload);
      await api.sendMessage(payload, token || undefined);

      setMessagesByChat(prev => ({
        ...prev,
        [targetChatId]: (prev[targetChatId] || []).map(m =>
          m.id === msgId ? { ...m, status: 'delivered' } : m
        )
      }));

      notify({
        title: 'Forwarded',
        message: `Message forwarded to chat`,
        type: 'success',
        duration: 2000
      });
    } catch (e) {
      console.error('Failed to forward message:', e);
    }
  };

  // CLEAR CHAT
  const clearChat = (chatId: string) => {
    setMessagesByChat(prev => ({ ...prev, [chatId]: [] }));
    setConversations(prev =>
      prev.map(c => (c.id === chatId ? { ...c, lastMessage: undefined, unreadCount: 0 } : c))
    );
    notify({
      title: 'Chat Cleared',
      message: 'All messages in this chat have been cleared',
      type: 'info'
    });
  };

  // User Profile Open / Close
  const openUserProfile = (user: TelegramUser) => {
    setSelectedUserProfile(user);
  };

  const closeUserProfile = () => {
    setSelectedUserProfile(null);
  };

  const activeConversations = conversations.filter(c => !c.isArchived);
  const archivedConversations = conversations.filter(c => !!c.isArchived);

  const activeChat = conversations.find(c => c.id === activeChatId) || null;
  const activeMessages = (activeChatId ? messagesByChat[activeChatId] : []) || [];
  const typingStatus = Boolean(
    (activeChatId && typingChatIds[activeChatId]) ||
    activeChat?.user?.lastSeen?.toLowerCase().includes('typing')
  );

  return (
    <ChatContext.Provider
      value={{
        conversations: activeConversations,
        archivedConversations,
        activeChat,
        activeMessages,
        isLoading,
        typingStatus,
        searchQuery,
        setSearchQuery,
        selectChat,
        unseenChatIds,
        isChatUnseen,
        markChatSeen,
        sendMessage,
        sendSticker,
        sendMedia,
        sendAlbum,
        toggleReaction,
        deleteMessage,
        undoDeleteMessage,
        canUndo,
        forwardMessage,
        archiveChat,
        saveMessageToSaved,
        openSavedMessages,
        refreshChats,
        clearChat,
        setDraft,
        getDraft,
        selectedUserProfile,
        openUserProfile,
        closeUserProfile,
        isInlineButtonModalOpen,
        openCreateInlineButton,
        closeCreateInlineButton,
        sendInlineButtonMessage,
        customStickers,
        addCustomSticker,
        deleteCustomSticker
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
