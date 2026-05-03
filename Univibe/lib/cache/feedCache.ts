// lib/cache/feedCache.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

class FeedCache {
  private memoryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (feed updates frequently)
  private readonly MAX_MEMORY_SIZE = 50;

  /**
   * Generate cache key for feed
   */
  private getKey(feedType: string, cursor: string | null): string {
    return `feed_${feedType}_${cursor || "initial"}`;
  }

  /**
   * Get from memory cache
   */
  getFromMemory(feedType: string, cursor: string | null): any | null {
    const key = this.getKey(feedType, cursor);
    const cached = this.memoryCache.get(key);

    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Save to memory cache
   */
  saveToMemory(feedType: string, cursor: string | null, data: any): void {
    const key = this.getKey(feedType, cursor);

    // Evict oldest if at max size
    if (this.memoryCache.size >= this.MAX_MEMORY_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Get from persistent storage
   */
  async getFromStorage(
    feedType: string,
    cursor: string | null,
  ): Promise<any | null> {
    try {
      const key = this.getKey(feedType, cursor);
      const storageKey = `feed_cache_${key}`;
      const cached = await AsyncStorage.getItem(storageKey);

      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > this.CACHE_DURATION;

      if (isExpired) {
        await AsyncStorage.removeItem(storageKey);
        return null;
      }

      // Promote to memory cache
      this.saveToMemory(feedType, cursor, data);
      return data;
    } catch (error) {
      console.error("Feed cache storage read error:", error);
      return null;
    }
  }

  /**
   * Save to persistent storage
   */
  async saveToStorage(
    feedType: string,
    cursor: string | null,
    data: any,
  ): Promise<void> {
    try {
      const key = this.getKey(feedType, cursor);
      const storageKey = `feed_cache_${key}`;

      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        }),
      );

      // Also save to memory
      this.saveToMemory(feedType, cursor, data);
    } catch (error) {
      console.error("Feed cache storage save error:", error);
    }
  }

  /**
   * Invalidate all caches for a specific feed type
   */
  async invalidateFeed(feedType: string): Promise<void> {
    // Clear from memory
    const memoryKeysToDelete: string[] = [];
    this.memoryCache.forEach((_, key) => {
      if (key.startsWith(`feed_${feedType}_`)) {
        memoryKeysToDelete.push(key);
      }
    });
    memoryKeysToDelete.forEach((key) => this.memoryCache.delete(key));

    // Clear from storage
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const feedKeys = allKeys.filter((key) =>
        key.startsWith(`feed_cache_feed_${feedType}_`),
      );
      if (feedKeys.length > 0) {
        await AsyncStorage.multiRemove(feedKeys);
      }
    } catch (error) {
      console.error("Feed cache invalidation error:", error);
    }
  }

  /**
   * Invalidate all feed caches (all types)
   */
  async invalidateAll(): Promise<void> {
    // Clear memory
    this.memoryCache.clear();

    // Clear storage
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const feedKeys = allKeys.filter((key) => key.startsWith("feed_cache_"));
      if (feedKeys.length > 0) {
        await AsyncStorage.multiRemove(feedKeys);
      }
    } catch (error) {
      console.error("Feed cache clear all error:", error);
    }
  }

  /**
   * Clear everything
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const feedKeys = allKeys.filter(
        (key) => key.startsWith("feed_cache_") || key.startsWith("post_"),
      );
      if (feedKeys.length > 0) {
        await AsyncStorage.multiRemove(feedKeys);
      }
    } catch (error) {
      console.error("Cache clear all error:", error);
    }
  }
}

export const feedCache = new FeedCache();
