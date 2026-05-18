// lib/services/notificationService.ts

import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../constants/ipConstants";
import socketService from "./socketService";

export interface Notification {
  _id: string;
  type:
    | "connection_request"
    | "connection_accepted"
    | "comment"
    | "like"
    | "repost"
    | "mention"
    | "event_interest"
    | "event_rsvp"
    | "event_approved"
    | "event_rejected"
    | "post_removed";
  title: string;
  message: string;
  createdAt: string;
  lastInteractionAt?: string;
  read: boolean;
  sender: {
    _id: string;
    name: string;
    username: string;
    profilePicture?: string;
    fullName?: string;
  };
  targetId?: string;
  metadata?: {
    isGrouped?: boolean;
    count?: number;
    likers?: Array<{
      userId: string;
      name: string;
      profilePicture?: string;
    }>;
  };
}

export interface NotificationsResponse {
  success: boolean;
  data?: {
    notifications: Notification[];
    unreadCount: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message?: string;
}

const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync("authToken");
    return token || null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

export const notificationService = {
  getNotifications: async (
    page: number = 1,
    limit: number = 20,
  ): Promise<NotificationsResponse> => {
    try {
      const token = await getAuthToken();
      if (!token) return { success: false, message: "No authentication token" };
      const response = await fetch(
        `${API_BASE_URL}/api/notifications?page=${page}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      return await response.json();
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return { success: false, message: "Failed to fetch notifications" };
    }
  },

  markAsRead: async (
    notificationId: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) return { success: false, message: "No authentication token" };
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to mark as read" };
    }
  },

  // ADD THIS METHOD
  markAsUnread: async (
    notificationId: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) return { success: false, message: "No authentication token" };
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/unread`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to mark as unread" };
    }
  },

  markAllAsRead: async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) return { success: false, message: "No authentication token" };
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/read-all`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to mark all as read" };
    }
  },

  deleteNotification: async (
    notificationId: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) return { success: false, message: "No authentication token" };
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to delete notification" };
    }
  },

  getUnreadCount: async (): Promise<{
    success: boolean;
    count?: number;
    message?: string;
  }> => {
    try {
      const token = await getAuthToken();
      if (!token) return { success: false, message: "No authentication token" };
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/unread-count`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      return await response.json();
    } catch (error) {
      return { success: false, message: "Failed to fetch unread count" };
    }
  },
};

export const listenForNotifications = (
  onNewNotification: (notification: Notification) => void,
  onUnreadCountUpdate: (count: number) => void,
) => {
  const handleNewNotification = (data: { notification: Notification }) => {
    onNewNotification(data.notification);
  };
  const handleUnreadCount = (data: { count: number }) => {
    onUnreadCountUpdate(data.count);
  };
  socketService.on("notification:new", handleNewNotification);
  socketService.on("notification:unreadCount", handleUnreadCount);
  return () => {
    socketService.off("notification:new", handleNewNotification);
    socketService.off("notification:unreadCount", handleUnreadCount);
  };
};
