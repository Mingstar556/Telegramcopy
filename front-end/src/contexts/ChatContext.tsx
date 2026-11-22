import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import { ChatConversation, ChatMessage, OutgoingBackendPayload, StickerItem } from '../types/chat';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useNotification } from './NotificationContext';

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
  sendMedia: (type: 'photo' | 'video' | 'voice', fileOrUrl: File | Blob | string, duration?: number) => Promise<void>;
  archiveChat: (chatId: string, archive?: boolean) => void;
  saveMessageToSaved: (message: ChatMessage) => void;
  openSavedMessages: () => void;
  refreshChats: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { account, token, isAuthenticated } = useAuth();
  const { playSendSound, playReceiveSound } = useTheme();
  const { notify } = useNotification();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typingChatIds, setTypingChatIds] = useState<Record<string, boolean>>({});
  const [unseenChatIds, setUnseenChatIds] = useState<Record<string, boolean>>({});

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
  };

  const isChatUnseen = (chatId: string) => {
    if (activeChatId === chatId) return false;
    if (unseenChatIds[chatId]) return true;
    const conv = conversations.find(c => c.id === chatId);
    return Boolean(conv && conv.unreadCount > 0 && !conv.lastMessage?.isOutgoing);
  };

  // Load conversations when authenticated
  useEffect(() => {
    if (!isAuthenticated || !account?.userId) {
      setConversations([]);
      setActiveChatId(null);
      setMessagesByChat({});
      return;
    }

    const loadConversations = async () => {
      setIsLoading(true);
      try {
        const chats = await api.fetchConversations(account.userId, token || undefined, true);
        setConversations(chats);
        // Default select first chat on wide screens
        if (chats.length > 0 && !activeChatId && window.innerWidth >= 768) {
          setActiveChatId(chats[0].id);
        }
      } catch (err) {
        console.error('Failed to load chats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, [isAuthenticated, account?.userId, token]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId || !account?.userId) return;

    if (!messagesByChat[activeChatId]) {
      api.fetchMessages(account.userId, activeChatId, token || undefined)
        .then(msgs => {
          setMessagesByChat(prev => ({ ...prev, [activeChatId]: msgs }));
        })
        .catch(err => {
          console.error('Failed to load messages for chat', activeChatId, err);
        });
    }
  }, [activeChatId, account?.userId, token, messagesByChat]);

  // Listen to incoming real-time WebSocket messages from Django Channels
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

      setMessagesByChat(prev => {
        const chatMsgs = prev[chatId] || [];
        // Prevent duplicate messages with identical ID
        if (chatMsgs.some(m => m.id === incomingMsg.id)) {
          return prev;
        }

        // Match pending local outgoing message to replace with confirmed server message
        if (incomingMsg.isOutgoing) {
          const matchIdx = chatMsgs.findIndex(
            m => m.isOutgoing && m.message === incomingMsg.message && Math.abs(m.timestamp - incomingMsg.timestamp) < 5000
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

      // Update last message in conversation list
      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c.id === chatId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          const conv = { ...updated[existingIndex] };
          conv.lastMessage = incomingMsg;
          if (!incomingMsg.isOutgoing) {
            playReceiveSound();
            if (activeChatId !== chatId) {
              conv.unreadCount = (conv.unreadCount || 0) + 1;
              // Secondary glow beacon for unseen person who texted the bot
              setUnseenChatIds(prevUnseen => ({ ...prevUnseen, [chatId]: true }));
              const senderName = `${conv.user.firstName} ${conv.user.lastName || ''}`.trim();
              notify({
                title: senderName,
                message: incomingMsg.message || (incomingMsg.media?.type === 'voice' ? '🎤 Voice message' : incomingMsg.media?.type === 'photo' ? '📷 Photo' : 'New incoming message'),
                type: 'message',
                avatar: conv.user.avatar,
                chatId,
                actionLabel: 'Open Chat',
                onAction: () => selectChat(chatId)
              });
            }
          }
          updated.splice(existingIndex, 1);
          return [conv, ...updated];
        }
        return prev;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [activeChatId]);

  const selectChat = (chatId: string) => {
    setActiveChatId(chatId);
    // Mark as read and stop glowing in secondary color
    markChatSeen(chatId);
  };

  // Automatically clear unseen glow when activeChatId is opened
  useEffect(() => {
    if (activeChatId) {
      markChatSeen(activeChatId);
    }
  }, [activeChatId]);

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

  /**
   * Swipe-to-archive functionality
   */
  const archiveChat = (chatId: string, archive = true) => {
    setConversations(prev =>
      prev.map(c => (c.id === chatId ? { ...c, isArchived: archive } : c))
    );
    if (activeChatId === chatId && archive) {
      // Switch active chat if current one is archived
      const remaining = conversations.filter(c => c.id !== chatId && !c.isArchived);
      if (remaining.length > 0 && window.innerWidth >= 768) {
        setActiveChatId(remaining[0].id);
      } else {
        setActiveChatId(null);
      }
    }
  };


  /**
   * Save a message to the "Saved Messages" chat
   */
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
      forwardedFrom: message.senderName || (message.isOutgoing ? 'You' : 'User')
    };

    setMessagesByChat(prev => ({
      ...prev,
      [savedId]: [...(prev[savedId] || []), savedMsg]
    }));

    // Update last message in Saved Messages
    setConversations(prev =>
      prev.map(c => (c.id === savedId ? { ...c, lastMessage: savedMsg } : c))
    );

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
      setConversations(chats);
    } catch (e) {
      console.warn('Failed to refresh chats:', e);
    }
  };

  /**
   * Send a text message matching requirement 9:
   * { "User-ID": ..., "to-user": ..., "message": ..., "action": ... }
   */
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

    // Optimistically update message stream
    playSendSound();
    setMessagesByChat(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), newLocalMessage]
    }));

    // Update conversation snippet
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === currentChatId);
      if (idx >= 0) {
        const updated = [...prev];
        const conv = { ...updated[idx], lastMessage: newLocalMessage };
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
      // 1. Try WebSocket send if live
      const wsSent = wsService.send(payload);

      // 2. Also send via REST API client for persistence / Django view
      await api.sendMessage(payload, token || undefined);

      // Mark status delivered
      setMessagesByChat(prev => ({
        ...prev,
        [currentChatId]: (prev[currentChatId] || []).map(m =>
          m.id === msgId ? { ...m, status: 'delivered' } : m
        )
      }));
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  /**
   * Send a pre-installed sticker
   */
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
        url: '',
        emoji: sticker.emoji,
        name: sticker.name
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
      "sticker": {
        id: sticker.id,
        packId: sticker.packId,
        emoji: sticker.emoji
      }
    };

    try {
      wsService.send(payload);
      await api.sendMessage(payload, token || undefined);

      setMessagesByChat(prev => ({
        ...prev,
        [currentChatId]: (prev[currentChatId] || []).map(m =>
          m.id === msgId ? { ...m, status: 'delivered' } : m
        )
      }));
    } catch (e) {
      console.error('Failed to send sticker:', e);
    }
  };

  /**
   * Send media (photo, video, voice note) matching backend requirements
   */
  const sendMedia = async (type: 'photo' | 'video' | 'voice', fileOrUrl: File | Blob | string, duration?: number) => {
    if (!activeChatId || !account?.userId) return;

    playSendSound();
    const currentChatId = activeChatId;
    const msgId = 'media_' + Date.now();
    let mediaUrl = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
    const fileName = typeof fileOrUrl === 'string' ? undefined : (fileOrUrl as File).name || (type === 'voice' ? 'voice.webm' : 'media');

    // If live backend is available and file is Blob/File, upload to server
    if (typeof fileOrUrl !== 'string' && !api.isMockMode()) {
      try {
        const uploadRes = await api.uploadMedia(fileOrUrl, fileName || (type === 'voice' ? 'voice.webm' : 'media'), token || undefined);
        if (uploadRes?.url) {
          mediaUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('Media upload to server failed, using local URL:', err);
      }
    }

    const newLocalMediaMsg: ChatMessage = {
      id: msgId,
      senderId: account.userId,
      senderName: account.botName,
      toUser: currentChatId,
      message: '',
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'pending',
      action: 'send_media',
      media: {
        type,
        url: mediaUrl,
        duration,
        fileName
      }
    };

    setMessagesByChat(prev => ({
      ...prev,
      [currentChatId]: [...(prev[currentChatId] || []), newLocalMediaMsg]
    }));

    // Update conversation snippet
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
      "message": "",
      "action": type === 'photo' ? 'send_photo' : 'send_media',
      "media": {
        type,
        url: mediaUrl,
        duration,
        fileName
      }
    };

    try {
      wsService.send(payload);
      if (type === 'photo') {
        await api.sendPhoto({
          employee_id: account.userId,
          to_userid: currentChatId,
          file: mediaUrl,
          caption: '',
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
        archiveChat,
        saveMessageToSaved,
        openSavedMessages,
        refreshChats
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
