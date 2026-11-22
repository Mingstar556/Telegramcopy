/**
 * Resilient persistent storage for Telegram Bot Client
 * Ensures chat history, conversations, reactions, drafts, and settings persist across page refresh.
 */

export const StorageKeys = {
  conversations: (userId: string) => `tg_conversations_${userId}`,
  messages: (userId: string) => `tg_messages_${userId}`,
  drafts: (userId: string) => `tg_drafts_${userId}`,
  recentStickers: 'tg_recent_stickers',
  recentEmojis: 'tg_recent_emojis',
  savedAccounts: 'tg_saved_accounts',
  activeAccountId: 'tg_active_account_id',
  theme: 'tg_theme',
  chatSettings: 'tg_chat_settings'
};

export function getStoredItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[Storage] Failed to read key: ${key}`, e);
    return defaultValue;
  }
}

export function setStoredItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[Storage] Failed to write key: ${key}`, e);
  }
}

export function removeStoredItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[Storage] Failed to remove key: ${key}`, e);
  }
}
