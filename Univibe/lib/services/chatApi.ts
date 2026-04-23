/**
 * lib/api/chatApi.ts
 * 
 * Centralized API service for all chat-related endpoints
 */

import { API_BASE_URL } from '../../constants/ipConstants';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface GetChatRoomsResponse {
  success: boolean;
  data: ChatRoom[];
  count?: number;
}

export interface ChatRoom {
  roomId: string;
  type: 'direct' | 'group';
  name: string;
  avatar?: string | null;
  otherUserId?: string | null;
  otherUserAvatar?: string | null;
  lastMessage: {
    message: string;
    sentAt: string;
    senderId?: string;
    type?: string;
  } | null;
  updatedAt: string;
  createdAt: string;
  isPinned: boolean;
  isMuted: boolean;
  muteUntil?: string | null;
  isRead: boolean;
  unreadCount: number;
}

export interface GetMessagesResponse {
  success: boolean;
  data: {
    roomId: string;
    messages: Message[];
    hasMore: boolean;
  };
}

export interface Message {
  _id: string;
  sender: string | { _id: string; name: string; avatar?: string };
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  message: string;
  type: 'text' | 'image' | 'audio' | 'file';
  createdAt: string;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  duration?: number;
  replyTo?: {
    messageId: string;
    message: string;
    senderName: string;
    senderId?: string;
    type?: string;
    mediaUrl?: string;
  };
  reactions?: Reaction[];
}

export interface Reaction {
  userId: string;
  reaction: string;
  createdAt: string;
  user?: {
    name: string;
    username?: string;
  };
}

export interface UserProfileResponse {
  success: boolean;
  data: {
    userId: string;
    name: string;
    username: string;
    profilePicture: string | null;
    bio?: string;
    hasExistingChat?: boolean;
    roomId?: string | null;
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export const chatApi = {
  /**
   * Get all chat rooms for the current user
   */
  getChatRooms: async (token: string): Promise<GetChatRoomsResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/rooms`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  },

  /**
   * Get or create a direct message room with another user
   */
  getOrCreateRoom: async (token: string, otherUserId: string): Promise<{
    success: boolean;
    data: { roomId: string; type: string };
  }> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/room/${otherUserId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  },

  /**
   * Get message history for a room
   */
  getMessages: async (
    token: string,
    roomId: string,
    limit: number = 50,
    before?: string
  ): Promise<GetMessagesResponse> => {
    let url = `${API_BASE_URL}/api/chat/messages/${roomId}?limit=${limit}`;
    if (before) {
      url += `&before=${before}`;
    }
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  },

  /**
   * Send a message (text or media)
   */
  sendMessage: async (
    token: string,
    data: {
      roomId: string;
      message: string;
      type?: string;
      replyTo?: any;
      tempId?: string;
    }
  ): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  /**
   * Delete a message
   */
  deleteMessage: async (token: string, messageId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/message/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },

  /**
   * Toggle pin status for a chat room
   */
  togglePin: async (token: string, roomId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/room/${roomId}/pin`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },

  /**
   * Toggle mute status for a chat room
   */
  toggleMute: async (token: string, roomId: string, duration?: number): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/room/${roomId}/mute`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ duration }),
    });
    return response.json();
  },

  /**
   * Toggle read/unread status
   */
  toggleRead: async (token: string, roomId: string, isRead: boolean): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/room/${roomId}/read`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isRead }),
    });
    return response.json();
  },

  /**
   * Delete or hide a chat room
   */
  deleteChat: async (token: string, roomId: string, permanent: boolean = false): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/room/${roomId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ permanent }),
    });
    return response.json();
  },

  /**
   * Get user profile for chat
   */
  getUserProfile: async (token: string, userId: string): Promise<UserProfileResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/user-profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },

  /**
   * Add reaction to a message
   */
  addReaction: async (token: string, messageId: string, reaction: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/message/${messageId}/react`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reaction }),
    });
    return response.json();
  },

  /**
   * Remove reaction from a message
   */
  removeReaction: async (token: string, messageId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/message/${messageId}/react`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },

  /**
   * Mark audio message as played
   */
  markAudioPlayed: async (token: string, messageId: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/audio/${messageId}/played`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },

  /**
   * Get total unread count
   */
  getUnreadCount: async (token: string): Promise<{ success: boolean; data: { totalUnread: number } }> => {
    const response = await fetch(`${API_BASE_URL}/api/chat/rooms/unread-count`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.json();
  },
};