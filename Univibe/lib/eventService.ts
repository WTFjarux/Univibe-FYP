import { API_BASE_URL } from '@/constants/ipConstants';
import * as SecureStore from 'expo-secure-store';

// ============================================
// CONFIGURATION - MUST BE DEFINED FIRST
// ============================================

const CONFIG = {
  TIMEOUT: 60000,
  MAX_RETRIES: 2,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Base URL
const BASE_URL: string = API_BASE_URL;

// ============================================
// CACHE IMPLEMENTATION
// ============================================

class EventCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxSize = 50;

  set(key: string, data: any) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        console.log(`🗑️ Cache size limit reached, removed oldest item: ${firstKey}`);
      }
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
    
    setTimeout(() => {
      if (this.cache.has(key)) {
        this.cache.delete(key);
        console.log(`⏰ Cache expired for key: ${key}`);
      }
    }, CONFIG.CACHE_DURATION);
  }

  get(key: string) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > CONFIG.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(key);
      console.log(`⏰ Cache expired (checked on get): ${key}`);
      return null;
    }
    
    console.log(`✅ Cache hit for key: ${key}`);
    return cached.data;
  }
  
  clear() {
    this.cache.clear();
    console.log(`🗑️ Cache cleared completely`);
  }
  
  remove(key: string) {
    this.cache.delete(key);
    console.log(`🗑️ Cache removed for key: ${key}`);
  }
  
  getSize() {
    return this.cache.size;
  }
}

const eventCache = new EventCache();

// ============================================
// HELPER FUNCTIONS
// ============================================

const getAuthToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync('authToken');
    return token || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

const enhancedFetch = async (url: string, options: RequestInit, retries = CONFIG.MAX_RETRIES): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok && response.status >= 400 && response.status < 500) {
        return response;
      }
      
      if (!response.ok && response.status >= 500 && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  
  throw new Error('Max retries reached');
};

const generateCacheKey = (url: string, params?: any): string => {
  if (params) {
    return `${url}?${JSON.stringify(params)}`;
  }
  return url;
};

export const getFullImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return `${BASE_URL}/${url}`;
};

const processEventImages = (event: Event): Event => {
  if (!event) return event;
  
  if (event.coverImage) {
    event.coverImage = getFullImageUrl(event.coverImage);
  }
  
  if (event.coverImageUrl) {
    event.coverImageUrl = getFullImageUrl(event.coverImageUrl);
  }
  
  if (event.images && event.images.length > 0) {
    event.images = event.images.map(img => ({
      ...img,
      url: getFullImageUrl(img.url),
    }));
  }
  
  if (event.imageUrls && event.imageUrls.length > 0) {
    event.imageUrls = event.imageUrls.map(url => getFullImageUrl(url));
  }
  
  return event;
};

const processOrganizerProfilePicture = (event: Event): Event => {
  if (!event) return event;
  
  if (event.organizer && event.organizer.profilePicture) {
    event.organizer.profilePicture = getFullImageUrl(event.organizer.profilePicture);
  }
  return event;
};

const invalidateEventCache = () => {
  eventCache.clear();
};

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

// ============================================
// EVENT SERVICE
// ============================================

