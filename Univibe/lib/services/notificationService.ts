// lib/notificationService.ts
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../constants/ipConstants';

export interface Notification {
  _id: string;
  type: 'connection_request' | 'connection_accepted' | 'comment' | 'like' | 'repost' | 'mention';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  sender: {
    _id: string;
    name: string;
    username: string;
    profilePicture?: string;
  };
  targetId?: string;
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
    const token = await SecureStore.getItemAsync('authToken');
    return token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

export const notificationService = {
  getNotifications: async (page: number = 1, limit: number = 20): Promise<NotificationsResponse> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { success: false, message: 'Failed to fetch notifications' };
    }
  },

  markAsRead: async (notificationId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/read`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error marking as read:', error);
      return { success: false, message: 'Failed to mark as read' };
    }
  },

  markAsUnread: async (notificationId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}/unread`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error marking as unread:', error);
      return { success: false, message: 'Failed to mark as unread' };
    }
  },

  markAllAsRead: async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/read-all`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error marking all as read:', error);
      return { success: false, message: 'Failed to mark all as read' };
    }
  },

  deleteNotification: async (notificationId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/${notificationId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return { success: false, message: 'Failed to delete notification' };
    }
  },

  /**
   * Delete all pending connection request notifications from a specific sender
   * This prevents duplicate/spam notifications when users cancel and resend requests
   */
  deletePendingConnectionNotifications: async (senderId: string): Promise<{ success: boolean; message?: string; deletedCount?: number }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/connection-requests/${senderId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting pending connection notifications:', error);
      return { success: false, message: 'Failed to delete pending connection notifications' };
    }
  },

  getUnreadCount: async (): Promise<{ success: boolean; count?: number; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/unread-count`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      return { success: data.success, count: data.count, message: data.message };
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return { success: false, message: 'Failed to fetch unread count' };
    }
  },
};