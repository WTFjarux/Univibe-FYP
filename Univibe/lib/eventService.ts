// lib/eventService.ts
import { API_BASE_URL } from '@/constants/ipConstants';
import * as SecureStore from 'expo-secure-store';

export interface Event {
  _id: string;
  title: string;
  description: string;
  category: 'Academic' | 'Social' | 'Sports' | 'Career' | 'Cultural' | 'Workshop' | 'Other';
  location: string;
  campus: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  organizer: {
    _id: string;
    name: string;
    username: string;
    email: string;
  };
  organizerName: string;
  interestedCount: number;
  rsvpCount: number;
  visibility: 'campus' | 'connections' | 'public';
  maxAttendees: number | null;
  isOnline: boolean;
  meetingLink: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  tags: string[];
  isInterested?: boolean;
  isRsvpd?: boolean;
  isFull?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventsResponse {
  success: boolean;
  data: Event[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
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

export const getFullImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

export const eventService = {
  // Create a new event
  createEvent: async (formData: FormData): Promise<{ success: boolean; message?: string; event?: Event }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating event:', error);
      return { success: false, message: 'Failed to create event' };
    }
  },

  // Get all events with filters
  getEvents: async (params?: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<EventsResponse> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
      }

      const queryParams = new URLSearchParams();
      if (params?.category) queryParams.append('category', params.category);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);

      const url = `${API_BASE_URL}/api/events${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      // Process cover image URLs
      if (data.success && data.data) {
        data.data = data.data.map((event: Event) => ({
          ...event,
          coverImage: getFullImageUrl(event.coverImage),
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching events:', error);
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  },

  // Get single event by ID
  getEventById: async (eventId: string): Promise<{ success: boolean; event?: Event; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success && data.event) {
        data.event.coverImage = getFullImageUrl(data.event.coverImage);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching event:', error);
      return { success: false, message: 'Failed to fetch event' };
    }
  },

  // Get events created by user
  getMyEvents: async (page = 1, limit = 20): Promise<EventsResponse> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/my-events?page=${page}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        data.data = data.data.map((event: Event) => ({
          ...event,
          coverImage: getFullImageUrl(event.coverImage),
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching my events:', error);
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  },

  // Get events user is attending (RSVP'd)
  getAttendingEvents: async (page = 1, limit = 20): Promise<EventsResponse> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/attending?page=${page}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        data.data = data.data.map((event: Event) => ({
          ...event,
          coverImage: getFullImageUrl(event.coverImage),
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching attending events:', error);
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  },

  // Toggle interest in an event
  toggleInterest: async (eventId: string): Promise<{ success: boolean; message?: string; isInterested?: boolean; interestedCount?: number }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/interested`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error toggling interest:', error);
      return { success: false, message: 'Failed to toggle interest' };
    }
  },

  // Toggle RSVP for an event
  toggleRsvp: async (eventId: string): Promise<{ success: boolean; message?: string; isRsvpd?: boolean; rsvpCount?: number; isFull?: boolean }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error toggling RSVP:', error);
      return { success: false, message: 'Failed to toggle RSVP' };
    }
  },

  // Delete an event
  deleteEvent: async (eventId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting event:', error);
      return { success: false, message: 'Failed to delete event' };
    }
  },
};