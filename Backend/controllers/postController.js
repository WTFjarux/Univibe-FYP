// Backend/controllers/postController.js
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const Profile = require("../models/Profile");
const {
  getPostImageRelativePath,
  deletePostImages,
} = require("../middleware/uploadPostMiddleware");

// ===================== HELPER FUNCTIONS =====================

/**
 * Extract hashtags from post content
 */
function extractHashtags(content) {
  const hashtagRegex = /#(\w+)/g;
  const matches = content.match(hashtagRegex);
  return matches ? matches.map((tag) => tag.substring(1)) : [];
}

/**
 * Extract mentions from post content
 */
function extractMentions(content) {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex);
  return matches ? matches.map((mention) => mention.substring(1)) : [];
}

// ===================== POST CRUD OPERATIONS =====================

/**
 * Create a new post
 */
exports.createPost = async (req, res) => {
  try {
    const { content, tags, visibility, isAnonymous } = req.body;
    const userId = req.user._id;

    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Profile not found. Please complete your profile setup first.",
      });
    }

    const extractedTags = extractHashtags(content);
    const allTags = [...new Set([...(tags || []), ...extractedTags])];

    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        images.push({
          filename: file.filename,
          url: getPostImageRelativePath(req, file.filename),
          path: file.path,
          mimetype: file.mimetype,
          size: file.size,
        });
      });
    }

    const post = new Post({
      user: userId,
      content,
      images,
      tags: allTags,
      campus: profile.campus || "Unknown Campus",
      visibility: visibility || "campus",
      isAnonymous: isAnonymous === "true" || isAnonymous === true,
      commentCount: 0,
    });

    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate("user", "name username email verified")
      .lean();

    const userProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    populatedPost.user.profilePicture = userProfile?.profilePicture || null;
    populatedPost.isAnonymous = post.isAnonymous;

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: populatedPost,
    });
  } catch (error) {
    console.error("Create post error:", error);

    if (req.files && req.files.length > 0) {
      const filenames = req.files.map((file) => file.filename);
      deletePostImages(req.user._id.toString(), filenames);
    }

    res.status(500).json({
      success: false,
      error: "Failed to create post",
    });
  }
};

/**
 * Delete a post
 */
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete this post",
      });
    }

    await Comment.deleteMany({ post: post._id });

    if (post.images && post.images.length > 0) {
      const filenames = post.images.map((img) => img.filename);
      deletePostImages(req.user._id.toString(), filenames);
    }

    await post.deleteOne();

    res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete post",
    });
  }
};

/**
 * Update a post
 */
exports.updatePost = async (req, res) => {
  try {
    const { content, removeImages, visibility, isAnonymous } = req.body;
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this post",
      });
    }

    // Remove specified images
    if (removeImages && Array.isArray(removeImages)) {
      const imagesToRemove = post.images.filter(
        (img) =>
          removeImages.includes(img.filename) || removeImages.includes(img.url),
      );

      const filenames = imagesToRemove.map((img) => img.filename);
      deletePostImages(userId.toString(), filenames);

      post.images = post.images.filter(
        (img) =>
          !removeImages.includes(img.filename) &&
          !removeImages.includes(img.url),
      );
    }

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => ({
        filename: file.filename,
        url: getPostImageRelativePath(req, file.filename),
        path: file.path,
        mimetype: file.mimetype,
        size: file.size,
      }));

      if (post.images.length + newImages.length > 4) {
        const filenames = req.files.map((file) => file.filename);
        deletePostImages(userId.toString(), filenames);
        return res.status(400).json({
          success: false,
          error: "Maximum 4 images allowed per post",
        });
      }

      post.images.push(...newImages);
    }

    // Update fields
    if (content !== undefined) {
      post.content = content;
      post.tags = extractHashtags(content);
    }

    if (visibility !== undefined) {
      if (!["campus", "connections"].includes(visibility)) {
        return res.status(400).json({
          success: false,
          error: "Visibility must be either 'campus' or 'connections'",
        });
      }
      post.visibility = visibility;
    }

    if (isAnonymous !== undefined) {
      post.isAnonymous = isAnonymous === "true" || isAnonymous === true;
    }

    post.isEdited = true;
    post.editedAt = new Date();
    await post.save();

    const updatedPost = await Post.findById(postId)
      .populate("user", "name username email verified")
      .lean();

    const userProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();
    updatedPost.user.profilePicture = userProfile?.profilePicture || null;
    updatedPost.commentCount = await Comment.countDocuments({
      post: postId,
      isDeleted: false,
    });

    res.json({
      success: true,
      message: "Post updated successfully",
      post: updatedPost,
    });
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update post",
    });
  }
};

