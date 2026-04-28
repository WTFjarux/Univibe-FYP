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
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Manages socket event listeners for the ChatList screen.
 *
 * Uses a ref-based handler pattern to prevent stale closures:
 * - Handler refs are updated every render so callbacks always access latest state
 * - Socket listeners are registered once and delegate to the refs
 * - Connection events are monitored in real-time (no polling)
 * - Listeners are re-attached on reconnection to handle new socket instances
 */
export const useChatListSocket = ({
  onNewMessage,
  onMessagesRead,
  onMessageDeleted,
  onReactionUpdated,
}: UseChatListSocketProps) => {
  const isConnectedRef = useRef(false);
  const isListenersAttachedRef = useRef(false);

  // Stores latest handler references; updated every render to prevent staleness
  const handlersRef = useRef({
    onNewMessage,
    onMessagesRead,
    onMessageDeleted,
    onReactionUpdated,
  });

  handlersRef.current = {
    onNewMessage,
    onMessagesRead,
    onMessageDeleted,
    onReactionUpdated,
  };

  // ---------------------------------------------------------------------------
  // Listener Registration
  // ---------------------------------------------------------------------------

  /**
   * Registers all socket event listeners once.
   * Each listener reads from handlersRef so it always calls the latest handler
   * without needing to re-register when props change.
   */
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

    socketService.on("receive_message", handleNewMessage);
    socketService.on("messages_read", handleMessagesRead);
    socketService.on("message_deleted", handleDelete);
    socketService.on("reaction_added", handleReaction);
    socketService.on("reaction_removed", handleReaction);

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
      // New socket instance requires re-attaching listeners
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

  /** Removes all chat list listeners on unmount */
  useEffect(() => {
    return () => {
      if (isListenersAttachedRef.current) {
        socketService.removeAllListeners("receive_message");
        socketService.removeAllListeners("messages_read");
        socketService.removeAllListeners("message_deleted");
        socketService.removeAllListeners("reaction_added");
        socketService.removeAllListeners("reaction_removed");
        isListenersAttachedRef.current = false;
      }
    };
  }, []);

  return isConnectedRef.current;
};
