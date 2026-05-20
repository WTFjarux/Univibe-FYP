// hooks/chatList/useChatList.ts

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

export const useChatList = (token: string | null, currentUserId?: string) => {
  const [searchQuery, setSearchQuery] = useState("");

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

  const { isRoomUnread, addManualUnread, removeManualUnread } =
    useReadStatus(currentUserId);

  const { pinChat, toggleMute, deleteChat } = useChatActions(token, setRooms);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms, roomsRef]);

  const fetchRoomsRef = useRef(fetchRooms);
  useEffect(() => {
    fetchRoomsRef.current = fetchRooms;
  }, [fetchRooms]);

  // Room subscription management
  useEffect(() => {
    if (socketService.getConnectionStatus() && rooms.length > 0) {
      joinAllRooms(rooms);
    }
  }, [rooms.length, joinAllRooms]);

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
  // Handle Real-time Unread Count Updates
  // ---------------------------------------------------------------------------

  // Handle individual message received - increment unread count for the specific room
  const handleNewMessage = useCallback(
    (data: any) => {
      if (!data?.roomId) return;

      const roomId = data.roomId;
      const senderId =
        typeof data.sender === "string" ? data.sender : data.sender?._id;

      // Don't increment count for messages sent by current user
      if (senderId === currentUserId) return;

      setRooms((prevRooms) =>
        prevRooms.map((room) => {
          if (room.roomId === roomId) {
            const currentUnread = room.unreadCount || 0;
            return {
              ...room,
              unreadCount: currentUnread + 1,
              lastMessage: {
                message: data.message,
                sentAt: data.createdAt || new Date().toISOString(),
                senderId: senderId,
                senderName: data.senderName,
                type: data.type || "text",
                readBy: [],
              },
              updatedAt: data.createdAt || new Date().toISOString(),
            };
          }
          return room;
        }),
      );
    },
    [currentUserId, setRooms],
  );

  // Handle messages read - reset unread count for the room
  const handleMessagesRead = useCallback(
    (data: { roomId: string; userId: string }) => {
      if (data.userId === currentUserId) {
        // Current user read messages in this room - reset unread count to 0
        setRooms((prevRooms) =>
          prevRooms.map((room) => {
            if (room.roomId === data.roomId) {
              return { ...room, unreadCount: 0 };
            }
            return room;
          }),
        );
      }
    },
    [currentUserId, setRooms],
  );

  // Handle message deleted - refresh the room
  const handleMessageDeleted = useCallback(
    (data: { roomId: string }) => {
      if (data.roomId) {
        refreshSingleRoom(data.roomId);
      }
    },
    [refreshSingleRoom],
  );

  // Handle chat cleared - reset unread count
  const handleChatCleared = useCallback(
    (data: { roomId: string }) => {
      setRooms((prevRooms) =>
        prevRooms.map((room) => {
          if (room.roomId === data.roomId) {
            return { ...room, unreadCount: 0 };
          }
          return room;
        }),
      );
    },
    [setRooms],
  );

  // Handle unread count update from server (total count)
  const handleUnreadCountUpdate = useCallback(() => {
    // Refresh all rooms to get accurate per-room unread counts
    if (roomsRef.current.length > 0) {
      fetchRoomsRef.current();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Socket Event Handlers (using refs for stability)
  // ---------------------------------------------------------------------------

  const handleNewMessageRef = useRef(handleNewMessage);
  const handleMessagesReadRef = useRef(handleMessagesRead);
  const handleMessageDeletedRef = useRef(handleMessageDeleted);
  const handleChatClearedRef = useRef(handleChatCleared);
  const handleUnreadCountUpdateRef = useRef(handleUnreadCountUpdate);

  useEffect(() => {
    handleNewMessageRef.current = handleNewMessage;
    handleMessagesReadRef.current = handleMessagesRead;
    handleMessageDeletedRef.current = handleMessageDeleted;
    handleChatClearedRef.current = handleChatCleared;
    handleUnreadCountUpdateRef.current = handleUnreadCountUpdate;
  }, [
    handleNewMessage,
    handleMessagesRead,
    handleMessageDeleted,
    handleChatCleared,
    handleUnreadCountUpdate,
  ]);

  const stableSocketHandlers = useMemo(
    () => ({
      onNewMessage: (data: any) => handleNewMessageRef.current(data),
      onMessagesRead: (data: any) => handleMessagesReadRef.current(data),
      onMessageDeleted: (data: any) => handleMessageDeletedRef.current(data),
      onReactionUpdated: () => {},
      onChatRestored: () => fetchRoomsRef.current(),
      onChatCleared: (data: any) => handleChatClearedRef.current(data),
      onUnreadCountUpdate: () => handleUnreadCountUpdateRef.current(),
    }),
    [],
  );

  useChatListSocket(stableSocketHandlers);

  // ---------------------------------------------------------------------------
  // Mark Room as Read
  // ---------------------------------------------------------------------------

  const markRoomAsRead = useCallback(
    async (roomId: string) => {
      if (!token) return;

      // Optimistically update UI - set unread count to 0
      setRooms((prev) =>
        prev.map((room) => {
          if (room.roomId === roomId) {
            return { ...room, unreadCount: 0 };
          }
          return room;
        }),
      );

      await removeManualUnread(roomId);

      try {
        const response = await chatApi.markRoomAsRead(roomId);
        if (response.success && socketService.getConnectionStatus()) {
          socketService.emit("mark_read", { roomId });
        }
      } catch (err: any) {
        const data = err?.response?.data;
        if (
          data?.code === "ACCOUNT_BANNED" ||
          data?.code === "ACCOUNT_SUSPENDED" ||
          data?.code === "TOKEN_VERSION_MISMATCH"
        ) {
          return;
        }
        // Revert optimistic update on error
        refreshSingleRoom(roomId);
      }
    },
    [token, setRooms, removeManualUnread, refreshSingleRoom],
  );

  // ---------------------------------------------------------------------------
  // Toggle Read / Unread
  // ---------------------------------------------------------------------------

  const toggleRead = useCallback(
    async (room: ChatRoom | null) => {
      if (!room || !token) return;

      const currentlyUnread = isRoomUnread(room);

      if (currentlyUnread) {
        await markRoomAsRead(room.roomId);
      } else {
        await addManualUnread(room.roomId);

        // Optimistically update UI - set unread count to 1
        setRooms((prev) =>
          prev.map((r) => {
            if (r.roomId === room.roomId) {
              return { ...r, unreadCount: 1 };
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
      setRooms,
      refreshSingleRoom,
    ],
  );

  // ---------------------------------------------------------------------------
  // Delete Chat wrapper
  // ---------------------------------------------------------------------------

  const handleDeleteChat = useCallback(
    async (room: ChatRoom | null, onClose?: () => void) => {
      if (!room) return;
      await deleteChat(room, onClose);
    },
    [deleteChat],
  );

  // ---------------------------------------------------------------------------
  // Search Filtering
  // ---------------------------------------------------------------------------

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
    markRoomAsRead,
    isRoomUnread,
    pinChat,
    toggleRead,
    toggleMute,
    deleteChat: handleDeleteChat, //
  };
};
