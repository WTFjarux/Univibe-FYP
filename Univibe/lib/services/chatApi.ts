// lib/services/chatApi.ts

import api from "./api";
import type {
  ChatRoomsResponse,
  SingleRoomResponse,
  Message,
  MessagesResponse,
  MarkReadResponse,
  Reaction,
  DeleteChatHistoryResponse,
} from "../types/chat.types";

// -----------------------------------------------------------------------------
// ChatApiService
// -----------------------------------------------------------------------------

class ChatApiService {
  // ---------------------------------------------------------------------------
  // Chat Rooms
  // ---------------------------------------------------------------------------

  async getChatRooms(): Promise<ChatRoomsResponse> {
    const response = await api.get("/chat/rooms");
    return response.data;
  }

  async getSingleRoom(roomId: string): Promise<SingleRoomResponse> {
    const response = await api.get(`/chat/room/${roomId}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Room Actions
  // ---------------------------------------------------------------------------

  async markRoomAsRead(roomId: string): Promise<MarkReadResponse> {
    const response = await api.post(`/chat/room/${roomId}/read`);
    return response.data;
  }

  async markRoomAsUnread(
    roomId: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/chat/room/${roomId}/unread`);
    return response.data;
  }

  async togglePin(roomId: string): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/room/${roomId}/pin`);
    return response.data;
  }

  async toggleMute(
    roomId: string,
    duration?: number,
  ): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/room/${roomId}/mute`, { duration });
    return response.data;
  }

  async deleteRoom(
    roomId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await api.delete(`/chat/room/${roomId}`);
    return response.data;
  }

  /**
   * Deletes chat history for the current user only.
   * Other participant still sees all messages.
   */
  async deleteChatHistory(roomId: string): Promise<DeleteChatHistoryResponse> {
    const response = await api.delete(`/chat/room/${roomId}/history`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

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

  /**
   * Forwards a message to multiple chats
   */
  async forwardMessage(
    messageId: string,
    targetChatIds: string[],
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      forwardedCount: number;
      forwardedMessages: Message[];
    };
  }> {
    const response = await api.post("/chat/messages/forward", {
      messageId,
      targetChatIds,
    });
    return response.data;
  }

  async sharePost(
    postId: string,
    targetChatIds: string[],
    comment?: string,
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      sharedCount: number;
      sharedMessages: any[];
    };
  }> {
    const response = await api.post("/chat/share-post", {
      postId,
      targetChatIds,
      comment,
    });
    return response.data;
  }

  async deleteMessage(
    messageId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await api.delete(`/chat/message/${messageId}`);
    return response.data;
  }

  async markMessageAsRead(
    messageId: string,
  ): Promise<{ success: boolean; data?: Message }> {
    const response = await api.post(`/chat/message/${messageId}/read`);
    return response.data;
  }

  async markMessageAsDelivered(
    messageId: string,
  ): Promise<{ success: boolean; data?: Message }> {
    const response = await api.post(`/chat/message/${messageId}/delivered`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------

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

  async addReaction(
    messageId: string,
    reaction: string,
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    return this.toggleReaction(messageId, reaction, false);
  }

  async removeReaction(
    messageId: string,
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    return this.toggleReaction(messageId, "", true);
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  async markAudioPlayed(messageId: string): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/audio/${messageId}/played`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Uploads
  // ---------------------------------------------------------------------------

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

  async uploadAttachments(formData: FormData): Promise<{
    success: boolean;
    data?: Message[];
    message?: string;
  }> {
    const response = await api.post("/chat/upload-attachments", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000,
      onUploadProgress: (progressEvent: any) => {
        if (progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );

        }
      },
    });
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // User Profile
  // ---------------------------------------------------------------------------

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
