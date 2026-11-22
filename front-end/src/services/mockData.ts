import { ChatConversation, ChatMessage, TelegramUser } from '../types/chat';

export const MOCK_BOT_USER = {
  userId: 'bot_89201948',
  botName: 'Alpha Telegram Bot',
  botUsername: 'alpha_operator_bot',
  avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
  description: 'Official Telegram Bot for automated customer queries and interactive live support.',
  connectedAt: new Date().toLocaleTimeString(),
  bio: 'Automated staff bot operator instance connected to Python/Django backend.'
};

export const MOCK_USERS: TelegramUser[] = [
  {
    id: 'saved_messages',
    username: 'saved_messages',
    firstName: 'Saved Messages',
    lastName: '',
    avatar: '',
    online: true,
    lastSeen: 'Individual Storage',
    bio: 'Your private individual notes and workspace.'
  },
  {
    id: '8164206458',
    username: 'Mingstar01',
    firstName: 'Phal Lin Dara',
    lastName: '陈光明',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    online: true,
    lastSeen: 'online',
    employeeBadge: 'Lead Operator',
    bio: 'Telegram Platform Specialist • Lead Developer',
    phone: '+855 12 345 678'
  },
  {
    id: '1497801216',
    username: 'Kavv502',
    firstName: 'Kavv',
    lastName: '502',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    online: true,
    lastSeen: 'online',
    employeeBadge: 'VIP Client',
    bio: 'Crypto trader & automation bot enthusiast',
    phone: '+1 555 882 1092'
  },
  {
    id: '2071936331',
    username: 'visal_holland',
    firstName: 'Ratanakvisal',
    lastName: 'LENG',
    avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80',
    online: false,
    lastSeen: 'last seen 10 mins ago',
    employeeBadge: 'Client',
    bio: 'Enterprise customer relations manager',
    phone: '+855 98 765 432'
  },
  {
    id: 'user_10293847',
    username: 'alex_river',
    firstName: 'Alex',
    lastName: 'River',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    online: true,
    lastSeen: 'online',
    employeeBadge: 'Client',
    bio: 'Product Designer & Frontend Engineer • Available for consultation',
    phone: '+1 555 019 2831'
  },
  {
    id: 'user_58201944',
    username: 'sarah_chen',
    firstName: 'Sarah',
    lastName: 'Chen',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    online: false,
    lastSeen: 'last seen 5 mins ago',
    employeeBadge: 'Client',
    bio: 'DevOps & Cloud Infrastructure Lead',
    phone: '+1 555 092 8412'
  },
  {
    id: 'user_99201293',
    username: 'marcus_v',
    firstName: 'Marcus',
    lastName: 'Vance',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    online: true,
    lastSeen: 'online',
    employeeBadge: 'Client',
    bio: 'Backend Architecture & High-load APIs',
    phone: '+1 555 771 9021'
  },
  {
    id: 'user_77339102',
    username: 'elena_rostova',
    firstName: 'Elena',
    lastName: 'Rostova',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    online: false,
    lastSeen: 'last seen 2 hours ago',
    employeeBadge: 'VIP User',
    bio: 'Security researcher and audit specialist',
    phone: '+44 7911 123456'
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
      timestamp: Date.now() - 1000 * 60 * 5,
      isOutgoing: true,
      status: 'read'
    }
  },
  {
    id: '8164206458',
    user: MOCK_USERS[1],
    unreadCount: 0,
    isPinned: true,
    lastMessage: {
      id: 'm_ming_02',
      senderId: '8164206458',
      toUser: MOCK_BOT_USER.userId,
      message: 'All Telegram webhook updates and low-latency Channels are active! ⚡',
      timestamp: Date.now() - 1000 * 60 * 1,
      isOutgoing: false,
      status: 'read'
    }
  },
  {
    id: '1497801216',
    user: MOCK_USERS[2],
    unreadCount: 0,
    lastMessage: {
      id: 'm_kavv_01',
      senderId: '1497801216',
      toUser: MOCK_BOT_USER.userId,
      message: 'Can you check my bot account balance and API token?',
      timestamp: Date.now() - 1000 * 60 * 8,
      isOutgoing: false,
      status: 'read'
    }
  },
  {
    id: '2071936331',
    user: MOCK_USERS[3],
    unreadCount: 0,
    lastMessage: {
      id: 'm_visal_01',
      senderId: MOCK_BOT_USER.userId,
      toUser: '2071936331',
      message: 'Your customer support channel configuration has been updated.',
      timestamp: Date.now() - 1000 * 60 * 15,
      isOutgoing: true,
      status: 'read'
    }
  },
  {
    id: 'user_10293847',
    user: MOCK_USERS[4],
    unreadCount: 0,
    lastMessage: {
      id: 'm_105',
      senderId: 'user_10293847',
      toUser: MOCK_BOT_USER.userId,
      message: 'New UI design looks amazing! 🚀',
      timestamp: Date.now() - 1000 * 60 * 20,
      isOutgoing: false,
      status: 'read',
      media: {
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        fileName: 'preview.jpg',
        fileSize: '420 KB'
      }
    }
  },
  {
    id: 'user_58201944',
    user: MOCK_USERS[5],
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
    user: MOCK_USERS[6],
    unreadCount: 0,
    lastMessage: {
      id: 'm_302',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'user_99201293',
      message: 'Here is the interactive quick menu. Tap a button below to get started:',
      timestamp: Date.now() - 1000 * 60 * 45,
      isOutgoing: true,
      status: 'read',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌐 Official Portal', url: 'https://telegram.org' },
            { text: '⚡ Help Center', callback_data: 'help_faq' }
          ]
        ]
      }
    }
  },
  {
    id: 'user_77339102',
    user: MOCK_USERS[7],
    unreadCount: 0,
    lastMessage: {
      id: 'm_elena_01',
      senderId: 'user_77339102',
      toUser: MOCK_BOT_USER.userId,
      message: 'Security audit report attached for bot infrastructure review.',
      timestamp: Date.now() - 1000 * 60 * 90,
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
      status: 'read',
      reactions: [{ emoji: '⭐️', count: 1, users: ['bot_89201948'] }]
    },
    {
      id: 'm_saved_01',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'saved_messages',
      message: '📌 Notes: Remember to sync Django webhook endpoints for the 2.0 release.',
      timestamp: Date.now() - 1000 * 60 * 5,
      isOutgoing: true,
      status: 'read'
    }
  ],
  '8164206458': [
    {
      id: 'm_ming_01',
      senderId: '8164206458',
      toUser: MOCK_BOT_USER.userId,
      message: 'Hello Operator! Verifying low-latency Telegram webhook connection.',
      timestamp: Date.now() - 1000 * 60 * 10,
      isOutgoing: false,
      status: 'read'
    },
    {
      id: 'm_ming_02',
      senderId: '8164206458',
      toUser: MOCK_BOT_USER.userId,
      message: 'All Telegram webhook updates and low-latency Channels are active! ⚡',
      timestamp: Date.now() - 1000 * 60 * 1,
      isOutgoing: false,
      status: 'read',
      reactions: [{ emoji: '🔥', count: 1, users: ['bot_89201948'] }]
    }
  ],
  '1497801216': [
    {
      id: 'm_kavv_01',
      senderId: '1497801216',
      toUser: MOCK_BOT_USER.userId,
      message: 'Can you check my bot account balance and API token?',
      timestamp: Date.now() - 1000 * 60 * 8,
      isOutgoing: false,
      status: 'read'
    },
    {
      id: 'm_kavv_02',
      senderId: MOCK_BOT_USER.userId,
      toUser: '1497801216',
      message: 'Your token is active and operating normally on server port 8000.',
      timestamp: Date.now() - 1000 * 60 * 6,
      isOutgoing: true,
      status: 'read'
    }
  ],
  '2071936331': [
    {
      id: 'm_visal_01',
      senderId: MOCK_BOT_USER.userId,
      toUser: '2071936331',
      message: 'Your customer support channel configuration has been updated.',
      timestamp: Date.now() - 1000 * 60 * 15,
      isOutgoing: true,
      status: 'read'
    }
  ],
  'user_10293847': [
    {
      id: 'm_100',
      senderId: 'user_10293847',
      toUser: MOCK_BOT_USER.userId,
      message: 'Hello! I started the bot via /start',
      timestamp: Date.now() - 1000 * 60 * 45,
      isOutgoing: false,
      status: 'read'
    },
    {
      id: 'm_101',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'user_10293847',
      message: 'Welcome Alex! You are now connected to our Django-powered bot service.',
      timestamp: Date.now() - 1000 * 60 * 40,
      isOutgoing: true,
      status: 'read',
      reactions: [{ emoji: '👍', count: 1, users: ['user_10293847'] }]
    },
    {
      id: 'm_103',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'user_10293847',
      message: 'Yes! Here is a video demo of the real-time bot operations in action 🎥',
      timestamp: Date.now() - 1000 * 60 * 30,
      isOutgoing: true,
      status: 'read',
      media: {
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        duration: 15,
        fileName: 'bot_demo.mp4',
        fileSize: '1.8 MB'
      },
      reactions: [{ emoji: '🔥', count: 1, users: ['user_10293847'] }]
    },
    {
      id: 'm_105',
      senderId: 'user_10293847',
      toUser: MOCK_BOT_USER.userId,
      message: 'New UI design looks amazing! 🚀',
      timestamp: Date.now() - 1000 * 60 * 20,
      isOutgoing: false,
      status: 'read',
      media: {
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        fileName: 'preview.jpg',
        fileSize: '420 KB'
      }
    }
  ],
  'user_58201944': [
    {
      id: 'm_201',
      senderId: 'user_58201944',
      toUser: MOCK_BOT_USER.userId,
      message: 'Submitting verification request for account review.',
      timestamp: Date.now() - 1000 * 60 * 30,
      isOutgoing: false,
      status: 'read'
    },
    {
      id: 'm_202',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'user_58201944',
      message: 'Your verification token has been confirmed successfully.',
      timestamp: Date.now() - 1000 * 60 * 25,
      isOutgoing: true,
      status: 'read',
      reactions: [{ emoji: '🎉', count: 2, users: ['bot_89201948', 'user_58201944'] }]
    }
  ],
  'user_99201293': [
    {
      id: 'm_301',
      senderId: 'user_99201293',
      toUser: MOCK_BOT_USER.userId,
      message: 'Can I get the command list for this bot?',
      timestamp: Date.now() - 1000 * 60 * 65,
      isOutgoing: false,
      status: 'delivered'
    },
    {
      id: 'm_302',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'user_99201293',
      message: 'Here is the interactive quick menu. Tap a button below to get started:',
      timestamp: Date.now() - 1000 * 60 * 45,
      isOutgoing: true,
      status: 'read',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌐 Official Portal', url: 'https://telegram.org' },
            { text: '⚡ Help Center', callback_data: 'help_faq' }
          ]
        ]
      }
    }
  ],
  'user_77339102': [
    {
      id: 'm_elena_01',
      senderId: 'user_77339102',
      toUser: MOCK_BOT_USER.userId,
      message: 'Security audit report attached for bot infrastructure review.',
      timestamp: Date.now() - 1000 * 60 * 90,
      isOutgoing: false,
      status: 'read'
    },
    {
      id: 'm_elena_02',
      senderId: MOCK_BOT_USER.userId,
      toUser: 'user_77339102',
      message: 'Report received. All 142 Blue Team security checks passed.',
      timestamp: Date.now() - 1000 * 60 * 85,
      isOutgoing: true,
      status: 'read'
    }
  ]
};
