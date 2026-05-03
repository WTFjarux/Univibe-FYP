// lib/cache/postCache.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

class PostCache {
  private memoryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 50;

  /**
   * Get from memory cache
   */
  getFromMemory(key: string): any | null {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Save to memory cache
   */
  saveToMemory(key: string, data: any): void {
    if (this.memoryCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Get from persistent storage
   */
  async getFromStorage(key: string): Promise<any | null> {
    try {
      const storageKey = `post_cache_${key}`;
      const cached = await AsyncStorage.getItem(storageKey);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > this.CACHE_DURATION) {
        await AsyncStorage.removeItem(storageKey);
        return null;
      }

      this.saveToMemory(key, data);
      return data;
    } catch (error) {
      console.error("Post cache read error:", error);
      return null;
    }
  }

  /**
   * Save to persistent storage
   */
  async saveToStorage(key: string, data: any): Promise<void> {
    try {
      const storageKey = `post_cache_${key}`;
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        }),
      );
      this.saveToMemory(key, data);
    } catch (error) {
      console.error("Post cache save error:", error);
    }
  }

  /**
   * Clear a specific cached item
   */
  async clear(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(`post_cache_${key}`);
    } catch (error) {
      console.error("Post cache clear error:", error);
    }
  }

  /**
   * Invalidate caches related to a specific post
   */
  async invalidatePost(postId: string): Promise<void> {
    // Clear from memory
    this.memoryCache.delete(`post_${postId}`);
    this.memoryCache.delete(`post_comments_${postId}`);

    // Clear from storage
    try {
      const keys = await AsyncStorage.getAllKeys();
      const relatedKeys = keys.filter(
        (key) => key.includes(postId) && key.startsWith("post_cache_"),
      );
      if (relatedKeys.length > 0) {
        await AsyncStorage.multiRemove(relatedKeys);
      }
    } catch (error) {
      console.error("Post cache invalidation error:", error);
    }
  }

  /**
   * Clear all post caches (not feed caches)
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const postKeys = keys.filter((key) => key.startsWith("post_cache_"));
      if (postKeys.length > 0) {
        await AsyncStorage.multiRemove(postKeys);
      }
    } catch (error) {
      console.error("Post cache clear all error:", error);
    }
  }
}

export const postCache = new PostCache();
