// hooks/useChatRooms.ts

import { useState, useCallback, useEffect } from "react";
import { API_BASE_URL } from "../constants/ipConstants";
import { Alert } from "react-native";
import { socketService } from "../lib/services";
import { useActiveRoom } from "../lib/contexts/ActiveRoomContext";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for manual unread rooms
const MANUAL_UNREAD_KEY = 'manual_unread_rooms';

interface ChatRoom {
  roomId: string;
  type: string;
  name: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  lastMessage?: {
    message: string;
    sentAt: string;
    senderId: string;
    senderName: string;
    type: string;
    readBy: string[];
  };
  updatedAt: string;
  isPinned?: boolean;
  isMuted?: boolean;
  participants?: string[];
}

export const useChatRooms = (token: string | null, currentUserId?: string) => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Track manually marked unread rooms
  const [manualUnreadRooms, setManualUnreadRooms] = useState<Set<string>>(new Set());

  // Get active room from context
  const { activeRoomId } = useActiveRoom();

  // Load manually unread rooms on mount
  useEffect(() => {
    const loadManualUnread = async () => {
      try {
        const stored = await AsyncStorage.getItem(MANUAL_UNREAD_KEY);
        if (stored) {
          setManualUnreadRooms(new Set(JSON.parse(stored)));
        }
      } catch (error) {
        // Silent fail
      }
    };
    loadManualUnread();
  }, []);

  // Save manual unread rooms when changed
  const saveManualUnread = async (rooms: Set<string>) => {
    try {
      await AsyncStorage.setItem(MANUAL_UNREAD_KEY, JSON.stringify([...rooms]));
    } catch (error) {
      // Silent fail
    }
  };

  // Helper: Calculate if a room is unread (considers active room AND manual unread)
  const isRoomUnread = useCallback((room: ChatRoom): boolean => {
    // Check manual unread first - this overrides everything
    if (manualUnreadRooms.has(room.roomId)) {
      return true;
    }
    
    if (!room.lastMessage) return false;
    
    const { senderId, readBy } = room.lastMessage;
    
    // If I sent the message, it's always read
    if (senderId === currentUserId) return false;
    
    // If this room is currently active, consider it read
    if (room.roomId === activeRoomId) return false;
    
    // If I'm in readBy array, it's read
    return !readBy?.includes(currentUserId || "");
  }, [currentUserId, activeRoomId, manualUnreadRooms]);

  const fetchChatRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (data.success) {
        const roomsWithState = data.data.map((room: ChatRoom) => ({
          ...room,
          isPinned: room.isPinned || false,
          isMuted: room.isMuted || false,
          lastMessage: room.lastMessage ? {
            ...room.lastMessage,
            readBy: room.lastMessage.readBy || [],
          } : undefined,
        }));
        
        const sorted = roomsWithState.sort((a: ChatRoom, b: ChatRoom) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        
        setChatRooms(sorted);
        filterRooms(sorted, searchQuery);
      }
    } catch (error) {
      // Silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, searchQuery]);

  const filterRooms = (rooms: ChatRoom[], query: string) => {
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

  const refreshSingleRoom = useCallback(async (roomId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/room/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (data.success) {
        setChatRooms((prev) => {
          const updated = prev.map((room) =>
            room.roomId === roomId
              ? { 
                  ...room, 
                  ...data.data, 
                  isPinned: room.isPinned, 
                  isMuted: room.isMuted,
                  lastMessage: data.data.lastMessage ? {
                    ...data.data.lastMessage,
                    readBy: data.data.lastMessage.readBy || [],
                  } : undefined,
                }
              : room
          );
          return updated.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
        });
        
        setFilteredRooms((prev) => {
          const updated = prev.map((room) =>
            room.roomId === roomId
              ? { 
                  ...room, 
                  ...data.data, 
                  isPinned: room.isPinned, 
                  isMuted: room.isMuted,
                  lastMessage: data.data.lastMessage ? {
                    ...data.data.lastMessage,
                    readBy: data.data.lastMessage.readBy || [],
                  } : undefined,
                }
              : room
          );
          return updated.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });
        });
      }
    } catch (error) {
      // Silent fail
    }
  }, [token]);

  // Update last message preview
  const updateChatRoomLastMessage = useCallback((
    roomId: string,
    message: string,
    sentAt: string,
    senderId?: string,
    senderName?: string,
    type: string = "text"
  ) => {
    const updateFn = (prev: ChatRoom[]) => {
      const updated = prev.map((room) => {
        if (room.roomId === roomId) {
          const isFromCurrentUser = senderId === currentUserId;
          
          return {
            ...room,
            lastMessage: {
              message,
              sentAt,
              senderId: senderId || "",
              senderName: senderName || "",
              type,
              readBy: isFromCurrentUser ? [currentUserId || ""] : [],
            },
            updatedAt: sentAt,
          };
        }
        return room;
      });
      
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    };
    
    setChatRooms(updateFn);
    setFilteredRooms(updateFn);
  }, [currentUserId]);

  // Handle messages_read from other user
  const handleMessagesRead = useCallback((roomId: string, userId: string) => {
    if (userId === currentUserId) return;
    
    const updateFn = (prev: ChatRoom[]) =>
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
      });
    
    setChatRooms(updateFn);
    setFilteredRooms(updateFn);
  }, [currentUserId]);

  // Mark room as read locally (optimistic)
  const markRoomAsReadLocally = useCallback((roomId: string) => {
    if (!currentUserId) return;
    
    const updateFn = (prev: ChatRoom[]) =>
      prev.map((room) => {
        if (room.roomId === roomId && room.lastMessage) {
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
      });
    
    setChatRooms(updateFn);
    setFilteredRooms(updateFn);
  }, [currentUserId]);

  // API call to mark room as read on server
  const markRoomAsReadOnServer = useCallback(async (roomId: string) => {
    // Optimistic update first
    markRoomAsReadLocally(roomId);
    
    // Remove from manual unread if present
    if (manualUnreadRooms.has(roomId)) {
      const newSet = new Set(manualUnreadRooms);
      newSet.delete(roomId);
      setManualUnreadRooms(newSet);
      await saveManualUnread(newSet);
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/room/${roomId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Emit socket event if connected
        if (socketService.getConnectionStatus()) {
          socketService.emit("mark_read", { roomId });
        }
      } else {
        refreshSingleRoom(roomId);
      }
    } catch (error) {
      refreshSingleRoom(roomId);
    }
  }, [token, markRoomAsReadLocally, refreshSingleRoom, manualUnreadRooms]);

  // Toggle read status manually
  const toggleRead = useCallback(async (room: ChatRoom | null) => {
    if (!room) return;
    
    const currentlyUnread = isRoomUnread(room);
    
    if (currentlyUnread) {
      // Mark as read
      await markRoomAsReadOnServer(room.roomId);
    } else {
      // Mark as unread - add to manual set
      const newSet = new Set(manualUnreadRooms);
      newSet.add(room.roomId);
      setManualUnreadRooms(newSet);
      await saveManualUnread(newSet);
      
      // Optimistic UI update
      const updateFn = (prev: ChatRoom[]) =>
        prev.map((r) => {
          if (r.roomId === room.roomId && r.lastMessage) {
            const readBy = r.lastMessage.readBy || [];
            return {
              ...r,
              lastMessage: {
                ...r.lastMessage,
                readBy: readBy.filter((id: string) => id !== currentUserId),
              },
            };
          }
          return r;
        });
      
      setChatRooms(updateFn);
      setFilteredRooms(updateFn);
      
      // Call server to persist
      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/room/${room.roomId}/unread`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const data = await response.json();
        
        if (!data.success) {
          // Revert on failure
          const revertSet = new Set(manualUnreadRooms);
          revertSet.delete(room.roomId);
          setManualUnreadRooms(revertSet);
          await saveManualUnread(revertSet);
          refreshSingleRoom(room.roomId);
        }
      } catch (error) {
        // Revert on failure
        const revertSet = new Set(manualUnreadRooms);
        revertSet.delete(room.roomId);
        setManualUnreadRooms(revertSet);
        await saveManualUnread(revertSet);
        refreshSingleRoom(room.roomId);
      }
    }
  }, [isRoomUnread, markRoomAsReadOnServer, manualUnreadRooms, currentUserId, token, refreshSingleRoom]);

  const pinChat = (room: ChatRoom | null) => {
    if (!room) return;
    
    const updateFn = (prev: ChatRoom[]) => {
      const updated = prev.map((r) =>
        r.roomId === room.roomId ? { ...r, isPinned: !r.isPinned } : r
      );
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    };
    
    setChatRooms(updateFn);
    setFilteredRooms(updateFn);
  };

  const toggleMute = (room: ChatRoom | null) => {
    if (!room) return;
    
    const updateFn = (prev: ChatRoom[]) =>
      prev.map((r) => (r.roomId === room.roomId ? { ...r, isMuted: !r.isMuted } : r));
    
    setChatRooms(updateFn);
    setFilteredRooms(updateFn);
  };

  const deleteChat = async (room: ChatRoom | null, onSuccess?: () => void) => {
    if (!room) return;
    
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
                const filterFn = (prev: ChatRoom[]) => prev.filter((r) => r.roomId !== room.roomId);
                setChatRooms(filterFn);
                setFilteredRooms(filterFn);
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
    refreshSingleRoom,
    updateChatRoomLastMessage,
    handleMessagesRead,
    markRoomAsReadLocally,
    markRoomAsReadOnServer,
    isRoomUnread,
    pinChat,
    toggleRead,
    toggleMute,
    deleteChat,
  };
};