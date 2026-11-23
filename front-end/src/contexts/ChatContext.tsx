import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { wsService } from '../services/websocket';
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
import { compressImage, svgToPngDataUrl, computeFileHash, generateMicroBlurThumbnail } from '../utils/imageCompressor';

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
  deleteMessage: (chatId: string, messageId: string, deleteForEveryone?: boolean) => void;
  undoDeleteMessage: () => boolean;
  canUndo: boolean;
  forwardMessage: (targetChatId: string, message: ChatMessage) => Promise<void>;
  archiveChat: (chatId: string, archive?: boolean) => void;
  saveMessageToSaved: (message: ChatMessage) => void;
  openSavedMessages: () => void;
  refreshChats: () => Promise<void>;
  clearChat: (chatId: string, deleteForEveryone?: boolean) => void;
  deleteChat: (chatId: string, deleteForEveryone?: boolean) => void;
  wipeAllChats: () => Promise<void>;
  toggleMuteChat: (chatId: string) => void;
  isChatMuted: (chatId: string) => boolean;
  togglePinChat: (chatId: string) => void;
  isChatPinned: (chatId: string) => boolean;
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

const processFetchedMessages = (msgs: ChatMessage[]): ChatMessage[] => {
  if (!msgs || msgs.length === 0) return [];
  const normalMsgs: ChatMessage[] = [];
  const reactionsToApply: ChatMessage[] = [];

  for (const m of msgs) {
    if (m.action === 'reaction') {
      reactionsToApply.push(m);
    } else {
      normalMsgs.push(m);
    }
  }

  if (reactionsToApply.length === 0) return normalMsgs;

  return normalMsgs.map(msg => {
    const matchingReactions = reactionsToApply.filter(r => {
      const targetId = (r as any).reaction?.message_id || (r as any).messageId;
      if (targetId === msg.id) return true;
      if (msg.album && msg.album.some((p: any) => p.id === targetId)) return true;
      return false;
    });
    if (matchingReactions.length === 0) return msg;

    const currentReactions = msg.reactions ? [...msg.reactions] : [];
    for (const r of matchingReactions) {
      const emoji = (r as any).reaction?.emoji || (r as any).emoji || r.message;
      const oldEmoji = (r as any).reaction?.old_emoji || (r as any).old_emoji;
      const user = r.senderId || (r as any).userId;
      const isRemoved = Boolean((r as any).is_removed || (r as any).reaction?.is_removed || (!emoji && oldEmoji));
      const targetEmoji = emoji || oldEmoji;
      if (!targetEmoji) continue;

      const exIdx = currentReactions.findIndex(cr => cr.emoji === targetEmoji);
      if (isRemoved) {
        if (exIdx >= 0) {
          const item = { ...currentReactions[exIdx] };
          item.users = item.users.filter(u => u !== user);
          item.count = Math.max(0, item.count - 1);
          if (item.count <= 0) {
            currentReactions.splice(exIdx, 1);
          } else {
            currentReactions[exIdx] = item;
          }
        }
      } else {
        if (exIdx >= 0) {
          if (user && !currentReactions[exIdx].users.includes(user)) {
            currentReactions[exIdx].users.push(user);
            currentReactions[exIdx].count += 1;
          }
        } else {
          currentReactions.push({ emoji: targetEmoji, count: 1, users: user ? [user] : [] });
        }
      }
    }
    return { ...msg, reactions: currentReactions };
  });
};

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
    if (userId) {
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
              const processed = processFetchedMessages(msgs);
              setMessagesByChat(prev => {
                const current = prev[activeChatId] || [];
                if (current.length !== processed.length || (processed.length > 0 && current[current.length - 1]?.id !== processed[processed.length - 1]?.id)) {
                  return { ...prev, [activeChatId]: processed };
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
            const processed = processFetchedMessages(msgs);
            setMessagesByChat(prev => ({ ...prev, [activeChatId]: processed }));
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

      // Handle server ACK or status update
      if (incomingMsg.action === 'status_check' && incomingMsg.id) {
        setMessagesByChat(prev => {
          const chatMsgs = prev[chatId] || [];
          const idx = chatMsgs.findIndex(m => m.id === incomingMsg.id);
          if (idx >= 0) {
            const updated = [...chatMsgs];
            updated[idx] = {
              ...updated[idx],
              status: incomingMsg.status || 'sent',
              seqno: incomingMsg.seqno || updated[idx].seqno,
              pts: incomingMsg.pts || updated[idx].pts
            };
            return { ...prev, [chatId]: updated };
          }
          return prev;
        });
        return;
      }

      // Handle lightweight read receipt broadcast
      if (incomingMsg.action === 'read_receipt') {
        const targetChatId = (incomingMsg as any).toUser || (incomingMsg as any)['to-user'] || chatId;
        const maxSeq = (incomingMsg as any).max_seq || (incomingMsg as any).seqno || 0;
        setMessagesByChat(prev => {
          const chatMsgs = prev[targetChatId] || [];
          const updated = chatMsgs.map(m => {
            if (m.isOutgoing && (maxSeq === 0 || (m.seqno && m.seqno <= maxSeq))) {
              return { ...m, status: 'read' as const };
            }
            return m;
          });
          return { ...prev, [targetChatId]: updated };
        });
        return;
      }

      // Background prefetching for incoming voice notes and small photos (< 500 KB)
      if (!incomingMsg.isOutgoing && incomingMsg.media?.url) {
        try {
          const mediaUrl = incomingMsg.media.url;
          if (incomingMsg.media.type === 'photo') {
            const imgPre = new Image();
            imgPre.src = mediaUrl;
          } else if (incomingMsg.media.type === 'voice') {
            fetch(mediaUrl, { mode: 'cors' }).catch(() => {});
          }
        } catch (e) {
          // ignore prefetch errors
        }
      }

      // Handle real-time delete_message: remove message from feed across tabs and devices
      if (incomingMsg.action === 'delete_message') {
        const targetChatId = (incomingMsg as any).chatId || (incomingMsg.isOutgoing ? incomingMsg.toUser : incomingMsg.senderId) || chatId;
        const targetMsgId = (incomingMsg as any).messageId || (incomingMsg as any).message_id || incomingMsg.id;
        if (targetChatId && targetMsgId) {
          setMessagesByChat(prev => {
            const current = prev[targetChatId] || [];
            const filtered = current.filter(m => m.id !== targetMsgId);
            return { ...prev, [targetChatId]: filtered };
          });
        }
        return;
      }

      // Handle real-time reactions: update target message reaction badges instead of appending as a new message/sticker
      if (incomingMsg.action === 'reaction') {
        const targetChatId = (incomingMsg as any).chatId || (incomingMsg.isOutgoing ? incomingMsg.toUser : incomingMsg.senderId) || chatId;
        const targetMsgId = incomingMsg.reaction?.message_id || (incomingMsg as any).messageId || (incomingMsg as any).reaction?.messageId;
        const reactionEmoji = incomingMsg.reaction?.emoji || (incomingMsg as any).emoji || incomingMsg.message || '';
        const oldEmoji = incomingMsg.reaction?.old_emoji || (incomingMsg as any).old_emoji || '';
        const isRemoved = Boolean(
          incomingMsg.is_removed ||
          incomingMsg.reaction?.is_removed ||
          (incomingMsg as any).is_removed ||
          (incomingMsg as any).reaction?.is_removed ||
          (!reactionEmoji && oldEmoji)
        );
        const reactingUserId = incomingMsg.senderId || (incomingMsg as any).userId || (incomingMsg.isOutgoing ? account?.userId : targetChatId);

        if (targetChatId && targetMsgId) {
          setMessagesByChat(prev => {
            const chatMsgs = prev[targetChatId] || [];
            const updated = chatMsgs.map(msg => {
              const isTargetMsg = msg.id === targetMsgId || (msg.album && msg.album.some((p: any) => p.id === targetMsgId));
              if (!isTargetMsg) return msg;

              let currentReactions = msg.reactions ? [...msg.reactions] : [];

              if (isRemoved) {
                const removeEmoji = reactionEmoji || oldEmoji;
                if (removeEmoji) {
                  const exIdx = currentReactions.findIndex(r => r.emoji === removeEmoji);
                  if (exIdx >= 0) {
                    const r = { ...currentReactions[exIdx] };
                    if (reactingUserId) {
                      r.users = r.users.filter(u => u !== reactingUserId);
                    }
                    r.count = Math.max(0, r.count - 1);
                    if (r.count <= 0) {
                      currentReactions.splice(exIdx, 1);
                    } else {
                      currentReactions[exIdx] = r;
                    }
                  }
                }
              } else {
                // If there was an old_emoji replaced by a new one
                if (oldEmoji && oldEmoji !== reactionEmoji) {
                  const oldIdx = currentReactions.findIndex(r => r.emoji === oldEmoji);
                  if (oldIdx >= 0) {
                    const rOld = { ...currentReactions[oldIdx] };
                    if (reactingUserId) {
                      rOld.users = rOld.users.filter(u => u !== reactingUserId);
                    }
                    rOld.count = Math.max(0, rOld.count - 1);
                    if (rOld.count <= 0) {
                      currentReactions.splice(oldIdx, 1);
                    } else {
                      currentReactions[oldIdx] = rOld;
                    }
                  }
                }

                if (reactionEmoji) {
                  const existingReactionIdx = currentReactions.findIndex(r => r.emoji === reactionEmoji);
                  if (existingReactionIdx >= 0) {
                    const r = { ...currentReactions[existingReactionIdx] };
                    if (reactingUserId && !r.users.includes(reactingUserId)) {
                      r.users = [...r.users, reactingUserId];
                      r.count += 1;
                    }
                    currentReactions[existingReactionIdx] = r;
                  } else {
                    currentReactions.push({
                      emoji: reactionEmoji,
                      count: 1,
                      users: reactingUserId ? [reactingUserId] : []
                    });
                  }
                }
              }

              return { ...msg, reactions: currentReactions };
            });

            return { ...prev, [targetChatId]: updated };
          });
        }
        return;
      }

      setTypingChatIds(prev => ({ ...prev, [chatId]: false }));

      const isCurrentActive = activeChatIdRef.current === chatId;

      // Append message to chat (with group of photos / album support)
      let isDuplicate = false;
      let effectiveMsg = incomingMsg;

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

        // Group photos: if incoming message has mediaGroupId or is part of a media group
        const isPhoto = incomingMsg.media?.type === 'photo';
        if (isPhoto && incomingMsg.mediaGroupId) {
          const albumMsgIdx = chatMsgs.findIndex(
            m => m.mediaGroupId === incomingMsg.mediaGroupId
          );
          if (albumMsgIdx >= 0) {
            const updated = [...chatMsgs];
            const parentMsg = { ...updated[albumMsgIdx] };
            const existingAlbum = parentMsg.album || (parentMsg.media ? [parentMsg.media] : []);
            
            // If incoming photo URL not in album yet, append it
            const newPhotoUrl = incomingMsg.media!.url;
            if (!existingAlbum.some(p => p.url === newPhotoUrl)) {
              parentMsg.album = [...existingAlbum, incomingMsg.media!];
            }
            if (!parentMsg.message && incomingMsg.message) {
              parentMsg.message = incomingMsg.message;
            }
            parentMsg.timestamp = Math.max(parentMsg.timestamp, incomingMsg.timestamp);
            updated[albumMsgIdx] = parentMsg;
            effectiveMsg = parentMsg;
            return { ...prev, [chatId]: updated };
          }

          // First photo in this media group: initialize album array
          const initialAlbumMsg: ChatMessage = {
            ...incomingMsg,
            album: incomingMsg.album && incomingMsg.album.length > 0 ? incomingMsg.album : [incomingMsg.media!]
          };
          effectiveMsg = initialAlbumMsg;
          return {
            ...prev,
            [chatId]: [...chatMsgs, initialAlbumMsg]
          };
        }

        // Fallback photo grouping for rapid consecutive incoming photos from same sender (< 3.0s)
        if (isPhoto && !incomingMsg.isOutgoing && chatMsgs.length > 0) {
          const lastMsgIdx = chatMsgs.length - 1;
          const lastMsg = chatMsgs[lastMsgIdx];
          const isSameSender = !lastMsg.isOutgoing && lastMsg.senderId === incomingMsg.senderId;
          const isLastPhoto = (lastMsg.media?.type === 'photo' || Boolean(lastMsg.album && lastMsg.album.length > 0));
          const isRecent = Math.abs(incomingMsg.timestamp - lastMsg.timestamp) < 3000;

          if (isSameSender && isLastPhoto && isRecent) {
            const updated = [...chatMsgs];
            const parentMsg = { ...lastMsg };
            const existingAlbum = parentMsg.album || (parentMsg.media ? [parentMsg.media] : []);
            const newPhotoUrl = incomingMsg.media!.url;
            if (!existingAlbum.some(p => p.url === newPhotoUrl)) {
              parentMsg.album = [...existingAlbum, incomingMsg.media!];
            }
            if (!parentMsg.message && incomingMsg.message) {
              parentMsg.message = incomingMsg.message;
            }
            parentMsg.timestamp = Math.max(parentMsg.timestamp, incomingMsg.timestamp);
            updated[lastMsgIdx] = parentMsg;
            effectiveMsg = parentMsg;
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
      let senderName = effectiveMsg.senderName || `User ${chatId}`;
      let senderAvatar = effectiveMsg.senderAvatar;

      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c.id === chatId);

        if (existingIndex >= 0) {
          const updated = [...prev];
          const conv = { ...updated[existingIndex] };
          conv.lastMessage = effectiveMsg;
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
          if (conv.isPinned) {
            // Find the position among pinned items or keep at very top
            return [conv, ...updated];
          } else {
            // Insert after all pinned conversations so pinned chats remain permanently at the top
            const firstUnpinnedIndex = updated.findIndex(c => !c.isPinned);
            if (firstUnpinnedIndex === -1) {
              return [...updated, conv];
            } else {
              updated.splice(firstUnpinnedIndex, 0, conv);
              return updated;
            }
          }
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

          // Place after all pinned conversations
          const firstUnpinnedIndex = prev.findIndex(c => !c.isPinned);
          if (firstUnpinnedIndex === -1) {
            return [...prev, newConv];
          } else {
            const nextList = [...prev];
            nextList.splice(firstUnpinnedIndex, 0, newConv);
            return nextList;
          }
        }
      });

      if (!incomingMsg.isOutgoing) {
        if (!isCurrentActive) {
          const targetConv = conversations.find(c => c.id === chatId);
          const isMuted = Boolean(targetConv?.isMuted);

          if (!isMuted) {
            playReceiveSound();
          }

          setUnseenChatIds(prevUnseen => ({ ...prevUnseen, [chatId]: true }));
          const mediaType = incomingMsg.media?.type;
          const previewText = incomingMsg.message && incomingMsg.message !== '[Photo]' && incomingMsg.message !== '[Video]' && incomingMsg.message !== '[Voice message]'
            ? (mediaType === 'video' ? `📹 ${incomingMsg.message}` : mediaType === 'photo' ? `📷 ${incomingMsg.message}` : incomingMsg.message)
            : (mediaType === 'voice' ? '🎤 Voice message' : mediaType === 'video' ? '📹 Video' : mediaType === 'photo' ? '📷 Photo' : mediaType === 'file' ? `📄 ${incomingMsg.media?.fileName || 'File'}` : 'New incoming message');

          if (!isMuted) {
            notify({
              title: senderName,
              message: previewText,
              type: 'message',
              avatar: senderAvatar,
              chatId,
              actionLabel: 'Open Chat',
              onAction: () => selectChat(chatId)
            });
          }
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
          lastSeen: 'Individual Storage'
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
          lastSeen: 'Individual Storage'
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
      message: 'Message saved to your individual notes',
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

    let stickerUrl = sticker.url || '';
    if (!stickerUrl && sticker.svgContent) {
      stickerUrl = await svgToPngDataUrl(sticker.svgContent, 512);
    }

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
        url: stickerUrl,
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
      "file": stickerUrl,
      "sticker": {
        id: sticker.id,
        packId: sticker.packId,
        emoji: sticker.emoji,
        url: stickerUrl
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
    let fileHash: string | undefined = undefined;
    let microBlur: string | undefined = undefined;

    // Automatic Client-Side Image Compression & Micro Blur for Photos
    if (type === 'photo' && fileOrUrl instanceof File) {
      try {
        const [compressed, blur, hash] = await Promise.all([
          compressImage(fileOrUrl, 1600, 1600, 0.82),
          generateMicroBlurThumbnail(fileOrUrl),
          computeFileHash(fileOrUrl)
        ]);
        finalFileOrBlob = compressed.file;
        previewDataUrl = compressed.previewUrl;
        microBlur = blur;
        fileHash = hash;
      } catch (err) {
        console.warn('Image compression bypassed:', err);
      }
    } else if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
      try {
        fileHash = await computeFileHash(fileOrUrl);
      } catch (e) {
        // ignore hash error
      }
    }

    let mediaUrl = typeof finalFileOrBlob === 'string'
      ? finalFileOrBlob
      : previewDataUrl || URL.createObjectURL(finalFileOrBlob);

    const resolvedFileName = fileName || (typeof finalFileOrBlob === 'string'
      ? undefined
      : (finalFileOrBlob as File).name || (type === 'voice' ? 'voice.webm' : type === 'photo' ? 'photo.jpg' : type === 'video' ? 'video.mp4' : 'document.bin'));

    // Check media deduplication cache before uploading
    let alreadyUploaded = false;
    if (fileHash && typeof finalFileOrBlob !== 'string') {
      try {
        const hashCheck = await api.checkMediaHash(fileHash);
        if (hashCheck?.exists && hashCheck.url) {
          mediaUrl = hashCheck.url;
          alreadyUploaded = true;
          if (hashCheck.preview_blur && !microBlur) microBlur = hashCheck.preview_blur;
        }
      } catch (e) {
        // ignore check error
      }
    }

    // Upload to server if not deduplicated and live backend
    if (!alreadyUploaded && typeof finalFileOrBlob !== 'string') {
      try {
        const uploadRes = await api.uploadMedia(
          finalFileOrBlob,
          resolvedFileName || (type === 'video' ? 'video.mp4' : 'upload'),
          token || undefined,
          { file_hash: fileHash, preview_blur: microBlur }
        );
        if (uploadRes?.url) {
          mediaUrl = uploadRes.url;
        }
      } catch (err) {
        console.warn('Backend upload failed, utilizing local ObjectURL:', err);
      }
    }

    const actionType = type === 'photo' ? 'send_photo' : type === 'video' ? 'send_video' : 'send_media';

    const newLocalMediaMsg: ChatMessage = {
      id: msgId,
      senderId: account.userId,
      senderName: account.botName,
      toUser: currentChatId,
      message: caption?.trim() || (type === 'photo' ? '[Photo]' : type === 'video' ? '[Video]' : type === 'voice' ? '[Voice message]' : `[File: ${resolvedFileName}]`),
      timestamp: Date.now(),
      isOutgoing: true,
      status: 'pending',
      action: actionType,
      file_hash: fileHash,
      preview_blur: microBlur,
      media: {
        type,
        url: mediaUrl,
        duration,
        fileName: resolvedFileName,
        fileSize,
        preview_blur: microBlur,
        file_hash: fileHash
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
      "video": type === 'video' ? mediaUrl : undefined,
      "Action": actionType,
      "message": caption?.trim() || '',
      "caption": caption?.trim() || '',
      "action": actionType,
      "token": token || undefined,
      "session_token": token || undefined,
      "media": {
        type,
        url: mediaUrl,
        duration,
        fileName: resolvedFileName,
        fileSize
      }
    };

    try {
      const wsSent = wsService.send(payload);
      if (type === 'photo') {
        await api.sendPhoto({
          employee_id: account.userId,
          to_userid: currentChatId,
          file: mediaUrl,
          caption: caption || '',
          action: 'send_photo'
        }, token || undefined);
      } else if (!wsSent) {
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

    // Upload compressed photos to backend storage so server/Telegram get real accessible URLs
    const uploadedMediaItems: MediaItem[] = await Promise.all(
      compressedList.map(async (comp) => {
        try {
          const uploadRes = await api.uploadMedia(
            comp.file,
            comp.file.name || 'photo.jpg',
            token || undefined
          );
          return {
            type: 'photo' as const,
            url: uploadRes?.url || comp.previewUrl,
            fileName: comp.file.name,
            fileSize: `${Math.round(comp.compressedSize / 1024)} KB`
          };
        } catch {
          return {
            type: 'photo' as const,
            url: comp.previewUrl,
            fileName: comp.file.name,
            fileSize: `${Math.round(comp.compressedSize / 1024)} KB`
          };
        }
      })
    );

    const mediaAlbum: MediaItem[] = uploadedMediaItems;

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
    let isRemoved = false;

    setMessagesByChat(prev => {
      const msgs = prev[chatId] || [];
      const updated = msgs.map(msg => {
        const isTarget = msg.id === messageId || (msg.album && msg.album.some((p: any) => p.id === messageId));
        if (!isTarget) return msg;

        const currentReactions = msg.reactions ? [...msg.reactions] : [];
        const existingReactionIdx = currentReactions.findIndex(r => r.emoji === emoji);

        if (existingReactionIdx >= 0) {
          const r = { ...currentReactions[existingReactionIdx] };
          const userIndex = r.users.indexOf(currentUserId);
          if (userIndex >= 0) {
            // Remove user reaction
            r.users = r.users.filter(u => u !== currentUserId);
            r.count = r.count - 1;
            isRemoved = true;
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

    const payload = {
      "User-ID": currentUserId,
      "to-user": chatId,
      "message": emoji,
      "action": "reaction",
      "is_removed": isRemoved,
      "reaction": {
        message_id: messageId,
        emoji,
        is_removed: isRemoved
      }
    };

    // Notify backend/WebSocket with REST fallback
    const sent = wsService.send(payload);
    if (!sent) {
      api.sendMessage(payload, token || undefined).catch(() => {});
    }
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
  const deleteMessage = (chatId: string, messageId: string, deleteForEveryone: boolean = true) => {
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

      // Notify backend & Telegram via API and WebSocket
      if (account?.userId) {
        api.deleteMessage(account.userId, chatId, messageId, deleteForEveryone).catch(() => {});
        wsService.send({
          "User-ID": account.userId,
          "to-user": chatId,
          "message": messageId,
          "message_id": messageId,
          "delete_for_everyone": deleteForEveryone,
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
      const wsSent = wsService.send(payload);
      if (!wsSent) {
        await api.sendMessage(payload, token || undefined);
      }

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
  const clearChat = (chatId: string, _deleteForEveryone: boolean = true) => {
    setMessagesByChat(prev => ({ ...prev, [chatId]: [] }));
    setConversations(prev =>
      prev.map(c => (c.id === chatId ? { ...c, lastMessage: undefined, unreadCount: 0 } : c))
    );
    if (account?.userId) {
      api.wipeChatHistory(account.userId, chatId, false, false).catch(() => {});
    }
    notify({
      title: 'Chat Cleared',
      message: 'All messages in this chat have been cleared',
      type: 'info'
    });
  };

  // DELETE CHAT
  const deleteChat = (chatId: string, _deleteForEveryone: boolean = true) => {
    setConversations(prev => prev.filter(c => c.id !== chatId));
    setMessagesByChat(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
    setDraftsByChat(prev => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });

    if (account?.userId) {
      api.wipeChatHistory(account.userId, chatId, false, true).catch(() => {});
    }

    if (activeChatIdRef.current === chatId) {
      setActiveChatId(null);
    }

    dismissByChatId(chatId);

    notify({
      title: 'Chat Deleted',
      message: 'Conversation and history have been removed',
      type: 'info'
    });
  };

  // WIPE ALL CHATS
  const wipeAllChats = async () => {
    setConversations([]);
    setMessagesByChat({});
    setDraftsByChat({});
    setActiveChatId(null);
    if (userId) {
      try {
        localStorage.removeItem(`tg_convs_${userId}`);
        localStorage.removeItem(`tg_msgs_${userId}`);
        localStorage.removeItem(`tg_drafts_${userId}`);
      } catch {}
      await api.wipeChatHistory(userId, undefined, true).catch(() => {});
    }
    notify({
      title: 'Chats Wiped',
      message: 'All chats, history, and cached media have been cleared',
      type: 'info'
    });
  };

  // TOGGLE MUTE CHAT
  const toggleMuteChat = (chatId: string) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === chatId) {
          const nextMuted = !c.isMuted;
          notify({
            title: nextMuted ? 'Chat Muted' : 'Chat Unmuted',
            message: nextMuted ? 'Notifications silenced for this chat' : 'Notifications enabled for this chat',
            type: 'info'
          });
          return { ...c, isMuted: nextMuted };
        }
        return c;
      })
    );
  };

  const isChatMuted = (chatId: string): boolean => {
    const conv = conversations.find(c => c.id === chatId);
    return Boolean(conv?.isMuted);
  };

  // TOGGLE PIN CHAT
  const togglePinChat = (chatId: string) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === chatId) {
          const nextPinned = !c.isPinned;
          notify({
            title: nextPinned ? 'Chat Pinned' : 'Chat Unpinned',
            message: nextPinned ? 'Chat pinned to the top of your list' : 'Chat unpinned',
            type: 'info'
          });
          return { ...c, isPinned: nextPinned };
        }
        return c;
      })
    );
  };

  const isChatPinned = (chatId: string): boolean => {
    const conv = conversations.find(c => c.id === chatId);
    return Boolean(conv?.isPinned);
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
  const activeMessages = ((activeChatId ? messagesByChat[activeChatId] : []) || []).filter(m => m.action !== 'reaction');
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
        deleteChat,
        wipeAllChats,
        toggleMuteChat,
        isChatMuted,
        togglePinChat,
        isChatPinned,
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
