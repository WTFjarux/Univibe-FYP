// backend/controllers/postController.js
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Notification = require("../models/Notification");
const Block = require("../models/Block");
const BlockService = require("../services/blockService");
const { getAdminModel } = require("../config/database");
const {
  getPostImageRelativePath,
  deletePostImages,
} = require("../middleware/uploadPostMiddleware");

// ===================== HELPER FUNCTIONS =====================

function extractHashtags(content) {
  const hashtagRegex = /#(\w+)/g;
  const matches = content.match(hashtagRegex);
  return matches ? matches.map((tag) => tag.substring(1)) : [];
}

function extractMentions(content) {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex);
  return matches ? matches.map((mention) => mention.substring(1)) : [];
}

const isBlockedInteraction = async (userId1, userId2) => {
  try {
    return await Block.areUsersBlocked(userId1, userId2);
  } catch (error) {
    console.error("isBlockedInteraction error:", error);
    return true;
  }
};

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
    const isBlocked = await Block.areUsersBlocked(recipientId, senderId);
    if (isBlocked) return null;

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

const getBlockFilter = async (userId) => {
  const blockedUserIds = await BlockService.getBlockedUserIds(userId);
  return {
    user: { $nin: blockedUserIds },
    isDeleted: false,
  };
};

// ===================== POST CRUD OPERATIONS =====================

exports.createPost = async (req, res) => {
  try {
    const { content, tags, visibility, isAnonymous, communityId } = req.body;
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

    // Build post data
    let postData = {
      user: userId,
      content,
      images,
      tags: allTags,
      campus: profile.campus || "Unknown Campus",
      visibility: visibility || "campus",
      isAnonymous: isAnonymous === "true" || isAnonymous === true,
      commentCount: 0,
    };

    // ✅ If community post, associate with community
    if (communityId) {
      const mongoose = require("mongoose");
      const Community = require("../models/Community");
      const community = await Community.findById(communityId);

      if (community) {
        // ✅ Cast to ObjectId properly
        postData.community = new mongoose.Types.ObjectId(communityId);
      }
    }

    const post = new Post(postData);
    await post.save();

    // Populate the post for response
    const populatedPost = await Post.findById(post._id)
      .populate("user", "name username email verified")
      .populate("community", "name coverImage type privacy memberCount")
      .lean();

    const userProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    populatedPost.user.profilePicture = userProfile?.profilePicture || null;
    populatedPost.isAnonymous = post.isAnonymous;

    // ✅ Emit socket event if this is a community post
    if (communityId) {
      const io = req.app.get("io");
      if (io) {
        io.to(`community:${communityId}`).emit("community:new_post", {
          communityId,
          post: populatedPost,
        });
        console.log(
          `📤 Emitted community:new_post to community:${communityId}`,
        );
      }
    }

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

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found or you don't have permission to delete it",
      });
    }

    await post.softDelete();

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

exports.restorePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).includeDeleted();

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found or you don't have permission to restore it",
      });
    }

    if (!post.isDeleted) {
      return res.status(400).json({
        success: false,
        error: "Post is not deleted",
      });
    }

    await post.restore();

    const restoredPost = await Post.findById(post._id)
      .populate("user", "name username email verified")
      .lean();

    const userProfile = await Profile.findOne({ user: post.user })
      .select("profilePicture")
      .lean();

    if (restoredPost && restoredPost.user) {
      restoredPost.user.profilePicture = userProfile?.profilePicture || null;
    }

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

exports.permanentlyDeletePost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
    }).includeDeleted();

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

    await Comment.deleteMany({ post: post._id });
    await Notification.deleteMany({
      targetId: post._id,
      targetModel: "Post",
    });

    if (post.images && post.images.length > 0) {
      const filenames = post.images.map((img) => img.filename);
      deletePostImages(req.user._id.toString(), filenames);
    }

    await Post.deleteOne({ _id: post._id });

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

