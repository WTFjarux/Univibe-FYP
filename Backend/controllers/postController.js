// controllers/postController.js - UPDATED
const Post = require("../models/Post");
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

    const { content, tags, visibility, isAnonymous } = req.body; // Removed category
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

    // 4. Create new post
    const campus = profile.campus || "Unknown Campus";
    const post = new Post({
      user: userId,
      content,
      images,
      tags: allTags,
      campus,
      visibility: visibility || "campus", // Default to campus
      isAnonymous: isAnonymous === "true" || isAnonymous === true,
    });

    await post.save();

    // 5. Get populated post with user info
    const populatedPost = await Post.findById(post._id)
      .populate("user", "name username email verified")
      .lean();

    // 6. Get user's profile picture - store relative path
    const userProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    // Store relative path (frontend will convert to absolute)
    populatedPost.user.profilePicture = userProfile?.profilePicture || null;

    // 7. Add isAnonymous flag to response
    populatedPost.isAnonymous = post.isAnonymous;

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
    const { filter = "all", page = 1, limit = 20, userId } = req.query; // Removed category

    const skip = (page - 1) * limit;
    const currentUserId = req.user._id;

    // 1. Get current user's profile for campus info
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

    // 2. Get user's following and connections for filters
    const currentUser = await User.findById(currentUserId);
    const followingIds = currentUser.following || [];

    // Get connections (mutual follows or friends)
    // Users who follow current user OR are followed by current user
    const connectionsQuery = await User.find({
      $or: [{ _id: { $in: followingIds } }, { following: currentUserId }],
    }).select("_id");
    const connectionIds = connectionsQuery.map((u) => u._id);

    // 3. Build query based on filter
    let query = {};
    switch (filter) {
      case "following":
        // Posts from people the user follows
        query.user = { $in: followingIds };
        break;
      case "connections":
        // Posts from connections (mutual follows)
        query.user = { $in: connectionIds };
        break;
      case "campus":
        // Posts from current user's campus
        query.campus = currentUserCampus;
        break;
      case "anonymous":
        // Only anonymous posts
        query.isAnonymous = true;
        break;
      case "user":
        query.user = userId;
        break;
      // "all" shows everything (no specific filter)
    }

    // 4. Apply visibility filter based on post's visibility setting
    const visibilityQuery = {
      $or: [
        { visibility: "campus", campus: currentUserCampus },
        { user: currentUserId }, // User can always see their own posts
        { visibility: "following", user: { $in: followingIds } },
        { visibility: "connections", user: { $in: connectionIds } },
        { visibility: "private", user: currentUserId },
      ],
    };

    // Combine filter query with visibility query
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

    // 6. Get profile pictures for all users in posts
    const userIds = posts.map((post) => post.user._id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    // 7. Create map of user ID → profile picture
    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    // 8. Process each post
    posts.forEach((post) => {
      // Store relative path for profile picture
      post.user.profilePicture =
        profilePictureMap[post.user._id.toString()] || null;

      // Check if current user liked the post
      post.isLiked = post.likes.some(
        (like) => like._id.toString() === currentUserId.toString(),
      );

      // Check if current user reposted
      post.isReposted =
        post.reposts?.some(
          (repost) => repost.toString() === currentUserId.toString(),
        ) || false;

      // ANONYMOUS POSTS: Hide user info if post is anonymous
      if (post.isAnonymous) {
        // Keep original user data for system tracking but hide from frontend
        post.originalUser = post.user; // For potential admin/moderator use later
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

    // 9. Get total count for pagination
    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      posts, // Send relative paths to frontend
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

    // 2. Fetch post with populated data
    const post = await Post.findById(req.params.id)
      .populate("user", "name username email verified")
      .populate("likes", "name username")
      .populate("comments.user", "name username")
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    // 3. Check if user can view this post based on visibility
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

    // 4. ANONYMOUS POST: Hide user info if post is anonymous
    if (post.isAnonymous) {
      post.originalUser = post.user; // For admin use
      post.user = {
        _id: null,
        name: "Anonymous",
        username: "anonymous",
        email: null,
        verified: false,
        profilePicture: null,
      };
    } else {
      // Get profile picture for non-anonymous post author
      const authorProfile = await Profile.findOne({ user: post.user._id })
        .select("profilePicture")
        .lean();
      post.user.profilePicture = authorProfile?.profilePicture || null;
    }

    // 5. Get profile pictures for comment authors
    const commentUserIds = post.comments.map((comment) => comment.user._id);
    const commentProfiles = await Profile.find({
      user: { $in: commentUserIds },
    })
      .select("user profilePicture")
      .lean();

    const commentProfileMap = {};
    commentProfiles.forEach((profile) => {
      commentProfileMap[profile.user.toString()] = profile.profilePicture;
    });

    // 6. Add profile pictures to comments
    post.comments.forEach((comment) => {
      // Check if comment is from anonymous post author
      if (
        post.isAnonymous &&
        comment.user._id.toString() === post.originalUser?._id?.toString()
      ) {
        comment.user = {
          _id: null,
          name: "Anonymous",
          username: "anonymous",
          profilePicture: null,
        };
      } else {
        comment.user.profilePicture =
          commentProfileMap[comment.user._id.toString()] || null;
      }
    });

    // 7. Check if current user liked the post
    post.isLiked = post.likes.some(
      (like) => like._id.toString() === currentUserId.toString(),
    );

    res.json({
      success: true,
      post, // Send relative paths to frontend
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
    const { q, campus } = req.query; // Removed category
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

    // Use provided campus or default to user's campus
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

    // 5. Get profile pictures for all users
    const userIds = posts.map((post) => post.user._id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    // 6. Process each post
    posts.forEach((post) => {
      // ANONYMOUS POST: Hide user info if post is anonymous
      if (post.isAnonymous) {
        post.originalUser = post.user; // For admin use
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
      posts, // Send relative paths to frontend
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
 * Add comment to a post
 */
exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    // Check if user can see the post before allowing comment
    const currentUserProfile = await Profile.findOne({ user: userId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";

    const currentUser = await User.findById(userId);
    const followingIds = currentUser.following || [];

    const connectionsQuery = await User.find({
      $or: [{ _id: { $in: followingIds } }, { following: userId }],
    }).select("_id");
    const connectionIds = connectionsQuery.map((u) => u._id);

    const canViewPost =
      post.user.toString() === userId.toString() ||
      (post.visibility === "campus" && post.campus === currentUserCampus) ||
      (post.visibility === "following" &&
        followingIds.includes(post.user.toString())) ||
      (post.visibility === "connections" &&
        connectionIds.includes(post.user.toString())) ||
      (post.visibility === "private" &&
        post.user.toString() === userId.toString());

    if (!canViewPost) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to comment on this post",
      });
    }

    const comment = {
      user: userId,
      content,
    };

    post.comments.push(comment);
    await post.save();

    const lastComment = post.comments[post.comments.length - 1];
    const populatedComment = await Post.populate(lastComment, {
      path: "user",
      select: "name username",
    });

    // Get profile picture - relative path
    const commentUserProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    populatedComment.user.profilePicture =
      commentUserProfile?.profilePicture || null;

    res.status(201).json({
      success: true,
      comment: populatedComment, // Send relative path to frontend
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add comment",
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
    const { content, removeImages, visibility, isAnonymous } = req.body; // Added visibility and isAnonymous
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

    // Add campus and profile info to posts
    posts.forEach((post) => {
      const profile = profileMap[post.user._id.toString()];
      if (profile) {
        post.user.campus = profile.campus;
        post.user.profilePicture = profile.profilePicture;
      }
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
