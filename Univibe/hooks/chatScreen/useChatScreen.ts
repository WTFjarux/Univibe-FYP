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

export const useChatScreen = (flatListRef: React.RefObject<any>) => {
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const isMountedRef = useRef(true);

  const roomId = params.roomId as string;
  const otherUserName = params.otherUserName as string;
  const otherUserAvatar = params.otherUserAvatar as string;
  const otherUserId =
    (params.otherUserId as string) ||
    (roomId && user?.id ? extractOtherUserIdFromRoomId(roomId, user.id) : "");

  // Connection state
  const [socketConnected, setSocketConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ReplyToState | null>(
    null,
  );

  // Messages (now with pagination + caching)
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

  // Read receipts - marks messages as read when viewing
  useChatReadReceipts({
    token,
    roomId,
    userId: user?.id,
    messages,
  });

  // Scroll management
  const {
    highlightedMessageId,
    registerMessageRef,
    scrollToMessage,
    clearHighlight,
  } = useMessageScroll(flatListRef);

  const {
    scrollToMessage: scrollToMessageIndex,
    initialScrollToBottom,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
    enableAutoScroll,
    cleanup: cleanupScroll,
    isAutoScrollEnabledRef,
  } = useChatScroll(flatListRef);

  // Message actions
  const emitEvent = useCallback((event: string, data: any) => {
    socketService.emit(event, data);
  }, []);

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
      scrollToEnd: useCallback(() => {
        enableAutoScroll();
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
      }, [enableAutoScroll, flatListRef]),
      emitEvent,
    });

  // Audio recorder
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

  // Socket with read receipt handling
  useChatSocket({
    roomId,
    otherUserId,
    isMountedRef,
    onMessageDelivered: useCallback(
      (data: any) => {
        const { tempId, messageId, message: messageData, success, type } = data;

        // ── Handle Read Receipts ──────────────────────────

        // Bulk read - other user read all messages in room
        if (type === "messages_read") {
          console.log(
            `📖 Updating all messages to read for user ${data.userId}`,
          );

          setMessages((prev) => {
            const updated = prev.map((msg) => {
              // Only update messages sent by current user
              const senderId =
                typeof msg.sender === "string" ? msg.sender : msg.sender?._id;

              if (senderId === user?.id && msg.status !== "read") {
                const existingReadBy = msg.readBy || [];
                const alreadyRead = existingReadBy.some((r: any) => {
                  const readUserId =
                    typeof r === "string" ? r : r.user || r.userId;
                  return readUserId?.toString() === data.userId?.toString();
                });

                if (!alreadyRead) {
                  console.log(`  📖 Marking message ${msg._id} as read`);
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

            // Log the update
            const readCount = updated.filter((m) => m.status === "read").length;
            console.log(`  ✅ ${readCount} messages now marked as read`);

            return updated;
          });
          return;
        }

        // Single message read
        if (type === "message_read") {
          console.log(`📖 Updating single message ${data.messageId} to read`);

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg._id === data.messageId && msg.status !== "read") {
                const existingReadBy = msg.readBy || [];
                const alreadyRead = existingReadBy.some((r: any) => {
                  const readUserId =
                    typeof r === "string" ? r : r.user || r.userId;
                  return readUserId?.toString() === data.userId?.toString();
                });

                if (!alreadyRead) {
                  console.log(`  ✅ Message ${msg._id} marked as read`);
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

        // Message delivered to recipient
        if (type === "message_delivered_to_recipient") {
          console.log(`📬 Updating message ${data.messageId} to delivered`);

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg._id === data.messageId && msg.status === "sent") {
                const existingDelivered = msg.deliveredTo || [];
                const alreadyDelivered = existingDelivered.some((r: any) => {
                  const dUserId =
                    typeof r === "string" ? r : r.user || r.userId;
                  return dUserId?.toString() === data.recipientId?.toString();
                });

                if (!alreadyDelivered) {
                  console.log(`  ✅ Message ${msg._id} marked as delivered`);
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

        // ── Original Message Delivery Logic ───────────────
        if (success === false) {
          if (tempId) removeOptimisticMessage(tempId);
          return;
        }
        if (tempId) {
          confirmOptimisticMessage(tempId, messageId, messageData);
        }
      },
      [
        removeOptimisticMessage,
        confirmOptimisticMessage,
        setMessages,
        user?.id,
      ],
    ),
    onReceiveMessage: useCallback(
      (message: Message) => {
        addMessage(message);
      },
      [addMessage],
    ),
    onUserOnline: useCallback(() => setIsOnline(true), []),
    onUserOffline: useCallback(() => setIsOnline(false), []),
  });

  // Send handlers
  const handleSendMessage = useCallback(
    (text: string) => {
      sendTextMessage(text, replyToMessage, () => setReplyToMessage(null));
    },
    [sendTextMessage, replyToMessage],
  );

  const handleAttachmentsSelected = useCallback(
    async (attachments: AttachmentData[]) => {
      setAttachmentUploading(true);
      await sendAttachments(attachments, setAttachmentUploading);
    },
    [sendAttachments],
  );

  const handleLocationShared = useCallback(
    (location: AttachmentData) => {
      sendLocation(location);
    },
    [sendLocation],
  );

  // Reply
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

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
    clearHighlight();
  }, [clearHighlight]);

  // Scroll to message (for reply navigation)
  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      // Find message index in the messages array
      const messageIndex = messages.findIndex((m) => m._id === messageId);
      if (messageIndex !== -1 && flatListRef.current) {
        // In inverted FlatList, we need to calculate the reversed index
        const reversedIndex = messages.length - 1 - messageIndex;
        scrollToMessage(messageId);
      }
    },
    [messages, scrollToMessage],
  );

  // Reactions
  const handleReaction = useCallback(
    async (messageId: string, reaction: string, shouldRemove?: boolean) => {
      if (!token) return;

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

  // Delete
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
        // Silent
      }
    },
    [token, roomId, deleteMessage],
  );

  // Audio played
  const markAudioAsPlayed = useCallback(
    async (messageId: string) => {
      if (!token) return;
      await chatApi.markAudioPlayed(messageId);
    },
    [token],
  );

  // Connection status check
  useEffect(() => {
    const check = () => setSocketConnected(socketService.getConnectionStatus());
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      AudioManager.stopAllSounds();
    };
  }, []);

  // Audio cleanup function
  const audioCleanup = useCallback(() => {
    AudioManager.stopAllSounds();
  }, []);

  return {
    // Data
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

    // Actions
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

    // Audio
    isRecording: audioRecorder.isRecording,
    recordingDuration: audioRecorder.recordingDuration,
    startRecording: audioRecorder.startRecording,
    stopRecording: audioRecorder.stopRecording,
    cancelRecording: audioRecorder.cancelRecording,

    // Scroll
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
  };
};
