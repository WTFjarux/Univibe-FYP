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
    public isBlocked?: boolean,
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

// =================== CALLBACK TYPES ===================

/**
 * Callback invoked when a story view sync completes
 * Allows UI to update viewer counts after background sync
 */
export type OnViewSyncComplete = (
  storyId: string,
  uniqueViewerCount: number,
) => void;

/**
 * Callback invoked when a new story is received via socket
 * Allows UI to refresh stories in real-time
 */
export type OnNewStoryReceived = (data: {
  userId: string;
  story: Story;
}) => void;

// =================== STORY API SERVICE ===================

class StoryApiService {
  private abortController: AbortController | null = null;

  private storiesListCache: CacheEntry<GetStoriesResponse> | undefined =
    undefined;
  private storyViewersCache = new Map<
    string,
    CacheEntry<GetStoryViewersResponse>
  >();
  private individualStoryCache = new Map<string, CacheEntry<Story>>();

  private viewedStoriesLocal = new Map<string, ViewedStoryTracker>();
  private syncQueue: PendingSync[] = [];
  private isSyncing = false;

  // Callback registrations
  private onViewSyncCallbacks: OnViewSyncComplete[] = [];
  private onNewStoryCallbacks: OnNewStoryReceived[] = [];

  private readonly STORIES_LIST_CACHE_DURATION = 30000; // Reduced: 30s for fresher data
  private readonly STORY_VIEWERS_CACHE_DURATION = 120000;
  private readonly INDIVIDUAL_STORY_CACHE_DURATION = 300000;
  private readonly MAX_CACHE_SIZE = 100;

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly SYNC_INTERVAL = 5000;
  private readonly MAX_QUEUE_SIZE = 100; // ✅ NEW: Prevent unbounded queue growth

