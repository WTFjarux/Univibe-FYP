// hooks/chatScreen/useChatMessages.ts

import { useState, useRef, useCallback } from "react";
import chatApi from "../../lib/services/chatApi";
import { isTempId } from "../../lib/utils/messageIdGenerator";
import { getSenderId } from "../../lib/utils/chatUtils";
import type { Message, PendingMessage } from "../../lib/types/chat.types";

// ============================================
// IN-MEMORY CACHE (survives screen navigation)
// ============================================

interface CacheEntry {
  messages: Message[];
  hasMore: boolean;
  timestamp: number;
}

const messageCache = new Map<string, CacheEntry>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const pendingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const processedMessageIds = useRef<Set<string>>(new Set());

  // ============================================
  // HELPERS
  // ============================================

  const isValidMessage = useCallback((msg: Message): boolean => {
    if (isTempId(msg._id) || msg.status === "sending") return false;
    if (msg.type === "audio" && !msg.mediaUrl) return false;
    return !!msg._id;
  }, []);

  const mergePendingMessages = useCallback((): Message[] => {
    const pendingList = Array.from(pendingMessagesRef.current.values());
    return pendingList.map((pending) => ({
      _id: pending.tempId,
      tempId: pending.tempId,
      sender: userId || "",
      senderName: userName || "You",
      message: pending.type === "audio" ? "🎤 Voice message" : pending.message,
      roomId,
      createdAt: new Date(pending.timestamp).toISOString(),
      status: "sending" as const,
      type: pending.type as Message["type"],
      mediaUrl: pending.mediaUrl,
      duration: pending.duration,
      replyTo: pending.replyTo,
      reactions: [],
    }));
  }, [roomId, userId, userName]);

  // ✅ Deduplicate messages by _id or tempId
  const deduplicateMessages = useCallback((msgs: Message[]): Message[] => {
    const seen = new Set<string>();
    return msgs.filter((msg) => {
      const key = msg._id || msg.tempId;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  // ============================================
  // LOAD MESSAGES (with cache)
  // ============================================

  const loadMessages = useCallback(
    async (forceRefresh = false) => {
      if (!token) return;

      const cached = messageCache.get(roomId);
      const now = Date.now();

      // ✅ Return cached data if fresh
      if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL) {
        const deduped = deduplicateMessages(cached.messages);
        setMessages(deduped);
        setHasMore(cached.hasMore);

        processedMessageIds.current.clear();
        deduped.forEach((msg) => {
          if (!isTempId(msg._id)) processedMessageIds.current.add(msg._id);
        });

        setLoading(false);
        return;
      }

      try {
        const response = await chatApi.getMessagesLight(
          token,
          roomId,
          INITIAL_LIMIT,
        );

        if (response.success) {
          const serverMessages: Message[] = response.data.messages || [];
          const cleanMessages = serverMessages.filter(isValidMessage);

          processedMessageIds.current.clear();
          cleanMessages.forEach((msg) =>
            processedMessageIds.current.add(msg._id),
          );

          const pendingMessages = mergePendingMessages();
          const combined = [
            ...cleanMessages.filter((msg) => !isTempId(msg._id)),
            ...pendingMessages,
          ];

          // ✅ Deduplicate before setting state
          const finalMessages = deduplicateMessages(combined);

          setMessages(finalMessages);
          setHasMore(response.data.hasMore);

          // ✅ Update cache with deduped messages
          messageCache.set(roomId, {
            messages: finalMessages,
            hasMore: response.data.hasMore,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error("Error loading messages:", error);
        if (cached) {
          const deduped = deduplicateMessages(cached.messages);
          setMessages(deduped);
          setHasMore(cached.hasMore);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, roomId, isValidMessage, mergePendingMessages, deduplicateMessages],
  );

  // ============================================
  // LOAD OLDER MESSAGES (pagination)
  // ============================================

  const loadOlderMessages = useCallback(async () => {
    if (!token || !hasMore || loadingMore || messages.length === 0) return;

    setLoadingMore(true);
    const oldestMessage = messages[0];

    try {
      const response = await chatApi.getMessagesLight(
        token,
        roomId,
        PAGINATION_LIMIT,
        oldestMessage.createdAt,
      );

      if (response.success) {
        const olderMessages: Message[] = response.data.messages || [];
        const cleanOlder = olderMessages.filter(isValidMessage);

        cleanOlder.forEach((msg) => processedMessageIds.current.add(msg._id));

        setMessages((prev) => {
          const combined = [...cleanOlder.reverse(), ...prev];
          return deduplicateMessages(combined);
        });
        setHasMore(response.data.hasMore);

        // Update cache
        const cached = messageCache.get(roomId);
        if (cached) {
          messageCache.set(roomId, {
            messages: deduplicateMessages([...cleanOlder, ...cached.messages]),
            hasMore: response.data.hasMore,
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      // Silent fail - user can pull to refresh
    } finally {
      setLoadingMore(false);
    }
  }, [
    token,
    roomId,
    hasMore,
    loadingMore,
    messages,
    isValidMessage,
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
  // PENDING MESSAGE MANAGEMENT
  // ============================================

  const addPendingMessage = useCallback(
    (tempId: string, pending: PendingMessage) => {
      pendingMessagesRef.current.set(tempId, pending);
    },
    [],
  );

  const removePendingMessage = useCallback((tempId: string) => {
    pendingMessagesRef.current.delete(tempId);
    const timeout = pendingTimeoutsRef.current.get(tempId);
    if (timeout) {
      clearTimeout(timeout);
      pendingTimeoutsRef.current.delete(tempId);
    }
    setMessages((prev) =>
      prev.filter((msg) => msg._id !== tempId && msg.tempId !== tempId),
    );
  }, []);

  const setPendingTimeout = useCallback((tempId: string, timeout: number) => {
    pendingTimeoutsRef.current.set(tempId, timeout);
  }, []);

  // ============================================
  // REAL-TIME MESSAGE HANDLERS
  // ============================================

  const addMessage = useCallback(
    (message: Message) => {
      // Skip if already processed
      if (processedMessageIds.current.has(message._id)) return;

      setMessages((prev) => {
        // Check by _id
        if (prev.some((msg) => msg._id === message._id)) return prev;

        // ✅ Check if a temp/sending message matches this incoming real message
        // This prevents the "temp + real" duplicate
        const filtered = prev.filter((msg) => {
          if (msg.status === "sending" || isTempId(msg._id)) {
            // If this temp message matches the incoming one, remove it
            const isMatch =
              msg.message === message.message &&
              msg.type === message.type &&
              msg.sender === message.sender;
            return !isMatch;
          }
          return true;
        });

        processedMessageIds.current.add(message._id);

        const updated = [...filtered, { ...message, status: "sent" as const }];

        // Update cache
        messageCache.set(roomId, {
          messages: deduplicateMessages(updated),
          hasMore,
          timestamp: Date.now(),
        });

        return updated;
      });
    },
    [roomId, hasMore, deduplicateMessages],
  );

  const replaceTempMessage = useCallback(
    (tempId: string, messageId: string, messageData?: Partial<Message>) => {
      pendingMessagesRef.current.delete(tempId);
      const timeout = pendingTimeoutsRef.current.get(tempId);
      if (timeout) {
        clearTimeout(timeout);
        pendingTimeoutsRef.current.delete(tempId);
      }

      setMessages((prev) => {
        const tempIndex = prev.findIndex(
          (msg) => msg.tempId === tempId || msg._id === tempId,
        );
        if (tempIndex === -1) return prev;

        // ✅ Check if the real message already exists (from socket)
        const alreadyExists = prev.some((msg) => msg._id === messageId);
        if (alreadyExists) {
          // Remove temp, real message is already there
          return prev.filter(
            (msg) => msg._id !== tempId && msg.tempId !== tempId,
          );
        }

        const newMessages = [...prev];
        newMessages[tempIndex] = {
          ...(messageData || {}),
          _id: messageId || newMessages[tempIndex]._id,
          status: "sent" as const,
          reactions: newMessages[tempIndex].reactions || [],
        } as Message;
        processedMessageIds.current.add(messageId);

        // Update cache
        messageCache.set(roomId, {
          messages: newMessages,
          hasMore,
          timestamp: Date.now(),
        });

        return newMessages;
      });
    },
    [roomId, hasMore],
  );

  const updateMessageReactions = useCallback(
    (messageId: string, reactions: Message["reactions"]) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg,
        ),
      );
    },
    [],
  );

  const deleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
  }, []);

  // ============================================
  // CLEANUP
  // ============================================

  const clearAllPending = useCallback(() => {
    pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    pendingTimeoutsRef.current.clear();
    pendingMessagesRef.current.clear();
  }, []);

  const clearCache = useCallback(() => {
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
    addPendingMessage,
    removePendingMessage,
    addMessage,
    replaceTempMessage,
    updateMessageReactions,
    deleteMessage,
    setPendingTimeout,
    clearAllPending,
    clearCache,
    processedMessageIds,
  };
};
