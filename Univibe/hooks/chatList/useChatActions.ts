import { useCallback } from 'react';
import { Alert } from 'react-native';
import type { ChatRoom } from '../../lib/types/chat.types';
import { chatApi } from '../../lib/services/chatApi';

export const useChatActions = (
  token: string | null,
  setRooms: React.Dispatch<React.SetStateAction<ChatRoom[]>>
) => {
  const updateRoom = useCallback((roomId: string, updates: Partial<ChatRoom>) => {
    setRooms(prev => 
      prev.map(room => room.roomId === roomId ? { ...room, ...updates } : room)
    );
  }, [setRooms]);

  const pinChat = useCallback(async (room: ChatRoom | null) => {
    if (!room || !token) return;
    
    // Optimistic update
    updateRoom(room.roomId, { isPinned: !room.isPinned });
    
    // Server sync
    try {
      await chatApi.togglePin(token, room.roomId);
    } catch {
      // Revert on failure
      updateRoom(room.roomId, { isPinned: room.isPinned });
    }
  }, [token, updateRoom]);

  const toggleMute = useCallback(async (room: ChatRoom | null) => {
    if (!room || !token) return;
    
    // Optimistic update
    updateRoom(room.roomId, { isMuted: !room.isMuted });
    
    // Server sync
    try {
      await chatApi.toggleMute(token, room.roomId);
    } catch {
      // Revert on failure
      updateRoom(room.roomId, { isMuted: room.isMuted });
    }
  }, [token, updateRoom]);

  const deleteChat = useCallback(async (room: ChatRoom | null, onSuccess?: () => void) => {
    if (!room || !token) return;
    
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete the conversation with ${room.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await chatApi.deleteRoom(token, room.roomId);
              if (response.success) {
                setRooms(prev => prev.filter(r => r.roomId !== room.roomId));
                onSuccess?.();
              } else {
                Alert.alert('Error', response.message || 'Failed to delete conversation');
              }
            } catch {
              Alert.alert('Error', 'Failed to delete conversation');
            }
          },
        },
      ]
    );
  }, [token, setRooms]);

  return { pinChat, toggleMute, deleteChat };
};