// backend/middleware/blockMiddleware.js
const BlockService = require("../services/blockService");

/**
 * Middleware to filter out blocked users from queries
 */
exports.filterBlockedUsers = async (req, res, next) => {
  try {
    if (!req.user) return next();

    // Get all blocked user IDs for current user
    req.blockedUserIds = await BlockService.getBlockedUserIds(req.user._id);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if target user is blocked
 * Attach to routes with :userId parameter
 */
exports.checkBlockStatus = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId || req.body.userId;

    if (!targetUserId || currentUserId.toString() === targetUserId.toString()) {
      return next();
    }

    const isBlocked = await BlockService.areUsersBlocked(
      currentUserId,
      targetUserId,
    );

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "This action cannot be performed due to block restrictions",
        isBlocked: true,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to prevent interactions with blocked users
 */
exports.preventBlockedInteractions = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    let targetUserId;

    // Extract target user ID from various possible locations
    if (req.params.userId) targetUserId = req.params.userId;
    else if (req.body.userId) targetUserId = req.body.userId;
    else if (req.body.recipientId) targetUserId = req.body.recipientId;
    else if (req.params.postId) {
      // For post interactions, check post author
      const Post = require("../models/Post");
      const post = await Post.findById(req.params.postId).select("user");
      if (post) targetUserId = post.user;
    }

    if (!targetUserId || currentUserId.toString() === targetUserId.toString()) {
      return next();
    }

    const isBlocked = await BlockService.areUsersBlocked(
      currentUserId,
      targetUserId,
    );

    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Cannot interact with blocked users",
        isBlocked: true,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * MongoDB aggregation pipeline stage for filtering blocked users
 */
exports.blockFilterPipeline = (userId) => ({
  $match: {
    user: { $nin: userId.blockedUserIds || [] },
    "user.blockedUsers": { $nin: [userId] },
  },
});

/**
 * Generate blocked user filter for queries
 */
exports.getBlockedUserFilter = async (userId) => {
  const blockedIds = await BlockService.getBlockedUserIds(userId);
  return {
    user: { $nin: blockedIds },
    isAnonymous: false, // Anonymous posts from blocked users should also be hidden
  };
};
