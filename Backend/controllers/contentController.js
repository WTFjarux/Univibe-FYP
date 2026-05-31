// backend/controllers/contentController.js

const User = require("../models/User");
const Post = require("../models/Post");
const Profile = require("../models/Profile");
const BlockService = require("../services/blockService");
const Block = require("../models/Block");

// Cache invalidation - optional, won't break if blockCache middleware is missing
let invalidateBlockCache = (userId) => {};
try {
  const blockCache = require("../middleware/blockCache");
  invalidateBlockCache = blockCache.invalidateBlockCache;
} catch (err) {
  // blockCache middleware not found, running without cache
}

/**
 * Toggle save/unsave a post
 */
exports.toggleSavePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const post = await Post.findById(postId);
    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.user && post.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, post.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "You cannot interact with this post",
        });
      }
    }

    const isSaved = user.savedPosts.includes(postId);

    if (isSaved) {
      await user.unsavePost(postId);
      return res.json({
        success: true,
        saved: false,
        message: "Post removed from saved",
      });
    } else {
      await user.savePost(postId);
      return res.json({
        success: true,
        saved: true,
        message: "Post saved successfully",
      });
    }
  } catch (error) {
    console.error("Toggle save error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save post",
    });
  }
};

/**
 * Get all saved posts for the current user
 */
exports.getSavedPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const blockedUserIds = await BlockService.getBlockedUserIds(userId);

    const user = await User.findById(userId).populate({
      path: "savedPosts",
      match: {
        isDeleted: false,
        user: { $nin: blockedUserIds },
      },
      populate: [
        {
          path: "user",
          select: "name username email",
        },
        {
          path: "community",
          select: "name coverImage type privacy",
        },
      ],
      options: {
        sort: { createdAt: -1 },
        skip: skip,
        limit: parseInt(limit),
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userIds = user.savedPosts
      .map((post) => post.user?._id)
      .filter(Boolean);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    const postsWithDetails = user.savedPosts.map((post) => {
      const postObj = post.toObject();
      if (postObj.user) {
        postObj.user.profilePicture =
          profilePictureMap[postObj.user._id.toString()] || null;
      }
      postObj.isSaved = true;
      return postObj;
    });

    const totalSavedAfterFilter = postsWithDetails.length;

    res.json({
      success: true,
      data: {
        posts: postsWithDetails,
        total: totalSavedAfterFilter,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalSavedAfterFilter,
          pages: Math.ceil(totalSavedAfterFilter / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get saved posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get saved posts",
    });
  }
};

/**
 * Hide a post
 */
exports.hidePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const post = await Post.findById(postId);
    if (post && post.user && post.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, post.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "You cannot interact with this post",
        });
      }
    }

    await user.hidePost(postId);
    res.json({
      success: true,
      hidden: true,
      message: "Post hidden successfully",
    });
  } catch (error) {
    console.error("Hide post error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to hide post",
    });
  }
};

/**
 * Unhide a post
 */
exports.unhidePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const post = await Post.findById(postId);
    if (post && post.user && post.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, post.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "You cannot interact with this post",
        });
      }
    }

    await user.unhidePost(postId);
    res.json({
      success: true,
      unhidden: true,
      message: "Post unhidden successfully",
    });
  } catch (error) {
    console.error("Unhide post error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to unhide post",
    });
  }
};

/**
 * Get all hidden posts for the current user
 */