exports.getDeletedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find({
      user: userId,
      isDeleted: true,
      deletedByAdmin: { $ne: true },
    })
      .includeDeleted()
      .sort({ deletedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "name username email verified")
      .populate("community", "name coverImage type privacy") // ✅ ADD THIS
      .lean();

    const total = await Post.find({
      user: userId,
      isDeleted: true,
      deletedByAdmin: { $ne: true },
    })
      .includeDeleted()
      .countDocuments();

    const userIds = posts.map((post) => post.user?._id).filter(Boolean);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      if (profile.user) {
        profilePictureMap[profile.user.toString()] = profile.profilePicture;
      }
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

    const processedPosts = posts.map((post) => ({
      ...post,
      user: {
        ...post.user,
        profilePicture: profilePictureMap[post.user?._id?.toString()] || null,
      },
      commentCount: commentCountMap[post._id.toString()] || 0,
      isLiked: false,
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
      },
    });
  } catch (error) {
    console.error("Get deleted posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deleted posts",
      error: error.message,
    });
  }
};

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

    let imagesToRemove = [];
    if (removeImages) {
      if (Array.isArray(removeImages)) {
        imagesToRemove = removeImages;
      } else if (typeof removeImages === "string") {
        try {
          imagesToRemove = JSON.parse(removeImages);
        } catch {
          imagesToRemove = removeImages.split(",").filter((id) => id.trim());
        }
      }
    }

    if (imagesToRemove.length > 0) {
      const imagesToKeep = [];
      const imagesToDelete = [];

      for (const img of post.images) {
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

      if (imagesToDelete.length > 0) {
        const filenames = imagesToDelete.map((img) => img.filename);
        deletePostImages(userId.toString(), filenames);
      }

      post.images = imagesToKeep;
    }

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

    if (!isOwnProfile) {
      const isBlocked = await Block.areUsersBlocked(currentUserId, userId);
      if (isBlocked) {
        return res.status(200).json({
          success: true,
          data: {
            posts: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0,
            },
            viewerStatus: {
              isOwnProfile,
              isConnected: false,
              isBlocked: true,
            },
          },
        });
      }
    }

    const currentUser =
      await User.findById(currentUserId).select("connections");
    const profileOwnerProfile = await Profile.findOne({ user: userId });
    const profileOwnerCampus = profileOwnerProfile?.campus || "Unknown Campus";

    let isConnected =
      currentUser?.connections?.some((id) => id.toString() === userId) || false;

    let query = {
      user: userId,
      isAnonymous: false,
      isDeleted: false,
      community: null,
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
      .populate("community", "name coverImage")
      .populate("likes", "name username")
      .lean();

    const total = await Post.countDocuments(query);

    const userIds = posts.map((post) => post.user._id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
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

    // ✅ Get report status for current user
    const Report = getAdminModel("Report");
    const userReports = await Report.find({
      reportedBy: currentUserId,
      targetType: "Post",
      targetId: { $in: postIds },
      status: { $in: ["pending", "reviewing"] },
    }).lean();
    const reportedPostIds = new Set(
      userReports.map((r) => r.targetId.toString()),
    );

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
      isReported: reportedPostIds.has(post._id.toString()), // ✅ ADDED
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
        viewerStatus: {
          isOwnProfile,
          isConnected,
          isBlocked: false,
        },
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

exports.getPostById = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const postId = req.params.id;

    const post = await Post.findById(postId)
      .populate("user", "name username email verified")
      .populate("community", "name coverImage")
      .populate("likes", "name username")
      .lean();

    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    if (post.user._id.toString() !== currentUserId.toString()) {
      const isBlocked = await Block.areUsersBlocked(
        currentUserId,
        post.user._id,
      );
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: "You cannot view this post due to a block",
        });
      }
    }

    const currentUser = await User.findById(currentUserId);
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";
    const connectionIds = currentUser?.connections || [];

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

    // ✅ Check if current user reported this post
    const Report = getAdminModel("Report");
    const userReport = await Report.findOne({
      reportedBy: currentUserId,
      targetType: "Post",
      targetId: postId,
      status: { $in: ["pending", "reviewing"] },
    });
    post.isReported = !!userReport;

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

