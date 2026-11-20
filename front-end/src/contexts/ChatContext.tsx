import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
import { createDemoAudioVoice } from '../services/audioRecorder';
import { ChatConversation, ChatMessage, OutgoingBackendPayload, StickerItem } from '../types/chat';
import { useAuth } from './AuthContext';

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
  sendMessage: (text: string) => Promise<void>;
  sendSticker: (sticker: StickerItem) => Promise<void>;
  sendMedia: (type: 'photo' | 'video' | 'voice', fileOrUrl: File | Blob | string, duration?: number) => Promise<void>;
  triggerShowcaseEvent?: (eventType: 'text' | 'voice' | 'photo' | 'typing') => Promise<void>;
  archiveChat: (chatId: string, archive?: boolean) => void;
  saveMessageToSaved: (message: ChatMessage) => void;
  openSpecialChat: () => void;
  openSavedMessages: () => void;
  refreshChats: () => Promise<void>;
  isSpecialChatOpen: boolean;
  setIsSpecialChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { account, token, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSpecialChatOpen, setIsSpecialChatOpen] = useState<boolean>(false);
  const [typingChatIds, setTypingChatIds] = useState<Record<string, boolean>>({});

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
          if (activeChatId !== chatId && !incomingMsg.isOutgoing) {
            conv.unreadCount = (conv.unreadCount || 0) + 1;
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
    // Mark as read in local conversation state
    setConversations(prev =>
      prev.map(c => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    );
  };

  const openSpecialChat = () => {
    const specialId = 'special_direct_bot';
    const found = conversations.find(c => c.id === specialId);
    if (found) {
      selectChat(specialId);
    } else {
      // Create if not existing
      const specialConv: ChatConversation = {
        id: specialId,
        user: {
          id: specialId,
          username: 'special_direct',
          firstName: 'Special Channel',
          lastName: '⚡',
          isBot: true,
          online: true
        },
        unreadCount: 0,
        isPinned: true
      };
      setConversations(prev => [specialConv, ...prev]);
      selectChat(specialId);
    }
    setIsSpecialChatOpen(false);
  };

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

      // In mock mode, simulate automatic response from target user/client after 1.5s
      if (api.isMockMode() && !wsSent) {
        setTimeout(() => {
          const simulatedReply: ChatMessage = {
            id: 'mock_reply_' + Date.now(),
            senderId: currentChatId,
            toUser: account.userId,
            message: `Received by client: "${text.slice(0, 25)}${text.length > 25 ? '...' : ''}"`,
            timestamp: Date.now(),
            isOutgoing: false,
            status: 'read'
          };

          setMessagesByChat(prev => ({
            ...prev,
            [currentChatId]: [...(prev[currentChatId] || []), simulatedReply]
          }));

          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === currentChatId);
            if (idx >= 0) {
              const updated = [...prev];
              const conv = { ...updated[idx], lastMessage: simulatedReply };
              updated.splice(idx, 1);
              return [conv, ...updated];
            }
            return prev;
          });
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  /**
   * Send a pre-installed sticker
   */
  const sendSticker = async (sticker: StickerItem) => {
    if (!activeChatId || !account?.userId) return;

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
      "message": "",
      "action": "send_media",
      "media": {
        type,
        url: mediaUrl,
        duration,
        fileName
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

      // In mock mode, simulate automatic response from target user/client after 1.5s
      if (api.isMockMode()) {
        setTimeout(() => {
          const simulatedReply: ChatMessage = {
            id: 'mock_reply_' + Date.now(),
            senderId: currentChatId,
            toUser: account.userId,
            message: type === 'voice' 
              ? '🎤 Listened to your voice message! Working on it.'
              : `Received ${type} attachment. Looks good!`,
            timestamp: Date.now(),
            isOutgoing: false,
            status: 'read'
          };

          setMessagesByChat(prev => ({
            ...prev,
            [currentChatId]: [...(prev[currentChatId] || []), simulatedReply]
          }));

          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === currentChatId);
            if (idx >= 0) {
              const updated = [...prev];
              const conv = { ...updated[idx], lastMessage: simulatedReply };
              updated.splice(idx, 1);
              return [conv, ...updated];
            }
            return prev;
          });
        }, 1200);
      }
    } catch (e) {
      console.error('Failed to send media:', e);
    }
  };

  const activeConversations = conversations.filter(c => !c.isArchived);
  const archivedConversations = conversations.filter(c => !!c.isArchived);

  /**
   * Trigger simulated test events for live showcase presentations
   */
  const triggerShowcaseEvent = async (eventType: 'text' | 'voice' | 'photo' | 'typing') => {
    const targetChatId = activeChatId || (activeConversations[0]?.id !== 'saved_messages' ? activeConversations[0]?.id : activeConversations[1]?.id) || 'user_10293847';
    const targetConv = conversations.find(c => c.id === targetChatId);
    const senderName = targetConv?.user?.firstName || 'Alex';

    if (eventType === 'typing') {
      // Simulate typing status
      setTypingChatIds(prev => ({ ...prev, [targetChatId]: true }));
      setConversations(prev =>
        prev.map(c => c.id === targetChatId ? { ...c, user: { ...c.user, lastSeen: 'typing...' } } : c)
      );
      setTimeout(() => {
        setTypingChatIds(prev => ({ ...prev, [targetChatId]: false }));
        setConversations(prev =>
          prev.map(c => c.id === targetChatId ? { ...c, user: { ...c.user, lastSeen: 'online' } } : c)
        );
      }, 3000);
      return;
    }

    let showcaseMsg: ChatMessage;

    if (eventType === 'text') {
      const phrases = [
        "Hey! Could you confirm if the bot token sync completed successfully?",
        "Everything looks great on our end! Just testing the Telegram client.",
        "Quick question: Can we invite more operator IDs into this channel?",
        "Received your update. Thanks for the quick response!"
      ];
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      showcaseMsg = {
        id: 'showcase_text_' + Date.now(),
        senderId: targetChatId,
        senderName: senderName,
        toUser: account?.userId || '1234',
        message: randomPhrase,
        timestamp: Date.now(),
        isOutgoing: false,
        status: 'read'
      };
    } else if (eventType === 'voice') {
      const demoVoice = await createDemoAudioVoice(4);
      showcaseMsg = {
        id: 'showcase_voice_' + Date.now(),
        senderId: targetChatId,
        senderName: senderName,
        toUser: account?.userId || '1234',
        message: '[Voice Note]',
        timestamp: Date.now(),
        isOutgoing: false,
        status: 'read',
        media: {
          type: 'voice',
          url: demoVoice.url,
          duration: demoVoice.duration
        }
      };
    } else {
      showcaseMsg = {
        id: 'showcase_photo_' + Date.now(),
        senderId: targetChatId,
        senderName: senderName,
        toUser: account?.userId || '1234',
        message: '[Photo]',
        timestamp: Date.now(),
        isOutgoing: false,
        status: 'read',
        media: {
          type: 'photo',
          url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
          fileName: 'analytics_report.jpg'
        }
      };
    }

    setMessagesByChat(prev => ({
      ...prev,
      [targetChatId]: [...(prev[targetChatId] || []), showcaseMsg]
    }));

    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === targetChatId);
      if (idx >= 0) {
        const updated = [...prev];
        const updatedConv = {
          ...updated[idx],
          lastMessage: showcaseMsg,
          unreadCount: (updated[idx].unreadCount || 0) + 1
        };
        updated.splice(idx, 1);
        return [updatedConv, ...updated];
      }
      return prev;
    });
  };

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
        sendMessage,
        sendSticker,
        sendMedia,
        triggerShowcaseEvent,
        archiveChat,
        saveMessageToSaved,
        openSpecialChat,
        openSavedMessages,
        refreshChats,
        isSpecialChatOpen,
        setIsSpecialChatOpen
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
