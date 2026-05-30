// lib/services/notificationService.ts

import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../constants/ipConstants";
import socketService from "./socketService";

// ============================================
// TYPES
// ============================================

export type NotificationType =
  // Connection
  | "connection_request"
  | "connection_accepted"
  // Post interactions
  | "comment"
  | "like"
  | "repost"
  | "mention"
  | "post_removed"
  // Events
  | "event_interest"
  | "event_rsvp"
  | "event_approved"
  | "event_rejected"
  // Community approval
  | "community_approved"
  | "community_rejected"
  // Join requests
  | "join_request"
  | "join_approved"
  | "join_rejected"
  // Invitations
  | "community_invite"
  | "invitation_pending"
  | "invitation_accepted"
  | "invitation_approved"
  | "invitation_rejected"
  // Membership
  | "member_joined"
  | "member_removed"
  // Roles
  | "role_updated";

export interface NotificationSender {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
  fullName?: string;
}

export interface NotificationMetadata {
  isGrouped?: boolean;
  count?: number;
  likers?: Array<{
    userId: string;
    name: string;
    profilePicture?: string;
  }>;
  commenters?: Array<{
    userId: string;
    name: string;
    profilePicture?: string;
    preview?: string;
  }>;
}

export interface Notification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  lastInteractionAt?: string;
  read: boolean;
  sender: NotificationSender;
  targetId?: string;
  targetModel?: string;
  metadata?: NotificationMetadata;
}

export interface NotificationsData {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface NotificationsResponse {
  success: boolean;
  data?: NotificationsData;
  message?: string;
}

export interface MarkReadResponse {
  success: boolean;
  message?: string;
}

export interface UnreadCountResponse {
  success: boolean;
  count?: number;
  message?: string;
}

// ============================================
// HELPERS
// ============================================

const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync("authToken");
    return token || null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

const authFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const token = await getAuthToken();
  if (!token) throw new Error("No authentication token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
};

// ============================================
// NOTIFICATION SERVICE
// ============================================

export const notificationService = {
  /**
   * Get paginated notifications for the current user
   */
  getNotifications: async (
    page: number = 1,
    limit: number = 20,
  ): Promise<NotificationsResponse> => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/notifications?page=${page}&limit=${limit}`,
        { method: "GET" },
      );
      return await response.json();
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return { success: false, message: "Failed to fetch notifications" };
    }
  },

  /**
   * Mark a single notification as read
   */
  markAsRead: async (notificationId: string): Promise<MarkReadResponse> => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        { method: "PUT" },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to mark as read" };
    }
  },

  /**
   * Mark a single notification as unread
   */
  markAsUnread: async (notificationId: string): Promise<MarkReadResponse> => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/unread`,
        { method: "PUT" },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to mark as unread" };
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<MarkReadResponse> => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/notifications/read-all`,
        { method: "PUT" },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to mark all as read" };
    }
  },

  /**
   * Delete a single notification
   */
  deleteNotification: async (
    notificationId: string,
  ): Promise<MarkReadResponse> => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        { method: "DELETE" },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to delete notification" };
    }
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/notifications/unread-count`,
        { method: "GET" },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to fetch unread count" };
    }
  },
};

// ============================================
// SOCKET LISTENERS
// ============================================

/**
 * Listen for real-time notifications via socket
 * Returns a cleanup function to remove listeners
 */
export const listenForNotifications = (
  onNewNotification: (notification: Notification) => void,
  onUnreadCountUpdate: (count: number) => void,
): (() => void) => {
  const handleNewNotification = (data: { notification: Notification }) => {
    onNewNotification(data.notification);
  };

  const handleUnreadCount = (data: { count: number }) => {
    onUnreadCountUpdate(data.count);
  };

  socketService.on("notification:new", handleNewNotification);
  socketService.on("notification:unreadCount", handleUnreadCount);

  // Return cleanup function
  return () => {
    socketService.off("notification:new", handleNewNotification);
    socketService.off("notification:unreadCount", handleUnreadCount);
  };
};
