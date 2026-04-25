// hooks/chatScreen/useMessageStore.ts
import { useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isTempId } from "../../lib/utils/messageIdGenerator";
import type { Message } from "../../lib/types/chat.types";

// ============================================
// NORMALIZED CACHE STORE
// ============================================

interface RoomMetadata {
  lastMessageId?: string;
  unreadCount: number;
  lastReadAt?: string;
  lastFetchedAt: number;
  hasMore: boolean;
}

interface CacheStore {
  messagesById: Map<string, Message>;
  roomMessages: Map<string, string[]>;
  roomMetadata: Map<string, RoomMetadata>;
}

const STORAGE_PREFIX = "@chat_cache_";
const MAX_CACHED_MESSAGES_PER_ROOM = 200;

class MessageStore {
  private store: CacheStore;
  private subscribers: Set<() => void> = new Set();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.store = {
      messagesById: new Map(),
      roomMessages: new Map(),
      roomMetadata: new Map(),
    };
    this.loadFromAsyncStorage();
  }

  // ============================================
  // SUBSCRIPTION (React integration)
  // ============================================

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  private notify() {
    this.subscribers.forEach((listener) => listener());
    this.schedulePersist();
  }

  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistToAsyncStorage(), 2000);
  }

  // ============================================
  // MESSAGE OPERATIONS
  // ============================================

  getMessages(roomId: string, limit?: number): Message[] {
    const messageIds = this.store.roomMessages.get(roomId) || [];
    const messages = messageIds
      .map((id) => this.store.messagesById.get(id))
      .filter((m): m is Message => !!m);

    if (limit && messages.length > limit) {
      return messages.slice(-limit);
    }
    return messages;
  }

  getMessage(messageId: string): Message | undefined {
    return this.store.messagesById.get(messageId);
  }

  addMessage(roomId: string, message: Message): void {
    // Skip if already exists
    if (!isTempId(message._id) && this.store.messagesById.has(message._id)) {
      return;
    }

    // Store message
    this.store.messagesById.set(message._id, message);

    // Update room message list
    let roomMessages = this.store.roomMessages.get(roomId) || [];

    // Remove temp ID if this is replacing
    if (!isTempId(message._id)) {
      roomMessages = roomMessages.filter(
        (id) => id !== message._id && !isTempId(id),
      );
    }

    // Add new message (maintain order by createdAt)
    const newList = [...roomMessages, message._id];
    newList.sort((a, b) => {
      const msgA = this.store.messagesById.get(a);
      const msgB = this.store.messagesById.get(b);
      if (!msgA || !msgB) return 0;
      return (
        new Date(msgA.createdAt).getTime() - new Date(msgB.createdAt).getTime()
      );
    });

    // Limit cache size
    while (newList.length > MAX_CACHED_MESSAGES_PER_ROOM) {
      const removed = newList.shift();
      if (removed) this.store.messagesById.delete(removed);
    }

    this.store.roomMessages.set(roomId, newList);
    this.notify();
  }

  addMessages(roomId: string, messages: Message[]): void {
    // Filter out existing messages to avoid duplicates
    const newMessages = messages.filter(
      (msg) => !this.store.messagesById.has(msg._id),
    );

    if (newMessages.length === 0) return;

    // Add all messages
    newMessages.forEach((msg) => {
      this.store.messagesById.set(msg._id, msg);
    });

    // Update room message list
    let existingIds = this.store.roomMessages.get(roomId) || [];
    const newIds = [...existingIds, ...newMessages.map((m) => m._id)];

    // Deduplicate and sort
    const uniqueIds = [...new Map(newIds.map((id) => [id, id])).values()];
    uniqueIds.sort((a, b) => {
      const msgA = this.store.messagesById.get(a);
      const msgB = this.store.messagesById.get(b);
      if (!msgA || !msgB) return 0;
      return (
        new Date(msgA.createdAt).getTime() - new Date(msgB.createdAt).getTime()
      );
    });

    // Limit cache size
    while (uniqueIds.length > MAX_CACHED_MESSAGES_PER_ROOM) {
      const removed = uniqueIds.shift();
      if (removed) this.store.messagesById.delete(removed);
    }

    this.store.roomMessages.set(roomId, uniqueIds);
    this.notify();
  }

  updateMessage(messageId: string, updates: Partial<Message>): void {
    const existing = this.store.messagesById.get(messageId);
    if (existing) {
      this.store.messagesById.set(messageId, { ...existing, ...updates });
      this.notify();
    }
  }

  replaceTempMessage(tempId: string, realMessage: Message): void {
    // Find which room contains this temp message
    let targetRoomId: string | null = null;
    for (const [roomId, ids] of this.store.roomMessages.entries()) {
      if (ids.includes(tempId)) {
        targetRoomId = roomId;
        break;
      }
    }

    if (targetRoomId) {
      // Remove temp message
      const roomMessages = this.store.roomMessages.get(targetRoomId) || [];
      const filtered = roomMessages.filter((id) => id !== tempId);
      this.store.roomMessages.set(targetRoomId, filtered);
      this.store.messagesById.delete(tempId);

      // Add real message
      this.addMessage(targetRoomId, realMessage);
    }
  }

  deleteMessage(roomId: string, messageId: string): void {
    const roomMessages = this.store.roomMessages.get(roomId) || [];
    this.store.roomMessages.set(
      roomId,
      roomMessages.filter((id) => id !== messageId),
    );
    this.store.messagesById.delete(messageId);
    this.notify();
  }

  // ============================================
  // METADATA OPERATIONS
  // ============================================

  getRoomMetadata(roomId: string): RoomMetadata | undefined {
    return this.store.roomMetadata.get(roomId);
  }

  setRoomMetadata(roomId: string, metadata: Partial<RoomMetadata>): void {
    const existing = this.store.roomMetadata.get(roomId) || {
      unreadCount: 0,
      lastFetchedAt: 0,
      hasMore: true,
    };
    this.store.roomMetadata.set(roomId, { ...existing, ...metadata });
    this.notify();
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private async persistToAsyncStorage() {
    try {
      // Only persist recent messages (last 50 per room)
      const toPersist: Record<string, any> = {};

      for (const [roomId, messageIds] of this.store.roomMessages.entries()) {
        const last50Ids = messageIds.slice(-50);
        const messages = last50Ids
          .map((id) => this.store.messagesById.get(id))
          .filter((m) => m && !isTempId(m._id));

        if (messages.length > 0) {
          toPersist[`${STORAGE_PREFIX}${roomId}`] = messages;
        }
      }

      await AsyncStorage.multiSet(
        Object.entries(toPersist).map(([key, value]) => [
          key,
          JSON.stringify(value),
        ]),
      );
    } catch (error) {
      console.warn("Failed to persist messages:", error);
    }
  }

  private async loadFromAsyncStorage() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const chatKeys = keys.filter((key) => key.startsWith(STORAGE_PREFIX));

      for (const key of chatKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const messages: Message[] = JSON.parse(value);
          const roomId = key.replace(STORAGE_PREFIX, "");
          this.addMessages(roomId, messages);
        }
      }
    } catch (error) {
      console.warn("Failed to load messages from storage:", error);
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  clearRoom(roomId: string): void {
    const messageIds = this.store.roomMessages.get(roomId) || [];
    messageIds.forEach((id) => this.store.messagesById.delete(id));
    this.store.roomMessages.delete(roomId);
    this.store.roomMetadata.delete(roomId);
    this.notify();
  }

  clearAll(): void {
    this.store.messagesById.clear();
    this.store.roomMessages.clear();
    this.store.roomMetadata.clear();
    this.notify();
  }
}

// Singleton instance
export const messageStore = new MessageStore();

// React hook for using the store
export function useMessageStore(roomId: string) {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = messageStore.subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, []);

  const messages = messageStore.getMessages(roomId);
  const metadata = messageStore.getRoomMetadata(roomId);

  return {
    messages,
    metadata,
    addMessage: (message: Message) => messageStore.addMessage(roomId, message),
    addMessages: (messages: Message[]) =>
      messageStore.addMessages(roomId, messages),
    updateMessage: (messageId: string, updates: Partial<Message>) =>
      messageStore.updateMessage(messageId, updates),
    replaceTempMessage: (tempId: string, realMessage: Message) =>
      messageStore.replaceTempMessage(tempId, realMessage),
    deleteMessage: (messageId: string) =>
      messageStore.deleteMessage(roomId, messageId),
    setMetadata: (metadata: Partial<RoomMetadata>) =>
      messageStore.setRoomMetadata(roomId, metadata),
  };
}
