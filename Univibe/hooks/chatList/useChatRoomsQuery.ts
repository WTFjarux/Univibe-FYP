import { useState, useCallback, useMemo } from 'react';
import type { ChatRoom } from '../../lib/types/chat.types';
import { chatApi } from '../../lib/services/chatApi';

interface UseChatRoomsQueryProps {
  token: string | null;
}

export const useChatRoomsQuery = ({ token }: UseChatRoomsQueryProps) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Transform API response to consistent ChatRoom shape
  const normalizeRoom = useCallback((room: any): ChatRoom => ({
    roomId: room.roomId,
    type: room.type || 'direct',
    name: room.name,
    avatar: room.avatar || null,
    otherUserId: room.otherUserId || null,
    otherUserAvatar: room.otherUserAvatar || null,
    participants: room.participants || [],
    lastMessage: room.lastMessage ? {
      message: room.lastMessage.message,
      sentAt: room.lastMessage.sentAt,
      senderId: room.lastMessage.senderId || '',
      senderName: room.lastMessage.senderName || '',
      type: room.lastMessage.type || 'text',
      readBy: room.lastMessage.readBy || [],
    } : null,
    updatedAt: room.updatedAt,
    createdAt: room.createdAt,
    isPinned: room.isPinned || false,
    isMuted: room.isMuted || false,
    muteUntil: room.muteUntil || null,
  }), []);

  // Sort rooms: pinned first, then by most recent
  const sortRooms = useCallback((roomsList: ChatRoom[]): ChatRoom[] => {
    return [...roomsList].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, []);

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    
    try {
      setError(null);
      const response = await chatApi.getChatRooms(token);
      
      if (response.success) {
        const normalized = response.data.map(normalizeRoom);
        setRooms(sortRooms(normalized));
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, normalizeRoom, sortRooms]);

  const refreshSingleRoom = useCallback(async (roomId: string) => {
    if (!token) return;
    
    try {
      const response = await chatApi.getSingleRoom(token, roomId);
      
      if (response.success) {
        setRooms(prev => {
          const normalized = normalizeRoom(response.data);
          const updated = prev.map(room => 
            room.roomId === roomId 
              ? { ...normalized, isPinned: room.isPinned, isMuted: room.isMuted }
              : room
          );
          return sortRooms(updated);
        });
      }
    } catch {
      // Silent fail - will be refreshed later
    }
  }, [token, normalizeRoom, sortRooms]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRooms();
  }, [fetchRooms]);

  return {
    rooms,
    loading,
    refreshing,
    error,
    fetchRooms,
    onRefresh,
    refreshSingleRoom,
    setRooms,
  };
};