exports.getHiddenPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const blockedUserIds = await BlockService.getBlockedUserIds(userId);

    const user = await User.findById(userId).populate({
      path: "hiddenPosts",
      match: {
        isDeleted: false,
        user: { $nin: blockedUserIds },
      },
      populate: [
        {
          path: "user",
          select: "name username email verified profilePicture",
        },
        {
          path: "community",
          select: "name coverImage type privacy",
        },
      ],
      options: {
        sort: { createdAt: -1 },
        skip: skip,
        limit: parseInt(limit),
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userIds = user.hiddenPosts
      .map((post) => post.user?._id)
      .filter(Boolean);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture fullName")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    const postsWithDetails = user.hiddenPosts.map((post) => {
      const postObj = post.toObject();
      if (postObj.user) {
        const profilePicture = profilePictureMap[postObj.user._id.toString()];
        if (profilePicture) {
          postObj.user.profilePicture = profilePicture;
        }
      }
      return postObj;
    });

    const totalAfterFilter = postsWithDetails.length;

    res.json({
      success: true,
      data: {
        posts: postsWithDetails,
        total: totalAfterFilter,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalAfterFilter,
          pages: Math.ceil(totalAfterFilter / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get hidden posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get hidden posts",
    });
  }
};

/**
 * Toggle mute/unmute a user
 */
exports.toggleMuteUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userId: userToMuteId } = req.params;

    if (userId.toString() === userToMuteId) {
      return res.status(400).json({
        success: false,
        message: "You cannot mute yourself",
      });
    }

    const isBlocked = await Block.areUsersBlocked(userId, userToMuteId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Cannot mute this user due to block restrictions",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const result = await user.muteUser(userToMuteId);
    res.json({
      success: true,
      muted: result.muted,
      message: result.message,
    });
  } catch (error) {
    console.error("Toggle mute error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to toggle mute",
    });
  }
};

/**
 * Get all muted users for the current user
 */