// ===================== POST RETRIEVAL =====================

/**
 * Get posts with connection-based visibility and filters
 */
exports.getPosts = async (req, res) => {
  try {
    const { filter = "all", page = 1, limit = 20, userId } = req.query;
    const skip = (page - 1) * limit;
    const currentUserId = req.user._id;

    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

    const currentUser = await User.findById(currentUserId);
    const connectionIds = currentUser?.connections || [];

    // Visibility rules: user can see own posts, campus posts, connection posts, and anonymous posts
    const visibilityConditions = [
      { user: currentUserId },
      { visibility: "campus", campus: currentUserCampus },
      { visibility: "connections", user: { $in: connectionIds } },
      { isAnonymous: true },
    ];

    // Filter-specific conditions
    let filterConditions = [];

    switch (filter) {
      case "connections":
        filterConditions = [{ user: { $in: connectionIds } }];
        break;
      case "campus":
        filterConditions = [
          { campus: currentUserCampus },
          { isAnonymous: true },
        ];
        break;
      case "anonymous":
        filterConditions = [{ isAnonymous: true }];
        break;
      case "user":
        if (userId) filterConditions = [{ user: userId }];
        break;
      default:
        break;
    }

    const finalQuery = filterConditions.length
      ? { $and: [{ $or: filterConditions }, { $or: visibilityConditions }] }
      : { $or: visibilityConditions };

    const posts = await Post.find(finalQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "name username email verified")
      .populate("likes", "name username")
      .lean();

    // Get profile pictures
    const userIds = posts
      .filter((post) => !post.isAnonymous && post.user?._id)
      .map((post) => post.user._id);

    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    // Get comment counts
    const postIds = posts.map((post) => post._id);
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds }, isDeleted: false } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    const commentCountMap = {};
    commentCounts.forEach((item) => {
      commentCountMap[item._id.toString()] = item.count;
    });

    // Process posts
    posts.forEach((post) => {
      if (!post.isAnonymous && post.user && post.user._id) {
        post.user.profilePicture =
          profilePictureMap[post.user._id.toString()] || null;
      }

      post.isLiked =
        post.likes?.some(
          (like) => like._id.toString() === currentUserId.toString(),
        ) || false;

      post.commentCount = commentCountMap[post._id.toString()] || 0;

      if (post.isAnonymous) {
        post.originalUser = post.user;
        post.user = {
          _id: null,
          name: "Anonymous",
          username: "anonymous",
          email: null,
          verified: false,
          profilePicture: null,
        };
      }
    });

    const total = await Post.countDocuments(finalQuery);

    res.json({
      success: true,
      posts,
      currentCampus: currentUserCampus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch posts",
    });
  }
};

/**
 * Get posts for a user's profile based on viewer's connection status
 * - Connected: Show all non-anonymous posts
 * - Not connected: Show only campus visibility posts
 */
