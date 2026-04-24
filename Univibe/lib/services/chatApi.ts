// lib/services/chatApi.ts
import { API_BASE_URL } from '../../constants/ipConstants';
import type {
  ChatRoomsResponse,
  SingleRoomResponse,
  Message,
  MessagesResponse,
  MarkReadResponse,
  Reaction,
} from '../types/chat.types';

class ChatApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/chat`;
  }

  private getHeaders(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // ============================================
  // CHAT ROOMS
  // ============================================

  async getChatRooms(token: string): Promise<ChatRoomsResponse> {
    const response = await fetch(`${this.baseUrl}/rooms`, {
      headers: this.getHeaders(token),
    });
    return this.handleResponse<ChatRoomsResponse>(response);
  }

  async getSingleRoom(token: string, roomId: string): Promise<SingleRoomResponse> {
    const response = await fetch(`${this.baseUrl}/room/${roomId}`, {
      headers: this.getHeaders(token),
    });
    return this.handleResponse<SingleRoomResponse>(response);
  }

  // ============================================
  // ROOM ACTIONS
  // ============================================

  async markRoomAsRead(token: string, roomId: string): Promise<MarkReadResponse> {
    const response = await fetch(`${this.baseUrl}/room/${roomId}/read`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return this.handleResponse<MarkReadResponse>(response);
  }

  async markRoomAsUnread(token: string, roomId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/room/${roomId}/unread`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }

  async togglePin(token: string, roomId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/room/${roomId}/pin`, {
      method: 'PUT',
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }

  async toggleMute(token: string, roomId: string, duration?: number): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/room/${roomId}/mute`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ duration }),
    });
    return this.handleResponse(response);
  }

  async deleteRoom(token: string, roomId: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/room/${roomId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }

  // ============================================
  // MESSAGES
  // ============================================

  /** Full message fetch (for refresh/sync) */
  async getMessages(
    token: string,
    roomId: string,
    limit: number = 50,
    before?: string
  ): Promise<MessagesResponse> {
    let url = `${this.baseUrl}/messages/${roomId}?limit=${limit}`;
    if (before) url += `&before=${before}`;
    const response = await fetch(url, { headers: this.getHeaders(token) });
    return this.handleResponse<MessagesResponse>(response);
  }

  /** ✅ NEW: Lightweight message fetch (for initial load + pagination) */
  async getMessagesLight(
    token: string,
    roomId: string,
    limit: number = 30,
    before?: string
  ): Promise<MessagesResponse> {
    let url = `${this.baseUrl}/messages/${roomId}/light?limit=${limit}`;
    if (before) url += `&before=${before}`;
    const response = await fetch(url, { headers: this.getHeaders(token) });
    return this.handleResponse<MessagesResponse>(response);
  }

  async sendMessage(
    token: string,
    data: {
      roomId: string;
      message: string;
      type?: string;
      replyTo?: any;
      tempId?: string;
    }
  ): Promise<{ success: boolean; data?: Message; message?: string }> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteMessage(
    token: string,
    messageId: string
  ): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/message/${messageId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }

  // ============================================
  // REACTIONS
  // ============================================

  async toggleReaction(
    token: string,
    messageId: string,
    reaction: string,
    remove?: boolean
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    const response = await fetch(`${this.baseUrl}/message/${messageId}/react`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ reaction, remove: remove || false }),
    });
    return this.handleResponse(response);
  }

  async addReaction(
    token: string,
    messageId: string,
    reaction: string
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    return this.toggleReaction(token, messageId, reaction, false);
  }

  async removeReaction(
    token: string,
    messageId: string
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    return this.toggleReaction(token, messageId, '', true);
  }

  // ============================================
  // AUDIO
  // ============================================

  async markAudioPlayed(token: string, messageId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/audio/${messageId}/played`, {
      method: 'PUT',
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }

  // ============================================
  // UPLOADS
  // ============================================

  async uploadAudio(
    token: string,
    formData: FormData
  ): Promise<{ success: boolean; url?: string; message?: string; data?: Message }> {
    const response = await fetch(`${this.baseUrl}/upload-audio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return this.handleResponse(response);
  }

  async uploadAttachments(
    token: string,
    formData: FormData
  ): Promise<{ success: boolean; data?: Message[]; message?: string }> {
    const response = await fetch(`${this.baseUrl}/upload-attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    return this.handleResponse(response);
  }

  // ============================================
  // USER PROFILE
  // ============================================

  async getUserProfile(
    token: string,
    userId: string
  ): Promise<{
    success: boolean;
    data: {
      userId: string;
      name: string;
      username: string;
      profilePicture: string | null;
      bio?: string;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/user-profile/${userId}`, {
      headers: this.getHeaders(token),
    });
    return this.handleResponse(response);
  }
}

export const chatApi = new ChatApiService();
export default chatApi;