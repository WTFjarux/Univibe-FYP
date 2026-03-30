// controllers/postController.js - UPDATED for separate Comment model
const Post = require("../models/Post");
const Comment = require("../models/Comment"); // Add this
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

// ===================== POST CONTROLLERS =====================

/**
 * Create a new post
 */
exports.createPost = async (req, res) => {
  try {
    console.log("=== CREATE POST REQUEST ===");
    console.log("User ID:", req.user._id);
    console.log("Files received:", req.files ? req.files.length : 0);

    const { content, tags, visibility, isAnonymous } = req.body;
    const userId = req.user._id;

    // 1. Get user's profile for campus info
    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "Profile not found. Please complete your profile setup first.",
      });
    }

    // 2. Extract hashtags from content
    const extractedTags = extractHashtags(content);
    const allTags = [...new Set([...(tags || []), ...extractedTags])];

    // 3. Process uploaded images - store RELATIVE paths
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const relativePath = getPostImageRelativePath(req, file.filename);

        images.push({
          filename: file.filename,
          url: relativePath,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size,
        });
      });
    }

    // 4. Create new post (without embedded comments)
    const campus = profile.campus || "Unknown Campus";
    const post = new Post({
      user: userId,
      content,
      images,
      tags: allTags,
      campus,
      visibility: visibility || "campus",
      isAnonymous: isAnonymous === "true" || isAnonymous === true,
      commentCount: 0, // Initialize comment count
      recentComments: [], // Initialize empty recent comments
    });

    await post.save();

    // 5. Get populated post with user info
    const populatedPost = await Post.findById(post._id)
      .populate("user", "name username email verified")
      .lean();

    // 6. Get user's profile picture
    const userProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    populatedPost.user.profilePicture = userProfile?.profilePicture || null;

    // 7. Add isAnonymous flag to response
    populatedPost.isAnonymous = post.isAnonymous;
    populatedPost.commentCount = 0; // Send to frontend

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: populatedPost,
    });
  } catch (error) {
    console.error("Error creating post:", error);

    // Cleanup uploaded images if post creation fails
    if (req.files && req.files.length > 0) {
      const userId = req.user._id;
      const filenames = req.files.map((file) => file.filename);
      deletePostImages(userId.toString(), filenames);
    }

    res.status(500).json({
      success: false,
      error: "Failed to create post",
    });
  }
};

/**
 * Get all posts with filters and pagination
 */
