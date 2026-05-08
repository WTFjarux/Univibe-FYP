// lib/services/feedService.ts
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../constants/ipConstants";
import { Post } from "./postService";
import { feedCache } from "../cache/feedCache";

export interface PaginationInfo {
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
}

export interface FeedResponse {
  success: boolean;
  posts: Post[];
  pagination: PaginationInfo;
}

class FeedService {
  private baseUrl: string;

  constructor() {
    const baseApiUrl = API_BASE_URL.endsWith("/")
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;
    this.baseUrl = `${baseApiUrl}/api/feed`;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await SecureStore.getItemAsync("authToken");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  private async fetchFeed(
    feedType: "campus" | "connections" | "anonymous",
    cursor?: string,
    limit: number = 10,
  ): Promise<FeedResponse> {
    const cursorKey = cursor || null;

    // Try memory cache first
    const memoryCached = feedCache.getFromMemory(feedType, cursorKey);
    if (memoryCached) {
      return memoryCached;
    }

    // Try persistent cache
    const storageCached = await feedCache.getFromStorage(feedType, cursorKey);
    if (storageCached) {
      return storageCached;
    }

    // Fetch from API
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (cursor && cursor.trim().length > 0) {
      params.append("cursor", cursor);
    }

    const url = `${this.baseUrl}/${feedType}?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: await this.getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to fetch ${feedType} feed`);
    }

    const data: FeedResponse = await response.json();

    // Cache the response
    await feedCache.saveToStorage(feedType, cursorKey, data);

    return data;
  }

  async getCampusFeed(limit: number = 10): Promise<FeedResponse> {
    return this.fetchFeed("campus", undefined, limit);
  }

  async getMoreCampusFeed(
    cursor: string,
    limit: number = 10,
  ): Promise<FeedResponse> {
    return this.fetchFeed("campus", cursor, limit);
  }

  async getConnectionsFeed(limit: number = 10): Promise<FeedResponse> {
    return this.fetchFeed("connections", undefined, limit);
  }

  async getMoreConnectionsFeed(
    cursor: string,
    limit: number = 10,
  ): Promise<FeedResponse> {
    return this.fetchFeed("connections", cursor, limit);
  }

  async getAnonymousFeed(limit: number = 10): Promise<FeedResponse> {
    return this.fetchFeed("anonymous", undefined, limit);
  }

  async getMoreAnonymousFeed(
    cursor: string,
    limit: number = 10,
  ): Promise<FeedResponse> {
    return this.fetchFeed("anonymous", cursor, limit);
  }

  /**
   * Invalidate cache when new post is created or post is deleted
   */
  async invalidateCache(): Promise<void> {
    await feedCache.invalidateAll();
  }

  /**
   * Invalidate cache for a specific feed type
   */
  async invalidateFeedCache(
    feedType: "campus" | "connections" | "anonymous",
  ): Promise<void> {
    await feedCache.invalidateFeed(feedType);
  }
}

export const feedService = new FeedService();
