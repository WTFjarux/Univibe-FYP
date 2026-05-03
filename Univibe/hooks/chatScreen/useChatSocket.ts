// hooks/chatScreen/useChatSocket.ts

import { useEffect, useRef } from "react";
import socketService from "../../lib/services/socketService";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../constants/ipConstants";
import type { Message } from "../../lib/types/chat.types";

interface UseChatSocketProps {
  roomId: string;
  otherUserId: string;
  isMountedRef: React.RefObject<boolean>;
  onMessageDelivered: (data: any) => void;
  onReceiveMessage: (message: Message) => void;
  onUserOnline: () => void;
  onUserOffline: () => void;
  onMessagesRead?: (data: {
    roomId: string;
    userId: string;
    readAt: string;
  }) => void;
  onMessageRead?: (data: {
    messageId: string;
    roomId: string;
    userId: string;
    readAt: string;
  }) => void;
  onMessageDeleted?: (data: {
    roomId: string;
    messageId: string;
    deletedBy: string;
  }) => void;
  onReactionAdded?: (data: {
    messageId: string;
    userId: string;
    reaction: string;
    reactions: any[];
  }) => void;
  onReactionRemoved?: (data: {
    messageId: string;
    userId: string;
    reactions: any[];
  }) => void;
  onSocketError?: (error: any) => void;
}

