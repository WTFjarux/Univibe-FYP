import { useState, useCallback } from "react";
import { API_BASE_URL } from "../constants/ipConstants";
import { Alert } from "react-native";

export const useChatRooms = (token: string | null) => {
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchChatRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const roomsWithState = data.data.map((room: any) => ({
          ...room,
          isPinned: false,
          isMuted: false,
          isRead: true,
        }));
        const sorted = roomsWithState.sort((a: any, b: any) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        setChatRooms(sorted);
        filterRooms(sorted, searchQuery);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, searchQuery]);

  const filterRooms = (rooms: any[], query: string) => {
    if (!query.trim()) {
      setFilteredRooms(rooms);
    } else {
      const filtered = rooms.filter((room) =>
        room.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredRooms(filtered);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchChatRooms();
  };

  const updateChatRoomLastMessage = (roomId: string, message: string, sentAt: string) => {
    const updateFn = (prev: any[]) => {
      const updated = prev.map((room) =>
        room.roomId === roomId ? { ...room, lastMessage: { message, sentAt }, updatedAt: sentAt } : room
      );
      updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      return updated;
    };
    setChatRooms(updateFn);
    setFilteredRooms(updateFn);
  };

  const pinChat = (room: any) => {
    setChatRooms((prev) => {
      const updated = prev.map((r) =>
        r.roomId === room.roomId ? { ...r, isPinned: !r.isPinned } : r
      );
      updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      return updated;
    });
    setFilteredRooms((prev) => {
      const updated = prev.map((r) =>
        r.roomId === room.roomId ? { ...r, isPinned: !r.isPinned } : r
      );
      updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      return updated;
    });
  };

  const toggleRead = (room: any) => {
    setChatRooms((prev) =>
      prev.map((r) => (r.roomId === room.roomId ? { ...r, isRead: !r.isRead } : r))
    );
    setFilteredRooms((prev) =>
      prev.map((r) => (r.roomId === room.roomId ? { ...r, isRead: !r.isRead } : r))
    );
  };

  const toggleMute = (room: any) => {
    setChatRooms((prev) =>
      prev.map((r) => (r.roomId === room.roomId ? { ...r, isMuted: !r.isMuted } : r))
    );
    setFilteredRooms((prev) =>
      prev.map((r) => (r.roomId === room.roomId ? { ...r, isMuted: !r.isMuted } : r))
    );
  };

  const deleteChat = async (room: any, onSuccess?: () => void) => {
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete the conversation with ${room.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/chat/room/${room.roomId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (data.success) {
                setChatRooms((prev) => prev.filter((r) => r.roomId !== room.roomId));
                setFilteredRooms((prev) => prev.filter((r) => r.roomId !== room.roomId));
                onSuccess?.();
              } else {
                Alert.alert("Error", data.message || "Failed to delete conversation");
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete conversation");
            }
          },
        },
      ]
    );
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterRooms(chatRooms, text);
  };

  return {
    chatRooms,
    filteredRooms,
    loading,
    refreshing,
    searchQuery,
    setSearchQuery: handleSearch,
    fetchChatRooms,
    onRefresh,
    updateChatRoomLastMessage,
    pinChat,
    toggleRead,
    toggleMute,
    deleteChat,
  };
};