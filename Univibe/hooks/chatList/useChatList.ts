import { useState, useCallback, useMemo } from 'react';
import type { ChatRoom } from '../../lib/types/chat.types';
import { useChatRoomsQuery } from './useChatRoomsQuery';
import { useChatActions } from './useChatActions';
import { useReadStatus } from './useReadStatus';
import { useChatListSocket } from './useChatListSocket';
import { chatApi } from '../../lib/services/chatApi';
import  socketService  from '../../lib/services/socketService';

export const useChatList = (token: string | null, currentUserId?: string) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const { rooms, loading, refreshing, error, fetchRooms, onRefresh, refreshSingleRoom, setRooms } = 
    useChatRoomsQuery({ token });

  // Read/unread status
  const { isRoomUnread, addManualUnread, removeManualUnread } = useReadStatus(currentUserId);

  // Chat actions (pin/mute/delete)
  const { pinChat, toggleMute, deleteChat } = useChatActions(token, setRooms);

  // Update last message in room list
  const updateRoomLastMessage = useCallback((
    roomId: string,
    message: string,
    sentAt: string,
    senderId?: string,
    senderName?: string,
    type: string = 'text'
  ) => {
    setRooms(prev => {
      const updated = prev.map(room => {
        if (room.roomId !== roomId) return room;
        
        const isFromCurrentUser = senderId === currentUserId;
        
        return {
          ...room,
          lastMessage: {
            message,
            sentAt,
            senderId: senderId || '',
            senderName: senderName || '',
            type: type as any,
            readBy: isFromCurrentUser ? [currentUserId || ''] : [],
          },
          updatedAt: sentAt,
        };
      });
      
      // Re-sort
      return [...updated].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    });
  }, [currentUserId, setRooms]);

  // Handle messages_read from other users
  const handleMessagesRead = useCallback((roomId: string, userId: string) => {
    if (userId === currentUserId) return;
    
    setRooms(prev =>
      prev.map(room => {
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
      })
    );
  }, [currentUserId, setRooms]);

  // Socket event handlers
  const socketHandlers = useMemo(() => ({
    onNewMessage: (data: any) => {
      if (!data.roomId) return;
      
      const senderId = typeof data.sender === 'string' ? data.sender : data.sender?._id;
      const senderName = typeof data.sender === 'string' ? data.senderName : data.sender?.name;
      
      updateRoomLastMessage(
        data.roomId,
        data.message,
        data.createdAt || new Date().toISOString(),
        senderId,
        senderName,
        data.type
      );
    },
    onMessagesRead: (data: any) => {
      if (data.roomId && data.userId) {
        handleMessagesRead(data.roomId, data.userId);
      }
    },
    onMessageDeleted: (data: any) => {
      if (data.roomId) refreshSingleRoom(data.roomId);
    },
    onReactionUpdated: () => {
      // Could refresh specific room if needed
    },
  }), [updateRoomLastMessage, handleMessagesRead, refreshSingleRoom]);

  useChatListSocket(socketHandlers);

  // Mark room as read
  const markRoomAsRead = useCallback(async (roomId: string) => {
    if (!token) return;
    
    // Optimistic local update
    setRooms(prev =>
      prev.map(room => {
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
      })
    );
    
    // Remove manual unread if exists
    await removeManualUnread(roomId);
    
    // Server sync
    try {
      const response = await chatApi.markRoomAsRead(token, roomId);
      if (response.success && socketService.getConnectionStatus()) {
        socketService.emit('mark_read', { roomId });
      }
    } catch {
      refreshSingleRoom(roomId);
    }
  }, [token, currentUserId, setRooms, removeManualUnread, refreshSingleRoom]);

  // Toggle read/unread manually
  const toggleRead = useCallback(async (room: ChatRoom | null) => {
    if (!room || !token) return;
    
    const currentlyUnread = isRoomUnread(room);
    
    if (currentlyUnread) {
      // Mark as read
      await markRoomAsRead(room.roomId);
    } else {
      // Mark as unread
      await addManualUnread(room.roomId);
      
      // Optimistic UI update
      setRooms(prev =>
        prev.map(r => {
          if (r.roomId === room.roomId && r.lastMessage && currentUserId) {
            const readBy = r.lastMessage.readBy || [];
            return {
              ...r,
              lastMessage: {
                ...r.lastMessage,
                readBy: readBy.filter(id => id !== currentUserId),
              },
            };
          }
          return r;
        })
      );
      
      // Server sync
      try {
        await chatApi.markRoomAsUnread(token, room.roomId);
      } catch {
        // Revert
        await removeManualUnread(room.roomId);
        refreshSingleRoom(room.roomId);
      }
    }
  }, [token, isRoomUnread, markRoomAsRead, addManualUnread, removeManualUnread, currentUserId, setRooms, refreshSingleRoom]);

  // Filter rooms by search query
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const query = searchQuery.toLowerCase();
    return rooms.filter(room => room.name.toLowerCase().includes(query));
  }, [rooms, searchQuery]);

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