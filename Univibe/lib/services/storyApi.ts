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

  private readonly STORIES_LIST_CACHE_DURATION = 60000;
  private readonly STORY_VIEWERS_CACHE_DURATION = 120000;
  private readonly INDIVIDUAL_STORY_CACHE_DURATION = 300000;
  private readonly MAX_CACHE_SIZE = 100;

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private readonly SYNC_INTERVAL = 5000;

  private syncIntervalRef: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startBackgroundSync();
  }

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

        const tracked = this.viewedStoriesLocal.get(pending.storyId);
        if (tracked) {
          tracked.synced = true;
        }

        this.syncQueue.shift();
        console.log(`✅ Synced view for story: ${pending.storyId}`);
      } catch (err) {
        const error = err as any;
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
          pending.timestamp = Date.now();
          console.log(`🔄 Will retry story sync (attempt ${pending.retries})`);
          break;
        }
      }
    }

    this.isSyncing = false;
  }

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

  cancelRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

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

  private updateCacheWithViewedStories(
    response: GetStoriesResponse,
  ): GetStoriesResponse {
    const updated = JSON.parse(JSON.stringify(response));

    updated.data.forEach((group: StoryGroup) => {
      group.stories.forEach((story: Story) => {
        const viewed = this.viewedStoriesLocal.get(story._id);
        if (viewed) {
          story.hasCurrentUserViewed = true;
          story.uniqueViewersCount = (story.uniqueViewersCount || 0) + 1;
        }
      });
    });

    return updated;
  }

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

      this.invalidateStoriesListCache();

      return response.data;
    };

    const result = await this.handleRequest(request, "createStory");
    return result;
  }

  async viewStory(storyId: string): Promise<ViewStoryResponse> {
    if (!storyId) {
      throw new StoryApiError("Story ID is required", 400);
    }

    const tracked = this.viewedStoriesLocal.get(storyId);
    if (!tracked) {
      this.viewedStoriesLocal.set(storyId, {
        storyId,
        viewedAt: Date.now(),
        synced: false,
      });
    }

    if (!tracked?.synced) {
      this.syncQueue.push({
        storyId,
        timestamp: Date.now(),
        retries: 0,
      });
    }

    this.processSyncQueue().catch(console.error);

    return {
      success: true,
      message: "Story view recorded",
      data: { uniqueViewerCount: 0 },
    };
  }

  private async viewStoryInternal(storyId: string): Promise<ViewStoryResponse> {
    const request = async () => {
      const response = await api.post(`/stories/${storyId}/view`);
      return response.data;
    };

    return this.handleRequest(request, `viewStory-${storyId}`);
  }

  async viewStoryWithSync(storyId: string): Promise<ViewStoryResponse> {
    await this.viewStory(storyId);

    return new Promise((resolve) => {
      const checkSync = setInterval(() => {
        const tracked = this.viewedStoriesLocal.get(storyId);
        if (tracked?.synced) {
          clearInterval(checkSync);
          resolve({ success: true, message: "Story view synced" });
        }
        if (Date.now() - (tracked?.viewedAt || Date.now()) > 30000) {
          clearInterval(checkSync);
          resolve({ success: true, message: "Sync timeout, saved locally" });
        }
      }, 500);
    });
  }

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

  async cleanupExpiredStories(): Promise<CleanupStoriesResponse> {
    const request = async () => {
      const response = await api.get("/stories/expired/cleanup");
      this.invalidateStoriesListCache();
      return response.data;
    };

    const result = await this.handleRequest(request, "cleanupExpiredStories");
    return result;
  }

  async refreshStories(): Promise<GetStoriesResponse> {
    this.invalidateStoriesListCache();
    return this.getStories(1, 20, true);
  }

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

  hasUserViewedStory(story: Story, userId: string): boolean {
    if (!story.viewers || !userId) return false;
    return story.viewers.some((viewer) => viewer.userId === userId);
  }

  getUniqueViewerCount(story: Story | undefined): number {
    if (!story || !story.viewers || !Array.isArray(story.viewers)) {
      return 0;
    }
    const uniqueUserIds = new Set(story.viewers.map((v) => v.userId));
    return uniqueUserIds.size;
  }

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
