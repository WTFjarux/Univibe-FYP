import { useEffect, useRef } from 'react';
import socketService from '../../lib/services/socketService';
import type { Message } from '../../lib/types/chat.types';

interface UseChatSocketProps {
  roomId: string;
  otherUserId: string;
  isMountedRef: React.RefObject<boolean>;
  onMessageDelivered: (data: any) => void;
  onReceiveMessage: (message: Message) => void;
  onUserOnline: () => void;
  onUserOffline: () => void;
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
  onSocketError,
}: UseChatSocketProps) => {
  const handlersRef = useRef({
    onMessageDelivered,
    onReceiveMessage,
    onUserOnline,
    onUserOffline,
    onSocketError,
  });

  // Keep refs updated
  useEffect(() => {
    handlersRef.current = {
      onMessageDelivered,
      onReceiveMessage,
      onUserOnline,
      onUserOffline,
      onSocketError,
    };
  }, [onMessageDelivered, onReceiveMessage, onUserOnline, onUserOffline, onSocketError]);

  useEffect(() => {
    if (!roomId) return;

    socketService.joinRoom(roomId, otherUserId);

    const handleMessageDelivered = (data: any) => {
      if (isMountedRef.current) handlersRef.current.onMessageDelivered(data);
    };

    const handleReceiveMessage = (message: Message) => {
      if (message.roomId === roomId && isMountedRef.current) {
        handlersRef.current.onReceiveMessage(message);
      }
    };

    const handleUserOnline = () => {
      if (isMountedRef.current) handlersRef.current.onUserOnline();
    };

    const handleUserOffline = () => {
      if (isMountedRef.current) handlersRef.current.onUserOffline();
    };

    socketService.on('message_delivered', handleMessageDelivered);
    socketService.on('receive_message', handleReceiveMessage);
    socketService.on('user_online', handleUserOnline);
    socketService.on('user_offline', handleUserOffline);

    return () => {
      socketService.off('message_delivered', handleMessageDelivered);
      socketService.off('receive_message', handleReceiveMessage);
      socketService.off('user_online', handleUserOnline);
      socketService.off('user_offline', handleUserOffline);
    };
  }, [roomId, otherUserId]);
};