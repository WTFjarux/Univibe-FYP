// backend/controllers/feedController.js
const Post = require("../models/Post");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Comment = require("../models/Comment");

/**
 * Get Campus Feed (Default/ALL Feed)
 *
 * Shows:
 * - All campus visibility posts from same campus
 * - All anonymous posts
 * - Connections posts ONLY from connected users
 * - Owner's own posts (regardless of visibility)
 */
exports.getCampusFeed = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const currentUserId = req.user._id;

    // Fetch user data
    const [currentUser, userProfile] = await Promise.all([
      User.findById(currentUserId).select("connections").lean(),
      Profile.findOne({ user: currentUserId }).select("campus").lean(),
    ]);

    if (!userProfile) {
      return res.status(400).json({
        success: false,
        error: "Profile not found. Please complete your profile setup.",
      });
    }

    const connectionIds = currentUser?.connections || [];
    const userCampus = userProfile.campus;

    // Build query for campus feed
    const query = {
      isDeleted: false,
      $or: [
        // 1. Campus visibility posts from same campus (includes connected users' campus posts)
        { visibility: "campus", campus: userCampus },
        // 2. Anonymous posts (visible to all)
        { isAnonymous: true },
        // 3. Connections posts from connected users (regardless of campus)
        {
          visibility: "connections",
          user: { $in: connectionIds },
        },
        // 4. User's own posts (always visible to themselves)
        { user: currentUserId },
      ],
    };

    // Apply cursor for pagination
    if (cursor) {
      const cursorPost = await Post.findById(cursor).select("createdAt").lean();

      if (!cursorPost) {
        return res.status(400).json({
          success: false,
          error: "Invalid cursor. Post not found.",
        });
      }

      query.$and = [
        {
          $or: [
            { createdAt: { $lt: cursorPost.createdAt } },
            { createdAt: cursorPost.createdAt, _id: { $lt: cursor } },
          ],
        },
      ];
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(parseInt(limit) + 1)
      .populate("user", "name username email verified")
      .populate("likes", "name username")
      .lean();

    const hasMore = posts.length > limit;
    const paginatedPosts = hasMore ? posts.slice(0, limit) : posts;

    const [profilePictures, commentCounts] = await Promise.all([
      batchGetProfilePictures(paginatedPosts),
      batchGetCommentCounts(paginatedPosts),
    ]);

    const processedPosts = processPosts(paginatedPosts, {
      profilePictures,
      commentCounts,
      currentUserId,
      userConnections: connectionIds,
    });

    res.json({
      success: true,
      posts: processedPosts,
      pagination: {
        hasMore,
        nextCursor: hasMore
          ? paginatedPosts[paginatedPosts.length - 1]._id
          : null,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get campus feed error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch campus feed",
    });
  }
};

/**
 * Get Connections Feed
 *
 * Shows ONLY:
 * - Posts from connected users (both campus and connections visibility)
 * - EXCLUDES anonymous posts
 */
exports.getConnectionsFeed = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const currentUserId = req.user._id;

    // Get user's connections
    const currentUser = await User.findById(currentUserId)
      .select("connections")
      .lean();

    const connectionIds = currentUser?.connections || [];

    // Return empty if no connections
    if (connectionIds.length === 0) {
      return res.json({
        success: true,
        posts: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
          limit: parseInt(limit),
        },
      });
    }

    // Build query - connections feed shows all non-anonymous posts from connected users
    const query = {
      isDeleted: false,
      isAnonymous: false, // Exclude anonymous posts
      user: { $in: connectionIds }, // Only from connected users
      // Include both campus and connections visibility posts
      $or: [{ visibility: "campus" }, { visibility: "connections" }],
    };

    // Apply cursor for pagination
    if (cursor) {
      const cursorPost = await Post.findById(cursor).select("createdAt").lean();

      if (!cursorPost) {
        return res.status(400).json({
          success: false,
          error: "Invalid cursor",
        });
      }

      query.$and = [
        {
          $or: [
            { createdAt: { $lt: cursorPost.createdAt } },
            { createdAt: cursorPost.createdAt, _id: { $lt: cursor } },
          ],
        },
      ];
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(parseInt(limit) + 1)
      .populate("user", "name username email verified")
      .populate("likes", "name username")
      .lean();

    const hasMore = posts.length > limit;
    const paginatedPosts = hasMore ? posts.slice(0, limit) : posts;

    const [profilePictures, commentCounts] = await Promise.all([
      batchGetProfilePictures(paginatedPosts),
      batchGetCommentCounts(paginatedPosts),
    ]);

    const processedPosts = processPosts(paginatedPosts, {
      profilePictures,
      commentCounts,
      currentUserId,
      userConnections: connectionIds,
    });

    res.json({
      success: true,
      posts: processedPosts,
      pagination: {
        hasMore,
        nextCursor: hasMore
          ? paginatedPosts[paginatedPosts.length - 1]._id
          : null,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get connections feed error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch connections feed",
    });
  }
};

