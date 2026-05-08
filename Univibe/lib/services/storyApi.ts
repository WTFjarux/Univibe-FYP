// lib/services/storyApi.ts

import api from "./api";
import type { AxiosProgressEvent, AxiosError } from "axios";

// =================== TYPES ===================

export interface Story {
  _id: string;
  mediaUrl: string;
  type: "image" | "video";
  caption: string;
  createdAt: string;
  viewers: Array<{
    userId: string;
    viewedAt: string;
  }>;
  uniqueViewersCount?: number;
  hasCurrentUserViewed?: boolean;
}

export interface StoryGroup {
  userId: string;
  userName: string;
  userUsername: string;
  profilePicture: string | null;
  stories: Story[];
  hasUnseen: boolean;
  totalStories?: number;
  lastStoryTime?: string;
}

export interface Viewer {
  _id: string;
  userId: string;
  userName: string;
  userUsername?: string;
  profilePicture?: string;
  viewedAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalStories?: number;
    totalViewers?: number;
    hasMore: boolean;
  };
}

export interface CreateStoryResponse {
  success: boolean;
  message: string;
  data: Story;
}

export interface GetStoriesResponse extends PaginatedResponse<StoryGroup> {
  success: boolean;
}

export interface ViewStoryResponse {
  success: boolean;
  message: string;
  alreadyViewed?: boolean;
  data?: {
    uniqueViewerCount: number;
  };
}

export interface ReplyToStoryResponse {
  success: boolean;
  message: string;
  data: any;
}

export interface DeleteStoryResponse {
  success: boolean;
  message: string;
}

export interface GetStoryViewersResponse extends PaginatedResponse<Viewer> {
  success: boolean;
}

export interface CleanupStoriesResponse {
  success: boolean;
  message: string;
  deletedCount: number;
}

// =================== CUSTOM ERROR CLASS ===================

export class StoryApiError extends Error {
  constructor(
    public message: string,
    public statusCode?: number,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = "StoryApiError";
  }
}

// =================== CACHE TYPES ===================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

interface ViewedStoryTracker {
  storyId: string;
  viewedAt: number;
  synced: boolean;
}

interface PendingSync {
  storyId: string;
  timestamp: number;
  retries: number;
}

// =================== STORY API SERVICE ===================

class StoryApiService {
  private abortController: AbortController | null = null;

  // ✅ MULTI-LEVEL CACHING STRATEGY (Instagram-style)
  private storiesListCache: CacheEntry<GetStoriesResponse> | undefined =
    undefined;
  private storyViewersCache = new Map<
    string,
    CacheEntry<GetStoryViewersResponse>
  >(); // Per story
  private individualStoryCache = new Map<string, CacheEntry<Story>>(); // Per story

  // ✅ VIEWED STORIES TRACKING (optimistic updates)
  private viewedStoriesLocal = new Map<string, ViewedStoryTracker>(); // Optimistic state

  // ✅ SYNC QUEUE FOR BACKGROUND SYNCING
  private syncQueue: PendingSync[] = [];
  private isSyncing = false;

  // ✅ CACHE CONFIG (Instagram-level durations)
  private readonly STORIES_LIST_CACHE_DURATION = 60000; // 60s - Main list
  private readonly STORY_VIEWERS_CACHE_DURATION = 120000; // 2min - Viewers (less frequent)
  private readonly INDIVIDUAL_STORY_CACHE_DURATION = 300000; // 5min - Individual story
  private readonly MAX_CACHE_SIZE = 100; // Max stories to keep in memory

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly SYNC_INTERVAL = 5000; // Background sync every 5s