exports.getPosts = async (req, res) => {
  try {
    const { filter = "all", page = 1, limit = 20, userId } = req.query;
    const skip = (page - 1) * limit;
    const currentUserId = req.user._id;

    console.log(`📊 Fetching posts - Filter: ${filter}, Page: ${page}`);

    // 1. Get current user's profile for campus info
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

    // 2. Get user's following and connections for filters
    const currentUser = await User.findById(currentUserId);
    const followingIds = currentUser.following || [];

    // Get connections (mutual follows)
    const connectionsQuery = await User.find({
      $or: [{ _id: { $in: followingIds } }, { following: currentUserId }],
    }).select("_id");
    const connectionIds = connectionsQuery.map((u) => u._id);

    // 3. Build query based on filter
    let query = {};
    switch (filter) {
      case "following":
        query.user = { $in: followingIds };
        break;
      case "connections":
        query.user = { $in: connectionIds };
        break;
      case "campus":
        query.campus = currentUserCampus;
        break;
      case "anonymous":
        query.isAnonymous = true;
        break;
      case "user":
        query.user = userId;
        break;
    }

    // 4. Apply visibility filter
    const visibilityQuery = {
      $or: [
        { visibility: "campus", campus: currentUserCampus },
        { user: currentUserId }, // User can always see their own posts
        { visibility: "following", user: { $in: followingIds } },
        { visibility: "connections", user: { $in: connectionIds } },
        { visibility: "private", user: currentUserId },
      ],
    };

    if (Object.keys(query).length > 0) {
      query = { $and: [query, visibilityQuery] };
    } else {
      query = visibilityQuery;
    }

    // 5. Fetch posts with basic user info
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "name username email verified")
      .populate("likes", "name username")
      .lean();

    // 6. Get profile pictures for all users
    const userIds = posts.map((post) => post.user?._id).filter((id) => id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    // 7. Get accurate comment counts for all posts (including nested replies)
    const postIds = posts.map((post) => post._id);

    // Count all comments (top-level + replies) that are not deleted
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds }, isDeleted: false } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    const commentCountMap = {};
    commentCounts.forEach((item) => {
      commentCountMap[item._id.toString()] = item.count;
    });

    // 8. Also get the stored commentCount from posts for debugging
    const postCommentCounts = {};
    posts.forEach((post) => {
      postCommentCounts[post._id.toString()] = post.commentCount;
    });

    // 9. Process each post
    posts.forEach((post) => {
      // Add profile picture
      if (post.user && post.user._id) {
        post.user.profilePicture =
          profilePictureMap[post.user._id.toString()] || null;
      }

      // Check if current user liked the post
      post.isLiked =
        post.likes?.some(
          (like) => like._id.toString() === currentUserId.toString(),
        ) || false;

      // Check if current user reposted
      post.isReposted =
        post.reposts?.some(
          (repost) => repost.toString() === currentUserId.toString(),
        ) || false;

      // ✅ FIX: Use aggregated comment count (most accurate)
      const aggregatedCount = commentCountMap[post._id.toString()] || 0;
      const storedCount = post.commentCount || 0;

      post.commentCount = aggregatedCount;

      // Debug logging - log if there's a discrepancy
      if (aggregatedCount !== storedCount) {
        console.log(
          `⚠️ Post ${post._id} comment count mismatch - Stored: ${storedCount}, Actual: ${aggregatedCount}`,
        );
      }

      // ANONYMOUS POSTS: Hide user info
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

    // 10. Get total count for pagination
    const total = await Post.countDocuments(query);

    // 11. Summary logging
    console.log(`📊 Posts fetched: ${posts.length}, Total available: ${total}`);
    console.log(
      `   Comment counts - Sum: ${posts.reduce((sum, p) => sum + (p.commentCount || 0), 0)}`,
    );

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
    console.error("Error fetching posts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch posts",
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

    // 1. Get current user info for visibility checks
    const currentUser = await User.findById(currentUserId);
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";
    const followingIds = currentUser.following || [];

    // Get connections
    const connectionsQuery = await User.find({
      $or: [{ _id: { $in: followingIds } }, { following: currentUserId }],
    }).select("_id");
    const connectionIds = connectionsQuery.map((u) => u._id);

    // 2. Fetch post with populated data (NO embedded comments)
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

    // 3. Check if user can view this post
    const canViewPost =
      post.user._id.toString() === currentUserId.toString() ||
      (post.visibility === "campus" && post.campus === currentUserCampus) ||
      (post.visibility === "following" &&
        followingIds.includes(post.user._id.toString())) ||
      (post.visibility === "connections" &&
        connectionIds.includes(post.user._id.toString())) ||
      (post.visibility === "private" &&
        post.user._id.toString() === currentUserId.toString());

    if (!canViewPost) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to view this post",
      });
    }

    // 4. Get profile picture for post author
    if (!post.isAnonymous) {
      const authorProfile = await Profile.findOne({ user: post.user._id })
        .select("profilePicture")
        .lean();
      post.user.profilePicture = authorProfile?.profilePicture || null;
    }

    // 5. Get comment count
    post.commentCount = await Comment.countDocuments({
      post: postId,
      isDeleted: false,
    });

    // 6. Get recent comments (first 3 for preview)
    const recentComments = await Comment.find({
      post: postId,
      isDeleted: false,
      parentComment: null, // Only top-level comments
    })
      .populate("user", "name username")
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    // 7. Get profile pictures for recent comment authors
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

    // 8. Add profile pictures to comments
    recentComments.forEach((comment) => {
      comment.user.profilePicture =
        commentProfileMap[comment.user._id.toString()] || null;

      // Handle anonymous comments
      if (comment.isAnonymous) {
        comment.user = {
          _id: null,
          name: "Anonymous",
          username: "anonymous",
          profilePicture: null,
        };
      }
    });

    // 9. ANONYMOUS POST: Hide author info
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

    // 10. Check if current user liked the post
    post.isLiked = post.likes.some(
      (like) => like._id.toString() === currentUserId.toString(),
    );

    // Add recent comments to response
    post.recentComments = recentComments;

    res.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch post",
    });
  }
};

/**
 * Search posts
 */