exports.getProfilePosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const isOwnProfile = currentUserId.toString() === userId;

    const profileOwner = await User.findById(userId);
    if (!profileOwner) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profileOwnerProfile = await Profile.findOne({ user: userId });
    const profileOwnerCampus = profileOwnerProfile?.campus || "Unknown Campus";

    let isConnected = false;
    if (!isOwnProfile) {
      const currentUser = await User.findById(currentUserId);
      isConnected = currentUser?.connections?.includes(userId) || false;
    }

    // Build query based on connection status
    let query = {
      user: userId,
      isAnonymous: false,
      isDeleted: { $ne: true },
    };

    if (!isOwnProfile && !isConnected) {
      query.visibility = "campus";
      query.campus = profileOwnerCampus;
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "name username email verified")
      .populate("likes", "name username")
      .lean();

    const total = await Post.countDocuments(query);

    // Get profile pictures
    const userIds = posts.map((post) => post.user._id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    // Get comment counts
    const postIds = posts.map((post) => post._id);
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds }, isDeleted: false } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    const commentCountMap = {};
    commentCounts.forEach((item) => {
      commentCountMap[item._id.toString()] = item.count;
    });

    const processedPosts = posts.map((post) => ({
      ...post,
      user: {
        ...post.user,
        profilePicture: profilePictureMap[post.user._id.toString()] || null,
      },
      commentCount: commentCountMap[post._id.toString()] || 0,
      isLiked:
        post.likes?.some(
          (like) => like._id.toString() === currentUserId.toString(),
        ) || false,
    }));

    res.status(200).json({
      success: true,
      data: {
        posts: processedPosts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
        viewerStatus: { isOwnProfile, isConnected },
      },
    });
  } catch (error) {
    console.error("Get profile posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile posts",
    });
  }
};

/**
 * Get single post by ID
 */
exports.getPostById = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const postId = req.params.id;

    const currentUser = await User.findById(currentUserId);
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";
    const connectionIds = currentUser?.connections || [];

    const post = await Post.findById(postId)
      .populate("user", "name username email verified")
      .populate("likes", "name username")
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    // Check permission to view
    const canViewPost =
      post.user._id.toString() === currentUserId.toString() ||
      (post.visibility === "campus" && post.campus === currentUserCampus) ||
      (post.visibility === "connections" &&
        connectionIds.includes(post.user._id.toString())) ||
      post.isAnonymous;

    if (!canViewPost) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to view this post",
      });
    }

    if (!post.isAnonymous) {
      const authorProfile = await Profile.findOne({ user: post.user._id })
        .select("profilePicture")
        .lean();
      post.user.profilePicture = authorProfile?.profilePicture || null;
    }

    post.commentCount = await Comment.countDocuments({
      post: postId,
      isDeleted: false,
    });

    const recentComments = await Comment.find({
      post: postId,
      isDeleted: false,
      parentComment: null,
    })
      .populate("user", "name username")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    const commentUserIds = recentComments.map((comment) => comment.user._id);
    const commentProfiles = await Profile.find({
      user: { $in: commentUserIds },
    })
      .select("user profilePicture")
      .lean();

    const commentProfileMap = {};
    commentProfiles.forEach((profile) => {
      commentProfileMap[profile.user.toString()] = profile.profilePicture;
    });

    recentComments.forEach((comment) => {
      comment.user.profilePicture =
        commentProfileMap[comment.user._id.toString()] || null;
      if (comment.isAnonymous) {
        comment.user = {
          _id: null,
          name: "Anonymous",
          username: "anonymous",
          profilePicture: null,
        };
      }
    });

    if (post.isAnonymous) {
      post.originalUser = post.user;
      post.user = {
        _id: null,
        name: "Anonymous",
        username: "anonymous",
        email: null,
        verified: false,
        profilePicture: null,
      };
    }

    post.isLiked = post.likes.some(
      (like) => like._id.toString() === currentUserId.toString(),
    );
    post.recentComments = recentComments;

    res.json({ success: true, post });
  } catch (error) {
    console.error("Get post by ID error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch post",
    });
  }
};

/**
 * Search posts by content or tags
 */
