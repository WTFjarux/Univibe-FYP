// hooks/chatScreen/useMessageStore.ts

import { useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isTempId } from "../../lib/utils/messageIdGenerator";
import type { Message } from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Metadata tracked per chat room */
interface RoomMetadata {
  lastMessageId?: string;
  unreadCount: number;
  lastReadAt?: string;
  lastFetchedAt: number;
  hasMore: boolean;
}

/** In-memory cache structure */
interface CacheStore {
  messagesById: Map<string, Message>;
  roomMessages: Map<string, string[]>;
  roomMetadata: Map<string, RoomMetadata>;
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const STORAGE_PREFIX = "@chat_cache_";

/** Maximum number of messages to keep cached per room */
const MAX_CACHED_MESSAGES_PER_ROOM = 200;

// -----------------------------------------------------------------------------
// MessageStore Class
// -----------------------------------------------------------------------------

/**
 * Singleton store that manages cached messages, room metadata,
 * and AsyncStorage persistence.
 *
 * All messages are stored in a normalized structure:
 * - `messagesById`:  Map of message ID → Message object
 * - `roomMessages`:  Map of room ID → ordered array of message IDs
 * - `roomMetadata`:  Map of room ID → RoomMetadata
 *
 * Subscribers (React components) are notified on any state change,
 * and data is persisted to AsyncStorage with debouncing.
 */
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

  // ---------------------------------------------------------------------------
  // Subscription (React Integration)
  // ---------------------------------------------------------------------------

  /**
   * Registers a listener that is called whenever the store changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /** Notifies all subscribers and schedules a persistence write */
  private notify(): void {
    this.subscribers.forEach((listener) => listener());
    this.schedulePersist();
  }

