import { API_BASE_URL } from "../../constants/ipConstants";
import * as SecureStore from "expo-secure-store";
import {
  UserSearchResponse,
  PostSearchResponse,
  EventSearchResponse,
  UnifiedSearchResponse,
  SearchCategory,
  SearchFilters,
} from "../types/search";

// ============================================
// AUTH HELPER
// ============================================

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync("authToken");
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

// ============================================
// API REQUEST HELPER
// ============================================

const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> => {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Request failed");
  }

  return data as T;
};

// ============================================
// SEARCH API FUNCTIONS
// ============================================

/**
 * Unified search across all types (users, posts, events)
 * Used for quick preview in "All" tab
 */
export const searchAll = async (
  query: string,
  limit: number = 5,
): Promise<UnifiedSearchResponse> => {
  const params = new URLSearchParams({ q: query, limit: limit.toString() });
  return apiRequest<UnifiedSearchResponse>(`/api/search?${params}`);
};

/**
 * Search users/profiles
 */
export const searchUsers = async (
  query: string,
  page: number = 1,
  limit: number = 20,
  filters?: SearchFilters,
): Promise<UserSearchResponse> => {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters?.campus) params.append("campus", filters.campus);
  if (filters?.major) params.append("major", filters.major);
  if (filters?.year) params.append("year", filters.year);

  return apiRequest<UserSearchResponse>(`/api/search/users?${params}`);
};

/**
 * Search posts
 */
export const searchPosts = async (
  query: string,
  page: number = 1,
  limit: number = 10,
  filters?: SearchFilters,
): Promise<PostSearchResponse> => {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters?.campus) params.append("campus", filters.campus);
  if (filters?.type) params.append("type", filters.type);

  return apiRequest<PostSearchResponse>(`/api/search/posts?${params}`);
};

/**
 * Search events
 */
export const searchEvents = async (
  query: string,
  page: number = 1,
  limit: number = 10,
  filters?: SearchFilters,
): Promise<EventSearchResponse> => {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters?.campus) params.append("campus", filters.campus);
  if (filters?.category) params.append("category", filters.category);
  if (filters?.status) params.append("status", filters.status);

  return apiRequest<EventSearchResponse>(`/api/search/events?${params}`);
};