exports.searchPosts = async (req, res) => {
  try {
    const { q, campus } = req.query;
    const currentUserId = req.user._id;

    // 1. Get current user's campus and connections
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

    const currentUser = await User.findById(currentUserId);
    const followingIds = currentUser.following || [];

    const connectionsQuery = await User.find({
      $or: [{ _id: { $in: followingIds } }, { following: currentUserId }],
    }).select("_id");
    const connectionIds = connectionsQuery.map((u) => u._id);

    // 2. Build search query
    let query = {};
    if (q) {
      query.$or = [
        { content: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } },
      ];
    }

    const campusFilter = campus || currentUserCampus;
    if (campusFilter) {
      query.campus = campusFilter;
    }

    // 3. Apply visibility filter
    const visibilityQuery = {
      $or: [
        { visibility: "campus", campus: currentUserCampus },
        { user: currentUserId },
        { visibility: "following", user: { $in: followingIds } },
        { visibility: "connections", user: { $in: connectionIds } },
        { visibility: "private", user: currentUserId },
      ],
    };

    if (Object.keys(query).length > 0) {
      query = { $and: [query, visibilityQuery] };
    } else {
      query = visibilityQuery;
    }

    // 4. Fetch posts
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("user", "name username email verified")
      .lean();

    // 5. Get profile pictures and comment counts
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

    // 6. Process each post
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

    res.json({
      success: true,
      posts,
      searchCampus: campusFilter,
    });
  } catch (error) {
    console.error("Error searching posts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search posts",
    });
  }
};

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

    // Check if user can see the post before allowing like
    const currentUserId = req.user._id;
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

    const currentUser = await User.findById(currentUserId);
    const followingIds = currentUser.following || [];

    const connectionsQuery = await User.find({
      $or: [{ _id: { $in: followingIds } }, { following: currentUserId }],
    }).select("_id");
    const connectionIds = connectionsQuery.map((u) => u._id);

    const canViewPost =
      post.user.toString() === currentUserId.toString() ||
      (post.visibility === "campus" && post.campus === currentUserCampus) ||
      (post.visibility === "following" &&
        followingIds.includes(post.user.toString())) ||
      (post.visibility === "connections" &&
        connectionIds.includes(post.user.toString())) ||
      (post.visibility === "private" &&
        post.user.toString() === currentUserId.toString());

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
    console.error("Error toggling like:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle like",
    });
  }
};

/**
 * Add comment to a post - REMOVED (now handled by commentController)
 * This function is kept for backward compatibility but will be deprecated
 */
exports.addComment = async (req, res) => {
  // Redirect to comment controller
  const commentController = require("./commentController");
  return commentController.addComment(req, res);
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

    // Delete all comments associated with this post
    await Comment.deleteMany({ post: post._id });

    // Delete post images
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
    console.error("Error deleting post:", error);
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

    // Add new images if uploaded
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => {
        const relativePath = getPostImageRelativePath(req, file.filename);

        return {
          filename: file.filename,
          url: relativePath,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size,
        };
      });

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

    // Update post fields
    if (content !== undefined) {
      post.content = content;
      post.tags = extractHashtags(content);
    }

    if (visibility !== undefined) {
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

    // Get updated comment count
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
    console.error("Error updating post:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update post",
    });
  }
};

/**
 * Get anonymous posts for moderation (admin only)
 */
exports.getAnonymousPostsForModeration = async (req, res) => {
  try {
    // In the future, add admin check here
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Not authorized",
    //   });
    // }

    const posts = await Post.find({ isAnonymous: true })
      .sort({ createdAt: -1 })
      .populate("user", "name username email")
      .lean();

    // Get campus info for each user
    const userIds = posts.map((post) => post.user._id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user campus profilePicture")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = profile;
    });

    // Get comment counts for each post
    const postIds = posts.map((post) => post._id);
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds }, isDeleted: false } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    const commentCountMap = {};
    commentCounts.forEach((item) => {
      commentCountMap[item._id.toString()] = item.count;
    });

    // Add campus, profile info, and comment counts to posts
    posts.forEach((post) => {
      const profile = profileMap[post.user._id.toString()];
      if (profile) {
        post.user.campus = profile.campus;
        post.user.profilePicture = profile.profilePicture;
      }
      post.commentCount = commentCountMap[post._id.toString()] || 0;
    });

    res.json({
      success: true,
      posts,
      total: posts.length,
    });
  } catch (error) {
    console.error("Error fetching anonymous posts for moderation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch anonymous posts",
    });
  }
};
