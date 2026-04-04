// lib/connectionService.ts
import api from './api';
import { API_BASE_URL } from '@/constants/ipConstants';
import { notificationService } from './notificationService';

export type ConnectionStatusType = 'connected' | 'pending_sent' | 'pending_received' | 'not_connected';

export interface ConnectionStatusResponse {
  success: boolean;
  data: {
    status: ConnectionStatusType;
  };
}

export interface ConnectionResponse {
  success: boolean;
  message?: string;
  data?: {
    status?: ConnectionStatusType;
    autoAccepted?: boolean;
    senderConnectionCount?: number;
    receiverConnectionCount?: number;
    userConnectionCount?: number;
    requesterConnectionCount?: number;
    connectionUserCount?: number;
  };
}

export interface Connection {
  _id: string;
  name: string;
  username: string;
  email: string;
  fullName?: string;
  profilePicture?: string;
  isConnected?: boolean;
}

export interface ConnectionsResponse {
  success: boolean;
  data?: {
    connections: Connection[];
    connectionCount: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message?: string;
}

export interface PendingRequestsResponse {
  success: boolean;
  data?: {
    requests: Connection[];
    total: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message?: string;
}

export interface ConnectionCountResponse {
  success: boolean;
  data?: {
    connectionCount: number;
  };
  message?: string;
}

export const connectionService = {
  /**
   * Send a connection request to another user
   */
  sendConnectionRequest: async (userId: string): Promise<ConnectionResponse> => {
    try {
      const response = await api.post(`${API_BASE_URL}/api/connections/request/${userId}`);
      console.log('Send connection response:', response.data);
      
      return {
        success: true,
        message: response.data.message,
        data: {
          status: response.data.status || (response.data.autoAccepted ? 'connected' : 'pending_sent'),
          autoAccepted: response.data.autoAccepted || false,
          senderConnectionCount: response.data.data?.senderConnectionCount,
          receiverConnectionCount: response.data.data?.receiverConnectionCount,
        }
      };
    } catch (error: any) {
      console.error('Send connection request error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send connection request',
      };
    }
  },

  /**
   * Accept a connection request
   */
  acceptConnectionRequest: async (requestId: string): Promise<ConnectionResponse> => {
    try {
      const response = await api.post(`${API_BASE_URL}/api/connections/accept/${requestId}`);
      console.log('Accept connection response:', response.data);
      
      return {
        success: true,
        message: response.data.message,
        data: {
          userConnectionCount: response.data.data?.userConnectionCount,
          requesterConnectionCount: response.data.data?.requesterConnectionCount,
        }
      };
    } catch (error: any) {
      console.error('Accept connection request error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to accept connection request',
      };
    }
  },

  /**
   * Reject a connection request
   */
  rejectConnectionRequest: async (requestId: string): Promise<ConnectionResponse> => {
    try {
      const response = await api.post(`${API_BASE_URL}/api/connections/reject/${requestId}`);
      return {
        success: true,
        message: response.data.message,
      };
    } catch (error: any) {
      console.error('Reject connection request error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reject connection request',
      };
    }
  },

  /**
   * Cancel a sent connection request - FIXED
   */
cancelConnectionRequest: async (userId: string): Promise<ConnectionResponse> => {
  try {
    // First, delete any pending notifications
    await notificationService.deletePendingConnectionNotifications(userId);
    
    // Then cancel the request
    const response = await api.delete(`${API_BASE_URL}/api/connections/cancel/${userId}`);
    console.log('Cancel connection response:', response.data);
    
    return {
      success: true,
      message: response.data.message,
      data: {
        userConnectionCount: response.data.data?.userConnectionCount,
      }
    };
  } catch (error: any) {
    console.error('Cancel connection request error:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to cancel connection request',
    };
  }
},

  /**
   * Remove an existing connection
   */
  removeConnection: async (connectionId: string): Promise<ConnectionResponse> => {
    try {
      const response = await api.delete(`${API_BASE_URL}/api/connections/remove/${connectionId}`);
      console.log('Remove connection response:', response.data);
      
      return {
        success: true,
        message: response.data.message,
        data: {
          userConnectionCount: response.data.data?.userConnectionCount,
          connectionUserCount: response.data.data?.removedUserConnectionCount,
        }
      };
    } catch (error: any) {
      console.error('Remove connection error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to remove connection',
      };
    }
  },

  /**
   * Get connection status with another user
   */
  getConnectionStatus: async (userId: string): Promise<ConnectionStatusResponse> => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/connections/status/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get connection status error:', error);
      return {
        success: false,
        data: { status: 'not_connected' },
      };
    }
  },

  /**
   * Get user's connections list with pagination
   */
  getConnections: async (userId: string, page = 1, limit = 20): Promise<ConnectionsResponse> => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/connections/${userId}/connections?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('Get connections error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get connections',
      };
    }
  },

  /**
   * Get pending connection requests with pagination
   */
  getPendingRequests: async (page = 1, limit = 20): Promise<PendingRequestsResponse> => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/connections/requests/pending?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('Get pending requests error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get pending requests',
      };
    }
  },

  /**
   * Get mutual connections with another user
   */
  getMutualConnections: async (userId: string, page = 1, limit = 20): Promise<ConnectionsResponse> => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/connections/mutual/${userId}?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('Get mutual connections error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get mutual connections',
      };
    }
  },

  /**
   * Get connection suggestions
   */
  getConnectionSuggestions: async (limit = 10) => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/connections/suggestions?limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error('Get connection suggestions error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get suggestions',
      };
    }
  },

  /**
   * Get connection count for a user
   */
  getConnectionCount: async (userId: string): Promise<ConnectionCountResponse> => {
    try {
      const response = await api.get(`${API_BASE_URL}/api/connections/count/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get connection count error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get connection count',
      };
    }
  },
};