export const eventService = {
  createEvent: async (formData: FormData): Promise<{ success: boolean; message?: string; event?: Event }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await enhancedFetch(`${BASE_URL}/api/events`, {
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
        invalidateEventCache();
      }
      
      return data;
    } catch (error) {
      console.error('Error creating event:', error);
      return { success: false, message: 'Failed to create event' };
    }
  },

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

      const url = `${BASE_URL}/api/events${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const cacheKey = generateCacheKey(url, params);
      
      const cachedData = eventCache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const response = await enhancedFetch(url, {
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
        
        eventCache.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching events:', error);
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  },

  getEventById: async (eventId: string): Promise<{ success: boolean; event?: Event; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const url = `${BASE_URL}/api/events/${eventId}`;
      const cacheKey = generateCacheKey(url, { eventId });
      
      const cachedData = eventCache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const response = await enhancedFetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success && data.event) {
        data.event = processEventImages(data.event);
        data.event = processOrganizerProfilePicture(data.event);
        eventCache.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching event:', error);
      return { success: false, message: 'Failed to fetch event' };
    }
  },

  getMyEvents: async (page = 1, limit = 20): Promise<EventsResponse> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
      }

      const url = `${BASE_URL}/api/events/my-events?page=${page}&limit=${limit}`;
      const cacheKey = generateCacheKey(url, { page, limit });
      
      const cachedData = eventCache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const response = await enhancedFetch(url, {
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
        
        eventCache.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching my events:', error);
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  },

  getAttendingEvents: async (page = 1, limit = 20): Promise<EventsResponse> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
      }

      const url = `${BASE_URL}/api/events/attending?page=${page}&limit=${limit}`;
      const cacheKey = generateCacheKey(url, { page, limit });
      
      const cachedData = eventCache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const response = await enhancedFetch(url, {
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
        
        eventCache.set(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching attending events:', error);
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  },

  addEventImages: async (eventId: string, formData: FormData): Promise<{ success: boolean; message?: string; imageCount?: number; images?: EventImage[] }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await enhancedFetch(`${BASE_URL}/api/events/${eventId}/images`, {
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
        invalidateEventCache();
      }
      
      return data;
    } catch (error) {
      console.error('Error adding event images:', error);
      return { success: false, message: 'Failed to add images' };
    }
  },

  removeEventImage: async (eventId: string, imageIndex: number): Promise<{ success: boolean; message?: string; imageCount?: number; images?: EventImage[] }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await enhancedFetch(`${BASE_URL}/api/events/${eventId}/images/${imageIndex}`, {
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
        invalidateEventCache();
      }
      
      return data;
    } catch (error) {
      console.error('Error removing event image:', error);
      return { success: false, message: 'Failed to remove image' };
    }
  },

  setCoverImage: async (eventId: string, imageIndex: number): Promise<{ success: boolean; message?: string; event?: Event }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await enhancedFetch(`${BASE_URL}/api/events/${eventId}`, {
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
        invalidateEventCache();
      }
      
      return data;
    } catch (error) {
      console.error('Error setting cover image:', error);
      return { success: false, message: 'Failed to set cover image' };
    }
  },

  toggleInterest: async (eventId: string): Promise<{ success: boolean; message?: string; isInterested?: boolean; interestedCount?: number }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await enhancedFetch(`${BASE_URL}/api/events/${eventId}/interested`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        invalidateEventCache();
      }
      
      return data;
    } catch (error) {
      console.error('Error toggling interest:', error);
      return { success: false, message: 'Failed to toggle interest' };
    }
  },

  toggleRsvp: async (eventId: string): Promise<{ success: boolean; message?: string; isRsvpd?: boolean; rsvpCount?: number; isFull?: boolean }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await enhancedFetch(`${BASE_URL}/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        invalidateEventCache();
      }
      
      return data;
    } catch (error) {
      console.error('Error toggling RSVP:', error);
      return { success: false, message: 'Failed to toggle RSVP' };
    }
  },

  deleteEvent: async (eventId: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await enhancedFetch(`${BASE_URL}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        invalidateEventCache();
      }
      
      return data;
    } catch (error) {
      console.error('Error deleting event:', error);
      return { success: false, message: 'Failed to delete event' };
    }
  },

  updateEvent: async (eventId: string, formData: FormData): Promise<{ success: boolean; message?: string; event?: Event }> => {
    try {
      const token = await getAuthToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await enhancedFetch(`${BASE_URL}/api/events/${eventId}`, {
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
        invalidateEventCache();
      }
      
      return data;
    } catch (error) {
      console.error('Error updating event:', error);
      return { success: false, message: 'Failed to update event' };
    }
  },

  clearCache: () => {
    invalidateEventCache();
  },
  
  getCacheSize: () => {
    return eventCache.getSize();
  },
};