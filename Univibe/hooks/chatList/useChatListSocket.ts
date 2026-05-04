// hooks/chatList/useChatListSocket.ts

import { useEffect, useRef, useCallback } from "react";
import socketService from "../../lib/services/socketService";
import type {
  SocketMessageData,
  ReadReceiptData,
  MessageDeleteData,
  ReactionData,
} from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseChatListSocketProps {
  onNewMessage: (data: SocketMessageData) => void;
  onMessagesRead: (data: ReadReceiptData) => void;
  onMessageDeleted: (data: MessageDeleteData) => void;
  onReactionUpdated: (data: ReactionData) => void;
  onChatCleared?: (data: { roomId: string }) => void;
  onChatRestored?: (data: { roomId: string }) => void;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export const useChatListSocket = ({
  onNewMessage,
  onMessagesRead,
  onMessageDeleted,
  onReactionUpdated,
  onChatCleared,
  onChatRestored,
}: UseChatListSocketProps) => {
  const isConnectedRef = useRef(false);
  const isListenersAttachedRef = useRef(false);

  // Stores latest handler references; updated every render to prevent staleness
  const handlersRef = useRef({
    onNewMessage,
    onMessagesRead,
    onMessageDeleted,
    onReactionUpdated,
    onChatCleared,
    onChatRestored,
  });

  handlersRef.current = {
    onNewMessage,
    onMessagesRead,
    onMessageDeleted,
    onReactionUpdated,
    onChatCleared,
    onChatRestored,
  };

  // ---------------------------------------------------------------------------
  // Error handler
  // ---------------------------------------------------------------------------
  const handleError = useCallback((error: any) => {
    const message = error?.message || error?.error || "";
    if (message.includes("connections") || message.includes("connect first")) {
      console.log("Connection required:", message);
    }
  }, []);

  // Store error handler in ref for cleanup access
  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  // ---------------------------------------------------------------------------
  // Listener Registration
  // ---------------------------------------------------------------------------

  const attachListeners = useCallback(() => {
    if (isListenersAttachedRef.current) return;

    const handleNewMessage = (data: SocketMessageData) => {
      handlersRef.current.onNewMessage(data);
    };

    const handleMessagesRead = (data: ReadReceiptData) => {
      handlersRef.current.onMessagesRead(data);
    };

    const handleDelete = (data: MessageDeleteData) => {
      handlersRef.current.onMessageDeleted(data);
    };

    const handleReaction = (data: ReactionData) => {
      handlersRef.current.onReactionUpdated(data);
    };

    const handleChatCleared = (data: { roomId: string }) => {
      handlersRef.current.onChatCleared?.(data);
    };

    const handleChatRestored = (data: { roomId: string }) => {
      handlersRef.current.onChatRestored?.(data);
    };

    // ✅ Group updated handler - refreshes room to get new name/photo
    const handleGroupUpdated = (data: { roomId: string }) => {
      if (data.roomId) {
        handlersRef.current.onChatRestored?.({ roomId: data.roomId });
      }
    };

    // Store group handler in ref for cleanup access
    const groupHandlerRef = { current: handleGroupUpdated };
    (attachListeners as any).__groupHandler = groupHandlerRef;

    socketService.on("receive_message", handleNewMessage);
    socketService.on("messages_read", handleMessagesRead);
    socketService.on("message_deleted", handleDelete);
    socketService.on("reaction_added", handleReaction);
    socketService.on("reaction_removed", handleReaction);
    socketService.on("chat_cleared", handleChatCleared);
    socketService.on("chat_restored", handleChatRestored);
    socketService.on("group_updated", handleGroupUpdated);
    socketService.on("error", handleErrorRef.current);
    socketService.on("socket_error", handleErrorRef.current);

    isListenersAttachedRef.current = true;
  }, []);

  // ---------------------------------------------------------------------------
  // Connection Monitoring (Event-Driven)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (socketService.getConnectionStatus()) {
      isConnectedRef.current = true;
      attachListeners();
    }

    const handleConnected = () => {
      isConnectedRef.current = true;
      attachListeners();
    };

    const handleDisconnected = () => {
      isConnectedRef.current = false;
    };

    const handleReconnected = () => {
      isConnectedRef.current = true;
      isListenersAttachedRef.current = false;
      attachListeners();
    };

    socketService.on("socket_connected", handleConnected);
    socketService.on("socket_disconnected", handleDisconnected);
    socketService.on("socket_reconnected", handleReconnected);

    return () => {
      socketService.off("socket_connected", handleConnected);
      socketService.off("socket_disconnected", handleDisconnected);
      socketService.off("socket_reconnected", handleReconnected);
    };
  }, [attachListeners]);

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (isListenersAttachedRef.current) {
        socketService.removeAllListeners("receive_message");
        socketService.removeAllListeners("messages_read");
        socketService.removeAllListeners("message_deleted");
        socketService.removeAllListeners("reaction_added");
        socketService.removeAllListeners("reaction_removed");
        socketService.removeAllListeners("chat_cleared");
        socketService.removeAllListeners("chat_restored");
        socketService.removeAllListeners("group_updated");
        socketService.off("error", handleErrorRef.current);
        socketService.off("socket_error", handleErrorRef.current);
        isListenersAttachedRef.current = false;
      }
    };
  }, []);

  return isConnectedRef.current;
};
