// hooks/chatScreen/useChatScreen.ts

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { useChatMessages } from "./useChatMessages";
import { useAudioRecorder } from "./useAudioRecorder";
import { useMessageSender } from "./useMessageSender";
import { useChatSocket } from "./useChatSocket";
import { useChatScroll } from "./useChatScroll";
import { useMessageScroll } from "../useMessageScroll";
import socketService from "../../lib/services/socketService";
import chatApi from "../../lib/services/chatApi";
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
    addPendingMessage,
    removePendingMessage,
    addMessage,
    replaceTempMessage,
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

  // Scroll
  const {
    highlightedMessageId,
    registerMessageRef,
    scrollToMessage,
    clearHighlight,
  } = useMessageScroll(flatListRef);

  const {
    scrollToEnd,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
    setManualScroll,
    resetManualScroll,
    enableAutoScroll,
    cleanup: cleanupScroll,
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
      addPendingMessage,
      removePendingMessage,
      setPendingTimeout,
      scrollToEnd,
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

  // Socket
  useChatSocket({
    roomId,
    otherUserId,
    isMountedRef,
    onMessageDelivered: useCallback(
      (data: any) => {
        const { tempId, messageId, message: messageData, success } = data;
        if (success === false) {
          if (tempId) removePendingMessage(tempId);
          return;
        }
        if (tempId) replaceTempMessage(tempId, messageId, messageData);
      },
      [removePendingMessage, replaceTempMessage],
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

  // Scroll to message
  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      setManualScroll();
      scrollToMessage(messageId);
      resetManualScroll();
    },
    [scrollToMessage, setManualScroll, resetManualScroll],
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
          token,
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
        const data = await chatApi.deleteMessage(token, messageId);
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
      await chatApi.markAudioPlayed(token, messageId);
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
    };
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
    handleContentSizeChange,
    handleLayout,
    handleScroll,

    // Input
    scrollToEnd,
    enableAutoScroll,

    // Cleanup
    clearAllPending,
    clearCache,
    clearHighlight,
    cleanupScroll,
    audioCleanup: audioRecorder.cleanup,
    isMountedRef,
  };
};
