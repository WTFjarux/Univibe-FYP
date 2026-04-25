// hooks/chatScreen/useChatReadReceipts.ts

import { useEffect, useRef } from "react";
import socketService from "../../lib/services/socketService";
import chatApi from "../../lib/services/chatApi";
import { getSenderId } from "../../lib/utils/chatUtils";
import type { Message } from "../../lib/types/chat.types";

interface UseChatReadReceiptsProps {
  token: string | null;
  roomId: string;
  userId?: string;
  messages: Message[];
}

export const useChatReadReceipts = ({
  token,
  roomId,
  userId,
  messages,
}: UseChatReadReceiptsProps) => {
  const lastReadTimestampRef = useRef<number>(Date.now());
  const readTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialMarkedRef = useRef(false);

  // Mark room as read when entering the screen (only once)
  useEffect(() => {
    if (roomId && userId && token && !hasInitialMarkedRef.current) {
      console.log(`📖 Initial mark as read for room: ${roomId}`);

      // 🔴 Only emit socket event if connected
      if (socketService.getConnectionStatus()) {
        socketService.emit("mark_read", { roomId });
      } else {
        // Wait for socket to connect, then emit
        const onConnected = () => {
          socketService.emit("mark_read", { roomId });
          socketService.off("socket_connected", onConnected);
        };
        socketService.on("socket_connected", onConnected);

        // Cleanup listener after 5 seconds if it never connects
        setTimeout(() => {
          socketService.off("socket_connected", onConnected);
        }, 5000);
      }

      // Call API - always works regardless of socket state
      chatApi
        .markRoomAsRead(roomId)
        .then((response) => {
          if (response.success) {
            console.log(`✅ Marked ${response.modifiedCount} messages as read`);
            lastReadTimestampRef.current = Date.now();
            hasInitialMarkedRef.current = true;
          }
        })
        .catch((err) => {
          console.error("Error marking room as read:", err);
          // Still mark as done even if API fails
          hasInitialMarkedRef.current = true;
        });
    }
  }, [roomId, userId, token]);

  // Mark new incoming messages as read with debounce
  useEffect(() => {
    if (!userId || messages.length === 0 || !token) return;
    if (!hasInitialMarkedRef.current) return;

    if (readTimeoutRef.current) {
      clearTimeout(readTimeoutRef.current);
    }

    readTimeoutRef.current = setTimeout(() => {
      const hasNewUnreadMessages = messages.some((msg) => {
        const senderId = getSenderId(msg);
        const isFromOther = senderId !== userId;

        const messageTime = new Date(msg.createdAt).getTime();
        const isNew = messageTime > lastReadTimestampRef.current;

        const isReadByMe = msg.readBy?.some((r: any) => {
          const readUserId = typeof r === "string" ? r : r.user || r.userId;
          return readUserId?.toString() === userId?.toString();
        });

        return isFromOther && isNew && !isReadByMe;
      });

      if (hasNewUnreadMessages) {
        console.log(`📖 Marking new messages as read in room ${roomId}`);

        // Only emit if socket is connected
        if (socketService.getConnectionStatus()) {
          socketService.emit("mark_read", { roomId });
        }

        chatApi.markRoomAsRead(roomId).catch(() => {});

        lastReadTimestampRef.current = Date.now();
      }
    }, 1000);
  }, [messages.length, userId, token, roomId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (readTimeoutRef.current) {
        clearTimeout(readTimeoutRef.current);
      }
    };
  }, []);
};
