// hooks/chatScreen/useChatSocket.ts

import { useEffect, useRef } from "react";
import socketService from "../../lib/services/socketService";
import type { Message } from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Manages socket connection and event listeners for a single chat room.
 * Joins the room on mount, re-joins on reconnection, and cleans up on unmount.
 *
 * Uses a ref-based approach for all handler callbacks to prevent stale closures
 * without needing to re-register listeners when props change.
 */
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
  // Stores the latest handler references to avoid stale closures
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

  // Update ref on every render so socket callbacks always access latest handlers
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

  useEffect(() => {
    if (!roomId) return;

    // Join the room so the server routes events to this socket
    socketService.joinRoom(roomId, otherUserId);

    // -----------------------------------------------------------------------
    // Message Delivery
    // -----------------------------------------------------------------------

    /** Handles delivery confirmation for a sent message */
    const handleMessageDelivered = (data: any) => {
      if (!isMountedRef.current) return;
      handlersRef.current.onMessageDelivered(data);
    };

    // -----------------------------------------------------------------------
    // Receive New Message
    // -----------------------------------------------------------------------

    /** Handles incoming real-time messages; filters by room */
    const handleReceiveMessage = (message: Message) => {
      if (!isMountedRef.current) return;
      if (message.roomId === roomId) {
        handlersRef.current.onReceiveMessage(message);
      }
    };

    // -----------------------------------------------------------------------
    // Read Receipts — Single Message
    // -----------------------------------------------------------------------

    /** Handles a single message being read by another user */
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

      // Forward to onMessageDelivered for status update
      handlersRef.current.onMessageDelivered({
        type: "message_read",
        messageId: data.messageId,
        userId: data.userId,
        readAt: data.readAt || new Date().toISOString(),
      });
    };

    // -----------------------------------------------------------------------
    // Read Receipts — Bulk (Room)
    // -----------------------------------------------------------------------

    /** Handles all messages in a room being marked as read */
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

    // -----------------------------------------------------------------------
    // Message Deleted
    // -----------------------------------------------------------------------

    /** Handles a message being deleted by another user */
    const handleMessageDeleted = (data: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onMessageDeleted) {
        handlersRef.current.onMessageDeleted(data);
      }
    };

    // -----------------------------------------------------------------------
    // Reactions
    // -----------------------------------------------------------------------

    /** Handles a reaction being added to a message */
    const handleReactionAdded = (data: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onReactionAdded) {
        handlersRef.current.onReactionAdded(data);
      }
    };

    /** Handles a reaction being removed from a message */
    const handleReactionRemoved = (data: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onReactionRemoved) {
        handlersRef.current.onReactionRemoved(data);
      }
    };

    // -----------------------------------------------------------------------
    // User Presence
    // -----------------------------------------------------------------------

    /** Handles the other user coming online */
    const handleUserOnline = () => {
      if (!isMountedRef.current) return;
      handlersRef.current.onUserOnline();
    };

    /** Handles the other user going offline */
    const handleUserOffline = () => {
      if (!isMountedRef.current) return;
      handlersRef.current.onUserOffline();
    };

    /** Handles a user joining the current room */
    const handleUserJoinedRoom = (data: any) => {
      if (!isMountedRef.current) return;
      if (data.roomId === roomId) {
        handlersRef.current.onUserOnline();
      }
    };

    /** Handles chat being cleared (by this user or other user) */
    const handleChatCleared = (data: any) => {
      if (!isMountedRef.current) return;
      // If another user cleared their chat, we don't need to do anything
      // The messages remain visible for us
    };

    /** Handles chat being restored (new message after clearing) */
    const handleChatRestored = (data: any) => {
      if (!isMountedRef.current) return;
      // Chat was restored - we could refresh messages here if needed
      // Currently the backend handles this via clearedAt filtering
    };

    // -----------------------------------------------------------------------
    // Delivery to Recipient
    // -----------------------------------------------------------------------

    /** Handles confirmation that a message reached the recipient's device */
    const handleMessageDeliveredToRecipient = (data: any) => {
      if (!isMountedRef.current) return;
      handlersRef.current.onMessageDelivered({
        type: "message_delivered_to_recipient",
        messageId: data.messageId,
        recipientId: data.recipientId,
      });
    };

    // -----------------------------------------------------------------------
    // Error Handling
    // -----------------------------------------------------------------------

    /** Handles message-specific errors from the server */
    const handleMessageError = (error: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onSocketError) {
        handlersRef.current.onSocketError(error);
      }
    };

    // -----------------------------------------------------------------------
    // Connection Events
    // -----------------------------------------------------------------------

    /** Re-joins the room when the socket connects or reconnects */
    const handleSocketConnected = () => {
      if (!isMountedRef.current) return;
      socketService.joinRoom(roomId, otherUserId);
    };

    /** Handles socket disconnection */
    const handleSocketDisconnected = (reason: string) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onSocketError) {
        handlersRef.current.onSocketError({ type: "disconnect", reason });
      }
    };

    /** Handles generic socket errors */
    const handleSocketError = (error: any) => {
      if (!isMountedRef.current) return;
      if (handlersRef.current.onSocketError) {
        handlersRef.current.onSocketError(error);
      }
    };

    // -----------------------------------------------------------------------
    // Register All Listeners
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
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
  }, [roomId, otherUserId]); // Re-register only when room changes
};
