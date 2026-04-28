import api from "./api";
import type {
  ChatRoomsResponse,
  SingleRoomResponse,
  Message,
  MessagesResponse,
  MarkReadResponse,
  Reaction,
} from "../types/chat.types";

// -----------------------------------------------------------------------------
// ChatApiService
// -----------------------------------------------------------------------------

/**
 * Service layer for all chat-related API calls.
 *
 * Each method wraps an HTTP request to the backend and returns parsed data.
 * This service does NOT handle socket events — it is purely for REST operations
 * like fetching messages, toggling room settings, and uploading media.
 */
class ChatApiService {
  // ---------------------------------------------------------------------------
  // Chat Rooms
  // ---------------------------------------------------------------------------

  /** Fetches all chat rooms for the authenticated user */
  async getChatRooms(): Promise<ChatRoomsResponse> {
    const response = await api.get("/chat/rooms");
    return response.data;
  }

  /** Fetches a single room by ID */
  async getSingleRoom(roomId: string): Promise<SingleRoomResponse> {
    const response = await api.get(`/chat/room/${roomId}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Room Actions
  // ---------------------------------------------------------------------------

  /** Marks all messages in a room as read */
  async markRoomAsRead(roomId: string): Promise<MarkReadResponse> {
    const response = await api.post(`/chat/room/${roomId}/read`);
    return response.data;
  }

  /** Marks a room as manually unread */
  async markRoomAsUnread(
    roomId: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/chat/room/${roomId}/unread`);
    return response.data;
  }

  /** Toggles the pinned status of a room */
  async togglePin(roomId: string): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/room/${roomId}/pin`);
    return response.data;
  }

  /** Toggles the muted status of a room, optionally with a duration */
  async toggleMute(
    roomId: string,
    duration?: number,
  ): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/room/${roomId}/mute`, { duration });
    return response.data;
  }

  /** Deletes a room and all its messages */
  async deleteRoom(
    roomId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await api.delete(`/chat/room/${roomId}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  /** Full message fetch for sync/refresh operations */
  async getMessages(
    roomId: string,
    limit: number = 50,
    before?: string,
  ): Promise<MessagesResponse> {
    let url = `/chat/messages/${roomId}?limit=${limit}`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    const response = await api.get(url);
    return response.data;
  }

  /** Lightweight message fetch for initial load and pagination */
  async getMessagesLight(
    roomId: string,
    limit: number = 30,
    before?: string,
  ): Promise<MessagesResponse> {
    let url = `/chat/messages/${roomId}/light?limit=${limit}`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    const response = await api.get(url);
    return response.data;
  }

  /** Sends a text or location message via REST (text messages go through socket) */
  async sendMessage(data: {
    roomId: string;
    message: string;
    type?: string;
    replyTo?: any;
    tempId?: string;
  }): Promise<{ success: boolean; data?: Message; message?: string }> {
    const response = await api.post("/chat/messages", data);
    return response.data;
  }

  /** Deletes a message by ID */
  async deleteMessage(
    messageId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await api.delete(`/chat/message/${messageId}`);
    return response.data;
  }

  /** Marks a single message as read */
  async markMessageAsRead(
    messageId: string,
  ): Promise<{ success: boolean; data?: Message }> {
    const response = await api.post(`/chat/message/${messageId}/read`);
    return response.data;
  }

  /** Marks a single message as delivered */
  async markMessageAsDelivered(
    messageId: string,
  ): Promise<{ success: boolean; data?: Message }> {
    const response = await api.post(`/chat/message/${messageId}/delivered`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------

  /** Adds or removes a reaction on a message */
  async toggleReaction(
    messageId: string,
    reaction: string,
    remove?: boolean,
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    const response = await api.post(`/chat/message/${messageId}/react`, {
      reaction,
      remove: remove || false,
    });
    return response.data;
  }

  /** Adds a reaction to a message */
  async addReaction(
    messageId: string,
    reaction: string,
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    return this.toggleReaction(messageId, reaction, false);
  }

  /** Removes a reaction from a message */
  async removeReaction(
    messageId: string,
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    return this.toggleReaction(messageId, "", true);
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  /** Marks an audio message as played by the current user */
  async markAudioPlayed(messageId: string): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/audio/${messageId}/played`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Uploads
  // ---------------------------------------------------------------------------

  /** Uploads an audio recording and returns the message data */
  async uploadAudio(formData: FormData): Promise<{
    success: boolean;
    url?: string;
    message?: string;
    data?: Message;
  }> {
    const response = await api.post("/chat/upload-audio", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    });
    return response.data;
  }

  /** Uploads images, videos, or documents and returns message data */
  async uploadAttachments(
    formData: FormData,
  ): Promise<{ success: boolean; data?: Message[]; message?: string }> {
    const response = await api.post("/chat/upload-attachments", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // User Profile
  // ---------------------------------------------------------------------------

  /** Fetches a user's public profile by ID */
  async getUserProfile(userId: string): Promise<{
    success: boolean;
    data: {
      userId: string;
      name: string;
      username: string;
      profilePicture: string | null;
      bio?: string;
    };
  }> {
    const response = await api.get(`/chat/user-profile/${userId}`);
    return response.data;
  }
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const chatApi = new ChatApiService();
export default chatApi;
