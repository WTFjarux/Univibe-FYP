// hooks/chatList/useChatActions.ts

import { useCallback } from "react";
import { Alert } from "react-native";
import type { ChatRoom } from "../../lib/types/chat.types";
import { chatApi } from "../../lib/services/chatApi";
import socketService from "../../lib/services/socketService";

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Provides chat room actions: pin, mute/unmute, and delete.
 *
 * Each action follows an optimistic update pattern:
 * 1. Apply the change immediately to the UI
 * 2. Sync with the server in the background
 * 3. Revert on failure
 */
export const useChatActions = (
  token: string | null,
  setRooms: React.Dispatch<React.SetStateAction<ChatRoom[]>>,
) => {
  /** Merges partial updates into a specific room in state */
  const updateRoom = useCallback(
    (roomId: string, updates: Partial<ChatRoom>) => {
      setRooms((prev) =>
        prev.map((room) =>
          room.roomId === roomId ? { ...room, ...updates } : room,
        ),
      );
    },
    [setRooms],
  );

  // ---------------------------------------------------------------------------
  // Pin / Unpin
  // ---------------------------------------------------------------------------

  /**
   * Toggles the pinned status of a chat room.
   * Pinned rooms appear at the top of the chat list.
   */
  const pinChat = useCallback(
    async (room: ChatRoom | null) => {
      if (!room || !token) return;

      updateRoom(room.roomId, { isPinned: !room.isPinned });

      try {
        await chatApi.togglePin(token);
      } catch {
        updateRoom(room.roomId, { isPinned: room.isPinned });
      }
    },
    [token, updateRoom],
  );

  // ---------------------------------------------------------------------------
  // Mute / Unmute
  // ---------------------------------------------------------------------------

  /**
   * Toggles the muted status of a chat room.
   * Muted rooms suppress notification sounds/banners.
   */
  const toggleMute = useCallback(
    async (room: ChatRoom | null) => {
      if (!room || !token) return;

      updateRoom(room.roomId, { isMuted: !room.isMuted });

      try {
        await chatApi.toggleMute(token);
      } catch {
        updateRoom(room.roomId, { isMuted: room.isMuted });
      }
    },
    [token, updateRoom],
  );

  // ---------------------------------------------------------------------------
  // Delete Chat
  // ---------------------------------------------------------------------------

  /**
   * Deletes chat history for current user after confirmation.
   * The chat disappears from the list.
   * It will reappear if a new message arrives from the other participant.
   */
  const deleteChat = useCallback(
    async (room: ChatRoom | null, onSuccess?: () => void) => {
      if (!room || !token) return;

      Alert.alert(
        "Delete Chat",
        `Chat history with ${room.name} will be cleared. New messages will restore this chat.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const response = await chatApi.deleteChatHistory(room.roomId);
                if (response.success) {
                  // Remove from list immediately
                  setRooms((prev) =>
                    prev.filter((r) => r.roomId !== room.roomId),
                  );

                  // Also emit via socket for real-time
                  if (socketService.getConnectionStatus()) {
                    socketService.clearChat(room.roomId);
                  }

                  onSuccess?.();
                } else {
                  Alert.alert(
                    "Error",
                    response.message || "Failed to delete chat history",
                  );
                }
              } catch {
                Alert.alert("Error", "Failed to delete chat history");
              }
            },
          },
        ],
      );
    },
    [token, setRooms],
  );

  return { pinChat, toggleMute, deleteChat };
};
