import { useState, useEffect, useCallback } from 'react';
import type { ChatRoom } from '../../lib/types/chat.types';
import { useActiveRoom } from '../../lib/contexts/ActiveRoomContext';
import { chatPersistence } from '../../lib/services/chatPersistence';

export const useReadStatus = (currentUserId?: string) => {
  const [manualUnreadRooms, setManualUnreadRooms] = useState<Set<string>>(new Set());
  const { activeRoomId } = useActiveRoom();

  // Load persisted manual unread rooms
  useEffect(() => {
    chatPersistence.getManualUnreadRoomIds().then(setManualUnreadRooms);
  }, []);

  // Core logic: determine if room is unread
  const isRoomUnread = useCallback((room: ChatRoom): boolean => {
    // 1. Manual unread overrides everything
    if (manualUnreadRooms.has(room.roomId)) return true;
    
    // 2. No last message = not unread
    if (!room.lastMessage) return false;
    
    // 3. If I sent the last message, it's always read
    if (room.lastMessage.senderId === currentUserId) return false;
    
    // 4. If room is currently active, consider it read
    if (room.roomId === activeRoomId) return false;
    
    // 5. Check read receipt
    return !room.lastMessage.readBy.includes(currentUserId || '');
  }, [currentUserId, activeRoomId, manualUnreadRooms]);

  const addManualUnread = useCallback(async (roomId: string) => {
    const newSet = new Set(manualUnreadRooms);
    newSet.add(roomId);
    setManualUnreadRooms(newSet);
    await chatPersistence.addManualUnreadRoom(roomId);
  }, [manualUnreadRooms]);

  const removeManualUnread = useCallback(async (roomId: string) => {
    const newSet = new Set(manualUnreadRooms);
    newSet.delete(roomId);
    setManualUnreadRooms(newSet);
    await chatPersistence.removeManualUnreadRoom(roomId);
  }, [manualUnreadRooms]);

  return {
    isRoomUnread,
    manualUnreadRooms,
    addManualUnread,
    removeManualUnread,
  };
};