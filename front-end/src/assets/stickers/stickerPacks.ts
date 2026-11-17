import { StickerPack } from '../../types/chat';

export const PREINSTALLED_STICKER_PACKS: StickerPack[] = [
  {
    id: 'spotty-dog',
    title: 'Spotty Dog',
    icon: '🐶',
    stickers: [
      {
        id: 'spotty_wave',
        packId: 'spotty-dog',
        emoji: '👋',
        name: 'Spotty Wave',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <ellipse cx="50" cy="55" rx="35" ry="32" fill="#E8EEF4"/>
          <path d="M20 30 Q12 10 28 22" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <path d="M80 30 Q88 10 72 22" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <ellipse cx="38" cy="48" rx="5" ry="6" fill="#17212B"/>
          <ellipse cx="62" cy="48" rx="5" ry="6" fill="#17212B"/>
          <circle cx="40" cy="46" r="2" fill="#FFFFFF"/>
          <circle cx="64" cy="46" r="2" fill="#FFFFFF"/>
          <ellipse cx="50" cy="58" rx="7" ry="5" fill="#2B5278"/>
          <path d="M44 65 Q50 72 56 65" stroke="#17212B" stroke-width="3" stroke-linecap="round" fill="none"/>
          <path d="M75 55 Q92 40 85 32" stroke="#E8EEF4" stroke-width="10" stroke-linecap="round" fill="none"/>
          <circle cx="85" cy="32" r="5" fill="#E8EEF4"/>
          <ellipse cx="68" cy="42" rx="10" ry="12" fill="#D4AF37" opacity="0.35"/>
        </svg>`
      },
      {
        id: 'spotty_love',
        packId: 'spotty-dog',
        emoji: '❤️',
        name: 'Spotty Love',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <ellipse cx="50" cy="55" rx="35" ry="32" fill="#E8EEF4"/>
          <path d="M22 32 Q14 12 30 24" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <path d="M78 32 Q86 12 70 24" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <path d="M32 48 Q38 42 44 48" stroke="#E11D48" stroke-width="4" stroke-linecap="round" fill="none"/>
          <path d="M56 48 Q62 42 68 48" stroke="#E11D48" stroke-width="4" stroke-linecap="round" fill="none"/>
          <ellipse cx="50" cy="58" rx="7" ry="5" fill="#2B5278"/>
          <path d="M43 64 Q50 72 57 64" stroke="#17212B" stroke-width="3" fill="#E11D48"/>
          <path d="M50 24 C45 15, 30 18, 30 28 C30 38, 50 48, 50 48 C50 48, 70 38, 70 28 C70 18, 55 15, 50 24 Z" fill="#E11D48"/>
        </svg>`
      },
      {
        id: 'spotty_cool',
        packId: 'spotty-dog',
        emoji: '😎',
        name: 'Spotty Cool',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <ellipse cx="50" cy="55" rx="35" ry="32" fill="#E8EEF4"/>
          <path d="M20 30 Q12 10 28 22" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <path d="M80 30 Q88 10 72 22" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <!-- Sunglasses -->
          <rect x="25" y="42" width="22" height="14" rx="4" fill="#111827"/>
          <rect x="53" y="42" width="22" height="14" rx="4" fill="#111827"/>
          <line x1="47" y1="46" x2="53" y2="46" stroke="#111827" stroke-width="4"/>
          <line x1="28" y1="45" x2="40" y2="52" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"/>
          <line x1="56" y1="45" x2="68" y2="52" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="50" cy="62" rx="7" ry="5" fill="#2B5278"/>
          <path d="M46 70 Q54 74 58 68" stroke="#17212B" stroke-width="3" stroke-linecap="round" fill="none"/>
        </svg>`
      },
      {
        id: 'spotty_cry',
        packId: 'spotty-dog',
        emoji: '😭',
        name: 'Spotty Tears',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <ellipse cx="50" cy="55" rx="35" ry="32" fill="#E8EEF4"/>
          <path d="M22 34 Q10 20 25 28" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <path d="M78 34 Q90 20 75 28" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <path d="M34 48 Q40 44 46 48" stroke="#1E293B" stroke-width="4" fill="none"/>
          <path d="M54 48 Q60 44 66 48" stroke="#1E293B" stroke-width="4" fill="none"/>
          <path d="M38 52 C35 65, 30 75, 36 82 C40 82, 42 72, 40 54 Z" fill="#38BDF8"/>
          <path d="M62 52 C65 65, 70 75, 64 82 C60 82, 58 72, 60 54 Z" fill="#38BDF8"/>
          <ellipse cx="50" cy="60" rx="7" ry="5" fill="#2B5278"/>
          <path d="M43 72 Q50 66 57 72" stroke="#17212B" stroke-width="3" stroke-linecap="round" fill="none"/>
        </svg>`
      },
      {
        id: 'spotty_celebrate',
        packId: 'spotty-dog',
        emoji: '🎉',
        name: 'Spotty Celebrate',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <polygon points="50,5 65,30 35,30" fill="#F59E0B"/>
          <circle cx="50" cy="5" r="4" fill="#EF4444"/>
          <ellipse cx="50" cy="60" rx="34" ry="30" fill="#E8EEF4"/>
          <path d="M20 38 Q12 18 28 28" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <path d="M80 38 Q88 18 72 28" stroke="#2B5278" stroke-width="8" stroke-linecap="round" fill="none"/>
          <ellipse cx="38" cy="54" rx="5" ry="6" fill="#17212B"/>
          <ellipse cx="62" cy="54" rx="5" ry="6" fill="#17212B"/>
          <circle cx="40" cy="52" r="2" fill="#FFFFFF"/>
          <circle cx="64" cy="52" r="2" fill="#FFFFFF"/>
          <ellipse cx="50" cy="64" rx="7" ry="5" fill="#2B5278"/>
          <path d="M42 70 Q50 82 58 70" stroke="#17212B" stroke-width="3" fill="#EF4444"/>
          <circle cx="20" cy="60" r="3" fill="#EC4899"/>
          <circle cx="82" cy="50" r="3" fill="#3B82F6"/>
          <polygon points="78,72 82,75 80,80 76,76" fill="#10B981"/>
        </svg>`
      },
      {
        id: 'spotty_typing',
        packId: 'spotty-dog',
        emoji: '💻',
        name: 'Spotty Working',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <ellipse cx="50" cy="45" rx="32" ry="28" fill="#E8EEF4"/>
          <ellipse cx="40" cy="40" rx="4" ry="5" fill="#17212B"/>
          <ellipse cx="60" cy="40" rx="4" ry="5" fill="#17212B"/>
          <rect x="25" y="65" width="50" height="25" rx="4" fill="#334155"/>
          <polygon points="20,90 80,90 75,93 25,93" fill="#1E293B"/>
          <ellipse cx="50" cy="50" rx="6" ry="4" fill="#2B5278"/>
          <path d="M50 70 L48 78 L53 78 Z" fill="#38BDF8"/>
        </svg>`
      }
    ]
  },
  {
    id: 'cute-animals',
    title: 'Cute Animals',
    icon: '🐱',
    stickers: [
      {
        id: 'cat_happy',
        packId: 'cute-animals',
        emoji: '😻',
        name: 'Cat Happy',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <polygon points="25,25 35,45 15,45" fill="#F97316"/>
          <polygon points="75,25 85,45 65,45" fill="#F97316"/>
          <ellipse cx="50" cy="55" rx="35" ry="30" fill="#FDBA74"/>
          <path d="M32 50 Q40 45 42 52" stroke="#7C2D12" stroke-width="4" stroke-linecap="round" fill="none"/>
          <path d="M68 50 Q60 45 58 52" stroke="#7C2D12" stroke-width="4" stroke-linecap="round" fill="none"/>
          <polygon points="50,57 47,61 53,61" fill="#DC2626"/>
          <path d="M44 65 Q50 70 56 65" stroke="#7C2D12" stroke-width="3" stroke-linecap="round" fill="none"/>
          <line x1="20" y1="58" x2="10" y2="56" stroke="#7C2D12" stroke-width="2"/>
          <line x1="20" y1="63" x2="10" y2="65" stroke="#7C2D12" stroke-width="2"/>
          <line x1="80" y1="58" x2="90" y2="56" stroke="#7C2D12" stroke-width="2"/>
          <line x1="80" y1="63" x2="90" y2="65" stroke="#7C2D12" stroke-width="2"/>
        </svg>`
      },
      {
        id: 'panda_hug',
        packId: 'cute-animals',
        emoji: '🐼',
        name: 'Panda Hug',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <circle cx="25" cy="30" r="14" fill="#18181B"/>
          <circle cx="75" cy="30" r="14" fill="#18181B"/>
          <ellipse cx="50" cy="55" rx="36" ry="32" fill="#F4F4F5"/>
          <ellipse cx="36" cy="50" rx="9" ry="11" fill="#18181B" transform="rotate(-15 36 50)"/>
          <ellipse cx="64" cy="50" rx="9" ry="11" fill="#18181B" transform="rotate(15 64 50)"/>
          <circle cx="37" cy="48" r="3" fill="#FFFFFF"/>
          <circle cx="63" cy="48" r="3" fill="#FFFFFF"/>
          <ellipse cx="50" cy="58" rx="6" ry="4" fill="#18181B"/>
          <path d="M45 64 Q50 68 55 64" stroke="#18181B" stroke-width="3" stroke-linecap="round" fill="none"/>
        </svg>`
      },
      {
        id: 'fox_wink',
        packId: 'cute-animals',
        emoji: '🦊',
        name: 'Fox Wink',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <polygon points="18,18 36,44 14,46" fill="#EA580C"/>
          <polygon points="82,18 86,46 64,44" fill="#EA580C"/>
          <polygon points="22,24 33,42 18,43" fill="#FED7AA"/>
          <polygon points="78,24 82,43 67,42" fill="#FED7AA"/>
          <path d="M50 82 L16 46 Q50 30 84 46 Z" fill="#EA580C"/>
          <path d="M50 82 L28 54 Q50 48 72 54 Z" fill="#FFFFFF"/>
          <ellipse cx="36" cy="48" rx="4" ry="5" fill="#1E293B"/>
          <circle cx="37" cy="46" r="1.5" fill="#FFFFFF"/>
          <path d="M60 48 Q65 44 70 48" stroke="#1E293B" stroke-width="3" stroke-linecap="round" fill="none"/>
          <ellipse cx="50" cy="78" rx="6" ry="4" fill="#1E293B"/>
        </svg>`
      },
      {
        id: 'bunny_hearts',
        packId: 'cute-animals',
        emoji: '🐰',
        name: 'Bunny Shy',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md">
          <ellipse cx="35" cy="24" rx="8" ry="20" fill="#FCE7F3"/>
          <ellipse cx="65" cy="24" rx="8" ry="20" fill="#FCE7F3"/>
          <ellipse cx="35" cy="25" rx="4" ry="14" fill="#F472B6"/>
          <ellipse cx="65" cy="25" rx="4" ry="14" fill="#F472B6"/>
          <ellipse cx="50" cy="60" rx="32" ry="28" fill="#FDF2F8"/>
          <circle cx="38" cy="55" r="4" fill="#475569"/>
          <circle cx="62" cy="55" r="4" fill="#475569"/>
          <polygon points="50,62 47,65 53,65" fill="#EC4899"/>
          <ellipse cx="30" cy="62" rx="6" ry="4" fill="#F472B6" opacity="0.4"/>
          <ellipse cx="70" cy="62" rx="6" ry="4" fill="#F472B6" opacity="0.4"/>
        </svg>`
      }
    ]
  },
  {
    id: 'reactions-3d',
    title: '3D Reactions',
    icon: '✨',
    stickers: [
      {
        id: 'fire_3d',
        packId: 'reactions-3d',
        emoji: '🔥',
        name: 'Super Fire',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-lg">
          <defs>
            <linearGradient id="fireGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#DC2626"/>
              <stop offset="50%" stop-color="#EA580C"/>
              <stop offset="90%" stop-color="#FBBF24"/>
            </linearGradient>
            <linearGradient id="fireCore" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="#F59E0B"/>
              <stop offset="100%" stop-color="#FEF08A"/>
            </linearGradient>
          </defs>
          <path d="M50 10 C58 26, 75 36, 75 58 C75 75, 62 90, 50 90 C38 90, 25 75, 25 58 C25 42, 38 32, 42 20 C42 30, 48 35, 50 10 Z" fill="url(#fireGrad)"/>
          <path d="M50 40 C55 50, 64 56, 64 68 C64 78, 58 84, 50 84 C42 84, 36 78, 36 68 C36 58, 44 54, 46 46 C46 52, 49 54, 50 40 Z" fill="url(#fireCore)"/>
        </svg>`
      },
      {
        id: 'rocket_3d',
        packId: 'reactions-3d',
        emoji: '🚀',
        name: 'To the Moon',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-lg">
          <defs>
            <linearGradient id="rocketBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#F8FAFC"/>
              <stop offset="100%" stop-color="#94A3B8"/>
            </linearGradient>
          </defs>
          <path d="M68 20 C68 20, 45 18, 32 38 C24 50, 28 62, 28 62 L38 58 L42 68 C42 68, 54 72, 66 64 C86 51, 84 28, 84 28 L68 20 Z" fill="url(#rocketBody)"/>
          <polygon points="26,64 12,78 28,74" fill="#EF4444"/>
          <polygon points="56,66 64,88 68,72" fill="#DC2626"/>
          <polygon points="34,44 12,48 28,54" fill="#DC2626"/>
          <circle cx="56" cy="42" r="7" fill="#0284C7"/>
          <circle cx="56" cy="42" r="5" fill="#38BDF8"/>
          <!-- Flame trail -->
          <polygon points="22,70 8,88 18,78" fill="#F59E0B"/>
          <polygon points="18,74 2,98 12,82" fill="#EF4444"/>
        </svg>`
      },
      {
        id: 'gold_crown',
        packId: 'reactions-3d',
        emoji: '👑',
        name: 'Gold Crown',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-lg">
          <defs>
            <linearGradient id="goldCrownGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FDE047"/>
              <stop offset="50%" stop-color="#EAB308"/>
              <stop offset="100%" stop-color="#A16207"/>
            </linearGradient>
          </defs>
          <path d="M15 70 L25 35 L42 52 L50 24 L58 52 L75 35 L85 70 Z" fill="url(#goldCrownGrad)" stroke="#713F12" stroke-width="2"/>
          <rect x="15" y="70" width="70" height="12" rx="3" fill="#CA8A04"/>
          <circle cx="25" cy="35" r="4" fill="#EF4444"/>
          <circle cx="50" cy="24" r="5" fill="#3B82F6"/>
          <circle cx="75" cy="35" r="4" fill="#10B981"/>
          <circle cx="32" cy="76" r="3" fill="#EF4444"/>
          <circle cx="50" cy="76" r="3" fill="#FFFFFF"/>
          <circle cx="68" cy="76" r="3" fill="#3B82F6"/>
        </svg>`
      },
      {
        id: 'gold_star',
        packId: 'reactions-3d',
        emoji: '⭐',
        name: 'Telegram Star',
        svgContent: `<svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-lg">
          <defs>
            <linearGradient id="tgStarGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#FFFBEB"/>
              <stop offset="40%" stop-color="#FCD34D"/>
              <stop offset="100%" stop-color="#D97706"/>
            </linearGradient>
          </defs>
          <polygon points="50,12 62,38 90,40 68,58 75,86 50,71 25,86 32,58 10,40 38,38" fill="url(#tgStarGrad)" stroke="#B45309" stroke-width="2"/>
          <polygon points="50,18 59,38 80,40 64,54 69,76 50,64" fill="#FEF3C7" opacity="0.6"/>
        </svg>`
      }
    ]
  }
];
