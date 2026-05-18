// hooks/chatScreen/useChatReadReceipts.ts
// Marks messages as read only when the chat screen is focused/visible

import { useEffect, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
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

/**
 * Helper to check if an error is auth-related (already handled by API interceptor)
 * These errors don't need to be logged or re-thrown
 */
const isAuthError = (err: any): boolean => {
  const data = err?.response?.data;
  return (
    data?.code === "ACCOUNT_BANNED" ||
    data?.code === "ACCOUNT_SUSPENDED" ||
    data?.code === "TOKEN_VERSION_MISMATCH" ||
    err?.response?.status === 403 ||
    err?.response?.status === 401
  );
};

export const useChatReadReceipts = ({
  token,
  roomId,
  userId,
  messages,
}: UseChatReadReceiptsProps) => {
  const isFocused = useIsFocused();
  const lastReadTimestampRef = useRef<number>(Date.now());
  const readTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialMarkedRef = useRef(false);

  /**
   * Mark all messages in the room as read on initial entry.
   * Only runs once per room and only when the screen is focused.
   */
  useEffect(() => {
    if (
      !isFocused ||
      !roomId ||
      !userId ||
      !token ||
      hasInitialMarkedRef.current
    )
      return;

    const markRead = () => {
      socketService.emit("mark_read", { roomId });
    };

    if (socketService.getConnectionStatus()) {
      markRead();
    } else {
      const onConnected = () => {
        markRead();
        socketService.off("socket_connected", onConnected);
      };
      socketService.on("socket_connected", onConnected);
      setTimeout(
        () => socketService.off("socket_connected", onConnected),
        5000,
      );
    }

    chatApi
      .markRoomAsRead(roomId)
      .then((response) => {
        if (response.success) {
          lastReadTimestampRef.current = Date.now();
        }
      })
      .catch((err) => {
        // Suppress auth errors (already handled by API interceptor with Alert)
        if (isAuthError(err)) return;
        console.error("Error marking room as read:", err);
      })
      .finally(() => {
        hasInitialMarkedRef.current = true;
      });
  }, [roomId, userId, token, isFocused]);

  /**
   * Mark new incoming messages as read with debounce.
   * Only runs when the screen is focused.
   */
  useEffect(() => {
    if (
      !isFocused ||
      !userId ||
      messages.length === 0 ||
      !token ||
      !hasInitialMarkedRef.current
    )
      return;

    if (readTimeoutRef.current) clearTimeout(readTimeoutRef.current);

    readTimeoutRef.current = setTimeout(() => {
      const hasNewUnread = messages.some((msg) => {
        const senderId = getSenderId(msg);
        if (senderId === userId) return false;

        const msgTime = new Date(msg.createdAt).getTime();
        if (msgTime <= lastReadTimestampRef.current) return false;

        const alreadyRead = msg.readBy?.some((r: any) => {
          const id = typeof r === "string" ? r : r.user || r.userId;
          return id?.toString() === userId?.toString();
        });
        return !alreadyRead;
      });

      if (hasNewUnread) {
        if (socketService.getConnectionStatus()) {
          socketService.emit("mark_read", { roomId });
        }

        // Silent catch - auth errors handled by interceptor
        chatApi.markRoomAsRead(roomId).catch((err) => {
          if (!isAuthError(err)) {
            console.error("Error marking new messages as read:", err);
          }
        });

        lastReadTimestampRef.current = Date.now();
      }
    }, 1000);
  }, [messages.length, userId, token, roomId, isFocused]);

  // Reset when room changes
  useEffect(() => {
    hasInitialMarkedRef.current = false;
    lastReadTimestampRef.current = Date.now();
  }, [roomId]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (readTimeoutRef.current) clearTimeout(readTimeoutRef.current);
    };
  }, []);
};
