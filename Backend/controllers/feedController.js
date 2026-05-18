// backend/controllers/feedController.js
const Post = require("../models/Post");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Comment = require("../models/Comment");
const BlockService = require("../services/blockService");
const { getAdminModel } = require("../config/database");

/**
 * Get Campus Feed (Default/ALL Feed)
 */
exports.getCampusFeed = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const currentUserId = req.user._id;

    const [currentUser, userProfile, blockedUserIds] = await Promise.all([
      User.findById(currentUserId)
        .select("connections mutedUsers hiddenPosts savedPosts")
        .lean(),
      Profile.findOne({ user: currentUserId }).select("campus").lean(),
      BlockService.getBlockedUserIds(currentUserId),
    ]);

    if (!userProfile) {
      return res.status(400).json({
        success: false,
        error: "Profile not found. Please complete your profile setup.",
      });
    }

    const connectionIds = currentUser?.connections || [];
    const mutedUserIds =
      currentUser?.mutedUsers?.map((id) => id.toString()) || [];
    const hiddenPostIds =
      currentUser?.hiddenPosts?.map((id) => id.toString()) || [];
    const savedPostIds =
      currentUser?.savedPosts?.map((id) => id.toString()) || [];
    const userCampus = userProfile.campus;

    const excludedUserIds = [...new Set([...mutedUserIds, ...blockedUserIds])];

    const query = {
      isDeleted: false,
      user: { $nin: excludedUserIds },
      _id: { $nin: hiddenPostIds },
      $or: [
        { visibility: "campus", campus: userCampus },
        { isAnonymous: true },
        { visibility: "connections", user: { $in: connectionIds } },
        { user: currentUserId },
      ],
    };

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

    const [profilePictures, commentCounts, userReports] = await Promise.all([
      batchGetProfilePictures(paginatedPosts),
      batchGetCommentCounts(paginatedPosts),
      getAdminModel("Report")
        .find({
          reportedBy: currentUserId,
          targetType: "Post",
          targetId: { $in: paginatedPosts.map((p) => p._id) },
          status: { $in: ["pending", "reviewing"] },
        })
        .lean(),
    ]);

    const reportedPostIds = new Set(
      userReports.map((r) => r.targetId.toString()),
    );

    const processedPosts = processPosts(paginatedPosts, {
      profilePictures,
      commentCounts,
      currentUserId,
      userConnections: connectionIds,
      savedPostIds,
      reportedPostIds,
      forceAnonymous: false,
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
 */
exports.getConnectionsFeed = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const currentUserId = req.user._id;

    const [currentUser, blockedUserIds] = await Promise.all([
      User.findById(currentUserId)
        .select("connections mutedUsers hiddenPosts savedPosts")
        .lean(),
      BlockService.getBlockedUserIds(currentUserId),
    ]);

    const connectionIds = currentUser?.connections || [];
    const mutedUserIds =
      currentUser?.mutedUsers?.map((id) => id.toString()) || [];
    const hiddenPostIds =
      currentUser?.hiddenPosts?.map((id) => id.toString()) || [];
    const savedPostIds =
      currentUser?.savedPosts?.map((id) => id.toString()) || [];

    const excludedUserIds = [...new Set([...mutedUserIds, ...blockedUserIds])];

    const validConnectionIds = connectionIds.filter(
      (id) => !excludedUserIds.includes(id.toString()),
    );

    if (validConnectionIds.length === 0) {
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

    const query = {
      isDeleted: false,
      isAnonymous: false,
      user: { $in: validConnectionIds },
      _id: { $nin: hiddenPostIds },
      $or: [{ visibility: "campus" }, { visibility: "connections" }],
    };

    if (cursor) {
      const cursorPost = await Post.findById(cursor).select("createdAt").lean();
      if (!cursorPost) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid cursor" });
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

    const [profilePictures, commentCounts, userReports] = await Promise.all([
      batchGetProfilePictures(paginatedPosts),
      batchGetCommentCounts(paginatedPosts),
      getAdminModel("Report")
        .find({
          reportedBy: currentUserId,
          targetType: "Post",
          targetId: { $in: paginatedPosts.map((p) => p._id) },
          status: { $in: ["pending", "reviewing"] },
        })
        .lean(),
    ]);

    const reportedPostIds = new Set(
      userReports.map((r) => r.targetId.toString()),
    );

    const processedPosts = processPosts(paginatedPosts, {
      profilePictures,
      commentCounts,
      currentUserId,
      userConnections: connectionIds,
      savedPostIds,
      reportedPostIds,
      forceAnonymous: false,
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
 */
exports.getAnonymousFeed = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const currentUserId = req.user._id;

    const [currentUser, blockedUserIds] = await Promise.all([
      User.findById(currentUserId).select("hiddenPosts savedPosts").lean(),
      BlockService.getBlockedUserIds(currentUserId),
    ]);

    const hiddenPostIds =
      currentUser?.hiddenPosts?.map((id) => id.toString()) || [];
    const savedPostIds =
      currentUser?.savedPosts?.map((id) => id.toString()) || [];

    const query = {
      isAnonymous: true,
      isDeleted: false,
      _id: { $nin: hiddenPostIds },
      user: { $nin: blockedUserIds },
    };

    if (cursor) {
      const cursorPost = await Post.findById(cursor).select("createdAt").lean();
      if (!cursorPost) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid cursor" });
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

    const [profilePictures, commentCounts, userReports] = await Promise.all([
      batchGetProfilePictures(paginatedPosts),
      batchGetCommentCounts(paginatedPosts),
      getAdminModel("Report")
        .find({
          reportedBy: currentUserId,
          targetType: "Post",
          targetId: { $in: paginatedPosts.map((p) => p._id) },
          status: { $in: ["pending", "reviewing"] },
        })
        .lean(),
    ]);

    const reportedPostIds = new Set(
      userReports.map((r) => r.targetId.toString()),
    );

    const processedPosts = processPosts(paginatedPosts, {
      profilePictures,
      commentCounts,
      currentUserId,
      userConnections: [],
      savedPostIds,
      reportedPostIds,
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
    savedPostIds = [],
    reportedPostIds = new Set(),
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

      if (post.visibility === "connections" && !isConnected && !isOwner) {
        canView = false;
      }

      if (post.isDeleted) {
        canView = false;
      }

      const isLiked =
        post.likes?.some((like) => like._id?.toString() === currentUserIdStr) ||
        false;

      const isSaved = savedPostIds.includes(post._id.toString());

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
        isSaved,
        isReported: reportedPostIds.has(post._id.toString()),
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