  private syncIntervalRef: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startBackgroundSync();
  }

  // =================== CALLBACK REGISTRATION ===================

  /**
   * Register a callback for when a story view sync completes
   * Used by StoryViewerScreen to update viewer counts in real-time
   */
  onViewSyncComplete(callback: OnViewSyncComplete): () => void {
    this.onViewSyncCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.onViewSyncCallbacks = this.onViewSyncCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Register a callback for when a new story is received via socket
   * Used by HomeScreen to auto-refresh stories
   */
  onNewStoryReceived(callback: OnNewStoryReceived): () => void {
    this.onNewStoryCallbacks.push(callback);
    return () => {
      this.onNewStoryCallbacks = this.onNewStoryCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  /**
   * Called by socketService when new_story event is received
   * Invalidates cache and notifies registered callbacks
   */
  handleNewStoryEvent(data: { userId: string; story: Story }): void {
    console.log("📢 New story received, invalidating cache");
    this.invalidateStoriesListCache();

    // Notify all registered callbacks
    this.onNewStoryCallbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error("Error in onNewStory callback:", err);
      }
    });
  }

  // =================== BACKGROUND SYNC ===================

  private startBackgroundSync(): void {
    if (this.syncIntervalRef) clearInterval(this.syncIntervalRef);

    this.syncIntervalRef = setInterval(() => {
      this.processSyncQueue();
    }, this.SYNC_INTERVAL);
  }

  /**
   * Processes the sync queue, sending pending view events to the server
   * Handles retries with backoff, respects max retries and queue size
   */
  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) return;

    this.isSyncing = true;

    while (this.syncQueue.length > 0) {
      const pending = this.syncQueue[0];

      try {
        const response = await this.viewStoryInternal(pending.storyId);

        const tracked = this.viewedStoriesLocal.get(pending.storyId);
        if (tracked) {
          tracked.synced = true;
        }

        // Remove from queue on success
        this.syncQueue.shift();
        console.log(`✅ Synced view for story: ${pending.storyId}`);

        // ✅ NEW: Notify callbacks with actual viewer count
        if (response.data?.uniqueViewerCount !== undefined) {
          this.notifyViewSyncComplete(
            pending.storyId,
            response.data.uniqueViewerCount,
          );
        }
      } catch (err) {
        const error = err as any;

        // If blocked, remove from queue permanently
        if (error?.isBlocked) {
          console.log(`🚫 Story view blocked, removing from sync queue`);
          this.syncQueue.shift();
          continue;
        }

        pending.retries++;

        if (pending.retries > this.MAX_RETRIES) {
          console.log(
            `❌ Gave up syncing story after ${this.MAX_RETRIES} retries`,
          );
          this.syncQueue.shift();
        } else {
          console.log(`🔄 Will retry story sync (attempt ${pending.retries})`);
          break; // Wait for next interval to retry
        }
      }
    }

    this.isSyncing = false;
  }

  /**
   * Notifies all registered callbacks that a view sync completed
   * AND pushes fresh statistics directly into the local in-memory cache layers
   */
  private notifyViewSyncComplete(
    storyId: string,
    uniqueViewerCount: number,
  ): void {
    // 1. Manually surgically update the primary stories list cache if it exists
    if (this.storiesListCache?.data?.data) {
      const groups = this.storiesListCache.data.data;
      for (const group of groups) {
        const story = group.stories.find((s) => s._id === storyId);
        if (story) {
          story.uniqueViewersCount = uniqueViewerCount;
          story.hasCurrentUserViewed = true;

          // Also ensure the visual seen/unseen state for the group updates immediately
          group.hasUnseen = group.stories.some((s) => !s.hasCurrentUserViewed);
          console.log(
            `🎯 In-memory Cache updated directly for story ${storyId}. New count: ${uniqueViewerCount}`,
          );
          break;
        }
      }
    }

    // 2. Notify all registered UI callbacks
    this.onViewSyncCallbacks.forEach((cb) => {
      try {
        cb(storyId, uniqueViewerCount);
      } catch (err) {
        console.error("Error in onViewSync callback:", err);
      }
    });
  }

  // =================== REQUEST HANDLER ===================

  private async handleRequest<T>(
    request: () => Promise<T>,
    context: string,
    retries = this.MAX_RETRIES,
  ): Promise<T> {
    try {
      return await request();
    } catch (error) {
      const axiosError = error as AxiosError;

      const isCancelled =
        axiosError.code === "ERR_CANCELED" ||
        axiosError.message === "canceled" ||
        axiosError.message?.includes("canceled");

      if (isCancelled) {
        console.log(`📱 Request ${context} was cancelled`);
        throw new StoryApiError("Request cancelled", 499, error);
      }

      if (axiosError.response) {
        const responseData = axiosError.response.data as any;

        switch (axiosError.response.status) {
          case 400:
            throw new StoryApiError(
              responseData?.message || "Invalid request",
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
          case 403: {
            const isBlocked = responseData?.isBlocked || false;
            throw new StoryApiError(
              responseData?.message ||
                "You don't have permission to perform this action",
              403,
              error,
              isBlocked,
            );
          }
          case 404:
            throw new StoryApiError(
              responseData?.message || "Moment not found",
              404,
              error,
            );
          case 410:
            throw new StoryApiError(
              responseData?.message || "Moment has expired",
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
              responseData?.message ||
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // =================== CACHE MANAGEMENT ===================

  cancelRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Public method to invalidate stories cache
   * Called by socket event handlers to force fresh data on next fetch
   */
  invalidateStoriesListCache(): void {
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

  private clearAllCaches(): void {
    this.storiesListCache = undefined;
    this.storyViewersCache.clear();
    this.individualStoryCache.clear();
    this.viewedStoriesLocal.clear();
    console.log("🧹 Cleared all caches");
  }

  private enforceMaxCacheSize(): void {
    if (this.individualStoryCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.individualStoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
      toRemove.forEach(([key]) => this.individualStoryCache.delete(key));
      console.log(`📦 Pruned cache, removed ${toRemove.length} old entries`);
    }
  }

  private isCacheValid<T>(
    cache: CacheEntry<T> | undefined,
    duration: number,
  ): boolean {
    if (!cache) return false;
    return Date.now() - cache.timestamp < duration;
  }

  // =================== API METHODS ===================

  /**
   * Fetches stories from the current user and their connections
   * Uses cache for performance, merges local view state
   */
  async getStories(
    page: number = 1,
    limit: number = 20,
    forceRefresh: boolean = false,
  ): Promise<GetStoriesResponse> {
    if (
      !forceRefresh &&
      page === 1 &&
      this.isCacheValid(this.storiesListCache, this.STORIES_LIST_CACHE_DURATION)
    ) {
      console.log("⚡ Returning cached stories");
      return this.updateCacheWithViewedStories(this.storiesListCache!.data);
    }

    this.cancelRequests();
    this.abortController = new AbortController();

    const request = async () => {
      const response = await api.get("/stories", {
        params: { page, limit },
        signal: this.abortController!.signal,
      });

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
      if (this.storiesListCache) {
        console.log("📦 Request failed, returning cached stories");
        return this.updateCacheWithViewedStories(this.storiesListCache.data);
      }
      throw error;
    }
  }

  /**
   * Merges locally tracked viewed stories with server response
   * Ensures optimistic view state is reflected even before sync completes
   */
  private updateCacheWithViewedStories(
    response: GetStoriesResponse,
  ): GetStoriesResponse {
    // Deep clone to avoid mutating cache
    const updated: GetStoriesResponse = JSON.parse(JSON.stringify(response));

    updated.data.forEach((group: StoryGroup) => {
      group.stories.forEach((story: Story) => {
        // Check if we have a local view record for this story
        const viewed = this.viewedStoriesLocal.get(story._id);

        if (viewed) {
          // Mark as viewed locally (optimistic)
          story.hasCurrentUserViewed = true;
        }

        // If server says we've viewed, sync local state
        if (story.hasCurrentUserViewed && !viewed) {
          this.viewedStoriesLocal.set(story._id, {
            storyId: story._id,
            viewedAt: Date.now(),
            synced: true, // Server confirms we've viewed
          });
        }
      });

      // Recalculate hasUnseen based on merged data
      group.hasUnseen = group.stories.some(
        (s: Story) => !s.hasCurrentUserViewed,
      );
    });

    return updated;
  }

  /**
   * Creates a new story with media upload
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

      // Invalidate cache so next fetch gets the new story
      this.invalidateStoriesListCache();

      return response.data;
    };

    const result = await this.handleRequest(request, "createStory");
    return result;
  }

  /**
   * Records a story view (optimistic)
   * Returns immediately with optimistic response
   * Actual sync happens in background via sync queue
   */
  async viewStory(storyId: string): Promise<ViewStoryResponse> {
    if (!storyId) {
      throw new StoryApiError("Story ID is required", 400);
    }

    // Track locally for optimistic UI updates
    const tracked = this.viewedStoriesLocal.get(storyId);
    if (!tracked) {
      this.viewedStoriesLocal.set(storyId, {
        storyId,
        viewedAt: Date.now(),
        synced: false,
      });
    }

    // Add to sync queue if not already synced and queue has space
    if (!tracked?.synced) {
      // ✅ NEW: Check queue capacity before adding
      if (this.syncQueue.length >= this.MAX_QUEUE_SIZE) {
        console.warn(
          `⚠️ Sync queue full (${this.MAX_QUEUE_SIZE}), dropping oldest entry`,
        );
        this.syncQueue.shift(); // Remove oldest to make room
      }

      this.syncQueue.push({
        storyId,
        timestamp: Date.now(),
        retries: 0,
      });
    }

    // Trigger sync processing
    this.processSyncQueue().catch(console.error);

    // Return optimistic response immediately
    // ✅ FIXED: Return current known count instead of hardcoded 0
    const currentCount = this.getLocalViewerCount(storyId);

    return {
      success: true,
      message: "Story view recorded",
      data: { uniqueViewerCount: currentCount },
    };
  }

  /**
   * Gets estimated viewer count from local cache
   * Falls back to 1 (current user) if not cached
   */
  private getLocalViewerCount(storyId: string): number {
    // Check if we have this story in the cached groups
    if (this.storiesListCache) {
      const groups: StoryGroup[] = this.storiesListCache.data.data;
      for (const group of groups) {
        const story = group.stories.find((s: Story) => s._id === storyId);
        if (story) {
          return story.uniqueViewersCount || 0;
        }
      }
    }
    // Fallback: at least 1 (current user just viewed)
    return 1;
  }

  /**
   * Internal method: sends view to server (called by sync queue)
   */
  private async viewStoryInternal(storyId: string): Promise<ViewStoryResponse> {
    const request = async () => {
      const response = await api.post(`/stories/${storyId}/view`);
      return response.data;
    };

    return this.handleRequest(request, `viewStory-${storyId}`);
  }

  /**
   * Views a story and waits for server confirmation
   * Use when you need the actual viewer count (e.g., story owner)
   */
  async viewStoryWithSync(storyId: string): Promise<ViewStoryResponse> {
    // First record optimistically
    await this.viewStory(storyId);

    // Wait for sync to complete with timeout
    return new Promise((resolve) => {
      const startTime = Date.now();
      const maxWait = 30000; // 30 second timeout

      const checkSync = setInterval(() => {
        const tracked = this.viewedStoriesLocal.get(storyId);

        if (tracked?.synced) {
          clearInterval(checkSync);
          resolve({
            success: true,
            message: "Story view synced",
            data: {
              uniqueViewerCount: this.getLocalViewerCount(storyId),
            },
          });
        }

        if (Date.now() - startTime > maxWait) {
          clearInterval(checkSync);
          resolve({
            success: true,
            message: "Sync timeout, saved locally",
            data: {
              uniqueViewerCount: this.getLocalViewerCount(storyId),
            },
          });
        }
      }, 500);
    });
  }

  /**
   * Fetches viewers for a specific story
   */
  async getStoryViewers(
    storyId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<GetStoryViewersResponse> {
    if (!storyId) {
      throw new StoryApiError("Story ID is required", 400);
    }

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
   * Sends a reply to a story
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
        storyData: storyData,
      });
      return response.data;
    };

    const result = await this.handleRequest(request, "replyToStory");
    return result;
  }

  /**
   * Deletes a story (owner only)
   */
  async deleteStory(storyId: string): Promise<DeleteStoryResponse> {
    if (!storyId) {
      throw new StoryApiError("Story ID is required", 400);
    }

    const request = async () => {
      const response = await api.delete(`/stories/${storyId}`);

      this.invalidateStoriesListCache();
      this.invalidateIndividualStoryCache(storyId);

      return response.data;
    };

    const result = await this.handleRequest(request, "deleteStory");
    return result;
  }

  /**
   * Triggers manual cleanup of expired stories
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
   * Force refreshes stories (bypasses cache)
   */
  async refreshStories(): Promise<GetStoriesResponse> {
    this.invalidateStoriesListCache();
    return this.getStories(1, 20, true);
  }

  /**
   * Prefetches stories in background (non-blocking)
   */
  async prefetchStories(count: number = 2): Promise<void> {
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

  // =================== UTILITY METHODS ===================

  /**
   * Checks if a user has viewed a specific story
   */
  hasUserViewedStory(story: Story, userId: string): boolean {
    if (!story.viewers || !userId) return false;
    return story.viewers.some((viewer) => viewer.userId === userId);
  }

  /**
   * Gets unique viewer count from a story object
   */
  getUniqueViewerCount(story: Story | undefined): number {
    if (!story || !story.viewers || !Array.isArray(story.viewers)) {
      return 0;
    }
    const uniqueUserIds = new Set(story.viewers.map((v) => v.userId));
    return uniqueUserIds.size;
  }

  /**
   * Formats story creation time relative to now
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
   * Gets current cache statistics (useful for debugging)
   */
  getCacheStats() {
    return {
      hasStoriesListCache: !!this.storiesListCache,
      viewersCount: this.storyViewersCache.size,
      storyCount: this.individualStoryCache.size,
      viewedLocal: this.viewedStoriesLocal.size,
      syncQueue: this.syncQueue.length,
      isSyncing: this.isSyncing,
      cacheAge: this.storiesListCache
        ? Date.now() - this.storiesListCache.timestamp
        : null,
    };
  }

  /**
   * Cleanup all resources (call on app unmount)
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
