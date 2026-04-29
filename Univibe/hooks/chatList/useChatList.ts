import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { ChatRoom } from "../../lib/types/chat.types";
import { useChatRoomsQuery } from "./useChatRoomsQuery";
import { useChatActions } from "./useChatActions";
import { useReadStatus } from "./useReadStatus";
import { useChatListSocket } from "./useChatListSocket";
import { chatApi } from "../../lib/services/chatApi";
import socketService from "../../lib/services/socketService";

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Central hook for the ChatList screen.
 *
 * Orchestrates:
 * - Room data fetching and caching
 * - Real-time socket updates for last messages, read receipts, and deletions
 * - Read/unread status management
 * - Room actions (pin, mute, delete, mark read/unread)
 * - Search filtering
 *
 * Uses ref-based socket handlers to prevent stale closures without
 * re-registering listeners on every render.
 */
export const useChatList = (token: string | null, currentUserId?: string) => {
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Data fetching (API + cache) ──────────────────────────────────────────

  const {
    rooms,
    loading,
    refreshing,
    error,
    fetchRooms,
    onRefresh,
    refreshSingleRoom,
    setRooms,
    roomsRef,
    joinAllRooms,
  } = useChatRoomsQuery({ token });

  // ─── Read/unread status ───────────────────────────────────────────────────

  const { isRoomUnread, addManualUnread, removeManualUnread } =
    useReadStatus(currentUserId);

  // ─── Room actions (pin / mute / delete) ───────────────────────────────────

  const { pinChat, toggleMute, deleteChat } = useChatActions(token, setRooms);

  // ─── Keep roomsRef in sync with state ─────────────────────────────────────

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms, roomsRef]);

  // ─── Room subscription management ─────────────────────────────────────────

  /** Join all rooms when the list changes (new chats added or removed) */
  useEffect(() => {
    if (socketService.getConnectionStatus() && rooms.length > 0) {
      joinAllRooms(rooms);
    }
  }, [rooms.length, joinAllRooms]);

  /** Rejoin all rooms when the socket reconnects */
  useEffect(() => {
    const handleConnected = () => {
      if (roomsRef.current.length > 0) {
        joinAllRooms(roomsRef.current);
      }
    };

    socketService.on("socket_connected", handleConnected);
    socketService.on("socket_reconnected", handleConnected);

    return () => {
      socketService.off("socket_connected", handleConnected);
      socketService.off("socket_reconnected", handleConnected);
    };
  }, [joinAllRooms]);

  // ---------------------------------------------------------------------------
  // Room List Update Helpers
  // ---------------------------------------------------------------------------

  /**
   * Updates the last message for a room and re-sorts the list.
   * Pinned rooms always appear first, then sorted by most recent.
   */
  const updateRoomLastMessage = useCallback(
    (
      roomId: string,
      message: string,
      sentAt: string,
      senderId?: string,
      senderName?: string,
      type: string = "text",
    ) => {
      setRooms((prev) => {
        const updated = prev.map((room) => {
          if (room.roomId !== roomId) return room;

          const isFromCurrentUser = senderId === currentUserId;

          return {
            ...room,
            lastMessage: {
              message,
              sentAt,
              senderId: senderId || "",
              senderName: senderName || "",
              type: type as any,
              readBy: isFromCurrentUser ? [currentUserId || ""] : [],
            },
            updatedAt: sentAt,
          };
        });

        return [...updated].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      });
    },
    [currentUserId, setRooms],
  );

  /**
   * Updates read receipts when another user reads messages in a room.
   * Adds the user to the readBy array if not already present.
   */
  const handleMessagesRead = useCallback(
    (roomId: string, userId: string) => {
      if (userId === currentUserId) return;

      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomId === roomId && room.lastMessage) {
            const readBy = room.lastMessage.readBy || [];
            if (!readBy.includes(userId)) {
              return {
                ...room,
                lastMessage: {
                  ...room.lastMessage,
                  readBy: [...readBy, userId],
                },
              };
            }
          }
          return room;
        }),
      );
    },
    [currentUserId, setRooms],
  );

  // ---------------------------------------------------------------------------
  // Chat Restored / Chat Cleared Handlers
  // Declared BEFORE stableSocketHandlers to avoid "used before declaration"
  // ---------------------------------------------------------------------------

  /**
   * Handles chat restored event from socket.
   * When the other user sends a message to a deleted chat, the room reappears
   * in the list with only the new messages visible.
   */
  const handleChatRestored = useCallback(
    (data: { roomId: string }) => {
      const exists = roomsRef.current.some((r) => r.roomId === data.roomId);

      if (!exists) {
        refreshSingleRoom(data.roomId);

        if (socketService.getConnectionStatus()) {
          socketService.joinRoom(data.roomId);
        }
      }
    },
    [refreshSingleRoom],
  );

  /**
   * Handles chat cleared event from socket.
   * Optional handler - most apps don't notify when the other user clears their chat.
   */
  const handleChatCleared = useCallback((data: { roomId: string }) => {
    // Optional: refresh the room to update its state if needed
  }, []);

  // ---------------------------------------------------------------------------
  // Socket Event Handlers (Ref-Based for Stale Closure Prevention)
  // ---------------------------------------------------------------------------

  /** Handles incoming real-time messages */
  const handleNewMessageRef = useRef<(data: any) => void>(undefined);

  handleNewMessageRef.current = (data: any) => {
    if (!data.roomId) return;

    const senderId =
      typeof data.sender === "string" ? data.sender : data.sender?._id;
    const senderName =
      typeof data.sender === "string" ? data.senderName : data.sender?.name;

    const roomExists = roomsRef.current.some(
      (room) => room.roomId === data.roomId,
    );

    if (!roomExists) {
      fetchRooms();
      return;
    }

    updateRoomLastMessage(
      data.roomId,
      data.message,
      data.createdAt || new Date().toISOString(),
      senderId,
      senderName,
      data.type,
    );
  };

  /** Handles bulk read receipt events from the socket */
  const handleMessagesReadRef = useRef<(data: any) => void>(undefined);

  handleMessagesReadRef.current = (data: any) => {
    if (data.roomId && data.userId && data.userId !== currentUserId) {
      handleMessagesRead(data.roomId, data.userId);
    }
  };

  /** Handles message deletion events by refreshing the affected room */
  const handleMessageDeletedRef = useRef<(data: any) => void>(undefined);

  handleMessageDeletedRef.current = (data: any) => {
    if (data.roomId) {
      refreshSingleRoom(data.roomId);
    }
  };

  /** Handles reaction update events */
  const handleReactionUpdatedRef = useRef<(data: any) => void>(undefined);

  handleReactionUpdatedRef.current = (data: any) => {
    if (data.messageId) {
      // Room refresh could be triggered here if needed
    }
  };

  /**
   * Stable wrapper callbacks that delegate to the ref-based handlers.
   * These references never change, so useChatListSocket registers listeners once.
   */
  const stableSocketHandlers = useMemo(
    () => ({
      onNewMessage: (data: any) => {
        handleNewMessageRef.current?.(data);
      },
      onMessagesRead: (data: any) => {
        handleMessagesReadRef.current?.(data);
      },
      onMessageDeleted: (data: any) => {
        handleMessageDeletedRef.current?.(data);
      },
      onReactionUpdated: (data: any) => {
        handleReactionUpdatedRef.current?.(data);
      },
      onChatRestored: (data: any) => {
        handleChatRestored(data);
      },
      onChatCleared: (data: any) => {
        handleChatCleared(data);
      },
    }),
    [handleChatRestored, handleChatCleared],
  );

  useChatListSocket(stableSocketHandlers);

  // ---------------------------------------------------------------------------
  // Mark Room as Read
  // ---------------------------------------------------------------------------

  /**
   * Marks all messages in a room as read.
   * Applies optimistic update, removes manual unread flag, and syncs with server.
   */
  const markRoomAsRead = useCallback(
    async (roomId: string) => {
      if (!token) return;

      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomId === roomId && room.lastMessage && currentUserId) {
            const readBy = room.lastMessage.readBy || [];
            if (!readBy.includes(currentUserId)) {
              return {
                ...room,
                lastMessage: {
                  ...room.lastMessage,
                  readBy: [...readBy, currentUserId],
                },
              };
            }
          }
          return room;
        }),
      );

      await removeManualUnread(roomId);

      try {
        const response = await chatApi.markRoomAsRead(token);
        if (response.success && socketService.getConnectionStatus()) {
          socketService.emit("mark_read", { roomId });
        }
      } catch {
        refreshSingleRoom(roomId);
      }
    },
    [token, currentUserId, setRooms, removeManualUnread, refreshSingleRoom],
  );

  // ---------------------------------------------------------------------------
  // Toggle Read / Unread
  // ---------------------------------------------------------------------------

  /**
   * Toggles the read/unread state of a room manually.
   * If unread, marks as read. If read, marks as unread manually.
   */
  const toggleRead = useCallback(
    async (room: ChatRoom | null) => {
      if (!room || !token) return;

      const currentlyUnread = isRoomUnread(room);

      if (currentlyUnread) {
        await markRoomAsRead(room.roomId);
      } else {
        await addManualUnread(room.roomId);

        setRooms((prev) =>
          prev.map((r) => {
            if (r.roomId === room.roomId && r.lastMessage && currentUserId) {
              const readBy = r.lastMessage.readBy || [];
              return {
                ...r,
                lastMessage: {
                  ...r.lastMessage,
                  readBy: readBy.filter((id) => id !== currentUserId),
                },
              };
            }
            return r;
          }),
        );

        try {
          await chatApi.markRoomAsUnread(token);
        } catch {
          await removeManualUnread(room.roomId);
          refreshSingleRoom(room.roomId);
        }
      }
    },
    [
      token,
      isRoomUnread,
      markRoomAsRead,
      addManualUnread,
      removeManualUnread,
      currentUserId,
      setRooms,
      refreshSingleRoom,
    ],
  );

  // ---------------------------------------------------------------------------
  // Search Filtering
  // ---------------------------------------------------------------------------

  /** Filters rooms by the current search query (case-insensitive name match) */
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const query = searchQuery.toLowerCase();
    return rooms.filter((room) => room.name.toLowerCase().includes(query));
  }, [rooms, searchQuery]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    rooms,
    filteredRooms,
    loading,
    refreshing,
    error,
    searchQuery,
    setSearchQuery,
    fetchRooms,
    onRefresh,
    refreshSingleRoom,
    updateRoomLastMessage,
    handleMessagesRead,
    markRoomAsRead,
    isRoomUnread,
    pinChat,
    toggleRead,
    toggleMute,
    deleteChat,
  };
};