  /** Debounces persistence writes to avoid excessive I/O */
  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistToAsyncStorage(), 2000);
  }

  // ---------------------------------------------------------------------------
  // Message Operations
  // ---------------------------------------------------------------------------

  /**
   * Returns messages for a room in chronological order.
   * Optionally limits to the most recent N messages.
   */
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

  /** Returns a single message by its ID */
  getMessage(messageId: string): Message | undefined {
    return this.store.messagesById.get(messageId);
  }

  /**
   * Adds a single message to the store.
   * Skips duplicates by checking message IDs.
   * Maintains chronological ordering and enforces cache size limits.
   */
  addMessage(roomId: string, message: Message): void {
    if (!isTempId(message._id) && this.store.messagesById.has(message._id)) {
      return;
    }

    this.store.messagesById.set(message._id, message);

    let roomMessages = this.store.roomMessages.get(roomId) || [];

    // Remove temp IDs if this is the confirmed version
    if (!isTempId(message._id)) {
      roomMessages = roomMessages.filter(
        (id) => id !== message._id && !isTempId(id),
      );
    }

    const newList = [...roomMessages, message._id];
    newList.sort((a, b) => {
      const msgA = this.store.messagesById.get(a);
      const msgB = this.store.messagesById.get(b);
      if (!msgA || !msgB) return 0;
      return (
        new Date(msgA.createdAt).getTime() - new Date(msgB.createdAt).getTime()
      );
    });

    // Enforce cache size limit by removing oldest messages
    while (newList.length > MAX_CACHED_MESSAGES_PER_ROOM) {
      const removed = newList.shift();
      if (removed) this.store.messagesById.delete(removed);
    }

    this.store.roomMessages.set(roomId, newList);
    this.notify();
  }

  /**
   * Adds multiple messages at once.
   * Filters out already-cached messages to avoid duplicates.
   */
  addMessages(roomId: string, messages: Message[]): void {
    const newMessages = messages.filter(
      (msg) => !this.store.messagesById.has(msg._id),
    );

    if (newMessages.length === 0) return;

    newMessages.forEach((msg) => {
      this.store.messagesById.set(msg._id, msg);
    });

    let existingIds = this.store.roomMessages.get(roomId) || [];
    const newIds = [...existingIds, ...newMessages.map((m) => m._id)];

    // Deduplicate and sort chronologically
    const uniqueIds = [...new Map(newIds.map((id) => [id, id])).values()];
    uniqueIds.sort((a, b) => {
      const msgA = this.store.messagesById.get(a);
      const msgB = this.store.messagesById.get(b);
      if (!msgA || !msgB) return 0;
      return (
        new Date(msgA.createdAt).getTime() - new Date(msgB.createdAt).getTime()
      );
    });

    while (uniqueIds.length > MAX_CACHED_MESSAGES_PER_ROOM) {
      const removed = uniqueIds.shift();
      if (removed) this.store.messagesById.delete(removed);
    }

    this.store.roomMessages.set(roomId, uniqueIds);
    this.notify();
  }

  /** Merges partial updates into an existing message */
  updateMessage(messageId: string, updates: Partial<Message>): void {
    const existing = this.store.messagesById.get(messageId);
    if (existing) {
      this.store.messagesById.set(messageId, { ...existing, ...updates });
      this.notify();
    }
  }

  /**
   * Replaces a temporary (optimistic) message with the confirmed server version.
   * Finds which room the temp message belongs to and swaps it.
   */
  replaceTempMessage(tempId: string, realMessage: Message): void {
    let targetRoomId: string | null = null;
    for (const [roomId, ids] of this.store.roomMessages.entries()) {
      if (ids.includes(tempId)) {
        targetRoomId = roomId;
        break;
      }
    }

    if (targetRoomId) {
      const roomMessages = this.store.roomMessages.get(targetRoomId) || [];
      const filtered = roomMessages.filter((id) => id !== tempId);
      this.store.roomMessages.set(targetRoomId, filtered);
      this.store.messagesById.delete(tempId);

      this.addMessage(targetRoomId, realMessage);
    }
  }

  /** Removes a message from the store by its ID */
  deleteMessage(roomId: string, messageId: string): void {
    const roomMessages = this.store.roomMessages.get(roomId) || [];
    this.store.roomMessages.set(
      roomId,
      roomMessages.filter((id) => id !== messageId),
    );
    this.store.messagesById.delete(messageId);
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Metadata Operations
  // ---------------------------------------------------------------------------

  /** Returns metadata for a room (unread count, pagination status, etc.) */
  getRoomMetadata(roomId: string): RoomMetadata | undefined {
    return this.store.roomMetadata.get(roomId);
  }

  /** Updates or creates metadata for a room */
  setRoomMetadata(roomId: string, metadata: Partial<RoomMetadata>): void {
    const existing = this.store.roomMetadata.get(roomId) || {
      unreadCount: 0,
      lastFetchedAt: 0,
      hasMore: true,
    };
    this.store.roomMetadata.set(roomId, { ...existing, ...metadata });
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Persists the last 50 messages per room to AsyncStorage.
   * Temporary (optimistic) messages are excluded.
   */
  private async persistToAsyncStorage(): Promise<void> {
    try {
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
      // Silently fail — cache is not critical
    }
  }

  /** Loads previously persisted messages from AsyncStorage */
  private async loadFromAsyncStorage(): Promise<void> {
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
      // Silently fail — cache is not critical
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** Removes all cached data for a specific room */
  clearRoom(roomId: string): void {
    const messageIds = this.store.roomMessages.get(roomId) || [];
    messageIds.forEach((id) => this.store.messagesById.delete(id));
    this.store.roomMessages.delete(roomId);
    this.store.roomMetadata.delete(roomId);
    this.notify();
  }

  /** Removes all cached data across all rooms */
  clearAll(): void {
    this.store.messagesById.clear();
    this.store.roomMessages.clear();
    this.store.roomMetadata.clear();
    this.notify();
  }
}

// -----------------------------------------------------------------------------
// Singleton Instance
// -----------------------------------------------------------------------------

export const messageStore = new MessageStore();

// -----------------------------------------------------------------------------
// React Hook
// -----------------------------------------------------------------------------

/**
 * React hook that provides access to the MessageStore for a specific room.
 * Automatically re-renders when the store data for that room changes.
 */
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
