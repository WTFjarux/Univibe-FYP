// hooks/chatScreen/useChatScreen.ts

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { useChatMessages } from "./useChatMessages";
import { useAudioRecorder } from "./useAudioRecorder";
import { useMessageSender } from "./useMessageSender";
import { useChatSocket } from "./useChatSocket";
import { useChatReadReceipts } from "./useChatReadReceipts";
import { useChatScroll } from "./useChatScroll";
import { useMessageScroll } from "../useMessageScroll";
import socketService from "../../lib/services/socketService";
import chatApi from "../../lib/services/chatApi";
import AudioManager from "../../lib/utils/AudioManager";
import { extractOtherUserIdFromRoomId } from "../../lib/utils/chatUtils";
import type {
  Message,
  ReplyToState,
  AttachmentData,
} from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Central hook for the ChatScreen.
 * Orchestrates messages, socket events, read receipts, audio recording,
 * message sending, reactions, and scroll management.
 */
export const useChatScreen = (flatListRef: React.RefObject<any>) => {
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const isMountedRef = useRef(true);

  // ─── Route params ────────────────────────────────────────────────────────

  const roomId = params.roomId as string;
  const otherUserName = params.otherUserName as string;
  const otherUserAvatar = params.otherUserAvatar as string;
  const otherUserId =
    (params.otherUserId as string) ||
    (roomId && user?.id ? extractOtherUserIdFromRoomId(roomId, user.id) : "");

  // ─── UI state ────────────────────────────────────────────────────────────

  const [socketConnected, setSocketConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ReplyToState | null>(
    null,
  );

  // ─── Messages (with pagination + caching) ────────────────────────────────

  const {
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
  } = useChatMessages({
    token,
    roomId,
    userId: user?.id,
    userName: user?.name,
  });

  // ─── Read receipts (marks messages as read when viewing) ─────────────────

  useChatReadReceipts({
    token,
    roomId,
    userId: user?.id,
    messages,
  });

  // ─── Scroll management ───────────────────────────────────────────────────

  const {
    highlightedMessageId,
    registerMessageRef,
    scrollToMessage,
    clearHighlight,
  } = useMessageScroll(flatListRef);

  const {
    initialScrollToBottom,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
    enableAutoScroll,
    cleanup: cleanupScroll,
  } = useChatScroll(flatListRef);

  // ─── Message sending setup ───────────────────────────────────────────────

  const emitEvent = useCallback((event: string, data: any) => {
    socketService.emit(event, data);
  }, []);

  const scrollToEnd = useCallback(() => {
    enableAutoScroll();
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, [enableAutoScroll, flatListRef]);

  const { sendTextMessage, sendAudioMessage, sendAttachments, sendLocation } =
    useMessageSender({
      token,
      roomId,
      userId: user?.id,
      userName: user?.name,
      socketConnected,
      setMessages,
      addOptimisticMessage,
      removeOptimisticMessage,
      confirmOptimisticMessage,
      setPendingTimeout,
      scrollToEnd,
      emitEvent,
    });

  // ─── Audio recorder ──────────────────────────────────────────────────────

  /** Called when an audio recording is complete and ready to send */
  const handleAudioReady = useCallback(
    async (uri: string, duration: number) => {
      await sendAudioMessage(
        uri,
        duration,
        replyToMessage,
        () => setReplyToMessage(null),
        setUploading,
      );
    },
    [sendAudioMessage, replyToMessage],
  );

  const audioRecorder = useAudioRecorder(handleAudioReady);

  // ---------------------------------------------------------------------------
  // Socket Event Handlers
  // ---------------------------------------------------------------------------

  // Store frequently changing values in refs to prevent stale closures
  const userRef = useRef(user);
  userRef.current = user;

  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;

  const removeOptimisticMessageRef = useRef(removeOptimisticMessage);
  removeOptimisticMessageRef.current = removeOptimisticMessage;

  const confirmOptimisticMessageRef = useRef(confirmOptimisticMessage);
  confirmOptimisticMessageRef.current = confirmOptimisticMessage;

  const addMessageRef = useRef(addMessage);
  addMessageRef.current = addMessage;

  /**
   * Handles message delivery confirmations and read receipts from the socket.
   * Updates message statuses (sent → delivered → read) based on server events.
   */
  const onMessageDeliveredRef = useRef<(data: any) => void>(undefined);

  onMessageDeliveredRef.current = (data: any) => {
    const { tempId, messageId, message: messageData, success, type } = data;

    // Bulk read receipt — other user read all messages in the room
    if (type === "messages_read") {
      setMessagesRef.current((prev: Message[]) => {
        const updated = prev.map((msg) => {
          const senderId =
            typeof msg.sender === "string" ? msg.sender : msg.sender?._id;

          if (senderId === userRef.current?.id && msg.status !== "read") {
            const existingReadBy = msg.readBy || [];
            const alreadyRead = existingReadBy.some((r: any) => {
              const readUserId = typeof r === "string" ? r : r.user || r.userId;
              return readUserId?.toString() === data.userId?.toString();
            });

            if (!alreadyRead) {
              return {
                ...msg,
                status: "read" as const,
                readBy: [
                  ...existingReadBy,
                  {
                    user: data.userId,
                    readAt: data.readAt || new Date().toISOString(),
                  },
                ],
              };
            }
          }
          return msg;
        });

        return updated;
      });
      return;
    }

    // Single message read receipt
    if (type === "message_read") {
      setMessagesRef.current((prev: Message[]) =>
        prev.map((msg) => {
          if (msg._id === data.messageId && msg.status !== "read") {
            const existingReadBy = msg.readBy || [];
            const alreadyRead = existingReadBy.some((r: any) => {
              const readUserId = typeof r === "string" ? r : r.user || r.userId;
              return readUserId?.toString() === data.userId?.toString();
            });

            if (!alreadyRead) {
              return {
                ...msg,
                status: "read" as const,
                readBy: [
                  ...existingReadBy,
                  {
                    user: data.userId,
                    readAt: data.readAt || new Date().toISOString(),
                  },
                ],
              };
            }
          }
          return msg;
        }),
      );
      return;
    }

    // Delivery confirmation — message reached the recipient's device
    if (type === "message_delivered_to_recipient") {
      setMessagesRef.current((prev: Message[]) =>
        prev.map((msg) => {
          if (msg._id === data.messageId && msg.status === "sent") {
            const existingDelivered = msg.deliveredTo || [];
            const alreadyDelivered = existingDelivered.some((r: any) => {
              const dUserId = typeof r === "string" ? r : r.user || r.userId;
              return dUserId?.toString() === data.recipientId?.toString();
            });

            if (!alreadyDelivered) {
              return {
                ...msg,
                status: "delivered" as const,
                deliveredTo: [
                  ...existingDelivered,
                  {
                    user: data.recipientId,
                    deliveredAt: new Date().toISOString(),
                  },
                ],
              };
            }
          }
          return msg;
        }),
      );
      return;
    }

    // Optimistic message confirmation
    if (success === false) {
      if (tempId) removeOptimisticMessageRef.current(tempId);
      return;
    }
    if (tempId) {
      confirmOptimisticMessageRef.current(tempId, messageId, messageData);
    }
  };

  /** Handles incoming real-time messages from the socket */
  const onReceiveMessageRef = useRef<(message: Message) => void>(undefined);

  onReceiveMessageRef.current = (message: Message) => {
    addMessageRef.current(message);
  };

  // Stable wrapper objects so socket listeners are never re-registered
  const stableCallbacks = useRef({
    onMessageDelivered: (data: any) => {
      onMessageDeliveredRef.current?.(data);
    },
    onReceiveMessage: (message: Message) => {
      onReceiveMessageRef.current?.(message);
    },
    onUserOnline: () => setIsOnline(true),
    onUserOffline: () => setIsOnline(false),
  }).current;

  useChatSocket({
    roomId,
    otherUserId,
    isMountedRef,
    onMessageDelivered: stableCallbacks.onMessageDelivered,
    onReceiveMessage: stableCallbacks.onReceiveMessage,
    onUserOnline: stableCallbacks.onUserOnline,
    onUserOffline: stableCallbacks.onUserOffline,
  });

  // ---------------------------------------------------------------------------
  // Send Handlers
  // ---------------------------------------------------------------------------

  /** Sends a text message and clears the reply state */
  const handleSendMessage = useCallback(
    (text: string) => {
      sendTextMessage(text, replyToMessage, () => setReplyToMessage(null));
    },
    [sendTextMessage, replyToMessage],
  );

  /** Uploads and sends selected attachments */
  const handleAttachmentsSelected = useCallback(
    async (attachments: AttachmentData[]) => {
      setAttachmentUploading(true);
      await sendAttachments(attachments, setAttachmentUploading);
    },
    [sendAttachments],
  );

  /** Sends a shared location message */
  const handleLocationShared = useCallback(
    (location: AttachmentData) => {
      sendLocation(location);
    },
    [sendLocation],
  );

  // ---------------------------------------------------------------------------
  // Reply Handling
  // ---------------------------------------------------------------------------

  /** Sets a message as the reply target for the input bar */
  const handleReply = useCallback((message: Message) => {
    setReplyToMessage({
      _id: message._id,
      senderName: message.senderName,
      message: message.message,
      senderId:
        typeof message.sender === "string"
          ? message.sender
          : message.sender?._id,
      type: message.type,
      mediaUrl: message.mediaUrl,
      duration: message.duration,
    });
  }, []);

  /** Cancels the current reply and clears highlights */
  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
    clearHighlight();
  }, [clearHighlight]);

  // ---------------------------------------------------------------------------
  // Scroll to Message
  // ---------------------------------------------------------------------------

  /** Scrolls to a specific message (used for reply navigation) */
  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m._id === messageId);
      if (messageIndex !== -1 && flatListRef.current) {
        scrollToMessage(messageId);
      }
    },
    [messages, scrollToMessage],
  );

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------

  /**
   * Toggles a reaction on a message.
   * Applies optimistic update first, then syncs with the server.
   * Falls back to full reload on failure.
   */
  const handleReaction = useCallback(
    async (messageId: string, reaction: string, shouldRemove?: boolean) => {
      if (!token) return;

      // Optimistic update
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id !== messageId) return msg;
          const currentReactions = msg.reactions || [];
          if (shouldRemove) {
            return {
              ...msg,
              reactions: currentReactions.filter((r) => r.userId !== user?.id),
            };
          }
          const existingIndex = currentReactions.findIndex(
            (r) => r.userId === user?.id,
          );
          if (existingIndex !== -1) {
            const updated = [...currentReactions];
            updated[existingIndex] = {
              ...updated[existingIndex],
              reaction,
              createdAt: new Date().toISOString(),
            };
            return { ...msg, reactions: updated };
          }
          return {
            ...msg,
            reactions: [
              ...currentReactions,
              {
                userId: user?.id || "",
                reaction,
                createdAt: new Date().toISOString(),
              },
            ],
          };
        }),
      );

      // Server sync
      try {
        const data = await chatApi.toggleReaction(
          messageId,
          reaction,
          shouldRemove,
        );
        if (data.success) {
          updateMessageReactions(messageId, data.reactions);
        } else {
          loadMessages(true);
        }
      } catch {
        loadMessages(true);
      }
    },
    [token, user?.id, setMessages, updateMessageReactions, loadMessages],
  );

  // ---------------------------------------------------------------------------
  // Delete Message
  // ---------------------------------------------------------------------------

  /** Deletes a message locally and emits a socket event for the other user */
  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!token) return;

      try {
        const data = await chatApi.deleteMessage(messageId);
        if (data.success) {
          deleteMessage(messageId);
          socketService.emit("delete_message", { messageId, roomId });
        }
      } catch {
        // Silently fail — user can retry
      }
    },
    [token, roomId, deleteMessage],
  );

  // ---------------------------------------------------------------------------
  // Audio Played
  // ---------------------------------------------------------------------------

  /** Marks an audio message as played on the server */
  const markAudioAsPlayed = useCallback(
    async (messageId: string) => {
      if (!token) return;
      await chatApi.markAudioPlayed(messageId);
    },
    [token],
  );

  // ---------------------------------------------------------------------------
  // Connection Status (Event-Driven)
  // ---------------------------------------------------------------------------

  /** Monitors socket connection status in real-time via events */
  useEffect(() => {
    setSocketConnected(socketService.getConnectionStatus());

    const handleConnected = () => setSocketConnected(true);
    const handleDisconnected = () => setSocketConnected(false);

    socketService.on("socket_connected", handleConnected);
    socketService.on("socket_reconnected", handleConnected);
    socketService.on("socket_disconnected", handleDisconnected);

    return () => {
      socketService.off("socket_connected", handleConnected);
      socketService.off("socket_reconnected", handleConnected);
      socketService.off("socket_disconnected", handleDisconnected);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** Cleanup on unmount: stop audio and mark component as unmounted */
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      AudioManager.stopAllSounds();
    };
  }, []);

  /** Stops all playing audio */
  const audioCleanup = useCallback(() => {
    AudioManager.stopAllSounds();
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    messages,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    socketConnected,
    isOnline,
    uploading: uploading || attachmentUploading,
    replyToMessage,
    highlightedMessageId,
    otherUserName,
    otherUserId,
    otherUserAvatar,
    user,
    token,
    roomId,

    loadMessages,
    loadOlderMessages,
    onRefresh,
    handleSendMessage,
    handleReply,
    cancelReply,
    handleReaction,
    handleDelete,
    markAudioAsPlayed,
    handleAttachmentsSelected,
    handleLocationShared,
    handleScrollToMessage,
    registerMessageRef,

    isRecording: audioRecorder.isRecording,
    recordingDuration: audioRecorder.recordingDuration,
    startRecording: audioRecorder.startRecording,
    stopRecording: audioRecorder.stopRecording,
    cancelRecording: audioRecorder.cancelRecording,

    initialScrollToBottom,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
    enableAutoScroll,

    clearAllPending,
    clearCache,
    clearHighlight,
    cleanupScroll,
    audioCleanup,
    isMountedRef,
  };
};
