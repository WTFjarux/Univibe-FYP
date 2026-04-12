// lib/postCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

class PostCache {
  private memoryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Get from memory cache (fastest)
   */
  getFromMemory(key: string): any | null {
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
  saveToMemory(key: string, data: any): void {
    if (this.memoryCache.size >= this.MAX_CACHE_SIZE) {
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
  async getFromStorage(key: string): Promise<any | null> {
    try {
      const storageKey = `post_${key}`;
      const cached = await AsyncStorage.getItem(storageKey);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > this.CACHE_DURATION;
      
      if (isExpired) {
        await AsyncStorage.removeItem(storageKey);
        return null;
      }
      
      // Also save to memory for faster access
      this.saveToMemory(key, data);
      return data;
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  }

  /**
   * Save to persistent storage
   */
  async saveToStorage(key: string, data: any): Promise<void> {
    try {
      const storageKey = `post_${key}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      this.saveToMemory(key, data);
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  /**
   * Clear specific cache
   */
  async clear(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await AsyncStorage.removeItem(`post_${key}`);
  }

  /**
   * Clear all post caches
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    const keys = await AsyncStorage.getAllKeys();
    const postKeys = keys.filter(key => key.startsWith('post_'));
    await AsyncStorage.multiRemove(postKeys);
  }

  /**
   * Invalidate posts list caches (for feed, profile posts, etc.)
   */
  async invalidatePostsCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const postListKeys = keys.filter(key => 
      key.startsWith('post_posts_') || 
      key.startsWith('post_feed_') ||
      key.startsWith('post_profile_posts_') ||
      key.startsWith('post_search_posts_')
    );
    await AsyncStorage.multiRemove(postListKeys);
    
    // Also clear from memory
    for (const key of postListKeys) {
      const memoryKey = key.replace('post_', '');
      this.memoryCache.delete(memoryKey);
    }
  }

  /**
   * Invalidate comments cache for a specific post
   */
  async invalidateCommentsCache(postId: string): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const commentKeys = keys.filter(key => 
      key.startsWith(`post_post_comments_${postId}`) ||
      key.startsWith(`post_comment_thread_`)
    );
    await AsyncStorage.multiRemove(commentKeys);
    
    // Also clear from memory
    for (const key of commentKeys) {
      const memoryKey = key.replace('post_', '');
      this.memoryCache.delete(memoryKey);
    }
  }
}

// Create and export a singleton instance
export const postCache = new PostCache();