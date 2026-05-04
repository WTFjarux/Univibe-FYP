// Backend/controllers/postController.js
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Notification = require("../models/Notification");
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

/**
 * Create a notification for post interactions
 */
const createPostNotification = async (
  recipientId,
  senderId,
  type,
  title,
  message,
  targetId,
  targetModel,
) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      targetId,
      targetModel,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

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
 * Soft delete a post (mark as deleted instead of removing from DB)
 */
exports.deletePost = async (req, res) => {
  try {
    // Use includeDeleted to find the post even if it's already deleted
    const post = await Post.findOne({
      _id: req.params.id,
    }).includeDeleted();

    console.log("Delete post - Found post:", post?._id);
    console.log("Delete post - Current isDeleted:", post?.isDeleted);

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

    // Check if already soft deleted
    if (post.isDeleted) {
      return res.status(400).json({
        success: false,
        error: "Post already deleted",
      });
    }

    // Use the softDelete method from schema
    await post.softDelete();

    console.log("Post soft deleted successfully:", post._id);

    res.json({
      success: true,
      message: "Post deleted successfully",
      post: {
        _id: post._id,
        isDeleted: true,
        deletedAt: post.deletedAt,
      },
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
 * Restore a soft-deleted post
 */
exports.restorePost = async (req, res) => {
  try {
    // Use findOne with $or to bypass the pre-find middleware
    // Or use the includeDeleted query helper
    const post = await Post.findOne({
      _id: req.params.id,
    }).includeDeleted(); // This bypasses the isDeleted filter

    console.log("Restore attempt - Post found:", post);
    console.log("Restore attempt - isDeleted:", post?.isDeleted);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to restore this post",
      });
    }

    if (!post.isDeleted) {
      return res.status(400).json({
        success: false,
        error: "Post is not deleted",
      });
    }

    // Use the restore method from the schema
    await post.restore();

    // Get the restored post with populated fields
    const restoredPost = await Post.findById(post._id)
      .populate("user", "name username email verified")
      .lean();

    res.json({
      success: true,
      message: "Post restored successfully",
      post: restoredPost,
    });
  } catch (error) {
    console.error("Restore post error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore post",
    });
  }
};

/**
 * Permanently delete a post (hard delete) - for cleanup
 */
