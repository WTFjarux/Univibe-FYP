// backend/config/redis.js
const Redis = require("ioredis");

class CacheManager {
  constructor() {
    this.client = null;
    this.memoryCache = new Map();
    this.isRedisAvailable = false;
    this.initRedis();
  }

  async initRedis() {
    try {
      // Simple connection config that matches your Redis setup
      this.client = new Redis({
        host: "127.0.0.1", 
        port: 6379,
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn(
              "⚠️ Redis connection failed after 3 attempts, falling back to in-memory cache",
            );
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        connectTimeout: 10000,
        maxRetriesPerRequest: 1,
      });

      // Test the connection
      await this.client.ping();
      this.isRedisAvailable = true;
      console.log("✅ Redis connected - Cache layer enabled");
      console.log(`   Host: 127.0.0.1:6379`);
    } catch (error) {
      console.warn("⚠️ Redis unavailable, using in-memory fallback cache");
      console.warn(`   Reason: ${error.message}`);
      this.isRedisAvailable = false;
      this.client = null;
    }
  }

  async get(key) {
    if (this.isRedisAvailable && this.client) {
      try {
        const data = await this.client.get(key);
        if (data) return JSON.parse(data);
      } catch (e) {
        console.error("Redis get error:", e.message);
      }
    }

    // Fallback to memory cache
    const memData = this.memoryCache.get(key);
    if (memData && memData.expiry > Date.now()) {
      return memData.value;
    }
    this.memoryCache.delete(key);
    return null;
  }

  async set(key, value, ttlSeconds = 60) {
    const data = JSON.stringify(value);

    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.setex(key, ttlSeconds, data);
      } catch (e) {
        console.error("Redis set error:", e.message);
      }
    }

    // Also store in memory as fallback
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async del(pattern) {
    if (this.isRedisAvailable && this.client) {
      try {
        const keys = await this.client.keys(pattern);
        if (keys.length && keys.length > 0) {
          await this.client.del(...keys);
        }
      } catch (e) {
        console.error("Redis del error:", e.message);
      }
    }

    // Clear memory cache matching pattern
    const patternStr = pattern.replace(/\*/g, "");
    for (const key of this.memoryCache.keys()) {
      if (key.includes(patternStr)) {
        this.memoryCache.delete(key);
      }
    }
  }

  async delExact(key) {
    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.del(key);
      } catch (e) {
        console.error("Redis delExact error:", e.message);
      }
    }
    this.memoryCache.delete(key);
  }

  async invalidateUserCaches(userId, roomId = null) {
    await this.del(`user_chat_rooms:${userId}`);
    await this.del(`user_unread_counts:${userId}`);
    if (roomId) {
      await this.del(`room_last_message:${roomId}`);
      await this.del(`room_messages:${roomId}:*`);
    }
  }

  async flushAll() {
    if (this.isRedisAvailable && this.client) {
      try {
        await this.client.flushall();
        console.log("✅ Redis cache flushed");
      } catch (e) {
        console.error("Redis flush error:", e.message);
      }
    }
    this.memoryCache.clear();
  }
}

module.exports = new CacheManager();
