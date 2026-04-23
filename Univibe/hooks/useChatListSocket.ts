// hooks/useChatListSocket.ts

import { useEffect, useState, useRef } from "react";
import { socketService } from "../lib/services";
import { useActiveRoom } from "../lib/contexts/ActiveRoomContext";

interface MessageData {
  roomId: string;
  message: string;
  createdAt?: string;
  sender?: string | { _id: string; name: string };
  senderName?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
  replyTo?: any;
}

interface ReadReceiptData {
  roomId: string;
  userId: string;
  readAt?: string;
}

interface MessageReadData {
  messageId: string;
  roomId: string;
  userId: string;
  readAt?: string;
}

export const useChatListSocket = (
  updateLastMessage: (
    roomId: string,
    message: string,
    sentAt: string,
    senderId?: string,
    senderName?: string,
    type?: string
  ) => void,
  refreshChatRoom: (roomId: string) => void,
  handleMessagesRead?: (roomId: string, userId: string) => void,
  activeRoomIdProp?: string | null // Optional prop override
) => {
  const [connected, setConnected] = useState(false);
  
  // Get active room from context
  const { activeRoomId: contextActiveRoomId } = useActiveRoom();
  
  // Use prop if provided, otherwise use context value
  const activeRoomId = activeRoomIdProp !== undefined ? activeRoomIdProp : contextActiveRoomId;
  const activeRoomIdRef = useRef(activeRoomId);

  // Keep ref updated with latest activeRoomId
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // Connection status check
  useEffect(() => {
    const check = () => setConnected(socketService.getConnectionStatus());
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!connected) return;

    // Handle incoming messages
    const handleReceive = (message: MessageData) => {
      if (!message.roomId) return;

      const senderId = typeof message.sender === "string"
        ? message.sender
        : message.sender?._id;

      const senderName = typeof message.sender === "string"
        ? message.senderName
        : message.sender?.name;

      // Update last message preview
      updateLastMessage(
        message.roomId,
        message.message,
        message.createdAt || new Date().toISOString(),
        senderId,
        senderName,
        message.type || "text"
      );

      // Note: The isRoomUnread logic in useChatRooms handles whether to show
      // unread indicator based on activeRoomId from context
    };

    // Handle messages_read from other user
    const handleMessagesReadEvent = (data: ReadReceiptData) => {
      if (!data.roomId || !data.userId) return;
      
      // Call the handler if provided
      if (handleMessagesRead) {
        handleMessagesRead(data.roomId, data.userId);
      }
    };

    // Handle single message read
    const handleMessageRead = (data: MessageReadData) => {
      if (!data.messageId) return;
      
      // Refresh the room to update read receipts
      if (data.roomId) {
        refreshChatRoom(data.roomId);
      }
    };

    // Handle message deleted
    const handleDeleted = (data: { roomId: string; messageId: string }) => {
      if (data.roomId) {
        refreshChatRoom(data.roomId);
      }
    };

    // Handle message updated
    const handleUpdated = (data: { roomId: string }) => {
      if (data.roomId) {
        refreshChatRoom(data.roomId);
      }
    };

    // Handle delivery confirmation to recipient
    const handleDeliveredToRecipient = (data: { 
      messageId: string; 
      recipientId: string 
    }) => {
      // Silent - just for internal tracking
    };

    // Handle user joined room
    const handleUserJoinedRoom = (data: { userId: string; roomId: string }) => {
      // Can be used to update online status indicators
    };

    // Handle reaction added
    const handleReactionAdded = (data: { 
      messageId: string; 
      userId: string; 
      reaction: string;
      reactions: any[];
    }) => {
      // Refresh the room to update reactions
      // The roomId is not directly available, so we may need to get it
      // For now, we can rely on the parent to handle this
    };

    // Handle reaction removed
    const handleReactionRemoved = (data: { 
      messageId: string; 
      userId: string;
      reactions: any[];
    }) => {
      // Refresh the room to update reactions
    };

    // Register all listeners
    socketService.on("receive_message", handleReceive);
    socketService.on("messages_read", handleMessagesReadEvent);
    socketService.on("message_read", handleMessageRead);
    socketService.on("message_deleted", handleDeleted);
    socketService.on("message_updated", handleUpdated);
    socketService.on("message_delivered_to_recipient", handleDeliveredToRecipient);
    socketService.on("user_joined_room", handleUserJoinedRoom);
    socketService.on("reaction_added", handleReactionAdded);
    socketService.on("reaction_removed", handleReactionRemoved);

    // Cleanup listeners
    return () => {
      socketService.off("receive_message", handleReceive);
      socketService.off("messages_read", handleMessagesReadEvent);
      socketService.off("message_read", handleMessageRead);
      socketService.off("message_deleted", handleDeleted);
      socketService.off("message_updated", handleUpdated);
      socketService.off("message_delivered_to_recipient", handleDeliveredToRecipient);
      socketService.off("user_joined_room", handleUserJoinedRoom);
      socketService.off("reaction_added", handleReactionAdded);
      socketService.off("reaction_removed", handleReactionRemoved);
    };
  }, [connected, updateLastMessage, refreshChatRoom, handleMessagesRead]);

  return connected;
};