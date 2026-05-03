// hooks/chatScreen/useChatMessages.ts
// Message state management: cache, pagination, optimistic updates, real-time additions

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
  isCleared?: boolean;
  clearedAt?: string | null;
}

const messageCache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const INITIAL_LIMIT = 30;
const PAGINATION_LIMIT = 30;
const MAX_PROCESSED_IDS = 200;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

interface UseChatMessagesProps {
  token: string | null;
  roomId: string;
  userId?: string;
  userName?: string;
}

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
  const [isCleared, setIsCleared] = useState(false);
  const [clearedAt, setClearedAt] = useState<string | null>(null);

  // Refs to avoid stale closures in cache updates
  const isClearedRef = useRef(isCleared);
  const clearedAtRef = useRef(clearedAt);
  const isMountedRef = useRef(true);
  const pendingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const processedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    isClearedRef.current = isCleared;
    clearedAtRef.current = clearedAt;
  }, [isCleared, clearedAt]);

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

  const getCache = useCallback((): CacheEntry | undefined => {
    return messageCache.get(roomId);
  }, [roomId]);

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
        isCleared: isClearedRef.current,
        clearedAt: clearedAtRef.current,
      });
    },
    [roomId],
  );

  const getOptimisticFromCache = useCallback((): Message[] => {
    const cached = getCache();
    if (!cached) return [];
    return cached.messages.filter(
      (msg) => msg.status === "sending" || isTempId(msg._id),
    );
  }, [getCache]);

  // ---------------------------------------------------------------------------
  // Deduplication
  // ---------------------------------------------------------------------------

  const deduplicateMessages = useCallback((msgs: Message[]): Message[] => {
    const seen = new Set<string>();
    const result: Message[] = [];

    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      const key =
        !isTempId(msg._id) && msg._id
          ? msg._id
          : msg.tempId || `unknown-${i}-${msg.createdAt}`;

      if (!seen.has(key)) {
        seen.add(key);
        result.unshift(msg);
      }
    }
    return result;
  }, []);

  // ---------------------------------------------------------------------------
  // Load Messages (initial + pagination)
  // ---------------------------------------------------------------------------

  const loadMessages = useCallback(
    async (forceRefresh = false) => {
      if (!token || !isMountedRef.current) return;

      const cached = getCache();
      const now = Date.now();

      // Return cached data if fresh
      if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL) {
        if (isMountedRef.current) {
          setMessages(cached.messages);
          setHasMore(cached.hasMore);
          setIsCleared(cached.isCleared || false);
          setClearedAt(cached.clearedAt || null);

          processedIdsRef.current.clear();
          cached.messages.forEach((msg) => {
            if (msg._id && !isTempId(msg._id))
              processedIdsRef.current.add(msg._id);
          });
          setLoading(false);
        }
        return;
      }

      try {
        const response = await chatApi.getMessagesLight(roomId, INITIAL_LIMIT);

        if (response.success && isMountedRef.current) {
          const serverMessages: Message[] = response.data.messages || [];
          const optimisticMessages = forceRefresh
            ? []
            : getOptimisticFromCache();
          const finalMessages = deduplicateMessages([
            ...serverMessages,
            ...optimisticMessages,
          ]);

          processedIdsRef.current.clear();
          finalMessages.forEach((msg) => {
            if (msg._id && !isTempId(msg._id))
              processedIdsRef.current.add(msg._id);
          });

          setMessages(finalMessages);
          setHasMore(response.data.hasMore);
          setIsCleared(response.data.isCleared || false);
          setClearedAt(response.data.clearedAt || null);
          updateCache(finalMessages, response.data.hasMore);
        }
      } catch (error) {
        // Fallback to cache on error
        if (cached && isMountedRef.current) {
          setMessages(cached.messages);
          setHasMore(cached.hasMore);
          setIsCleared(cached.isCleared || false);
          setClearedAt(cached.clearedAt || null);
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
          const optimistic = prev.filter(
            (msg) => msg.status === "sending" || isTempId(msg._id),
          );
          const finalMessages = deduplicateMessages([
            ...olderMessages.reverse(),
            ...prev,
          ]);
          updateCache(finalMessages, response.data.hasMore);
          return finalMessages;
        });
        setHasMore(response.data.hasMore);
      }
    } catch (error) {
      // Silently fail
    } finally {
      if (isMountedRef.current) setLoadingMore(false);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMessages(true);
  }, [loadMessages]);

  // ---------------------------------------------------------------------------
  // Optimistic Messages
  // ---------------------------------------------------------------------------

  const addOptimisticMessage = useCallback(
    (tempId: string, messageData: Partial<Message>) => {
      const optimisticMessage: Message = {
        _id: tempId,
        tempId,
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

  const confirmOptimisticMessage = useCallback(
    (tempId: string, messageId: string, serverData?: Partial<Message>) => {
      const timeout = pendingTimeoutsRef.current.get(tempId);
      if (timeout) {
        clearTimeout(timeout);
        pendingTimeoutsRef.current.delete(tempId);
      }

      setMessages((prev) => {
        // Already confirmed via real-time
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
        if (tempIndex === -1) return prev;

        const confirmedMessage: Message = {
          ...prev[tempIndex],
          ...serverData,
          _id: messageId,
          tempId: undefined,
          status: "sent" as const,
        };

        const updated = [...prev];
        updated[tempIndex] = confirmedMessage;
        updateCache(updated, hasMore);
        if (messageId) processedIdsRef.current.add(messageId);
        return updated;
      });
    },
    [hasMore, updateCache],
  );

  // ---------------------------------------------------------------------------
  // Real-Time Message Handlers
  // ---------------------------------------------------------------------------

  const addMessage = useCallback(
    (message: Message) => {
      if (!message._id) return;

      // Block duplicates synchronously
      if (processedIdsRef.current.has(message._id)) return;
      processedIdsRef.current.add(message._id);
      console.log(
        `📥 addMessage: id=${message._id}, status=${message.status}, sender=${typeof message.sender === "string" ? message.sender : message.sender?._id}`,
      );

      // Prevent unbounded growth
      if (processedIdsRef.current.size > MAX_PROCESSED_IDS) {
        const entries = [...processedIdsRef.current];
        processedIdsRef.current = new Set(entries.slice(-100));
      }

      setMessages((prev) => {
        if (prev.some((msg) => msg._id === message._id)) return prev;

        // Remove matching optimistic messages
        const filtered = prev.filter((msg) => {
          if (msg.status === "sending" || isTempId(msg._id)) {
            const senderId =
              typeof msg.sender === "string" ? msg.sender : msg.sender?._id;
            const newSenderId =
              typeof message.sender === "string"
                ? message.sender
                : message.sender?._id;
            return !(
              msg.message === message.message &&
              msg.type === message.type &&
              senderId === newSenderId
            );
          }
          return true;
        });

        const updated = [...filtered, { ...message, status: "sent" as const }];
        updateCache(updated, hasMore);
        return updated;
      });
    },
    [hasMore, updateCache],
  );

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

  const deleteMessage = useCallback(
    (messageId: string) => {
      setMessages((prev) => {
        const updated = prev.filter((msg) => msg._id !== messageId);
        updateCache(updated, hasMore);
        return updated;
      });
      if (messageId) processedIdsRef.current.delete(messageId);
    },
    [hasMore, updateCache],
  );

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  const setPendingTimeout = useCallback(
    (tempId: string, timeout: ReturnType<typeof setTimeout>) => {
      pendingTimeoutsRef.current.set(tempId, timeout);
    },
    [],
  );

  const clearAllPending = useCallback(() => {
    pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pendingTimeoutsRef.current.clear();
  }, []);

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
    isCleared,
    clearedAt,
    setIsCleared,
    setClearedAt,
  };
};
