// lib/eventService.ts
import { API_BASE_URL } from '@/constants/ipConstants';
import * as SecureStore from 'expo-secure-store';

// ============================================
// INTERFACES
// ============================================

export interface User {
  _id: string;
  name: string;
  username: string;
  email?: string;
  profilePicture?: string;
  fullName?: string;
}

export interface EventImage {
  filename: string;
  url: string;
  path: string;
  mimetype: string;
  size: number;
  isCover: boolean;
  uploadedAt: string;
  _id?: string;
}

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
  images: EventImage[];
  coverImageUrl: string;
  imageUrls: string[];
  imageCount: number;
  organizer: {
    _id: string;
    name: string;
    username: string;
    email: string;
    profilePicture?: string;
    fullName?: string;
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
  
  rsvp?: User[];
  interested?: User[];
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

/**
 * Helper to process image URLs in an event object
 */
const processEventImages = (event: Event): Event => {
  // Process cover image URL
  if (event.coverImage) {
    event.coverImage = getFullImageUrl(event.coverImage);
  }
  
  // Process coverImageUrl virtual field
  if (event.coverImageUrl) {
    event.coverImageUrl = getFullImageUrl(event.coverImageUrl);
  }
  
  // Process all images in the images array
  if (event.images && event.images.length > 0) {
    event.images = event.images.map(img => ({
      ...img,
      url: getFullImageUrl(img.url),
    }));
  }
  
  // Process imageUrls array
  if (event.imageUrls && event.imageUrls.length > 0) {
    event.imageUrls = event.imageUrls.map(url => getFullImageUrl(url));
  }
  
  return event;
};

/**
 * Helper to process organizer profile picture URL
 */
const processOrganizerProfilePicture = (event: Event): Event => {
  if (event.organizer && event.organizer.profilePicture) {
    event.organizer.profilePicture = getFullImageUrl(event.organizer.profilePicture);
  }
  return event;
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
      
      if (data.success && data.event) {
        data.event = processEventImages(data.event);
        data.event = processOrganizerProfilePicture(data.event);
      }
      
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
      
      if (data.success && data.data) {
        data.data = data.data.map((event: Event) => {
          event = processEventImages(event);
          event = processOrganizerProfilePicture(event);
          return event;
        });
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
        data.event = processEventImages(data.event);
        data.event = processOrganizerProfilePicture(data.event);
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
        data.data = data.data.map((event: Event) => {
          event = processEventImages(event);
          event = processOrganizerProfilePicture(event);
          return event;
        });
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
        data.data = data.data.map((event: Event) => {
          event = processEventImages(event);
          event = processOrganizerProfilePicture(event);
          return event;
        });
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching attending events:', error);
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  },

  // Add more images to an existing event
  addEventImages: async (eventId: string, formData: FormData): Promise<{ success: boolean; message?: string; imageCount?: number; images?: EventImage[] }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success && data.images) {
        data.images = data.images.map((img: EventImage) => ({
          ...img,
          url: getFullImageUrl(img.url),
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error adding event images:', error);
      return { success: false, message: 'Failed to add images' };
    }
  },

  // Remove a specific image from an event
  removeEventImage: async (eventId: string, imageIndex: number): Promise<{ success: boolean; message?: string; imageCount?: number; images?: EventImage[] }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/images/${imageIndex}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success && data.images) {
        data.images = data.images.map((img: EventImage) => ({
          ...img,
          url: getFullImageUrl(img.url),
        }));
      }
      
      return data;
    } catch (error) {
      console.error('Error removing event image:', error);
      return { success: false, message: 'Failed to remove image' };
    }
  },

  // Set a specific image as the cover image
  setCoverImage: async (eventId: string, imageIndex: number): Promise<{ success: boolean; message?: string; event?: Event }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ setCoverImageIndex: imageIndex }),
      });

      const data = await response.json();
      
      if (data.success && data.event) {
        data.event = processEventImages(data.event);
        data.event = processOrganizerProfilePicture(data.event);
      }
      
      return data;
    } catch (error) {
      console.error('Error setting cover image:', error);
      return { success: false, message: 'Failed to set cover image' };
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

  // Update an event
  updateEvent: async (eventId: string, formData: FormData): Promise<{ success: boolean; message?: string; event?: Event }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success && data.event) {
        data.event = processEventImages(data.event);
        data.event = processOrganizerProfilePicture(data.event);
      }
      
      return data;
    } catch (error) {
      console.error('Error updating event:', error);
      return { success: false, message: 'Failed to update event' };
    }
  },
};