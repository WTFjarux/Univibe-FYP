// hooks/chatScreen/useChatMessages.ts

import { useState, useRef, useCallback, useEffect } from "react";
import chatApi from "../../lib/services/chatApi";
import { isTempId } from "../../lib/utils/messageIdGenerator";
import type { Message } from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Persistent Message Cache
// -----------------------------------------------------------------------------

interface CacheEntry {
  messages: Message[];
  hasMore: boolean;
  timestamp: number;
}

/** In-memory cache shared across all room instances */
const messageCache = new Map<string, CacheEntry>();

/** Cache expiration time in milliseconds */
const CACHE_TTL = 10 * 60 * 1000;

/** Number of messages to fetch on initial load */
const INITIAL_LIMIT = 30;

/** Number of messages to fetch when paginating */
const PAGINATION_LIMIT = 30;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

interface UseChatMessagesProps {
  token: string | null;
  roomId: string;
  userId?: string;
  userName?: string;
}

/**
 * Core hook for managing chat messages with caching, pagination,
 * optimistic updates, and deduplication.
 *
 * Messages are stored in chronological order (oldest first).
 */
export const useChatMessages = ({
  token,
  roomId,
  userId,
  userName,
}: UseChatMessagesProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  /** Tracks send timeout handlers for optimistic messages */
  const pendingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  /** Tracks already processed message IDs to prevent duplicates */
  const processedIdsRef = useRef<Set<string>>(new Set());

  /** Prevents state updates after unmount */
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      pendingTimeoutsRef.current.clear();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Cache Helpers
  // ---------------------------------------------------------------------------

  /** Retrieve cached messages for the current room */
  const getCache = useCallback((): CacheEntry | undefined => {
    return messageCache.get(roomId);
  }, [roomId]);

  /** Update the cache with validated messages and current timestamp */
  const updateCache = useCallback(
    (msgs: Message[], hasMoreFlag: boolean) => {
      const validMessages = msgs.filter((msg) => {
        if (msg.tempId && msg.status === "sending") return true;
        if (msg._id && !isTempId(msg._id) && msg.status !== "sending")
          return true;
        if (msg._id && msg.tempId) return true;
        return false;
      });

      messageCache.set(roomId, {
        messages: validMessages,
        hasMore: hasMoreFlag,
        timestamp: Date.now(),
      });
    },
    [roomId],
  );

  /** Retrieve only optimistic (pending/sending) messages from cache */
  const getOptimisticFromCache = useCallback((): Message[] => {
    const cached = getCache();
    if (!cached) return [];
    return cached.messages.filter(
      (msg) => msg.status === "sending" || isTempId(msg._id),
    );
  }, [getCache]);

  // ---------------------------------------------------------------------------
  // Message Deduplication
  // ---------------------------------------------------------------------------

  /**
   * Removes duplicate messages from an array based on message ID.
   * Iterates in reverse to keep the most recent occurrences.
   */
  const deduplicateMessages = useCallback((msgs: Message[]): Message[] => {
    const seen = new Set<string>();
    const result: Message[] = [];

    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];

      let key: string;
      if (!isTempId(msg._id) && msg._id) {
        key = msg._id;
      } else if (msg.tempId) {
        key = msg.tempId;
      } else {
        key = `unknown-${i}-${msg.createdAt}`;
      }

      if (!seen.has(key)) {
        seen.add(key);
        result.unshift(msg);
      }
    }

    return result;
  }, []);

  // ---------------------------------------------------------------------------
  // Load Messages (Initial & Refresh)
  // ---------------------------------------------------------------------------

  /**
   * Loads messages for the current room.
   * When `forceRefresh` is true, the cache is bypassed entirely.
   * Falls back to cached data if the server request fails.
   */
  const loadMessages = useCallback(
    async (forceRefresh = false) => {
      if (!token || !isMountedRef.current) return;

      const cached = getCache();
      const now = Date.now();

      // Serve from cache if valid and not forcing refresh
      if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL) {
        if (isMountedRef.current) {
          setMessages(cached.messages);
          setHasMore(cached.hasMore);

          processedIdsRef.current.clear();
          cached.messages.forEach((msg) => {
            if (msg._id && !isTempId(msg._id)) {
              processedIdsRef.current.add(msg._id);
            }
          });

          setLoading(false);
        }
        return;
      }

      // Fetch from server
      try {
        const response = await chatApi.getMessagesLight(roomId, INITIAL_LIMIT);

        if (response.success && isMountedRef.current) {
          const serverMessages: Message[] = response.data.messages || [];

          // Discard optimistic messages when forcing refresh
          const optimisticMessages = forceRefresh
            ? []
            : getOptimisticFromCache();

          const combined = [...serverMessages, ...optimisticMessages];
          const finalMessages = deduplicateMessages(combined);

          processedIdsRef.current.clear();
          finalMessages.forEach((msg) => {
            if (msg._id && !isTempId(msg._id)) {
              processedIdsRef.current.add(msg._id);
            }
          });

          setMessages(finalMessages);
          setHasMore(response.data.hasMore);
          updateCache(finalMessages, response.data.hasMore);
        }
      } catch (error) {
        // Fallback to cache on network failure
        if (cached && isMountedRef.current) {
          setMessages(cached.messages);
          setHasMore(cached.hasMore);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      token,
      roomId,
      getCache,
      getOptimisticFromCache,
      updateCache,
      deduplicateMessages,
    ],
  );

  // ---------------------------------------------------------------------------
  // Load Older Messages (Pagination)
  // ---------------------------------------------------------------------------

  /**
   * Loads older messages for pagination.
   * Uses the timestamp of the oldest currently loaded message as the cursor.
   */
  const loadOlderMessages = useCallback(async () => {
    if (
      !token ||
      !hasMore ||
      loadingMore ||
      messages.length === 0 ||
      !isMountedRef.current
    )
      return;

    setLoadingMore(true);
    const oldestMessage = messages[0];

    try {
      const response = await chatApi.getMessagesLight(
        roomId,
        PAGINATION_LIMIT,
        oldestMessage.createdAt,
      );

      if (response.success && isMountedRef.current) {
        const olderMessages: Message[] = response.data.messages || [];

        olderMessages.forEach((msg) => {
          if (msg._id) processedIdsRef.current.add(msg._id);
        });

        setMessages((prev) => {
          const optimisticMessages = prev.filter(
            (msg) => msg.status === "sending" || isTempId(msg._id),
          );

          const combined = [...olderMessages.reverse(), ...prev];
          const finalMessages = deduplicateMessages(combined);
          updateCache(finalMessages, response.data.hasMore);
          return finalMessages;
        });

        setHasMore(response.data.hasMore);
      }
    } catch (error) {
      // Silently fail - user can retry by scrolling
    } finally {
      if (isMountedRef.current) {
        setLoadingMore(false);
      }
    }
  }, [
    token,
    roomId,
    hasMore,
    loadingMore,
    messages,
    updateCache,
    deduplicateMessages,
  ]);

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  /** Pull-to-refresh handler that bypasses cache */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMessages(true);
  }, [loadMessages]);

  // ---------------------------------------------------------------------------
  // Optimistic Message Management
  // ---------------------------------------------------------------------------

  /**
   * Adds a temporary optimistic message to the state before server confirmation.
   * Returns the created message for reference.
   */
  const addOptimisticMessage = useCallback(
    (tempId: string, messageData: Partial<Message>) => {
      const optimisticMessage: Message = {
        _id: tempId,
        tempId: tempId,
        sender: userId || "",
        senderName: userName || "You",
        message: messageData.message || "",
        roomId,
        createdAt: messageData.createdAt || new Date().toISOString(),
        status: "sending",
        type: messageData.type || "text",
        mediaUrl: messageData.mediaUrl,
        mediaName: messageData.mediaName,
        mediaSize: messageData.mediaSize,
        duration: messageData.duration,
        replyTo: messageData.replyTo,
        reactions: [],
        groupId: messageData.groupId,
        groupIndex: messageData.groupIndex,
        groupTotal: messageData.groupTotal,
        readBy: [{ user: userId || "", readAt: new Date().toISOString() }],
        deliveredTo: [
          { user: userId || "", deliveredAt: new Date().toISOString() },
        ],
      };

      setMessages((prev) => {
        const updated = [...prev, optimisticMessage];
        updateCache(updated, hasMore);
        return updated;
      });

      return optimisticMessage;
    },
    [userId, userName, roomId, hasMore, updateCache],
  );

  /**
   * Removes a failed optimistic message and clears its timeout.
   */
  const removeOptimisticMessage = useCallback(
    (tempId: string) => {
      const timeout = pendingTimeoutsRef.current.get(tempId);
      if (timeout) {
        clearTimeout(timeout);
        pendingTimeoutsRef.current.delete(tempId);
      }

      setMessages((prev) => {
        const filtered = prev.filter(
          (msg) => msg._id !== tempId && msg.tempId !== tempId,
        );
        updateCache(filtered, hasMore);
        return filtered;
      });

      processedIdsRef.current.delete(tempId);
    },
    [hasMore, updateCache],
  );

  /**
   * Replaces an optimistic message with the confirmed server version.
   * Handles edge cases where the message already exists in state.
   */
  const confirmOptimisticMessage = useCallback(
    (tempId: string, messageId: string, serverData?: Partial<Message>) => {
      const timeout = pendingTimeoutsRef.current.get(tempId);
      if (timeout) {
        clearTimeout(timeout);
        pendingTimeoutsRef.current.delete(tempId);
      }

      setMessages((prev) => {
        // If confirmed message already exists, just remove the temp
        if (messageId && prev.some((msg) => msg._id === messageId)) {
          const updated = prev.filter(
            (msg) => msg._id !== tempId && msg.tempId !== tempId,
          );
          updateCache(updated, hasMore);
          return updated;
        }

        const tempIndex = prev.findIndex(
          (msg) => msg._id === tempId || msg.tempId === tempId,
        );

        // If temp message not found in state
        if (tempIndex === -1) {
          if (
            serverData &&
            messageId &&
            !prev.some((msg) => msg._id === messageId)
          ) {
            const newMessage = {
              ...serverData,
              _id: messageId,
              status: "sent" as const,
              readBy: [
                { user: userId || "", readAt: new Date().toISOString() },
              ],
              deliveredTo: [
                { user: userId || "", deliveredAt: new Date().toISOString() },
              ],
            } as Message;
            const updated = [...prev, newMessage];
            updateCache(updated, hasMore);
            processedIdsRef.current.add(messageId);
            return updated;
          }
          return prev;
        }

        // Merge temp message with server data
        const existingMsg = prev[tempIndex];
        const confirmedMessage: Message = {
          ...existingMsg,
          ...serverData,
          _id: messageId,
          tempId: undefined,
          status: "sent" as const,
          mediaUrl: serverData?.mediaUrl || existingMsg.mediaUrl,
          mediaName: serverData?.mediaName || existingMsg.mediaName,
          mediaSize: serverData?.mediaSize || existingMsg.mediaSize,
          reactions: existingMsg.reactions || [],
          groupId: serverData?.groupId || existingMsg.groupId,
          groupIndex: serverData?.groupIndex ?? existingMsg.groupIndex,
          groupTotal: serverData?.groupTotal ?? existingMsg.groupTotal,
          readBy: existingMsg.readBy || [
            { user: userId || "", readAt: new Date().toISOString() },
          ],
          deliveredTo: existingMsg.deliveredTo || [
            { user: userId || "", deliveredAt: new Date().toISOString() },
          ],
        };

        const updated = [...prev];
        updated[tempIndex] = confirmedMessage;

        updateCache(updated, hasMore);
        if (messageId) processedIdsRef.current.add(messageId);

        return updated;
      });
    },
    [hasMore, updateCache, userId],
  );

  // ---------------------------------------------------------------------------
  // Real-Time Message Handlers
  // ---------------------------------------------------------------------------

  /**
   * Adds a real-time message received via socket.
   * Performs deduplication against existing messages and removes
   * matching optimistic messages.
   */
  const addMessage = useCallback(
    (message: Message) => {
      if (!message._id) return;

      if (processedIdsRef.current.has(message._id)) return;

      setMessages((prev) => {
        const exists = prev.some((msg) => msg._id === message._id);
        if (exists) return prev;

        // Remove optimistic messages that match this incoming message
        const filtered = prev.filter((msg) => {
          if (msg.status === "sending" || isTempId(msg._id)) {
            const isMatch =
              msg.message === message.message &&
              msg.type === message.type &&
              (typeof msg.sender === "string"
                ? msg.sender
                : msg.sender?._id) ===
                (typeof message.sender === "string"
                  ? message.sender
                  : message.sender?._id);

            return !isMatch;
          }
          return true;
        });

        processedIdsRef.current.add(message._id);

        const updated = [...filtered, { ...message, status: "sent" as const }];
        updateCache(updated, hasMore);

        return updated;
      });
    },
    [hasMore, updateCache],
  );

  /** Updates the reactions array for a specific message */
  const updateMessageReactions = useCallback(
    (messageId: string, reactions: Message["reactions"]) => {
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg,
        );
        updateCache(updated, hasMore);
        return updated;
      });
    },
    [hasMore, updateCache],
  );

  /** Removes a message from state and cache by its ID */
  const deleteMessage = useCallback(
    (messageId: string) => {
      setMessages((prev) => {
        const updated = prev.filter((msg) => msg._id !== messageId);
        updateCache(updated, hasMore);
        return updated;
      });

      if (messageId) {
        processedIdsRef.current.delete(messageId);
      }
    },
    [hasMore, updateCache],
  );

  // ---------------------------------------------------------------------------
  // Pending Timeout Management
  // ---------------------------------------------------------------------------

  /** Stores a send timeout for an optimistic message */
  const setPendingTimeout = useCallback(
    (tempId: string, timeout: ReturnType<typeof setTimeout>) => {
      pendingTimeoutsRef.current.set(tempId, timeout);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** Clears all pending send timeouts */
  const clearAllPending = useCallback(() => {
    pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pendingTimeoutsRef.current.clear();
  }, []);

  /** Removes the cached messages for the current room */
  const clearCache = useCallback(() => {
    messageCache.delete(roomId);
  }, [roomId]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    messages,
    setMessages,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    loadMessages,
    loadOlderMessages,
    onRefresh,
    addOptimisticMessage,
    removeOptimisticMessage,
    confirmOptimisticMessage,
    addMessage,
    updateMessageReactions,
    deleteMessage,
    setPendingTimeout,
    clearAllPending,
    clearCache,
    processedIdsRef,
  };
};
