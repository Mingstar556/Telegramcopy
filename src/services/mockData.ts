import { ChatConversation, ChatMessage, TelegramUser } from '../types/chat';

export const MOCK_BOT_USER = {
  userId: 'bot_89201948',
  botName: 'Alpha Telegram Bot',
  botUsername: 'alpha_operator_bot',
  avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  description: 'Official Telegram Bot for automated customer queries and interactive live support.',
  connectedAt: new Date().toLocaleTimeString()
};

export const MOCK_USERS: TelegramUser[] = [
  {
    id: 'saved_messages',
    username: 'saved_messages',
    firstName: 'Saved Messages',
    lastName: '',
    avatar: '',
    online: true,
    lastSeen: 'Cloud Storage'
  },
  {
    id: 'group_support_alpha',
    username: 'support_squad_alpha',
    firstName: 'Support Squad Alpha 🎧',
    lastName: '',
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150&auto=format&fit=crop&q=80',
    online: true,
    lastSeen: '5 members'
  },
  {
    id: 'user_10293847',
    username: 'alex_river',
    firstName: 'Alex',
    lastName: 'River',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    online: true,
    lastSeen: 'online',
    employeeBadge: 'Client'
  },
  {
    id: 'user_58201944',
    username: 'sarah_chen',
    firstName: 'Sarah',
    lastName: 'Chen',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    online: false,
    lastSeen: 'last seen 5 mins ago',
    employeeBadge: 'Client'
  },
  {
    id: 'user_99201293',
    username: 'marcus_v',
    firstName: 'Marcus',
    lastName: 'Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    online: true,
    lastSeen: 'online',
    employeeBadge: 'Client'
  },
  {
    id: 'user_77339102',
    username: 'elena_rostova',
    firstName: 'Elena',
    lastName: 'Rostova',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    online: false,
    lastSeen: 'last seen 2 hours ago',
    employeeBadge: 'VIP User'
  },
  {
    id: 'special_direct_bot',
    username: 'special_assistant',
    firstName: 'Special Channel',
    lastName: '⚡',
    avatar: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=150&auto=format&fit=crop&q=80',
    isBot: true,
    online: true,
    lastSeen: 'always active'
  }
];

export const INITIAL_MOCK_CONVERSATIONS: ChatConversation[] = [
  {
    id: 'saved_messages',
    user: MOCK_USERS[0],
    unreadCount: 0,
    isPinned: true,
    isSavedMessages: true,
    lastMessage: {
      id: 'm_saved_01',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'saved_messages',
      message: '📌 Notes: Remember to sync Django webhook endpoints for the 2.0 release.',
      timestamp: Date.now() - 1000 * 60 * 10,
      isOutgoing: true,
      status: 'read'
    }
  },
  {
    id: 'group_support_alpha',
    user: MOCK_USERS[1],
    unreadCount: 3,
    isGroup: true,
    category: 'Customer Support',
    memberCount: 5,
    lastMessage: {
      id: 'm_grp_02',
      senderId: 'user_10293847',
      toUser: 'group_support_alpha',
      message: 'Alex: Just dispatched the morning Telegram ticket queue.',
      timestamp: Date.now() - 1000 * 60 * 2,
      isOutgoing: false,
      status: 'read'
    }
  },
  {
    id: 'user_10293847',
    user: MOCK_USERS[2],
    unreadCount: 2,
    lastMessage: {
      id: 'm_102',
      senderId: 'user_10293847',
      toUser: MOCK_BOT_USER.userId,
      message: 'Hey, is the telegram bot running the latest integration?',
      timestamp: Date.now() - 1000 * 60 * 3,
      isOutgoing: false,
      status: 'read'
    }
  },
  {
    id: 'user_58201944',
    user: MOCK_USERS[3],
    unreadCount: 0,
    lastMessage: {
      id: 'm_202',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'user_58201944',
      message: 'Your verification token has been confirmed successfully.',
      timestamp: Date.now() - 1000 * 60 * 25,
      isOutgoing: true,
      status: 'read'
    }
  },
  {
    id: 'user_99201293',
    user: MOCK_USERS[4],
    unreadCount: 1,
    lastMessage: {
      id: 'm_301',
      senderId: 'user_99201293',
      toUser: MOCK_BOT_USER.userId,
      message: 'Can I get the command list for this bot?',
      timestamp: Date.now() - 1000 * 60 * 65,
      isOutgoing: false,
      status: 'delivered'
    }
  },
  {
    id: 'special_direct_bot',
    user: MOCK_USERS[6],
    unreadCount: 0,
    isPinned: true,
    lastMessage: {
      id: 'm_sp_01',
      senderId: 'special_direct_bot',
      toUser: MOCK_BOT_USER.userId,
      message: 'Special direct channel active. Send any test message or command.',
      timestamp: Date.now() - 1000 * 60 * 120,
      isOutgoing: false,
      status: 'read'
    }
  }
];