exports.permanentlyDeletePost = async (req, res) => {
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
        error: "Not authorized to permanently delete this post",
      });
    }

    // Delete associated comments
    await Comment.deleteMany({ post: post._id });

    // Delete associated notifications
    await Notification.deleteMany({ targetId: post._id, targetModel: "Post" });

    // Delete images if they exist
    if (post.images && post.images.length > 0) {
      const filenames = post.images.map((img) => img.filename);
      deletePostImages(req.user._id.toString(), filenames);
    }

    // Hard delete the post
    await post.deleteOne();

    res.json({
      success: true,
      message: "Post permanently deleted",
    });
  } catch (error) {
    console.error("Permanent delete error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to permanently delete post",
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

    console.log("Update post request:", {
      postId,
      contentLength: content?.length,
      removeImages,
      visibility,
      isAnonymous,
      filesCount: req.files?.length || 0,
    });

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    // Don't allow updating deleted posts
    if (post.isDeleted) {
      return res.status(400).json({
        success: false,
        error: "Cannot update a deleted post",
      });
    }

    if (post.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this post",
      });
    }

    // Parse removeImages - it could come as string, array, or undefined
    let imagesToRemove = [];
    if (removeImages) {
      if (Array.isArray(removeImages)) {
        imagesToRemove = removeImages;
      } else if (typeof removeImages === "string") {
        try {
          // Try to parse as JSON first
          imagesToRemove = JSON.parse(removeImages);
        } catch {
          // If not JSON, split by comma
          imagesToRemove = removeImages.split(",").filter((id) => id.trim());
        }
      }
    }

    console.log("Images to remove:", imagesToRemove);

    // Remove specified images
    if (imagesToRemove.length > 0) {
      const imagesToKeep = [];
      const imagesToDelete = [];

      for (const img of post.images) {
        // Check if this image should be removed
        const shouldRemove = imagesToRemove.some(
          (removeId) =>
            removeId === img.filename ||
            removeId === img._id?.toString() ||
            removeId === img.url ||
            removeId === img.id,
        );

        if (shouldRemove) {
          imagesToDelete.push(img);
        } else {
          imagesToKeep.push(img);
        }
      }

      // Delete the image files
      if (imagesToDelete.length > 0) {
        const filenames = imagesToDelete.map((img) => img.filename);
        deletePostImages(userId.toString(), filenames);
        console.log("Deleted image files:", filenames);
      }

      post.images = imagesToKeep;
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
        // Clean up newly uploaded files
        const filenames = req.files.map((file) => file.filename);
        deletePostImages(userId.toString(), filenames);
        return res.status(400).json({
          success: false,
          error: "Maximum 4 images allowed per post",
        });
      }

      post.images.push(...newImages);
      console.log(`Added ${newImages.length} new images`);
    }

    // Update fields
    if (content !== undefined && content !== null) {
      post.content = content;
      post.tags = extractHashtags(content);
    }

    if (visibility !== undefined && visibility !== null) {
      if (!["campus", "connections"].includes(visibility)) {
        return res.status(400).json({
          success: false,
          error: "Visibility must be either 'campus' or 'connections'",
        });
      }
      post.visibility = visibility;
    }

    if (isAnonymous !== undefined && isAnonymous !== null) {
      post.isAnonymous = isAnonymous === "true" || isAnonymous === true;
    }

    // Set edited flag
    post.isEdited = true;
    post.editedAt = new Date();
    await post.save();

    console.log("Post updated successfully:", postId);

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
    // Exclude soft-deleted posts
    let query = {
      user: userId,
      isAnonymous: false,
      isDeleted: false,
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

    // Don't show soft-deleted posts
    if (post.isDeleted) {
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

    // Exclude soft-deleted posts
    const visibilityConditions = [
      { user: currentUserId, isDeleted: false },
      { visibility: "campus", campus: currentUserCampus, isDeleted: false },
      {
        visibility: "connections",
        user: { $in: connectionIds },
        isDeleted: false,
      },
      { isAnonymous: true, isDeleted: false },
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
 * Handle like notification with grouping
 * Creates or updates a grouped like notification
 */
/**
 * Handle like notification with grouping
 * Creates or updates a grouped like notification
 * Uses lastInteractionAt for proper sorting (new likes move notification to top)
 */
const handleLikeNotification = async (postId, postOwnerId, likerId, io) => {
  try {
    const liker = await User.findById(likerId).select("name");
    if (!liker) return;

    // Get profile picture for the liker
    const profile = await Profile.findOne({ user: likerId })
      .select("profilePicture")
      .lean();
    const profilePicture = profile?.profilePicture || null;

    const likerIdStr = likerId.toString();

    // Check if there's already a grouped like notification for this post
    let notification = await Notification.findOne({
      recipient: postOwnerId,
      type: "like",
      targetId: postId,
      targetModel: "Post",
      "metadata.isGrouped": true,
    });

    if (notification) {
      // ============================================
      // UPDATE EXISTING GROUPED NOTIFICATION
      // ============================================

      let currentLikers = notification.metadata?.likers || [];

      // Remove duplicate if user already exists (handles unlike-then-like-again)
      currentLikers = currentLikers.filter(
        (l) => l.userId.toString() !== likerIdStr,
      );

      // Add newest liker to the BEGINNING (most recent first)
      currentLikers.unshift({
        userId: likerIdStr,
        name: liker.name,
        profilePicture: profilePicture,
      });

      // Update notification fields
      notification.message = getLikeMessage(currentLikers);
      notification.read = false;
      notification.lastInteractionAt = new Date(); // Key: triggers re-sorting to top
      notification.sender = likerId;
      notification.metadata = {
        isGrouped: true,
        count: currentLikers.length,
        likers: currentLikers,
      };

      // Mark metadata as modified for Mongoose Mixed type
      notification.markModified("metadata");
      await notification.save(); // Mongoose auto-handles updatedAt via timestamps

      console.log(
        `📢 Updated like notification: ${notification.message} | lastInteractionAt: ${notification.lastInteractionAt}`,
      );
    } else {
      // ============================================
      // CREATE NEW GROUPED NOTIFICATION
      // ============================================

      // Clean up old individual like notifications for this post
      await Notification.deleteMany({
        recipient: postOwnerId,
        type: "like",
        targetId: postId,
        targetModel: "Post",
      });

      // Create fresh grouped notification
      notification = await Notification.create({
        recipient: postOwnerId,
        sender: likerId,
        type: "like",
        title: "New Like",
        message: `${liker.name} liked your post`,
        targetId: postId,
        targetModel: "Post",
        read: false,
        lastInteractionAt: new Date(), // Set initial interaction time
        metadata: {
          isGrouped: true,
          count: 1,
          likers: [
            {
              userId: likerIdStr,
              name: liker.name,
              profilePicture: profilePicture,
            },
          ],
        },
      });

      console.log(`📢 Created new like notification: ${notification.message}`);
    }

    // ============================================
    // EMIT REAL-TIME SOCKET EVENT
    // ============================================
    if (io && notification) {
      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("sender", "name username email")
        .lean();

      if (populatedNotification) {
        // Enrich sender with profile picture
        const senderProfile = await Profile.findOne({
          user:
            populatedNotification.sender._id || populatedNotification.sender,
        })
          .select("profilePicture fullName")
          .lean();

        if (senderProfile) {
          populatedNotification.sender = {
            ...populatedNotification.sender,
            profilePicture: senderProfile.profilePicture || null,
            fullName:
              senderProfile.fullName || populatedNotification.sender.name,
          };
        }

        const roomId = `user_${postOwnerId}`;

        // Emit to post owner's personal room
        io.to(roomId).emit("notification:new", {
          notification: populatedNotification,
        });

        // Emit updated unread count
        const unreadCount = await Notification.countDocuments({
          recipient: postOwnerId,
          read: false,
        });
        io.to(roomId).emit("notification:unreadCount", {
          count: unreadCount,
        });
      }
    }
  } catch (error) {
    console.error("Handle like notification error:", error);
  }
};

/**
 * Handle unlike notification
 * Removes user from grouped notification or deletes if last liker
 */
const handleUnlikeNotification = async (postId, postOwnerId, unlikerId) => {
  try {
    const unlikerIdStr = unlikerId.toString();
    console.log(
      "Unlike - postId:",
      postId.toString(),
      "unlikerId:",
      unlikerIdStr,
    );

    const existingNotification = await Notification.findOne({
      recipient: postOwnerId,
      type: "like",
      targetId: postId,
      targetModel: "Post",
      "metadata.isGrouped": true,
    });

    if (!existingNotification) {
      console.log("No grouped notification found");
      return;
    }

    const currentLikers = existingNotification.metadata?.likers || [];
    console.log(
      "Current likers:",
      currentLikers.map((l) => l.name),
    );

    // Remove the unliker
    const updatedLikers = currentLikers.filter(
      (l) => l.userId.toString() !== unlikerIdStr,
    );

    console.log(
      "Updated likers:",
      updatedLikers.map((l) => l.name),
    );

    if (updatedLikers.length === 0) {
      // No more likes, delete the notification
      console.log("No likers left, deleting notification");
      await Notification.findByIdAndDelete(existingNotification._id);
    } else {
      // Update directly
      existingNotification.metadata.likers = updatedLikers;
      existingNotification.metadata.count = updatedLikers.length;
      existingNotification.message = getLikeMessage(updatedLikers);
      existingNotification.read = false;
      existingNotification.createdAt = new Date();

      // Update sender to latest liker
      existingNotification.sender = updatedLikers[0].userId;

      // Mark metadata as modified
      existingNotification.markModified("metadata");

      await existingNotification.save();

      console.log(
        "Notification updated with",
        updatedLikers.length,
        "likers:",
        updatedLikers.map((l) => l.name),
      );
    }
  } catch (error) {
    console.error("Handle unlike notification error:", error);
  }
};

/**
 * Helper to generate like message
 */
const getLikeMessage = (likers) => {
  if (!likers || likers.length === 0) return "";
  if (likers.length === 1) {
    return `${likers[0].name} liked your post`;
  } else if (likers.length === 2) {
    return `${likers[0].name} and ${likers[1].name} liked your post`;
  } else {
    return `${likers[0].name}, ${likers[1].name} and ${likers.length - 2} others liked your post`;
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

    // Don't allow liking deleted posts
    if (post.isDeleted) {
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

    const wasLiked = likeIndex === -1;
    const io = req.app.get("io");

    if (wasLiked) {
      // USER IS LIKING THE POST
      post.likes.push(req.user._id);
      await post.save();

      // Handle like notification (grouped)
      if (
        post.user.toString() !== currentUserId.toString() &&
        !post.isAnonymous
      ) {
        await handleLikeNotification(post._id, post.user, currentUserId, io);
      }
    } else {
      // USER IS UNLIKING THE POST
      post.likes.splice(likeIndex, 1);
      await post.save();

      // Handle unlike notification
      if (
        post.user.toString() !== currentUserId.toString() &&
        !post.isAnonymous
      ) {
        await handleUnlikeNotification(post._id, post.user, currentUserId);
      }
    }

    res.json({
      success: true,
      likes: post.likes.length,
      isLiked: wasLiked,
    });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to toggle like",
    });
  }
};

// ===================== ADMIN FUNCTIONS =====================

/**
 * Get anonymous posts for moderation (admin only)
 */
exports.getAnonymousPostsForModeration = async (req, res) => {
  try {
    // Exclude soft-deleted posts from admin view too
    const posts = await Post.find({ isAnonymous: true, isDeleted: false })
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
      isDeleted: false, // Exclude soft-deleted posts
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