exports.searchPosts = async (req, res) => {
  try {
    const { q, campus } = req.query;
    const currentUserId = req.user._id;

    const blockedUserIds = await BlockService.getBlockedUserIds(currentUserId);

    const currentUser = await User.findById(currentUserId);
    const currentUserProfile = await Profile.findOne({ user: currentUserId });
    const currentUserCampus = currentUserProfile?.campus || "Unknown Campus";
    const connectionIds = currentUser?.connections || [];

    const visibilityConditions = [
      { user: currentUserId, isDeleted: false },
      {
        visibility: "campus",
        campus: currentUserCampus,
        isDeleted: false,
        user: { $nin: blockedUserIds },
      },
      {
        visibility: "connections",
        user: { $in: connectionIds, $nin: blockedUserIds },
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

const handleLikeNotification = async (postId, postOwnerId, likerId, io) => {
  try {
    const isBlocked = await Block.areUsersBlocked(postOwnerId, likerId);
    if (isBlocked) return;

    const liker = await User.findById(likerId).select("name");
    if (!liker) return;

    const profile = await Profile.findOne({ user: likerId })
      .select("profilePicture")
      .lean();
    const profilePicture = profile?.profilePicture || null;

    const likerIdStr = likerId.toString();

    // Find existing grouped notification
    let notification = await Notification.findOne({
      recipient: postOwnerId,
      type: "like",
      targetId: postId,
      targetModel: "Post",
      "metadata.isGrouped": true,
    });

    if (notification) {
      // Check if notification is older than 24 hours — if so, start fresh
      const notificationAge =
        Date.now() - new Date(notification.createdAt).getTime();
      const isStale = notificationAge > 24 * 60 * 60 * 1000; // 24 hours

      let currentLikers = isStale ? [] : notification.metadata?.likers || [];

      // Remove existing entry for this liker (to re-add at top)
      currentLikers = currentLikers.filter(
        (l) => l.userId.toString() !== likerIdStr,
      );

      // Add current liker at the front
      currentLikers.unshift({
        userId: likerIdStr,
        name: liker.name,
        profilePicture: profilePicture,
      });

      // Keep max 10 recent likers
      if (currentLikers.length > 10) {
        currentLikers = currentLikers.slice(0, 10);
      }

      notification.message = getLikeMessage(currentLikers);
      notification.read = false;
      notification.lastInteractionAt = new Date();
      notification.sender = likerId;
      notification.metadata = {
        isGrouped: true,
        count: currentLikers.length,
        likers: currentLikers,
      };

      notification.markModified("metadata");
      await notification.save();
    } else {
      // Create fresh notification
      notification = await Notification.create({
        recipient: postOwnerId,
        sender: likerId,
        type: "like",
        title: "New Like",
        message: `${liker.name} liked your post`,
        targetId: postId,
        targetModel: "Post",
        read: false,
        lastInteractionAt: new Date(),
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
    }

    // Emit socket event
    if (io && notification) {
      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("sender", "name username email")
        .lean();

      if (populatedNotification) {
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
        io.to(roomId).emit("notification:new", {
          notification: populatedNotification,
        });

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

const handleUnlikeNotification = async (postId, postOwnerId, unlikerId) => {
  try {
    const unlikerIdStr = unlikerId.toString();

    const existingNotification = await Notification.findOne({
      recipient: postOwnerId,
      type: "like",
      targetId: postId,
      targetModel: "Post",
      "metadata.isGrouped": true,
    });

    if (!existingNotification) {
      return;
    }

    const currentLikers = existingNotification.metadata?.likers || [];

    const updatedLikers = currentLikers.filter(
      (l) => l.userId.toString() !== unlikerIdStr,
    );

    if (updatedLikers.length === 0) {
      await Notification.findByIdAndDelete(existingNotification._id);
    } else {
      existingNotification.metadata.likers = updatedLikers;
      existingNotification.metadata.count = updatedLikers.length;
      existingNotification.message = getLikeMessage(updatedLikers);
      existingNotification.read = false;
      existingNotification.createdAt = new Date();
      existingNotification.sender = updatedLikers[0].userId;
      existingNotification.markModified("metadata");
      await existingNotification.save();
    }
  } catch (error) {
    console.error("Handle unlike notification error:", error);
  }
};

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

exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    const currentUserId = req.user._id;

    if (post.user.toString() !== currentUserId.toString()) {
      const isBlocked = await Block.areUsersBlocked(currentUserId, post.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: "You cannot interact with this post due to a block",
        });
      }
    }

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
      post.likes.push(req.user._id);
      await post.save();

      if (
        post.user.toString() !== currentUserId.toString() &&
        !post.isAnonymous
      ) {
        await handleLikeNotification(post._id, post.user, currentUserId, io);
      }
    } else {
      post.likes.splice(likeIndex, 1);
      await post.save();

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

exports.getAnonymousPostsForModeration = async (req, res) => {
  try {
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

exports.getUserPostCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const postCount = await Post.countDocuments({
      user: userId,
      isAnonymous: false,
      isDeleted: false,
      community: null, 
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
