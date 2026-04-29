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
 * Central orchestrator for the ChatScreen.
 *
 * Composes all chat sub-hooks and provides a unified interface for the screen.
 * Responsibilities:
 * - Message loading, caching, and pagination (useChatMessages)
 * - Real-time socket events (useChatSocket)
 * - Sending text, audio, attachments, and location (useMessageSender)
 * - Audio recording (useAudioRecorder)
 * - Read receipts (useChatReadReceipts)
 * - Scroll management and message highlighting (useChatScroll, useMessageScroll)
 * - Reactions, deletes, and reply threading
 */
export const useChatScreen = (flatListRef: React.RefObject<any>) => {
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const isMountedRef = useRef(true);

  // ---------------------------------------------------------------------------
  // Route params extracted from navigation
  // ---------------------------------------------------------------------------

  const roomId = params.roomId as string;
  const otherUserName = params.otherUserName as string;
  const otherUserAvatar = params.otherUserAvatar as string;
  const otherUserId =
    (params.otherUserId as string) ||
    (roomId && user?.id ? extractOtherUserIdFromRoomId(roomId, user.id) : "");

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------

  const [socketConnected, setSocketConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ReplyToState | null>(
    null,
  );

  // ---------------------------------------------------------------------------
  // Messages — loading, caching, pagination, optimistic updates
  // ---------------------------------------------------------------------------

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
    isCleared, // NEW
    clearedAt,
  } = useChatMessages({
    token,
    roomId,
    userId: user?.id,
    userName: user?.name,
  });

  // ---------------------------------------------------------------------------
  // Read receipts — marks messages as read when the user views the room
  // ---------------------------------------------------------------------------

  useChatReadReceipts({
    token,
    roomId,
    userId: user?.id,
    messages,
  });

  // ---------------------------------------------------------------------------
  // Scroll management — auto-scroll, content size tracking, message highlighting
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Message sender — text, audio, attachments, location
  // ---------------------------------------------------------------------------

  // Stable socket emit wrapper to avoid dependency churn
  const emitEvent = useCallback((event: string, data: any) => {
    socketService.emit(event, data);
  }, []);

  // Scrolls to the bottom of the message list and re-enables auto-scroll
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

  // ---------------------------------------------------------------------------
  // Audio recorder
  // ---------------------------------------------------------------------------

  // Called when the user finishes recording a voice note
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
  // Socket event handlers — stored in refs to prevent stale closures
  // ---------------------------------------------------------------------------

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
   * Handles delivery confirmations, read receipts, and optimistic
   * message confirmations from the socket.
   *
   * Cases handled:
   * - messages_read: Another user read all messages in the room
   * - message_read: Another user read a single message
   * - message_delivered_to_recipient: A message reached the recipient's device
   * - success/failure: Optimistic message was confirmed or rejected by server
   */
  const onMessageDeliveredRef = useRef<(data: any) => void>(undefined);

  onMessageDeliveredRef.current = (data: any) => {
    const { tempId, messageId, message: messageData, success, type } = data;

    // Other user read all messages in the room — bulk update statuses
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

    // Other user read a single message — update that message only
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

    // Message was delivered to the recipient's device
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

    // Optimistic message was rejected by the server — remove it
    if (success === false) {
      if (tempId) removeOptimisticMessageRef.current(tempId);
      return;
    }

    // Optimistic message was confirmed — replace temp with real message
    if (tempId) {
      confirmOptimisticMessageRef.current(tempId, messageId, messageData);
    }
  };

  // Handles incoming real-time messages from other users
  const onReceiveMessageRef = useRef<(message: Message) => void>(undefined);

  onReceiveMessageRef.current = (message: Message) => {
    addMessageRef.current(message);
  };

  // Stable callback objects — prevents socket listeners from re-registering
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
  // Send handlers — called from the ChatInput component
  // ---------------------------------------------------------------------------

  // Sends a text message and clears any active reply
  const handleSendMessage = useCallback(
    (text: string) => {
      sendTextMessage(text, replyToMessage, () => setReplyToMessage(null));
    },
    [sendTextMessage, replyToMessage],
  );

  // Uploads and sends selected attachments (images, videos, files)
  const handleAttachmentsSelected = useCallback(
    async (attachments: AttachmentData[]) => {
      setAttachmentUploading(true);
      await sendAttachments(attachments, setAttachmentUploading);
    },
    [sendAttachments],
  );

  // Sends a shared location
  const handleLocationShared = useCallback(
    (location: AttachmentData) => {
      sendLocation(location);
    },
    [sendLocation],
  );

  // ---------------------------------------------------------------------------
  // Reply handling
  // ---------------------------------------------------------------------------

  // Sets a message as the reply target, shown in ReplyIndicator above the input
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
      thumbnailUrl: message.thumbnailUrl,
      duration: message.duration,
    });
  }, []);

  // Cancels the active reply and clears message highlighting
  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
    clearHighlight();
  }, [clearHighlight]);

  // ---------------------------------------------------------------------------
  // Scroll to message — used when tapping a reply preview
  // ---------------------------------------------------------------------------

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
   * Applies an optimistic update immediately, then syncs with the server.
   * On failure, reloads messages from the server to restore correct state.
   */
  const handleReaction = useCallback(
    async (messageId: string, reaction: string, shouldRemove?: boolean) => {
      if (!token) return;

      // Optimistic update — apply reaction locally first
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

      // Server sync — confirm the reaction with the backend
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
  // Delete message
  // ---------------------------------------------------------------------------

  // Deletes a message locally and emits a socket event for the other user
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
        // Silently fail
      }
    },
    [token, roomId, deleteMessage],
  );

  // ---------------------------------------------------------------------------
  // Audio played
  // ---------------------------------------------------------------------------

  // Marks an audio message as played on the server
  const markAudioAsPlayed = useCallback(
    async (messageId: string) => {
      if (!token) return;
      await chatApi.markAudioPlayed(messageId);
    },
    [token],
  );

  // ---------------------------------------------------------------------------
  // Connection status — event-driven via socket service events
  // ---------------------------------------------------------------------------

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

  // Stops audio and marks component as unmounted on screen exit
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      AudioManager.stopAllSounds();
    };
  }, []);

  // Stops all currently playing audio (called during navigation)
  const audioCleanup = useCallback(() => {
    AudioManager.stopAllSounds();
  }, []);

  // ---------------------------------------------------------------------------
  // Return — unified interface for ChatScreen
  // ---------------------------------------------------------------------------

  return {
    // Message data
    messages,
    loading,
    refreshing,
    loadingMore,
    hasMore,

    // Connection state
    socketConnected,
    isOnline,
    uploading: uploading || attachmentUploading,

    // Reply state
    replyToMessage,

    // Message highlighting
    highlightedMessageId,

    // Other user info
    otherUserName,
    otherUserId,
    otherUserAvatar,

    // Current user
    user,
    token,
    roomId,

    // Message loading
    loadMessages,
    loadOlderMessages,
    onRefresh,

    // Sending
    handleSendMessage,
    handleAttachmentsSelected,
    handleLocationShared,

    // Reply
    handleReply,
    cancelReply,

    // Reactions and deletes
    handleReaction,
    handleDelete,

    // Audio
    markAudioAsPlayed,
    isRecording: audioRecorder.isRecording,
    recordingDuration: audioRecorder.recordingDuration,
    startRecording: audioRecorder.startRecording,
    stopRecording: audioRecorder.stopRecording,
    cancelRecording: audioRecorder.cancelRecording,

    // Scroll
    handleScrollToMessage,
    registerMessageRef,
    initialScrollToBottom,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
    enableAutoScroll,

    // Cleanup
    clearAllPending,
    clearCache,
    clearHighlight,
    cleanupScroll,
    audioCleanup,
    isMountedRef,

    isCleared, // NEW
    clearedAt,
  };
};
