import React from 'react';
import { Bookmark, Users } from 'lucide-react';

interface AvatarProps {
  id: string;
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  isSavedMessages?: boolean;
  isGroup?: boolean;
}

const MODERN_GRADIENTS = [
  'from-blue-600 to-cyan-500',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-violet-600 to-purple-500',
  'from-indigo-500 to-blue-500'
];

export const Avatar: React.FC<AvatarProps> = ({
  id,
  name,
  avatarUrl,
  size = 'md',
  isOnline,
  isSavedMessages,
  isGroup
}) => {
  const charCode = (id || name || 'A').charCodeAt(0);
  const gradient = MODERN_GRADIENTS[charCode % MODERN_GRADIENTS.length];

  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm font-semibold',
    lg: 'w-14 h-14 text-base font-bold',
    xl: 'w-20 h-20 text-2xl font-bold'
  }[size];

  const initials = name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'TG';

  const iconSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
  }[size];

  if (isSavedMessages || id === 'saved_messages') {
    return (
      <div className="relative inline-block flex-shrink-0 select-none">
        <div
          className={`${sizeClasses} rounded-full bg-gradient-to-tr from-[#229ad6] to-[#2aabee] text-white flex items-center justify-center shadow-md shadow-[#2aabee]/20 ring-1 ring-white/15`}
        >
          <Bookmark className={`${iconSize} fill-white stroke-[2.3]`} />
        </div>
      </div>
    );
  }

  if (isGroup && !avatarUrl) {
    return (
      <div className="relative inline-block flex-shrink-0 select-none">
        <div
          className={`${sizeClasses} rounded-full bg-gradient-to-tr from-[#4f46e5] to-[#7c3aed] text-white flex items-center justify-center shadow-md shadow-indigo-500/20 ring-1 ring-white/15`}
        >
          <Users className={`${iconSize} stroke-[2.3]`} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block flex-shrink-0 select-none">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClasses} rounded-full object-cover ring-1 ring-white/10 shadow-sm`}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className={`${sizeClasses} rounded-full bg-gradient-to-tr ${gradient} text-white flex items-center justify-center font-medium shadow-sm ring-1 ring-white/10`}
        >
          {initials}
        </div>
      )}

      {isOnline && (
        <span
          className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[var(--color-bg-base)] rounded-full shadow-sm animate-soft-pulse"
          title="Online"
        />
      )}
    </div>
  );
};
