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
  // ===========================================================================
  // CHAT ROOMS
  // ===========================================================================

  /**
   * Fetch all chat rooms for the current user.
   * Returns both direct and group chats sorted by most recent activity.
   * Includes last message preview, unread count, and participant info.
   */
  async getChatRooms(): Promise<ChatRoomsResponse> {
    const response = await api.get("/chat/rooms");
    return response.data;
  }

  /**
   * Get details for a single chat room by its roomId.
   * Works for both direct and group chats.
   * Returns full participant list with roles and avatars.
   */
  async getSingleRoom(roomId: string): Promise<SingleRoomResponse> {
    const response = await api.get(`/chat/room/${roomId}`);
    return response.data;
  }

  /**
   * Get or create a direct chat room with another user.
   * If a room already exists between the two users, returns it.
   * Otherwise creates a new direct chat room.
   * @param otherUserId - MongoDB ObjectId of the other user
   */
  async getOrCreateDirectRoom(otherUserId: string): Promise<{
    success: boolean;
    data: {
      roomId: string;
      type: string;
      name?: string;
      isCleared?: boolean;
      clearedAt?: string;
    };
  }> {
    const response = await api.get(`/chat/direct/${otherUserId}`);
    return response.data;
  }

  // ===========================================================================
  // ROOM ACTIONS
  // ===========================================================================

  /**
   * Mark all messages in a room as read for the current user.
   * Updates both the room's lastMessage.readBy and all individual messages.
   */
  async markRoomAsRead(roomId: string): Promise<MarkReadResponse> {
    const response = await api.post(`/chat/room/${roomId}/read`);
    return response.data;
  }

  /**
   * Mark a room as unread by removing the current user's read receipt
   * from the last message.
   */
  async markRoomAsUnread(
    roomId: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/chat/room/${roomId}/unread`);
    return response.data;
  }

  /**
   * Toggle pin status of a chat room.
   * Pinned rooms appear at the top of the chat list regardless of recent activity.
   */
  async togglePin(roomId: string): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/room/${roomId}/pin`);
    return response.data;
  }

  /**
   * Toggle mute status of a chat room.
   * Muted rooms suppress notification sounds and banners.
   * @param roomId - Room identifier
   * @param duration - Optional mute duration in hours (null = indefinite)
   */
  async toggleMute(
    roomId: string,
    duration?: number,
  ): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/room/${roomId}/mute`, { duration });
    return response.data;
  }

  /**
   * Delete a chat room entirely.
   * For groups: only the owner can delete.
   * For direct chats: removes the room for both users.
   */
  async deleteRoom(
    roomId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await api.delete(`/chat/room/${roomId}`);
    return response.data;
  }

  /**
   * Delete chat history for the current user only.
   * Other participants still see all messages unaffected.
   * The chat reappears in the list when a new message arrives.
   * Uses the clearedBy mechanism with restoreOnNewMessage.
   */
  async deleteChatHistory(roomId: string): Promise<DeleteChatHistoryResponse> {
    const response = await api.delete(`/chat/room/${roomId}/history`);
    return response.data;
  }

  // ===========================================================================
  // GROUP CHAT MANAGEMENT
  // ===========================================================================

  /**
   * Create a new group chat.
   * The creating user automatically becomes the group owner.
   * All participant IDs are validated before creation.
   *
   * @param data.name - Group name (required, max 100 chars)
   * @param data.participantIds - Array of user IDs to add (minimum 2, excluding creator)
   * @param data.icon - Optional group icon/avatar URL
   * @param data.description - Optional group description
   * @param data.settings - Optional group permissions settings
   * @returns Created group data with roomId for navigation
   */
  async createGroup(data: {
    name: string;
    participantIds: string[];
    icon?: string;
    description?: string;
    settings?: {
      onlyAdminsCanSend?: boolean;
      onlyAdminsCanAddMembers?: boolean;
      onlyAdminsCanChangeInfo?: boolean;
    };
  }): Promise<{
    success: boolean;
    message?: string;
    data?: {
      roomId: string;
      type: string;
      name: string;
      groupIcon?: string;
      groupDescription?: string;
      participantCount: number;
      participants: Array<{
        userId: string;
        name: string;
        username: string;
        avatar?: string;
        role: string;
        joinedAt: string;
      }>;
      createdBy: string;
      createdAt: string;
    };
  }> {
    const response = await api.post("/groups/create", data);
    return response.data;
  }

  /**
   * Get group members list.
   * Returns all participants sorted by role (owner → admins → members).
   * Includes user info, role, join date, and last read timestamp.
   *
   * @param roomId - Group room identifier
   */
  async getGroupInfo(roomId: string): Promise<{
    success: boolean;
    data?: Array<{
      userId: string;
      name: string;
      username: string;
      avatar?: string;
      role: string;
      joinedAt: string;
      lastReadAt: string;
    }>;
    message?: string;
  }> {
    const response = await api.get(`/groups/${roomId}/members`);
    return response.data;
  }

  /**
   * Add members to an existing group.
   * Requires admin/owner privileges (respects groupSettings.onlyAdminsCanAddMembers).
   * Duplicate members are silently ignored.
   *
   * @param roomId - Group room identifier
   * @param memberIds - Array of user IDs to add
   */
  async addGroupMembers(
    roomId: string,
    memberIds: string[],
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      roomId: string;
      addedMembers: string[];
      totalParticipants: number;
    };
  }> {
    const response = await api.put(`/groups/${roomId}/add-members`, {
      memberIds,
    });
    return response.data;
  }

  /**
   * Remove a member from a group.
   * Admins can remove any non-owner member.
   * Members can remove themselves (leave).
   * The owner cannot be removed by others.
   *
   * @param roomId - Group room identifier
   * @param memberId - User ID to remove
   */
  async removeGroupMember(
    roomId: string,
    memberId: string,
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      roomId: string;
      removedMember: string;
    };
  }> {
    const response = await api.put(`/groups/${roomId}/remove-member`, {
      memberId,
    });
    return response.data;
  }

  /**
   * Leave a group chat.
   * If the owner leaves, ownership transfers to the next admin or oldest member.
   * After leaving, the user no longer receives group messages.
   *
   * @param roomId - Group room identifier
   */
  async leaveGroup(roomId: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    const response = await api.post(`/groups/${roomId}/leave`);
    return response.data;
  }

  /**
   * Update group information.
   * Only admins/owners can update (respects groupSettings.onlyAdminsCanChangeInfo).
   * Partial updates are supported - only provided fields are changed.
   *
   * @param roomId - Group room identifier
   * @param updates - Object containing fields to update (name, icon, description, settings)
   */
  async updateGroupInfo(
    roomId: string,
    updates: {
      name?: string;
      icon?: string;
      description?: string;
      settings?: {
        onlyAdminsCanSend?: boolean;
        onlyAdminsCanAddMembers?: boolean;
        onlyAdminsCanChangeInfo?: boolean;
      };
    },
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      roomId: string;
      name: string;
      groupIcon?: string;
      groupDescription?: string;
      groupSettings?: any;
    };
  }> {
    const response = await api.put(`/groups/${roomId}/update`, updates);
    return response.data;
  }

  /**
   * Promote a member to admin.
   * Only the group owner can promote members.
   * Admins can manage members and update group info (unless restricted).
   *
   * @param roomId - Group room identifier
   * @param memberId - User ID to promote
   */
  async makeAdmin(
    roomId: string,
    memberId: string,
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const response = await api.put(`/groups/${roomId}/make-admin`, {
      memberId,
    });
    return response.data;
  }

  /**
   * Demote an admin to regular member.
   * Only the group owner can demote admins.
   * The owner cannot be demoted.
   *
   * @param roomId - Group room identifier
   * @param memberId - Admin user ID to demote
   */
  async removeAdmin(
    roomId: string,
    memberId: string,
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const response = await api.put(`/groups/${roomId}/remove-admin`, {
      memberId,
    });
    return response.data;
  }

  // ===========================================================================
  // MESSAGES
  // ===========================================================================

  /**
   * Get full message history for a room with pagination support.
   * Messages are sorted newest-first, respects per-user clearedAt filtering.
   *
   * @param roomId - Room identifier
   * @param limit - Maximum messages to return (default: 50)
   * @param before - ISO date string to fetch messages before this timestamp
   */
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

  /**
   * Get lightweight message list for a room (fewer populated fields).
   * Better performance for initial loads and chat list previews.
   *
   * @param roomId - Room identifier
   * @param limit - Maximum messages to return (default: 30)
   * @param before - ISO date string to fetch messages before this timestamp
   */
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

  /**
   * Send a message via REST API.
   * Note: Socket.IO is preferred for real-time messaging.
   * Use this for offline support or non-real-time scenarios.
   */
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
   * Forward a message to one or more chats.
   * The forwarded message includes reference to the original sender.
   * Media files are shared by URL (no re-upload).
   *
   * @param messageId - ID of the message to forward
   * @param targetChatIds - Array of room IDs to forward to (max 10)
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

  /**
   * Share a post to one or more chats.
   * Creates a special "post" type message with post preview data.
   *
   * @param postId - ID of the post to share
   * @param targetChatIds - Array of room IDs to share to (max 10)
   * @param comment - Optional comment to include with the shared post
   */
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

  /**
   * Soft delete a message.
   * Message is marked as deleted but remains in the database.
   * Only the message sender can delete their own messages.
   *
   * @param messageId - ID of the message to delete
   */
  async deleteMessage(
    messageId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await api.delete(`/chat/message/${messageId}`);
    return response.data;
  }

  /**
   * Mark a single message as read by the current user.
   * Updates the message's readBy array with timestamp.
   *
   * @param messageId - ID of the message to mark as read
   */
  async markMessageAsRead(
    messageId: string,
  ): Promise<{ success: boolean; data?: Message }> {
    const response = await api.post(`/chat/message/${messageId}/read`);
    return response.data;
  }

  /**
   * Mark a single message as delivered to the current user's device.
   * Updates the message's deliveredTo array with timestamp.
   *
   * @param messageId - ID of the message to mark as delivered
   */
  async markMessageAsDelivered(
    messageId: string,
  ): Promise<{ success: boolean; data?: Message }> {
    const response = await api.post(`/chat/message/${messageId}/delivered`);
    return response.data;
  }

  // ===========================================================================
  // REACTIONS
  // ===========================================================================

  /**
   * Toggle a reaction on a message.
   * If the user already reacted with the same emoji, it's removed.
   * If the user reacted with a different emoji, it's updated.
   * If remove is true, the reaction is removed regardless.
   *
   * @param messageId - ID of the message
   * @param reaction - Emoji reaction character
   * @param remove - If true, removes the reaction instead of toggling
   */
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

  /**
   * Add a reaction to a message.
   * Convenience method that calls toggleReaction with remove=false.
   */
  async addReaction(
    messageId: string,
    reaction: string,
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    return this.toggleReaction(messageId, reaction, false);
  }

  /**
   * Remove a reaction from a message.
   * Convenience method that calls toggleReaction with remove=true.
   */
  async removeReaction(
    messageId: string,
  ): Promise<{ success: boolean; reactions: Reaction[] }> {
    return this.toggleReaction(messageId, "", true);
  }

  // ===========================================================================
  // AUDIO
  // ===========================================================================

  /**
   * Mark an audio message as played.
   * Used for voice note played/not-played indicator in chat UI.
   *
   * @param messageId - ID of the audio message
   */
  async markAudioPlayed(messageId: string): Promise<{ success: boolean }> {
    const response = await api.put(`/chat/audio/${messageId}/played`);
    return response.data;
  }

  // ===========================================================================
  // UPLOADS
  // ===========================================================================

  /**
   * Upload an audio message (voice note).
   * The audio file is processed server-side and stored.
   *
   * @param formData - FormData containing 'audio' file, 'roomId', 'duration', and optional reply fields
   * @returns Uploaded audio URL and created message data
   */
  async uploadAudio(formData: FormData): Promise<{
    success: boolean;
    url?: string;
    message?: string;
    data?: Message;
  }> {
    const response = await api.post("/chat/upload-audio", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000, // 30 seconds for audio files
    });
    return response.data;
  }

  /**
   * Upload attachments (images, videos, files).
   * Supports multiple files in a single request.
   * Images and videos get automatic thumbnails generated server-side.
   *
   * @param formData - FormData containing files and 'roomId'
   * @returns Array of created message objects
   */
  async uploadAttachments(formData: FormData): Promise<{
    success: boolean;
    data?: Message[];
    message?: string;
  }> {
    const response = await api.post("/chat/upload-attachments", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000, // 5 minutes for large files
      onUploadProgress: (progressEvent: any) => {
        if (progressEvent.total) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          console.log(`Upload progress: ${percent}%`);
        }
      },
    });
    return response.data;
  }

  /**
   * Upload a video with automatic thumbnail generation.
   * Videos are compressed server-side for optimal playback.
   *
   * @param formData - FormData containing video file and 'roomId'
   * @returns Array of created message objects with thumbnail URLs
   */
  async uploadVideo(formData: FormData): Promise<{
    success: boolean;
    data?: Message[];
    message?: string;
  }> {
    const response = await api.post("/chat/upload-video", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000, // 5 minutes for video files
    });
    return response.data;
  }

  // ===========================================================================
  // USER PROFILE
  // ===========================================================================

  /**
   * Get another user's profile for chat header display.
   * Returns name, username, profile picture, and optional bio.
   *
   * @param userId - MongoDB ObjectId of the user
   */
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

  /**
   * Get total unread message count across all chats
   */
  async getUnreadChatCount(): Promise<{ success: boolean; count?: number }> {
    const response = await api.get("/chat/unread-count");
    return response.data;
  }
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const chatApi = new ChatApiService();
export default chatApi;
