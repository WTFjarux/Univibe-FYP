// hooks/chatScreen/useChatSocket.ts

import { useEffect, useRef } from "react";
import socketService from "../../lib/services/socketService";
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

  // Keep refs updated
  useEffect(() => {
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
  }, [
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
  ]);

  useEffect(() => {
    if (!roomId) return;

    console.log(`🔌 Setting up socket listeners for room: ${roomId}`);

    // Join the room
    socketService.joinRoom(roomId, otherUserId);

    // ────────────────────────────────────────
    // MESSAGE DELIVERY
    // ────────────────────────────────────────
    const handleMessageDelivered = (data: any) => {
      if (isMountedRef.current) {
        console.log(`✅ Message delivered:`, {
          tempId: data.tempId,
          messageId: data.messageId,
          type: data.message?.type,
          hasMediaUrl: !!data.message?.mediaUrl,
          success: data.success,
        });
        handlersRef.current.onMessageDelivered(data);
      }
    };

    // ────────────────────────────────────────
    // RECEIVE NEW MESSAGE
    // ────────────────────────────────────────
    const handleReceiveMessage = (message: Message) => {
      if (message.roomId === roomId && isMountedRef.current) {
        console.log(`📨 Received message:`, {
          id: message._id,
          type: message.type,
          sender: message.senderName,
          hasMedia: !!message.mediaUrl,
        });
        handlersRef.current.onReceiveMessage(message);
      }
    };

    // ────────────────────────────────────────
    // READ RECEIPTS - SINGLE MESSAGE
    // ────────────────────────────────────────
    const handleMessageRead = (data: any) => {
      if (isMountedRef.current) {
        console.log(
          `📖 Single message read - ID: ${data.messageId}, by: ${data.userId}, room: ${data.roomId}`,
        );

        // Notify parent about the read receipt
        if (handlersRef.current.onMessageRead) {
          handlersRef.current.onMessageRead({
            messageId: data.messageId,
            roomId: data.roomId,
            userId: data.userId,
            readAt: data.readAt || new Date().toISOString(),
          });
        }

        // Also forward to onMessageDelivered for updating message status
        handlersRef.current.onMessageDelivered({
          type: "message_read",
          messageId: data.messageId,
          userId: data.userId,
          readAt: data.readAt || new Date().toISOString(),
        });
      }
    };

    // ────────────────────────────────────────
    // READ RECEIPTS - BULK (ROOM)
    // ────────────────────────────────────────
    const handleMessagesRead = (data: any) => {
      if (isMountedRef.current) {
        console.log(
          `📖 Messages read in room ${data.roomId} by ${data.userId}`,
        );

        // Notify parent about bulk read
        if (handlersRef.current.onMessagesRead) {
          handlersRef.current.onMessagesRead({
            roomId: data.roomId,
            userId: data.userId,
            readAt: data.readAt || new Date().toISOString(),
          });
        }

        // Forward to onMessageDelivered for updating all messages status
        handlersRef.current.onMessageDelivered({
          type: "messages_read",
          roomId: data.roomId,
          userId: data.userId,
          readAt: data.readAt || new Date().toISOString(),
        });
      }
    };

    // ────────────────────────────────────────
    // MESSAGE DELETED
    // ────────────────────────────────────────
    const handleMessageDeleted = (data: any) => {
      if (isMountedRef.current) {
        console.log(
          `🗑️ Message deleted: ${data.messageId} in room ${data.roomId}`,
        );
        if (handlersRef.current.onMessageDeleted) {
          handlersRef.current.onMessageDeleted(data);
        }
      }
    };

    // ────────────────────────────────────────
    // REACTIONS
    // ────────────────────────────────────────
    const handleReactionAdded = (data: any) => {
      if (isMountedRef.current) {
        console.log(
          `👍 Reaction added to ${data.messageId}: ${data.reaction} by ${data.userId}`,
        );
        if (handlersRef.current.onReactionAdded) {
          handlersRef.current.onReactionAdded(data);
        }
      }
    };

    const handleReactionRemoved = (data: any) => {
      if (isMountedRef.current) {
        console.log(
          `👎 Reaction removed from ${data.messageId} by ${data.userId}`,
        );
        if (handlersRef.current.onReactionRemoved) {
          handlersRef.current.onReactionRemoved(data);
        }
      }
    };

    // ────────────────────────────────────────
    // USER PRESENCE
    // ────────────────────────────────────────
    const handleUserOnline = () => {
      if (isMountedRef.current) {
        console.log("👤 Other user came online");
        handlersRef.current.onUserOnline();
      }
    };

    const handleUserOffline = () => {
      if (isMountedRef.current) {
        console.log("👤 Other user went offline");
        handlersRef.current.onUserOffline();
      }
    };

    const handleUserJoinedRoom = (data: any) => {
      if (isMountedRef.current && data.roomId === roomId) {
        console.log(`👤 User ${data.userId} joined room ${data.roomId}`);
        handlersRef.current.onUserOnline();
      }
    };

    // ────────────────────────────────────────
    // DELIVERY TO RECIPIENT
    // ────────────────────────────────────────
    const handleMessageDeliveredToRecipient = (data: any) => {
      if (isMountedRef.current) {
        console.log(
          `✅ Message ${data.messageId} delivered to ${data.recipientId}`,
        );
        handlersRef.current.onMessageDelivered({
          type: "message_delivered_to_recipient",
          messageId: data.messageId,
          recipientId: data.recipientId,
        });
      }
    };

    // ────────────────────────────────────────
    // ERROR HANDLING
    // ────────────────────────────────────────
    const handleMessageError = (error: any) => {
      if (isMountedRef.current) {
        console.error("❌ Message error:", error);
        if (handlersRef.current.onSocketError) {
          handlersRef.current.onSocketError(error);
        }
      }
    };

    // ────────────────────────────────────────
    // CONNECTION EVENTS
    // ────────────────────────────────────────
    const handleSocketConnected = () => {
      if (isMountedRef.current) {
        console.log("✅ Socket connected, re-joining room:", roomId);
        // Re-join room on reconnection
        socketService.joinRoom(roomId, otherUserId);
      }
    };

    const handleSocketDisconnected = (reason: string) => {
      if (isMountedRef.current) {
        console.log("❌ Socket disconnected:", reason);
        if (handlersRef.current.onSocketError) {
          handlersRef.current.onSocketError({ type: "disconnect", reason });
        }
      }
    };

    const handleSocketError = (error: any) => {
      if (isMountedRef.current) {
        console.error("❌ Socket error:", error);
        if (handlersRef.current.onSocketError) {
          handlersRef.current.onSocketError(error);
        }
      }
    };

    // ────────────────────────────────────────
    // REGISTER ALL LISTENERS
    // ────────────────────────────────────────
    socketService.on("message_delivered", handleMessageDelivered);
    socketService.on("receive_message", handleReceiveMessage);
    socketService.on("message_read", handleMessageRead);
    socketService.on("messages_read", handleMessagesRead);
    socketService.on("messages_marked_read", handleMessagesRead); // Alternative event name
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
    socketService.on("message_error", handleMessageError);
    socketService.on("socket_connected", handleSocketConnected);
    socketService.on("socket_disconnected", handleSocketDisconnected);
    socketService.on("socket_error", handleSocketError);
    socketService.on("socket_reconnected", handleSocketConnected);

    // ────────────────────────────────────────
    // CLEANUP
    // ────────────────────────────────────────
    return () => {
      console.log(`🔌 Cleaning up socket listeners for room: ${roomId}`);

      // Leave the room
      socketService.leaveRoom(roomId);

      // Remove all event listeners
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
      socketService.off("message_error", handleMessageError);
      socketService.off("socket_connected", handleSocketConnected);
      socketService.off("socket_disconnected", handleSocketDisconnected);
      socketService.off("socket_error", handleSocketError);
      socketService.off("socket_reconnected", handleSocketConnected);
    };
  }, [roomId, otherUserId]);
};
