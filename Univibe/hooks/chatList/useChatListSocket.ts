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
  onUnreadCountUpdate?: (data: { count: number }) => void;
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
  onUnreadCountUpdate,
}: UseChatListSocketProps) => {
  const isConnectedRef = useRef(false);
  const isListenersAttachedRef = useRef(false);

  // Store the actual listener function references for cleanup
  const listenerRefs = useRef<{
    handleNewMessage?: (data: any) => void;
    handleMessagesRead?: (data: any) => void;
    handleDelete?: (data: any) => void;
    handleReaction?: (data: any) => void;
    handleChatCleared?: (data: any) => void;
    handleChatRestored?: (data: any) => void;
    handleGroupUpdated?: (data: any) => void;
    handleUnreadCount?: (data: any) => void;
  }>({});

  // Stores latest handler references; updated every render to prevent staleness
  const handlersRef = useRef({
    onNewMessage,
    onMessagesRead,
    onMessageDeleted,
    onReactionUpdated,
    onChatCleared,
    onChatRestored,
    onUnreadCountUpdate,
  });

  handlersRef.current = {
    onNewMessage,
    onMessagesRead,
    onMessageDeleted,
    onReactionUpdated,
    onChatCleared,
    onChatRestored,
    onUnreadCountUpdate,
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

  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  // ---------------------------------------------------------------------------
  // Listener Registration
  // ---------------------------------------------------------------------------

  const attachListeners = useCallback(() => {
    if (isListenersAttachedRef.current) return;

    // Create stable listener functions and store references for cleanup
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

    const handleGroupUpdated = (data: { roomId: string }) => {
      if (data.roomId) {
        handlersRef.current.onChatRestored?.({ roomId: data.roomId });
      }
    };

    const handleUnreadCount = (data: { count: number }) => {
      handlersRef.current.onUnreadCountUpdate?.(data);
    };

    // Store references for cleanup
    listenerRefs.current = {
      handleNewMessage,
      handleMessagesRead,
      handleDelete,
      handleReaction,
      handleChatCleared,
      handleChatRestored,
      handleGroupUpdated,
      handleUnreadCount,
    };

    // Register listeners
    socketService.on("receive_message", handleNewMessage);
    socketService.on("messages_read", handleMessagesRead);
    socketService.on("message_deleted", handleDelete);
    socketService.on("reaction_added", handleReaction);
    socketService.on("reaction_removed", handleReaction);
    socketService.on("chat_cleared", handleChatCleared);
    socketService.on("chat_restored", handleChatRestored);
    socketService.on("group_updated", handleGroupUpdated);
    socketService.on("chat:unreadCount", handleUnreadCount);
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
  // Cleanup - ONLY remove listeners created by THIS hook
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (isListenersAttachedRef.current) {
        const refs = listenerRefs.current;

        // Use off() with exact function references instead of removeAllListeners
        if (refs.handleNewMessage) {
          socketService.off("receive_message", refs.handleNewMessage);
        }
        if (refs.handleMessagesRead) {
          socketService.off("messages_read", refs.handleMessagesRead);
        }
        if (refs.handleDelete) {
          socketService.off("message_deleted", refs.handleDelete);
        }
        if (refs.handleReaction) {
          socketService.off("reaction_added", refs.handleReaction);
          socketService.off("reaction_removed", refs.handleReaction);
        }
        if (refs.handleChatCleared) {
          socketService.off("chat_cleared", refs.handleChatCleared);
        }
        if (refs.handleChatRestored) {
          socketService.off("chat_restored", refs.handleChatRestored);
        }
        if (refs.handleGroupUpdated) {
          socketService.off("group_updated", refs.handleGroupUpdated);
        }
        if (refs.handleUnreadCount) {
          socketService.off("chat:unreadCount", refs.handleUnreadCount);
        }

        socketService.off("error", handleErrorRef.current);
        socketService.off("socket_error", handleErrorRef.current);

        isListenersAttachedRef.current = false;
      }
    };
  }, []);

  return isConnectedRef.current;
};
