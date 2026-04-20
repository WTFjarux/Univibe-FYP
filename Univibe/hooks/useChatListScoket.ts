import { useEffect, useState } from "react";
import { socketService } from "../lib/services";

export const useChatListSocket = (
  updateLastMessage: (roomId: string, message: string, sentAt: string) => void,
  refreshChatRoom: (roomId: string) => void
) => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const check = () => setConnected(socketService.getConnectionStatus());
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!connected) return;

    const handleReceive = (message: any) => {
      if (message.roomId) {
        updateLastMessage(message.roomId, message.message, new Date().toISOString());
      }
    };
    const handleDeleted = (data: { roomId: string }) => data.roomId && refreshChatRoom(data.roomId);
    const handleUpdated = (data: { roomId: string }) => data.roomId && refreshChatRoom(data.roomId);

    socketService.on("receive_message", handleReceive);
    socketService.on("message_deleted", handleDeleted);
    socketService.on("message_updated", handleUpdated);

    return () => {
      socketService.off("receive_message", handleReceive);
      socketService.off("message_deleted", handleDeleted);
      socketService.off("message_updated", handleUpdated);
    };
  }, [connected, updateLastMessage, refreshChatRoom]);

  return connected;
};