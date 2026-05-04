// hooks/chatScreen/useChatScreen.ts

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";
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

  // ---------------------------------------------------------------------------
  // Route params
  // ---------------------------------------------------------------------------
  const roomId = params.roomId as string;
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
  const [forwarding, setForwarding] = useState(false);

  // ✅ Real-time group state
  const [groupName, setGroupName] = useState(params.otherUserName as string);
  const [groupAvatar, setGroupAvatar] = useState<string | null>(
    (params.groupPhoto as string) || null,
  );

  // Update when params change (navigating to different group)
  useEffect(() => {
    setGroupName(params.otherUserName as string);
    setGroupAvatar((params.groupPhoto as string) || null);
  }, [params.otherUserName, params.groupPhoto]);

  // ---------------------------------------------------------------------------
  // Messages
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
    isCleared,
    clearedAt,
  } = useChatMessages({
    token,
    roomId,
    userId: user?.id,
    userName: user?.name,
  });

  // ---------------------------------------------------------------------------
  // Read receipts
  // ---------------------------------------------------------------------------
  useChatReadReceipts({ token, roomId, userId: user?.id, messages });

  // ---------------------------------------------------------------------------
  // Scroll management
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
  // Message sender
  // ---------------------------------------------------------------------------
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

  const handleForwardMessage = useCallback(
    async (messageId: string, targetChatIds: string[]) => {
      if (!token) return;
      setForwarding(true);
      try {
        const response = await chatApi.forwardMessage(messageId, targetChatIds);
        if (response.success) {
          Alert.alert(
            "Success",
            `Message forwarded to ${response.data?.forwardedCount || 0} chat(s)`,
          );
          return response.data;
        } else {
          Alert.alert("Error", response.message || "Failed to forward message");
          return null;
        }
      } catch (error: any) {
        Alert.alert(
          "Error",
          error.response?.data?.message || "Failed to forward message",
        );
        return null;
      } finally {
        setForwarding(false);
      }
    },
    [token],
  );

  // ---------------------------------------------------------------------------
  // Audio recorder
  // ---------------------------------------------------------------------------
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
  // Socket event refs
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

  const onMessageDeliveredRef = useRef<(data: any) => void>(undefined);
  onMessageDeliveredRef.current = (data: any) => {
    const { tempId, messageId, message: messageData, success, type } = data;

    if (type === "messages_read") {
      if (data.userId === userRef.current?.id) return;
      setMessagesRef.current((prev: Message[]) =>
        prev.map((msg) => {
          const senderId =
            typeof msg.sender === "string" ? msg.sender : msg.sender?._id;
          if (senderId !== userRef.current?.id || msg.status === "read")
            return msg;
          const existingReadBy = msg.readBy || [];
          const alreadyRead = existingReadBy.some((r: any) => {
            const id = typeof r === "string" ? r : r.user || r.userId;
            return id?.toString() === data.userId?.toString();
          });
          if (alreadyRead) return msg;
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
        }),
      );
      return;
    }

    if (type === "message_read") {
      if (data.userId === userRef.current?.id) return;
      setMessagesRef.current((prev: Message[]) =>
        prev.map((msg) => {
          if (msg._id !== data.messageId || msg.status === "read") return msg;
          const existingReadBy = msg.readBy || [];
          const alreadyRead = existingReadBy.some((r: any) => {
            const id = typeof r === "string" ? r : r.user || r.userId;
            return id?.toString() === data.userId?.toString();
          });
          if (alreadyRead) return msg;
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
        }),
      );
      return;
    }

    if (type === "message_delivered_to_recipient") {
      setMessagesRef.current((prev: Message[]) =>
        prev.map((msg) => {
          if (msg._id !== data.messageId || msg.status !== "sent") return msg;
          const existingDelivered = msg.deliveredTo || [];
          const alreadyDelivered = existingDelivered.some((r: any) => {
            const id = typeof r === "string" ? r : r.user || r.userId;
            return id?.toString() === data.recipientId?.toString();
          });
          if (alreadyDelivered) return msg;
          return {
            ...msg,
            status: "delivered" as const,
            deliveredTo: [
              ...existingDelivered,
              { user: data.recipientId, deliveredAt: new Date().toISOString() },
            ],
          };
        }),
      );
      return;
    }

    if (success === false) {
      if (tempId) removeOptimisticMessageRef.current(tempId);
      return;
    }
    if (tempId) {
      confirmOptimisticMessageRef.current(tempId, messageId, messageData);
    }
  };

  const onReceiveMessageRef = useRef<(message: Message) => void>(undefined);
  onReceiveMessageRef.current = (message: Message) => {
    addMessageRef.current(message);
  };

  // ✅ Handle real-time group updates
  const handleGroupUpdated = useCallback(
    (data: {
      roomId: string;
      name?: string;
      icon?: string;
      groupPhoto?: string;
    }) => {
      if (data.name) setGroupName(data.name);
      if (data.icon || data.groupPhoto)
        setGroupAvatar(data.groupPhoto || data.icon || null);
    },
    [],
  );

  // Stable callbacks
  const stableCallbacks = useRef({
    onMessageDelivered: (data: any) => {
      onMessageDeliveredRef.current?.(data);
    },
    onReceiveMessage: (message: Message) => {
      onReceiveMessageRef.current?.(message);
    },
    onUserOnline: () => setIsOnline(true),
    onUserOffline: () => setIsOnline(false),
    onGroupUpdated: (data: any) => {
      handleGroupUpdated(data);
    },
  }).current;

  useChatSocket({
    roomId,
    otherUserId,
    isMountedRef,
    onMessageDelivered: stableCallbacks.onMessageDelivered,
    onReceiveMessage: stableCallbacks.onReceiveMessage,
    onUserOnline: stableCallbacks.onUserOnline,
    onUserOffline: stableCallbacks.onUserOffline,
    onGroupUpdated: stableCallbacks.onGroupUpdated,
  });

  // ---------------------------------------------------------------------------
  // Send handlers
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Reply handling
  // ---------------------------------------------------------------------------
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

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
    clearHighlight();
  }, [clearHighlight]);

  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      const messageIndex = messages.findIndex((m) => m._id === messageId);
      if (messageIndex !== -1 && flatListRef.current)
        scrollToMessage(messageId);
    },
    [messages, scrollToMessage],
  );

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------
  const handleReaction = useCallback(
    async (messageId: string, reaction: string, shouldRemove?: boolean) => {
      if (!token) return;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id !== messageId) return msg;
          const currentReactions = msg.reactions || [];
          if (shouldRemove)
            return {
              ...msg,
              reactions: currentReactions.filter((r) => r.userId !== user?.id),
            };
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
        if (data.success) updateMessageReactions(messageId, data.reactions);
        else loadMessages(true);
      } catch {
        loadMessages(true);
      }
    },
    [token, user?.id, setMessages, updateMessageReactions, loadMessages],
  );

  // ---------------------------------------------------------------------------
  // Delete message
  // ---------------------------------------------------------------------------
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
        /* silent */
      }
    },
    [token, roomId, deleteMessage],
  );

  // ---------------------------------------------------------------------------
  // Audio played
  // ---------------------------------------------------------------------------
  const markAudioAsPlayed = useCallback(
    async (messageId: string) => {
      if (!token) return;
      await chatApi.markAudioPlayed(messageId);
    },
    [token],
  );

  // ---------------------------------------------------------------------------
  // Connection status
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
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      AudioManager.stopAllSounds();
    };
  }, []);

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
    otherUserName: groupName,
    otherUserId,
    otherUserAvatar,
    groupAvatar,
    user,
    token,
    roomId,
    loadMessages,
    loadOlderMessages,
    onRefresh,
    handleSendMessage,
    handleAttachmentsSelected,
    handleLocationShared,
    handleReply,
    cancelReply,
    handleForwardMessage,
    forwarding,
    handleReaction,
    handleDelete,
    markAudioAsPlayed,
    isRecording: audioRecorder.isRecording,
    recordingDuration: audioRecorder.recordingDuration,
    startRecording: audioRecorder.startRecording,
    stopRecording: audioRecorder.stopRecording,
    cancelRecording: audioRecorder.cancelRecording,
    handleScrollToMessage,
    registerMessageRef,
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
    isCleared,
    clearedAt,
  };
};
