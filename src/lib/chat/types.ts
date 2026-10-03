export type Room = {
  id: number;
  name: string;
  createdBy: string;
  createdAt: string;
  memberCount: number;
};

export type ChatMessage = {
  id: number;
  roomId: number;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
};

export type PresenceUser = {
  userId: string;
  displayName: string;
  lastSeen: string;
};

export type WatchResult = {
  messages: ChatMessage[];
  presence: PresenceUser[];
};

export const MESSAGE_MAX = 1000;
export const HISTORY_DEFAULT = 50;
export const HISTORY_MAX = 100;
export const PRESENCE_TTL_SECONDS = 20;
export const WATCH_WAIT_MS = 8000;
export const WATCH_TICK_MS = 250;
