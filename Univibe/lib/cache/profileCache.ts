// lib/profileCache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

class ProfileCache {
  private memoryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 50;

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
      const cached = await AsyncStorage.getItem(`profile_${key}`);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > this.CACHE_DURATION;
      
      if (isExpired) {
        await AsyncStorage.removeItem(`profile_${key}`);
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
      await AsyncStorage.setItem(`profile_${key}`, JSON.stringify({
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
    await AsyncStorage.removeItem(`profile_${key}`);
  }

  /**
   * Clear all profile caches
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    const keys = await AsyncStorage.getAllKeys();
    const profileKeys = keys.filter(key => key.startsWith('profile_'));
    await AsyncStorage.multiRemove(profileKeys);
    console.log('All profile caches cleared');
  }

  /**
   * Invalidate profile cache for a user
   */
  async invalidateUserProfile(userId?: string): Promise<void> {
    await this.clear('my_profile');
    if (userId) {
      await this.clear(`public_profile_${userId}`);
    }
  }
}

export const profileCache = new ProfileCache();