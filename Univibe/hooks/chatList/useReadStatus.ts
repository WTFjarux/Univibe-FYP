import { useState, useCallback, useRef } from "react";
import type { ChatRoom } from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Manages read/unread status for chat rooms.
 *
 * Supports two types of unread status:
 * 1. **Automatic**: A room is unread if the last message was sent by
 *    another user and the current user hasn't read it yet.
 * 2. **Manual**: The user explicitly marks a read room as unread.
 *    Manual unread status overrides automatic detection.
 *
 * Uses a ref alongside state to prevent stale closure issues when
 * the unread set is accessed inside socket event handlers.
 */

export const useReadStatus = (currentUserId?: string) => {
  const [manualUnreadRooms, setManualUnreadRooms] = useState<Set<string>>(
    new Set(),
  );

  /** Ref kept in sync with state for non-reactive access */
  const manualUnreadRef = useRef(manualUnreadRooms);
  manualUnreadRef.current = manualUnreadRooms;

  // ---------------------------------------------------------------------------
  // Read Status Check
  // ---------------------------------------------------------------------------

  /**
   * Determines whether a room has unread messages.
   * Manual unread takes priority, then falls back to automatic detection.
   */
  const isRoomUnread = useCallback(
    (room: ChatRoom): boolean => {
      if (manualUnreadRef.current.has(room.roomId)) {
        return true;
      }

      if (!room.lastMessage || !currentUserId) return false;

      const { senderId, readBy } = room.lastMessage;

      // Own messages are always considered read
      if (senderId === currentUserId) return false;

      // Unread if current user is not in the readBy list
      return !readBy?.includes(currentUserId);
    },
    [currentUserId],
  );

  // ---------------------------------------------------------------------------
  // Manual Unread Management
  // ---------------------------------------------------------------------------

  /** Marks a room as manually unread */
  const addManualUnread = useCallback(async (roomId: string) => {
    setManualUnreadRooms((prev) => new Set(prev).add(roomId));
  }, []);

  /** Removes the manual unread mark from a room */
  const removeManualUnread = useCallback(async (roomId: string) => {
    setManualUnreadRooms((prev) => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  }, []);

  return {
    isRoomUnread,
    addManualUnread,
    removeManualUnread,
    manualUnreadRooms,
  };
};
