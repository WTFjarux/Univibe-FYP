// backend/middleware/blockCache.js

const NodeCache = require("node-cache");
const BlockService = require("../services/blockService");

// Cache block lists for 5 minutes (300 seconds)
const blockCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Get blocked users with caching
 */
exports.getCachedBlockedUsers = async (userId) => {
  const cacheKey = `blocked_${userId}`;
  let blockedUsers = blockCache.get(cacheKey);

  if (!blockedUsers) {
    blockedUsers = await BlockService.getBlockedUserIds(userId);
    blockCache.set(cacheKey, blockedUsers);
  }

  return blockedUsers;
};

/**
 * Invalidate cache when blocks change
 */
exports.invalidateBlockCache = (userId) => {
  blockCache.del(`blocked_${userId}`);
};

/**
 * Middleware to attach cached blocked users to request
 * Usage: app.use('/api', require('./middleware/blockCache').blockCacheMiddleware)
 */
exports.blockCacheMiddleware = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      req.blockedUserIds = await exports.getCachedBlockedUsers(req.user._id);
    }
    next();
  } catch (error) {
    // If cache fails, continue without blocking (will be filtered at query level)
    next();
  }
};

// Export for direct usage
module.exports = exports;