/**
 * Get Anonymous Feed
 * Only posts marked as anonymous
 */
exports.getAnonymousFeed = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const currentUserId = req.user._id;

    const query = {
      isAnonymous: true,
      isDeleted: false,
    };

    if (cursor) {
      const cursorPost = await Post.findById(cursor).select("createdAt").lean();

      if (!cursorPost) {
        return res.status(400).json({
          success: false,
          error: "Invalid cursor",
        });
      }

      query.$or = [
        { createdAt: { $lt: cursorPost.createdAt } },
        { createdAt: cursorPost.createdAt, _id: { $lt: cursor } },
      ];
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(parseInt(limit) + 1)
      .populate("user", "name username email verified")
      .populate("likes", "name username")
      .lean();

    const hasMore = posts.length > limit;
    const paginatedPosts = hasMore ? posts.slice(0, limit) : posts;

    const [profilePictures, commentCounts] = await Promise.all([
      batchGetProfilePictures(paginatedPosts),
      batchGetCommentCounts(paginatedPosts),
    ]);

    // Force anonymous for all posts in this feed
    const processedPosts = processPosts(paginatedPosts, {
      profilePictures,
      commentCounts,
      currentUserId,
      userConnections: [],
      forceAnonymous: true,
    });

    res.json({
      success: true,
      posts: processedPosts,
      pagination: {
        hasMore,
        nextCursor: hasMore
          ? paginatedPosts[paginatedPosts.length - 1]._id
          : null,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get anonymous feed error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch anonymous feed",
    });
  }
};

// ===================== HELPER FUNCTIONS =====================

async function batchGetProfilePictures(posts) {
  const userIds = [
    ...new Set(
      posts
        .filter((post) => !post.isAnonymous && post.user?._id)
        .map((post) => post.user._id.toString()),
    ),
  ];

  if (userIds.length === 0) return {};

  const profiles = await Profile.find({ user: { $in: userIds } })
    .select("user profilePicture")
    .lean();

  const profileMap = {};
  profiles.forEach((profile) => {
    if (profile.user) {
      profileMap[profile.user.toString()] = profile.profilePicture || null;
    }
  });

  return profileMap;
}

async function batchGetCommentCounts(posts) {
  const postIds = posts.map((post) => post._id);

  const counts = await Comment.aggregate([
    { $match: { post: { $in: postIds }, isDeleted: false } },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  counts.forEach((item) => {
    countMap[item._id.toString()] = item.count;
  });

  return countMap;
}

function processPosts(
  posts,
  {
    profilePictures,
    commentCounts,
    currentUserId,
    userConnections,
    forceAnonymous = false,
  },
) {
  const currentUserIdStr = currentUserId.toString();
  const connectionIdSet = new Set(userConnections.map((id) => id.toString()));

  return posts
    .map((post) => {
      const postUserId = post.user?._id?.toString();
      const isOwner = postUserId === currentUserIdStr;
      const isConnected = connectionIdSet.has(postUserId);
      const shouldAnonymize = post.isAnonymous || forceAnonymous;

      let canView = true;

      // Connection posts only visible to connected users or the owner
      if (post.visibility === "connections" && !isConnected && !isOwner) {
        canView = false;
      }

      if (post.isDeleted) {
        canView = false;
      }

      const isLiked =
        post.likes?.some((like) => like._id?.toString() === currentUserIdStr) ||
        false;

      return {
        _id: post._id,
        content: post.content,
        visibility: post.visibility,
        isAnonymous: post.isAnonymous,
        campus: post.campus,
        images: post.images || [],
        tags: post.tags || [],
        likeCount: post.likes?.length || 0,
        commentCount: commentCounts[post._id.toString()] || 0,
        isEdited: post.isEdited || false,
        editedAt: post.editedAt || null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        isLiked,
        canView,
        isOwner,
        user: shouldAnonymize
          ? {
              _id: null,
              name: "Anonymous",
              username: "anonymous",
              email: null,
              verified: false,
              profilePicture: null,
            }
          : {
              _id: post.user._id,
              name: post.user.name,
              username: post.user.username,
              email: post.user.email,
              verified: post.user.verified,
              profilePicture: profilePictures[postUserId] || null,
            },
      };
    })
    .filter((post) => post.canView);
}

module.exports = exports;