exports.getMutedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const blockedUserIds = await BlockService.getBlockedUserIds(userId);

    const user = await User.findById(userId).populate({
      path: "mutedUsers",
      select: "name username email",
      match: { _id: { $nin: blockedUserIds } },
      options: {
        skip: skip,
        limit: parseInt(limit),
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userIds = user.mutedUsers.map((u) => u._id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture fullName")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = {
        profilePicture: profile.profilePicture,
        fullName: profile.fullName,
      };
    });

    const usersWithDetails = user.mutedUsers.map((mutedUser) => {
      const userObj = mutedUser.toObject();
      const profile = profileMap[userObj._id.toString()];
      return {
        ...userObj,
        fullName: profile?.fullName || userObj.name,
        profilePicture: profile?.profilePicture || null,
      };
    });

    const totalAfterFilter = usersWithDetails.length;

    res.json({
      success: true,
      data: {
        users: usersWithDetails,
        total: totalAfterFilter,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalAfterFilter,
          pages: Math.ceil(totalAfterFilter / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get muted users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get muted users",
    });
  }
};

/**
 * Toggle block/unblock a user
 */
exports.toggleBlockUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { userId: userToBlockId } = req.params;
    const { reason } = req.body;

    console.log("Block request - Current user:", userId);
    console.log("Block request - Target user:", userToBlockId);

    // Self-block check
    if (userId.toString() === userToBlockId) {
      return res.status(400).json({
        success: false,
        message: "You cannot block yourself",
      });
    }

    // Validate ObjectId format
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(userToBlockId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(userToBlockId);
    if (!targetUser) {
      console.log("Target user not found:", userToBlockId);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if already blocked
    const existingBlock = await Block.getBlockRecord(userId, userToBlockId);

    if (existingBlock) {
      // UNBLOCK logic
      if (existingBlock.blocker.toString() === userId.toString()) {
        if (existingBlock.blockDirection === "mutual") {
          existingBlock.blockDirection = "one_way";
          existingBlock.blocker = userToBlockId;
          existingBlock.blocked = userId;
          existingBlock.updatedAt = new Date();
          await existingBlock.save();
        } else {
          await Block.deleteOne({ _id: existingBlock._id });
        }
      } else {
        if (existingBlock.blockDirection === "mutual") {
          existingBlock.blockDirection = "one_way";
          existingBlock.updatedAt = new Date();
          await existingBlock.save();
        } else {
          return res.status(403).json({
            success: false,
            message: "You cannot unblock this user",
          });
        }
      }

      // Socket events
      const io = req.app.get("io");
      if (io) {
        io.to(`user_${userToBlockId}`).emit("user_unblocked", {
          unblockedBy: userId,
        });
      }

      // Invalidate cache
      invalidateBlockCache(userId);
      invalidateBlockCache(userToBlockId);

      return res.json({
        success: true,
        blocked: false,
        message: "User unblocked successfully",
      });
    }

    // BLOCK the user
    const result = await BlockService.blockUser(userId, userToBlockId, reason);

    // Socket events
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${userToBlockId}`).emit("block_status_changed", {
        blockedBy: userId,
        timestamp: new Date().toISOString(),
      });

      const ChatRoom = require("../models/ChatRoom");
      const sharedRooms = await ChatRoom.find({
        "participants.userId": { $all: [userId, userToBlockId] },
      });

      sharedRooms.forEach((room) => {
        io.to(`user_${userId}`).emit("left_room", { roomId: room.roomId });
        io.to(`user_${userToBlockId}`).emit("left_room", {
          roomId: room.roomId,
        });
      });

      io.to(`user_${userId}`).emit("presence_clear", { userId: userToBlockId });
      io.to(`user_${userToBlockId}`).emit("presence_clear", { userId: userId });
    }

    // Invalidate cache
    invalidateBlockCache(userId);
    invalidateBlockCache(userToBlockId);

    res.json({
      success: true,
      blocked: true,
      isMutual: result.isMutual || false,
      message: result.isMutual
        ? "User blocked successfully (mutual block)"
        : "User blocked successfully",
    });
  } catch (error) {
    console.error("Toggle block error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to toggle block",
    });
  }
};

/**
 * Get all blocked users for the current user
 */
exports.getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, type = "all" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let blockQuery;
    switch (type) {
      case "blocked_by_me":
        blockQuery = { blocker: userId };
        break;
      case "blocked_me":
        blockQuery = { blocked: userId };
        break;
      default:
        blockQuery = {
          $or: [{ blocker: userId }, { blocked: userId }],
        };
    }

    const [blocks, totalBlocks] = await Promise.all([
      Block.find(blockQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("blocker", "name username email")
        .populate("blocked", "name username email")
        .lean(),
      Block.countDocuments(blockQuery),
    ]);

    const blockedUsersData = blocks.map((block) => {
      const isBlocker = block.blocker._id.toString() === userId.toString();
      const otherUser = isBlocker ? block.blocked : block.blocker;

      return {
        _id: block._id,
        user: {
          _id: otherUser._id,
          name: otherUser.name,
          username: otherUser.username,
          email: otherUser.email,
        },
        direction: block.blockDirection,
        blockedByMe: isBlocker,
        isMutual: block.blockDirection === "mutual",
        blockedAt: block.blockedAt,
        reason: isBlocker ? block.reason : null,
      };
    });

    const userIds = blockedUsersData.map((item) => item.user._id);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture fullName")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = {
        profilePicture: profile.profilePicture,
        fullName: profile.fullName,
      };
    });

    const usersWithDetails = blockedUsersData.map((item) => {
      const profile = profileMap[item.user._id.toString()];
      return {
        ...item,
        user: {
          ...item.user,
          fullName: profile?.fullName || item.user.name,
          profilePicture: profile?.profilePicture || null,
        },
      };
    });

    res.json({
      success: true,
      data: {
        users: usersWithDetails,
        stats: {
          total: totalBlocks,
          blockedByMe: blocks.filter(
            (b) => b.blocker._id.toString() === userId.toString(),
          ).length,
          blockedMe: blocks.filter(
            (b) => b.blocked._id.toString() === userId.toString(),
          ).length,
          mutual: blocks.filter((b) => b.blockDirection === "mutual").length,
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalBlocks,
          pages: Math.ceil(totalBlocks / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get blocked users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get blocked users",
    });
  }
};