  private syncIntervalRef: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startBackgroundSync();
  }

  /**
   * ✅ BACKGROUND SYNC - Like Instagram's offline queue
   * Syncs viewed stories in background without blocking UI
   */
  private startBackgroundSync(): void {
    if (this.syncIntervalRef) clearInterval(this.syncIntervalRef);

    this.syncIntervalRef = setInterval(() => {
      this.processSyncQueue();
    }, this.SYNC_INTERVAL);
  }

  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) return;

    this.isSyncing = true;

    while (this.syncQueue.length > 0) {
      const pending = this.syncQueue[0];

      try {
        await this.viewStoryInternal(pending.storyId);

        // Mark as synced
        const tracked = this.viewedStoriesLocal.get(pending.storyId);
        if (tracked) {
          tracked.synced = true;
        }

        this.syncQueue.shift(); // Remove from queue
        console.log(`✅ Synced view for story: ${pending.storyId}`);
      } catch (err) {
        pending.retries++;

        if (pending.retries > this.MAX_RETRIES) {
          console.log(
            `❌ Gave up syncing story after ${this.MAX_RETRIES} retries`,
          );
          this.syncQueue.shift();
        } else {
          // Retry later
          pending.timestamp = Date.now();
          console.log(`🔄 Will retry story sync (attempt ${pending.retries})`);
          break; // Stop processing, retry later
        }
      }
    }

    this.isSyncing = false;
  }

  /**
   * Generic request handler with error handling and retry logic
   */
  private async handleRequest<T>(
    request: () => Promise<T>,
    context: string,
    retries = this.MAX_RETRIES,
  ): Promise<T> {
    try {
      return await request();
    } catch (error) {
      const axiosError = error as AxiosError;

      // ✅ Check if request was cancelled (don't treat as error)
      const isCancelled =
        axiosError.code === "ERR_CANCELED" ||
        axiosError.message === "canceled" ||
        axiosError.message?.includes("canceled");

      if (isCancelled) {
        console.log(`📱 Request ${context} was cancelled`);
        throw new StoryApiError("Request cancelled", 499, error);
      }

      // Handle specific HTTP status codes
      if (axiosError.response) {
        switch (axiosError.response.status) {
          case 400:
            throw new StoryApiError(
              (axiosError.response.data as any)?.message || "Invalid request",
              400,
              error,
            );
          case 401:
            this.clearAllCaches();
            throw new StoryApiError(
              "Authentication required. Please log in again.",
              401,
              error,
            );
          case 403:
            throw new StoryApiError(
              (axiosError.response.data as any)?.message ||
                "You don't have permission to perform this action",
              403,
              error,
            );
          case 404:
            throw new StoryApiError(
              (axiosError.response.data as any)?.message || "Moment not found",
              404,
              error,
            );
          case 410:
            throw new StoryApiError(
              (axiosError.response.data as any)?.message || "Moment has expired",
              410,
              error,
            );
          case 429:
            throw new StoryApiError(
              "Too many requests. Please try again later.",
              429,
              error,
            );
          case 499:
            throw new StoryApiError("Request cancelled", 499, error);
          case 500:
            if (retries > 0) {
              console.log(
                `🔄 Retrying ${context}... (${this.MAX_RETRIES - retries + 1}/${this.MAX_RETRIES})`,
              );
              await this.delay(this.RETRY_DELAY);
              return this.handleRequest(request, context, retries - 1);
            }
            throw new StoryApiError(
              "Server error. Please try again later.",
              500,
              error,
            );
          default:
            throw new StoryApiError(
              (axiosError.response.data as any)?.message ||
                `Request failed with status ${axiosError.response.status}`,
              axiosError.response.status,
              error,
            );
        }
      } else if (axiosError.request) {
        throw new StoryApiError(
          "Network error. Please check your internet connection.",
          undefined,
          error,
        );
      } else {
        throw new StoryApiError(
          `Error in ${context}: ${axiosError.message}`,
          undefined,
          error,
        );
      }
    }
  }

  /**
   * Utility method for delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cancel ongoing requests
   */
  cancelRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * ✅ SMART CACHE INVALIDATION
   * Only invalidates what changed, not everything
   */
  private invalidateStoriesListCache(): void {
    this.storiesListCache = undefined;
    console.log("📦 Invalidated stories list cache");
  }

  private invalidateStoryViewersCache(storyId: string): void {
    this.storyViewersCache.delete(storyId);
    console.log(`📦 Invalidated viewers cache for story: ${storyId}`);
  }

  private invalidateIndividualStoryCache(storyId: string): void {
    this.individualStoryCache.delete(storyId);
    console.log(`📦 Invalidated individual story cache: ${storyId}`);
  }

  /**
   * Clear ALL caches (only on logout/auth failure)
   */
  private clearAllCaches(): void {
    this.storiesListCache = undefined;
    this.storyViewersCache.clear();
    this.individualStoryCache.clear();
    this.viewedStoriesLocal.clear();
    console.log("🧹 Cleared all caches");
  }

  /**
   * ✅ MEMORY MANAGEMENT - Keep cache from growing unbounded
   */
  private enforceMaxCacheSize(): void {
    if (this.individualStoryCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.individualStoryCache.entries());
      // Remove oldest entries
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
      toRemove.forEach(([key]) => this.individualStoryCache.delete(key));
      console.log(`📦 Pruned cache, removed ${toRemove.length} old entries`);
    }
  }

  /**
   * ✅ SMART CACHE CHECK - Returns cached if valid
   */
  private isCacheValid<T>(
    cache: CacheEntry<T> | undefined,
    duration: number,
  ): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < duration;
  }

  /**
   * ✅ GET STORIES WITH SMART CACHING
   * - Returns cached immediately on first page
   * - Doesn't clear cache on every view
   * - Optimistic viewer counts
   */
  async getStories(
    page: number = 1,
    limit: number = 20,
    forceRefresh: boolean = false,
  ): Promise<GetStoriesResponse> {
    // Check cache first (only for page 1)
    if (
      !forceRefresh &&
      page === 1 &&
      this.isCacheValid(this.storiesListCache, this.STORIES_LIST_CACHE_DURATION)
    ) {
      return this.updateCacheWithViewedStories(this.storiesListCache!.data);
    }

    // Cancel previous request
    this.cancelRequests();
    this.abortController = new AbortController();

    const request = async () => {
      const response = await api.get("/stories", {
        params: { page, limit },
        signal: this.abortController!.signal,
      });

      // Cache only first page
      if (page === 1) {
        this.storiesListCache = {
          data: response.data,
          timestamp: Date.now(),
        };
      }

      return response.data;
    };

    try {
      const result = await this.handleRequest(request, "getStories");
      return this.updateCacheWithViewedStories(result);
    } catch (error) {
      // Return cache if failed and available
      if (this.storiesListCache) {
        console.log("📦 Request failed, returning cached stories");
        return this.updateCacheWithViewedStories(this.storiesListCache.data);
      }
      throw error;
    }
  }

  /**
   * ✅ UPDATE CACHE WITH LOCAL VIEWED STATE
   * Shows optimistic viewer counts before sync completes
   */
  private updateCacheWithViewedStories(
    response: GetStoriesResponse,
  ): GetStoriesResponse {
    const updated = JSON.parse(JSON.stringify(response)); // Deep clone

    updated.data.forEach((group: StoryGroup) => {
      group.stories.forEach((story: Story) => {
        const viewed = this.viewedStoriesLocal.get(story._id);
        if (viewed) {
          // Add to viewers optimistically
          story.hasCurrentUserViewed = true;
          story.uniqueViewersCount = (story.uniqueViewersCount || 0) + 1;
        }
      });
    });

    return updated;
  }

  /**
   * Create a new story with image/video
   * @param formData - FormData containing 'media' file and optional 'caption'
   * @param onUploadProgress - Callback for upload progress
   */
  async createStory(
    formData: FormData,
    onUploadProgress?: (progress: AxiosProgressEvent) => void,
  ): Promise<CreateStoryResponse> {
    if (!formData.has("media")) {
      throw new StoryApiError("No media file provided", 400);
    }

    const request = async () => {
      const response = await api.post("/stories", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress,
      });

      // Invalidate list cache (new story added)
      this.invalidateStoriesListCache();

      return response.data;
    };

    const result = await this.handleRequest(request, "createStory");
    return result;
  }

  /**
   * ✅ VIEW STORY - OPTIMISTIC UPDATE
   * - Updates UI immediately
   * - Queues sync in background
   * - No blocking
   */
  async viewStory(storyId: string): Promise<ViewStoryResponse> {
    if (!storyId) {
      throw new StoryApiError("Story ID is required", 400);
    }

    // ✅ OPTIMISTIC UPDATE - Update immediately
    const tracked = this.viewedStoriesLocal.get(storyId);
    if (!tracked) {
      this.viewedStoriesLocal.set(storyId, {
        storyId,
        viewedAt: Date.now(),
        synced: false,
      });
    }

    // ✅ QUEUE FOR BACKGROUND SYNC - Don't wait
    if (!tracked?.synced) {
      this.syncQueue.push({
        storyId,
        timestamp: Date.now(),
        retries: 0,
      });
    }

    // Trigger sync but don't wait for it
    this.processSyncQueue().catch(console.error);

    return {
      success: true,
      message: "Story view recorded",
      data: { uniqueViewerCount: 0 },
    };
  }

  /**
   * Internal method for actual server sync
   */
  private async viewStoryInternal(storyId: string): Promise<ViewStoryResponse> {
    const request = async () => {
      const response = await api.post(`/stories/${storyId}/view`);
      return response.data;
    };

    return this.handleRequest(request, `viewStory-${storyId}`);
  }

  async viewStoryWithSync(storyId: string): Promise<ViewStoryResponse> {
    // Do optimistic update
    await this.viewStory(storyId);

    // Wait for this specific story to sync
    return new Promise((resolve, reject) => {
      const checkSync = setInterval(() => {
        const tracked = this.viewedStoriesLocal.get(storyId);
        if (tracked?.synced) {
          clearInterval(checkSync);
          resolve({ success: true, message: "Story view synced" });
        }
        // Timeout after 30 seconds
        if (Date.now() - (tracked?.viewedAt || Date.now()) > 30000) {
          clearInterval(checkSync);
          resolve({ success: true, message: "Sync timeout, saved locally" });
        }
      }, 500);
    });
  }
  /**
   * Get list of unique viewers for a story (with caching)
   * @param storyId - Story ID
   * @param page - Page number
   * @param limit - Items per page
   */
  async getStoryViewers(
    storyId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<GetStoryViewersResponse> {
    if (!storyId) {
      throw new StoryApiError("Story ID is required", 400);
    }

    // Check cache
    const cacheKey = `${storyId}_${page}_${limit}`;
    const cached = this.storyViewersCache.get(cacheKey);

    if (this.isCacheValid(cached, this.STORY_VIEWERS_CACHE_DURATION)) {
      console.log(`⚡ Returning cached viewers for story: ${storyId}`);
      return cached!.data;
    }

    const request = async () => {
      const response = await api.get(`/stories/${storyId}/viewers`, {
        params: { page, limit },
      });

      // Cache it
      this.storyViewersCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });

      this.enforceMaxCacheSize();

      return response.data;
    };

    const result = await this.handleRequest(request, "getStoryViewers");
    return result;
  }

  /**
   * Send a reply to a story
   */
  async replyToStory(
    storyId: string,
    message: string,
    storyData?: {
      storyId: string;
      mediaUrl?: string;
      thumbnailUrl?: string;
      caption?: string;
      type?: string;
    },
  ): Promise<ReplyToStoryResponse> {
    if (!storyId) {
      throw new StoryApiError("Story ID is required", 400);
    }

    if (!message || message.trim().length === 0) {
      throw new StoryApiError("Reply message is required", 400);
    }

    if (message.length > 1000) {
      throw new StoryApiError(
        "Reply message cannot exceed 1000 characters",
        400,
      );
    }

    const request = async () => {
      const response = await api.post(`/stories/${storyId}/reply`, {
        message: message.trim(),
        storyData: storyData, // Include story data for the chat message
      });
      return response.data;
    };

    const result = await this.handleRequest(request, "replyToStory");
    return result;
  }

  /**
   * Delete a story (only owner)
   */
  async deleteStory(storyId: string): Promise<DeleteStoryResponse> {
    if (!storyId) {
      throw new StoryApiError("Story ID is required", 400);
    }

    const request = async () => {
      const response = await api.delete(`/stories/${storyId}`);

      // Smart invalidation - only clear what's affected
      this.invalidateStoriesListCache();
      this.invalidateIndividualStoryCache(storyId);

      return response.data;
    };

    const result = await this.handleRequest(request, "deleteStory");
    return result;
  }

  /**
   * Manually trigger cleanup of expired stories (Admin only)
   */
  async cleanupExpiredStories(): Promise<CleanupStoriesResponse> {
    const request = async () => {
      const response = await api.get("/stories/expired/cleanup");
      this.invalidateStoriesListCache();
      return response.data;
    };

    const result = await this.handleRequest(request, "cleanupExpiredStories");
    return result;
  }

  /**
   * ✅ REFRESH STORIES - Force refetch from server
   */
  async refreshStories(): Promise<GetStoriesResponse> {
    this.invalidateStoriesListCache();
    return this.getStories(1, 20, true);
  }

  /**
   * ✅ PREFETCH - Download next N stories in background
   * No blocking, just fills cache
   */
  async prefetchStories(count: number = 2): Promise<void> {
    // Prefetch only if cache is stale
    if (
      !this.isCacheValid(
        this.storiesListCache,
        this.STORIES_LIST_CACHE_DURATION,
      )
    ) {
      try {
        await this.getStories(1, 20, false);
      } catch (err) {
        console.log("Prefetch failed (non-blocking):", err);
      }
    }
  }

  /**
   * Check if a story has been viewed by current user
   */
  hasUserViewedStory(story: Story, userId: string): boolean {
    if (!story.viewers || !userId) return false;
    return story.viewers.some((viewer) => viewer.userId === userId);
  }

  /**
   * Get unique viewer count with optimistic updates
   */
  getUniqueViewerCount(story: Story | undefined): number {
    if (!story || !story.viewers || !Array.isArray(story.viewers)) {
      return 0;
    }
    const uniqueUserIds = new Set(story.viewers.map((v) => v.userId));
    return uniqueUserIds.size;
  }

  /**
   * Format story timestamp for display
   */
  formatStoryTime(createdAt: string): string {
    if (!createdAt) return "Just now";

    const storyDate = new Date(createdAt);
    const now = new Date();
    const diffHours = (now.getTime() - storyDate.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) {
      const minutes = Math.floor(diffHours * 60);
      return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)} hour${Math.floor(diffHours) !== 1 ? "s" : ""} ago`;
    } else {
      return storyDate.toLocaleDateString();
    }
  }

  /**
   * Get cache stats (for debugging)
   */
  getCacheStats() {
    return {
      hasStoriesListCache: !!this.storiesListCache,
      viewersCount: this.storyViewersCache.size,
      storyCount: this.individualStoryCache.size,
      viewedLocal: this.viewedStoriesLocal.size,
      syncQueue: this.syncQueue.length,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Cleanup on unmount
   */
  destroy(): void {
    if (this.syncIntervalRef) {
      clearInterval(this.syncIntervalRef);
      this.syncIntervalRef = null;
    }
    this.cancelRequests();
  }
}

const storyApi = new StoryApiService();
export default storyApi;