export const INITIAL_MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  'saved_messages': [
    {
      id: 'm_saved_00',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'saved_messages',
      message: '⭐️ Welcome to Saved Messages! Forward messages here or use it as your personal scratchpad, draft storage, and file cloud.',
      timestamp: Date.now() - 1000 * 60 * 180,
      isOutgoing: true,
      status: 'read'
    },
    {
      id: 'm_saved_01',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'saved_messages',
      message: '📌 Notes: Remember to sync Django webhook endpoints for the 2.0 release.',
      timestamp: Date.now() - 1000 * 60 * 10,
      isOutgoing: true,
      status: 'read'
    }
  ],
  'group_support_alpha': [
    {
      id: 'm_grp_00',
      senderId: 'user_58201944',
      senderName: 'Sarah Chen',
      toUser: 'group_support_alpha',
      message: 'Team, please review the new Telegram bot broadcast templates.',
      timestamp: Date.now() - 1000 * 60 * 45,
      isOutgoing: false,
      status: 'read'
    },
    {
      id: 'm_grp_01',
      senderId: MOCK_BOT_USER.userId,
      senderName: 'Alpha Bot Operator',
      toUser: 'group_support_alpha',
      message: 'All staff endpoints are verified on Django Channels.',
      timestamp: Date.now() - 1000 * 60 * 30,
      isOutgoing: true,
      status: 'read'
    },
    {
      id: 'm_grp_02',
      senderId: 'user_10293847',
      senderName: 'Alex River',
      toUser: 'group_support_alpha',
      message: 'Alex: Just dispatched the morning Telegram ticket queue.',
      timestamp: Date.now() - 1000 * 60 * 2,
      isOutgoing: false,
      status: 'read'
    }
  ],
  'user_10293847': [
    {
      id: 'm_100',
      senderId: 'user_10293847',
      toUser: MOCK_BOT_USER.userId,
      message: 'Hello! I started the bot via /start',
      timestamp: Date.now() - 1000 * 60 * 15,
      isOutgoing: false,
      status: 'read'
    },
    {
      id: 'm_101',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'user_10293847',
      message: 'Welcome Alex! You are now connected to our Django-powered bot service.',
      timestamp: Date.now() - 1000 * 60 * 12,
      isOutgoing: true,
      status: 'read'
    },
    {
      id: 'm_102',
      senderId: 'user_10293847',
      toUser: MOCK_BOT_USER.userId,
      message: 'Hey, is the telegram bot running the latest integration?',
      timestamp: Date.now() - 1000 * 60 * 3,
      isOutgoing: false,
      status: 'read'
    }
  ],
  'special_direct_bot': [
    {
      id: 'm_sp_00',
      senderId: 'special_direct_bot',
      toUser: MOCK_BOT_USER.userId,
      message: '✨ Welcome to Special Direct Bot Channel! Here you can test bot interactions and direct client messages in real time.',
      timestamp: Date.now() - 1000 * 60 * 200,
      isOutgoing: false,
      status: 'read'
    },
    {
      id: 'm_sp_01',
      senderId: 'special_direct_bot',
      toUser: MOCK_BOT_USER.userId,
      message: 'Special direct channel active. Send any test message or command.',
      timestamp: Date.now() - 1000 * 60 * 120,
      isOutgoing: false,
      status: 'read'
    }
  ]
};
