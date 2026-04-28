import { useState, useCallback, useRef } from "react";
import type { ChatRoom } from "../../lib/types/chat.types";
import { chatApi } from "../../lib/services/chatApi";
import socketService from "../../lib/services/socketService";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseChatRoomsQueryProps {
  token: string | null;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Manages fetching, caching, and sorting of chat rooms for the ChatList.
 *
 * Responsibilities:
 * - Fetches all chat rooms from the API
 * - Normalizes API responses into a consistent ChatRoom shape
 * - Sorts rooms (pinned first, then by most recent)
 * - Joins each room on the socket for real-time updates
 * - Provides a non-reactive ref for socket handlers to access latest rooms
 */
export const useChatRoomsQuery = ({ token }: UseChatRoomsQueryProps) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /** Non-reactive ref for socket handlers to access latest rooms */
  const roomsRef = useRef<ChatRoom[]>([]);

  // ---------------------------------------------------------------------------
  // Normalization & Sorting
  // ---------------------------------------------------------------------------

  /** Transforms an API response object into a consistent ChatRoom shape */
  const normalizeRoom = useCallback(
    (room: any): ChatRoom => ({
      roomId: room.roomId,
      type: room.type || "direct",
      name: room.name,
      avatar: room.avatar || null,
      otherUserId: room.otherUserId || null,
      otherUserAvatar: room.otherUserAvatar || null,
      participants: room.participants || [],
      lastMessage: room.lastMessage
        ? {
            message: room.lastMessage.message,
            sentAt: room.lastMessage.sentAt,
            senderId: room.lastMessage.senderId || "",
            senderName: room.lastMessage.senderName || "",
            type: room.lastMessage.type || "text",
            readBy: room.lastMessage.readBy || [],
          }
        : null,
      updatedAt: room.updatedAt,
      createdAt: room.createdAt,
      isPinned: room.isPinned || false,
      isMuted: room.isMuted || false,
      muteUntil: room.muteUntil || null,
    }),
    [],
  );

  /** Sorts rooms: pinned first, then by most recently updated */
  const sortRooms = useCallback((roomsList: ChatRoom[]): ChatRoom[] => {
    return [...roomsList].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Socket Room Subscription
  // ---------------------------------------------------------------------------

  /**
   * Joins all provided rooms on the socket for real-time updates.
   * Rooms that are already joined are safely ignored by the socket service.
   */
  const joinAllRooms = useCallback((roomList: ChatRoom[]) => {
    if (!socketService.getConnectionStatus()) return;

    roomList.forEach((room) => {
      socketService.joinRoom(
        room.roomId,
        room.otherUserId,
        room.type || "direct",
      );
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch Rooms
  // ---------------------------------------------------------------------------

  /** Fetches all chat rooms from the server and joins them for real-time updates */
  const fetchRooms = useCallback(async () => {
    if (!token) return;

    try {
      setError(null);
      const response = await chatApi.getChatRooms();

      if (response.success) {
        const normalized = response.data.map(normalizeRoom);
        const sorted = sortRooms(normalized);

        setRooms(sorted);
        roomsRef.current = sorted;
        joinAllRooms(sorted);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, normalizeRoom, sortRooms, joinAllRooms]);

  // ---------------------------------------------------------------------------
  // Refresh Single Room
  // ---------------------------------------------------------------------------

  /**
   * Fetches updated data for a single room and merges it into state.
   * Preserves local-only flags like isPinned and isMuted.
   */
  const refreshSingleRoom = useCallback(
    async (roomId: string) => {
      if (!token) return;

      try {
        const response = await chatApi.getSingleRoom(token);

        if (response.success) {
          setRooms((prev) => {
            const normalized = normalizeRoom(response.data);
            const updated = prev.map((room) =>
              room.roomId === roomId
                ? {
                    ...normalized,
                    isPinned: room.isPinned,
                    isMuted: room.isMuted,
                  }
                : room,
            );
            const sorted = sortRooms(updated);
            roomsRef.current = sorted;
            return sorted;
          });
        }
      } catch {
        // Silently fail — will be refreshed on next focus or socket event
      }
    },
    [token, normalizeRoom, sortRooms],
  );

  // ---------------------------------------------------------------------------
  // Pull-to-Refresh
  // ---------------------------------------------------------------------------

  /** Handler for pull-to-refresh gesture */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRooms();
  }, [fetchRooms]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
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
  };
};
