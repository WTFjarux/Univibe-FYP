// hooks/chatScreen/useChatMessages.ts

import { useState, useRef, useCallback, useEffect } from "react";
import chatApi from "../../lib/services/chatApi";
import { isTempId } from "../../lib/utils/messageIdGenerator";
import type { Message } from "../../lib/types/chat.types";

// ============================================
// PERSISTENT MESSAGE CACHE
// ============================================

interface CacheEntry {
  messages: Message[];
  hasMore: boolean;
  timestamp: number;
}

const messageCache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const INITIAL_LIMIT = 30;
const PAGINATION_LIMIT = 30;

// ============================================
// HOOK
// ============================================

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
  // Messages are stored in chronological order (oldest first)
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const pendingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const processedIdsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      pendingTimeoutsRef.current.clear();
    };
  }, []);

  // ============================================
  // CACHE HELPERS
  // ============================================

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
      });

      console.log(
        `💾 Cache updated: ${validMessages.length} messages for room ${roomId}`,
      );
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

  // ============================================
  // MESSAGE VALIDATION & DEDUP
  // ============================================

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
      } else {
        console.log(`🔄 Removing duplicate: ${key}`);
      }
    }

    return result;
  }, []);

  // ============================================
  // LOAD MESSAGES
  // ============================================

  const loadMessages = useCallback(
    async (forceRefresh = false) => {
      if (!token || !isMountedRef.current) return;

      const cached = getCache();
      const now = Date.now();

      if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL) {
        console.log(
          `📦 Loading from cache: ${cached.messages.length} messages`,
        );

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

      try {
        console.log(`🌐 Fetching messages from server for room ${roomId}`);

        const response = await chatApi.getMessagesLight(roomId, INITIAL_LIMIT);

        if (response.success && isMountedRef.current) {
          const serverMessages: Message[] = response.data.messages || [];
          const optimisticMessages = forceRefresh
            ? []
            : getOptimisticFromCache();

          const combined = [...serverMessages, ...optimisticMessages];
          const finalMessages = deduplicateMessages(combined);

          console.log(
            `🌐 Loaded: ${serverMessages.length} server + ${optimisticMessages.length} optimistic = ${finalMessages.length} total`,
          );

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
        console.error("Error loading messages:", error);
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

  // ============================================
  // LOAD OLDER MESSAGES (Pagination)
  // ============================================

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
      console.error("Error loading older messages:", error);
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

  // ============================================
  // REFRESH
  // ============================================

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMessages(true);
  }, [loadMessages]);

  // ============================================
  // OPTIMISTIC MESSAGE MANAGEMENT
  // ============================================

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

      console.log(
        `✨ Adding optimistic message: ${tempId}, type: ${optimisticMessage.type}, hasMedia: ${!!optimisticMessage.mediaUrl}`,
      );

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
      console.log(`❌ Removing failed optimistic message: ${tempId}`);

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
      console.log(`✅ Confirming message: ${tempId} → ${messageId}`);

      const timeout = pendingTimeoutsRef.current.get(tempId);
      if (timeout) {
        clearTimeout(timeout);
        pendingTimeoutsRef.current.delete(tempId);
      }

      setMessages((prev) => {
        if (messageId && prev.some((msg) => msg._id === messageId)) {
          console.log(`⏭️ Message ${messageId} already exists, removing temp`);
          const updated = prev.filter(
            (msg) => msg._id !== tempId && msg.tempId !== tempId,
          );
          updateCache(updated, hasMore);
          return updated;
        }

        const tempIndex = prev.findIndex(
          (msg) => msg._id === tempId || msg.tempId === tempId,
        );

        if (tempIndex === -1) {
          console.log(`⚠️ Temp message ${tempId} not found in state`);
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

  // ============================================
  // REAL-TIME MESSAGE HANDLERS
  // ============================================

  const addMessage = useCallback(
    (message: Message) => {
      if (!message._id) return;

      if (processedIdsRef.current.has(message._id)) {
        console.log(`⏭️ Skipping duplicate message: ${message._id}`);
        return;
      }

      setMessages((prev) => {
        const exists = prev.some((msg) => msg._id === message._id);
        if (exists) {
          console.log(`⏭️ Message already in state: ${message._id}`);
          return prev;
        }

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

            if (isMatch) {
              console.log(
                `🔄 Removing temp message matching incoming: ${msg._id || msg.tempId}`,
              );
            }
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

      if (messageId) {
        processedIdsRef.current.delete(messageId);
      }
    },
    [hasMore, updateCache],
  );

  // ============================================
  // PENDING TIMEOUT MANAGEMENT
  // ============================================

  const setPendingTimeout = useCallback(
    (tempId: string, timeout: ReturnType<typeof setTimeout>) => {
      pendingTimeoutsRef.current.set(tempId, timeout);
    },
    [],
  );

  // ============================================
  // CLEANUP
  // ============================================

  const clearAllPending = useCallback(() => {
    console.log("🧹 Clearing pending timeouts");
    pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pendingTimeoutsRef.current.clear();
  }, []);

  const clearCache = useCallback(() => {
    console.log(`🗑️ Clearing cache for room: ${roomId}`);
    messageCache.delete(roomId);
  }, [roomId]);

  // ============================================
  // RETURN
  // ============================================

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