exports.searchPosts = async (req, res) => {
  try {
    const { q, campus } = req.query;
    const currentUserId = req.user._id;

    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

    const currentUser = await User.findById(currentUserId);
    const connectionIds = currentUser?.connections || [];

    const visibilityConditions = [
      { user: currentUserId },
      { visibility: "campus", campus: currentUserCampus },
      { visibility: "connections", user: { $in: connectionIds } },
      { isAnonymous: true },
    ];

    let searchQuery = {};
    if (q) {
      searchQuery.$or = [
        { content: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ];
    }

    const campusFilter = campus || currentUserCampus;
    if (campusFilter) {
      searchQuery.campus = campusFilter;
    }

    const finalQuery = Object.keys(searchQuery).length
      ? { $and: [searchQuery, { $or: visibilityConditions }] }
      : { $or: visibilityConditions };

    const posts = await Post.find(finalQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name username email verified")
      .lean();

    const userIds = posts.map((post) => post.user._id);
    const postIds = posts.map((post) => post._id);

    const [profiles, commentCounts] = await Promise.all([
      Profile.find({ user: { $in: userIds } })
        .select("user profilePicture")
        .lean(),
      Comment.aggregate([
        { $match: { post: { $in: postIds }, isDeleted: false } },
        { $group: { _id: "$post", count: { $sum: 1 } } },
      ]),
    ]);

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    const commentCountMap = {};
    commentCounts.forEach((item) => {
      commentCountMap[item._id.toString()] = item.count;
    });

    posts.forEach((post) => {
      post.commentCount = commentCountMap[post._id.toString()] || 0;

      if (post.isAnonymous) {
        post.originalUser = post.user;
        post.user = {
          _id: null,
          name: "Anonymous",
          username: "anonymous",
          email: null,
          verified: false,
          profilePicture: null,
        };
      } else {
        post.user.profilePicture =
          profilePictureMap[post.user._id.toString()] || null;
      }
    });

    res.json({ success: true, posts, searchCampus: campusFilter });
  } catch (error) {
    console.error("Search posts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search posts",
    });
  }
};

// ===================== INTERACTIONS =====================

/**
 * Like or unlike a post
 */
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    const currentUserId = req.user._id;
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

    const currentUser = await User.findById(currentUserId);
    const connectionIds = currentUser?.connections || [];

    const canViewPost =
      post.user.toString() === currentUserId.toString() ||
      (post.visibility === "campus" && post.campus === currentUserCampus) ||
      (post.visibility === "connections" &&
        connectionIds.includes(post.user.toString())) ||
      post.isAnonymous;

    if (!canViewPost) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to interact with this post",
      });
    }

    const likeIndex = post.likes.findIndex(
      (like) => like.toString() === req.user._id.toString(),
    );

    if (likeIndex === -1) {
      post.likes.push(req.user._id);
    } else {
      post.likes.splice(likeIndex, 1);
    }

    await post.save();

    res.json({
      success: true,
      likes: post.likes.length,
      isLiked: likeIndex === -1,
    });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle like",
    });
  }
};

// ===================== ADMIN FUNCTIONS =====================

/**
 * Get anonymous posts for moderation (admin only)
 */
exports.getAnonymousPostsForModeration = async (req, res) => {
  try {
    const posts = await Post.find({ isAnonymous: true })
      .sort({ createdAt: -1 })
      .populate("user", "name username email")
      .lean();

    const userIds = posts.map((post) => post.user._id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user campus profilePicture")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = profile;
    });

    const postIds = posts.map((post) => post._id);
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds }, isDeleted: false } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    const commentCountMap = {};
    commentCounts.forEach((item) => {
      commentCountMap[item._id.toString()] = item.count;
    });

    posts.forEach((post) => {
      const profile = profileMap[post.user._id.toString()];
      if (profile) {
        post.user.campus = profile.campus;
        post.user.profilePicture = profile.profilePicture;
      }
      post.commentCount = commentCountMap[post._id.toString()] || 0;
    });

    res.json({ success: true, posts, total: posts.length });
  } catch (error) {
    console.error("Get anonymous posts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch anonymous posts",
    });
  }
};

/**
 * Get post count for a user (excluding anonymous posts)
 */
exports.getUserPostCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const postCount = await Post.countDocuments({
      user: userId,
      isAnonymous: false,
    });

    res.json({ success: true, count: postCount });
  } catch (error) {
    console.error("Get user post count error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch post count",
    });
  }
};

module.exports = exports;