export const useChatSocket = ({
  roomId,
  otherUserId,
  isMountedRef,
  onMessageDelivered,
  onReceiveMessage,
  onUserOnline,
  onUserOffline,
  onMessagesRead,
  onMessageRead,
  onMessageDeleted,
  onReactionAdded,
  onReactionRemoved,
  onSocketError,
}: UseChatSocketProps) => {
  const handlersRef = useRef({
    onMessageDelivered,
    onReceiveMessage,
    onUserOnline,
    onUserOffline,
    onMessagesRead,
    onMessageRead,
    onMessageDeleted,
    onReactionAdded,
    onReactionRemoved,
    onSocketError,
  });

  handlersRef.current = {
    onMessageDelivered,
    onReceiveMessage,
    onUserOnline,
    onUserOffline,
    onMessagesRead,
    onMessageRead,
    onMessageDeleted,
    onReactionAdded,
    onReactionRemoved,
    onSocketError,
  };

  const hasJoinedRef = useRef(false);

  // ✅ Fetch other user's online status from the database via REST API
  const fetchOnlineStatus = async () => {
    if (!otherUserId) return;
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/api/users/${otherUserId}/online-status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.ok) {
        const data = await response.json();
        if (!isMountedRef.current) return;
        if (data.success && data.isOnline) {
          handlersRef.current.onUserOnline();
        }
      }
    } catch {
      // Silent fail - socket events will handle status updates
    }
  };

  useEffect(() => {
    if (!roomId) return;

    // Join room once
    if (!hasJoinedRef.current) {
      hasJoinedRef.current = true;
      socketService.joinRoom(roomId, otherUserId);

      // ✅ Check online status immediately when chat opens
      fetchOnlineStatus();
    }

    // ===== Message Handlers =====

    const handleMessageDelivered = (data: any) => {
      if (!isMountedRef.current) return;
      handlersRef.current.onMessageDelivered(data);
    };

    const handleReceiveMessage = (message: Message) => {

      if (!isMountedRef.current) return;
      if (message.roomId === roomId) {
        handlersRef.current.onReceiveMessage(message);
      }
    };

    const handleMessageRead = (data: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onMessageRead) {
        handlersRef.current.onMessageRead({
          messageId: data.messageId,
          roomId: data.roomId,
          userId: data.userId,
          readAt: data.readAt || new Date().toISOString(),
        });
      }
      handlersRef.current.onMessageDelivered({
        type: "message_read",
        messageId: data.messageId,
        userId: data.userId,
        readAt: data.readAt || new Date().toISOString(),
      });
    };

    const handleMessagesRead = (data: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onMessagesRead) {
        handlersRef.current.onMessagesRead({
          roomId: data.roomId,
          userId: data.userId,
          readAt: data.readAt || new Date().toISOString(),
        });
      }
      handlersRef.current.onMessageDelivered({
        type: "messages_read",
        roomId: data.roomId,
        userId: data.userId,
        readAt: data.readAt || new Date().toISOString(),
      });
    };

    const handleMessageDeleted = (data: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onMessageDeleted)
        handlersRef.current.onMessageDeleted(data);
    };

    const handleReactionAdded = (data: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onReactionAdded)
        handlersRef.current.onReactionAdded(data);
    };

    const handleReactionRemoved = (data: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onReactionRemoved)
        handlersRef.current.onReactionRemoved(data);
    };

    // ===== User Presence Handlers =====

    const handleUserOnline = (data: any) => {
      if (!isMountedRef.current) return;
      if (data.userId === otherUserId) {
        handlersRef.current.onUserOnline();
      }
    };

    const handleUserOffline = (data: any) => {
      if (!isMountedRef.current) return;
      if (data.userId === otherUserId) {
        handlersRef.current.onUserOffline();
      }
    };

    const handleUserJoinedRoom = (data: any) => {
      if (!isMountedRef.current) return;
      if (data.roomId === roomId && data.userId === otherUserId) {
        handlersRef.current.onUserOnline();
      }
    };

    // ===== Other Handlers =====

    const handleChatCleared = () => {};
    const handleChatRestored = () => {};

    const handleMessageDeliveredToRecipient = (data: any) => {
      if (!isMountedRef.current) return;
      handlersRef.current.onMessageDelivered({
        type: "message_delivered_to_recipient",
        messageId: data.messageId,
        recipientId: data.recipientId,
      });
    };

    const handleMessageError = (error: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onSocketError)
        handlersRef.current.onSocketError(error);
    };

    const handleSocketConnected = () => {
      if (!isMountedRef.current) return;
      // ✅ Re-check status when socket reconnects
      fetchOnlineStatus();
    };

    const handleSocketDisconnected = () => {};

    const handleSocketError = (error: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onSocketError)
        handlersRef.current.onSocketError(error);
    };

    // ===== Register All Listeners =====

    socketService.on("message_delivered", handleMessageDelivered);
    socketService.on("receive_message", handleReceiveMessage);
    socketService.on("message_read", handleMessageRead);
    socketService.on("messages_read", handleMessagesRead);
    socketService.on("messages_marked_read", handleMessagesRead);
    socketService.on("message_deleted", handleMessageDeleted);
    socketService.on(
      "message_delivered_to_recipient",
      handleMessageDeliveredToRecipient,
    );
    socketService.on("reaction_added", handleReactionAdded);
    socketService.on("reaction_removed", handleReactionRemoved);
    socketService.on("user_online", handleUserOnline);
    socketService.on("user_offline", handleUserOffline);
    socketService.on("user_joined_room", handleUserJoinedRoom);
    socketService.on("chat_cleared", handleChatCleared);
    socketService.on("chat_restored", handleChatRestored);
    socketService.on("message_error", handleMessageError);
    socketService.on("socket_connected", handleSocketConnected);
    socketService.on("socket_disconnected", handleSocketDisconnected);
    socketService.on("socket_error", handleSocketError);
    socketService.on("socket_reconnected", handleSocketConnected);

    // ===== Cleanup =====

    return () => {
      hasJoinedRef.current = false;
      socketService.leaveRoom(roomId);

      socketService.off("message_delivered", handleMessageDelivered);
      socketService.off("receive_message", handleReceiveMessage);
      socketService.off("message_read", handleMessageRead);
      socketService.off("messages_read", handleMessagesRead);
      socketService.off("messages_marked_read", handleMessagesRead);
      socketService.off("message_deleted", handleMessageDeleted);
      socketService.off(
        "message_delivered_to_recipient",
        handleMessageDeliveredToRecipient,
      );
      socketService.off("reaction_added", handleReactionAdded);
      socketService.off("reaction_removed", handleReactionRemoved);
      socketService.off("user_online", handleUserOnline);
      socketService.off("user_offline", handleUserOffline);
      socketService.off("user_joined_room", handleUserJoinedRoom);
      socketService.off("chat_cleared", handleChatCleared);
      socketService.off("chat_restored", handleChatRestored);
      socketService.off("message_error", handleMessageError);
      socketService.off("socket_connected", handleSocketConnected);
      socketService.off("socket_disconnected", handleSocketDisconnected);
      socketService.off("socket_error", handleSocketError);
      socketService.off("socket_reconnected", handleSocketConnected);
    };
  }, [roomId, otherUserId]);

  return null;
};
