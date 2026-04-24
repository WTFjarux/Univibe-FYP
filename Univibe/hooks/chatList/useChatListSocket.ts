import { useEffect, useState, useRef } from 'react';
import  socketService  from '../../lib/services/socketService';
import type { SocketMessageData, ReadReceiptData, MessageDeleteData, ReactionData } from '../../lib/types/chat.types';

interface UseChatListSocketProps {
  onNewMessage: (data: SocketMessageData) => void;
  onMessagesRead: (data: ReadReceiptData) => void;
  onMessageDeleted: (data: MessageDeleteData) => void;
  onReactionUpdated: (data: ReactionData) => void;
}

export const useChatListSocket = ({
  onNewMessage,
  onMessagesRead,
  onMessageDeleted,
  onReactionUpdated,
}: UseChatListSocketProps) => {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef({ onNewMessage, onMessagesRead, onMessageDeleted, onReactionUpdated });
  
  // Keep refs updated
  useEffect(() => {
    handlersRef.current = { onNewMessage, onMessagesRead, onMessageDeleted, onReactionUpdated };
  }, [onNewMessage, onMessagesRead, onMessageDeleted, onReactionUpdated]);

  // Connection status monitoring
  useEffect(() => {
    const check = () => setConnected(socketService.getConnectionStatus());
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!connected) return;

    const handleNewMessage = (data: SocketMessageData) => handlersRef.current.onNewMessage(data);
    const handleMessagesRead = (data: ReadReceiptData) => handlersRef.current.onMessagesRead(data);
    const handleDelete = (data: MessageDeleteData) => handlersRef.current.onMessageDeleted(data);
    const handleReaction = (data: ReactionData) => handlersRef.current.onReactionUpdated(data);

    socketService.on('receive_message', handleNewMessage);
    socketService.on('messages_read', handleMessagesRead);
    socketService.on('message_deleted', handleDelete);
    socketService.on('reaction_added', handleReaction);
    socketService.on('reaction_removed', handleReaction);

    return () => {
      socketService.off('receive_message', handleNewMessage);
      socketService.off('messages_read', handleMessagesRead);
      socketService.off('message_deleted', handleDelete);
      socketService.off('reaction_added', handleReaction);
      socketService.off('reaction_removed', handleReaction);
    };
  }, [connected]);

  return connected;
};