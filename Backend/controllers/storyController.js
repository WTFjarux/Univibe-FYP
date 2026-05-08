// Backend/controllers/storyController.js

const Story = require("../models/Story");
const User = require("../models/User");
const Message = require("../models/Message");
const ChatRoom = require("../models/ChatRoom");
const mongoose = require("mongoose");

// =================== CONSTANTS ===================
const STORY_EXPIRY_HOURS = 24;
const MAX_CAPTION_LENGTH = 2200;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for videos, 10MB for images (adjust as needed)

// =================== HELPER FUNCTIONS ===================

/**
 * Generate direct chat room ID between two users
 */
const getDirectRoomId = (id1, id2) => {
  const ids = [id1.toString(), id2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

/**
 * Check if two users are connected
 */
const areUsersConnected = async (userId1, userId2) => {
  try {
    const user = await User.findById(userId1).select("connections").lean();
    if (!user || !user.connections) return false;
    return user.connections.some(
      (connId) => connId.toString() === userId2.toString(),
    );
  } catch (error) {
    console.error("areUsersConnected error:", error.message);
    return false;
  }
};

/**
 * Ensure chat room exists and return it
 */
const ensureRoomExists = async (roomId, userId) => {
  try {
    let room = await ChatRoom.findOne({ roomId });
    if (!room && roomId.startsWith("direct_")) {
      const parts = roomId.split("_");
      if (parts.length >= 3) {
        const user1 = parts[1];
        const user2 = parts[2];
        const otherUserId = user1 === userId.toString() ? user2 : user1;
        if (otherUserId.match(/^[0-9a-fA-F]{24}$/)) {
          const isConnected = await areUsersConnected(userId, otherUserId);
          if (!isConnected) return null;
          room = await ChatRoom.create({
            roomId,
            type: "direct",
            participants: [
              {
                userId,
                joinedAt: new Date(),
                role: "member",
                lastReadAt: new Date(),
              },
              {
                userId: new mongoose.Types.ObjectId(otherUserId),
                joinedAt: new Date(),
                role: "member",
                lastReadAt: new Date(),
              },
            ],
          });
        }
      }
    }
    return room;
  } catch (error) {
    console.error("ensureRoomExists error:", error.message);
    return null;
  }
};

/**
 * Delete expired stories (older than 24 hours)
 * Should be called by a cron job
 */
const deleteExpiredStories = async () => {
  try {
    const expiryDate = new Date(
      Date.now() - STORY_EXPIRY_HOURS * 60 * 60 * 1000,
    );
    const result = await Story.deleteMany({ createdAt: { $lt: expiryDate } });
    if (result.deletedCount > 0) {
      console.log(`Deleted ${result.deletedCount} expired stories`);
    }
    return result;
  } catch (error) {
    console.error("Error deleting expired stories:", error);
    return null;
  }
};

/**
 * Validate story caption length
 */
const validateCaption = (caption) => {
  if (!caption) return true;
  return caption.length <= MAX_CAPTION_LENGTH;
};

/**
 * Get unique viewers count for a story
 */
const getUniqueViewersCount = (viewers) => {
  const uniqueUserIds = new Set();
  viewers.forEach((viewer) => {
    if (viewer.userId) {
      uniqueUserIds.add(viewer.userId.toString());
    }
  });
  return uniqueUserIds.size;
};

// =================== CONTROLLERS ===================

/**
 * POST /stories
 * Upload a new story
 */
exports.createStory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { caption } = req.body;

    // Validate caption length
    if (caption && !validateCaption(caption)) {
      return res.status(400).json({
        success: false,
        message: `Caption cannot exceed ${MAX_CAPTION_LENGTH} characters`,
      });
    }

    // Check for uploaded file using the middleware's attached info
    if (!req.file && !req.storyMediaInfo) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Check file size (if available)
    if (req.file && req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `File size cannot exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    // Use the story media info from the middleware
    const mediaUrl =
      req.storyMediaInfo?.url || `/uploads/stories/${req.file.filename}`;
    const type =
      req.storyMediaInfo?.type ||
      (req.file?.mimetype?.startsWith("video") ? "video" : "image");

    const story = await Story.create({
      user: userId,
      mediaUrl,
      type,
      caption: caption ? caption.trim() : "",
    });

    // Populate user info
    await story.populate("user", "name username avatar");

    res.status(201).json({
      success: true,
      message: "Story created successfully",
      data: story,
    });
  } catch (error) {
    console.error("Error creating story:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create story",
      error: error.message,
    });
  }
};

/**
 * GET /stories
 * Fetch stories from user's connections
 * Only stories from last 24 hours
 * Grouped by user
 */
exports.getStories = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    // Get user's connections
    const user = await User.findById(userId).select("connections").lean();
    const connectionIds = user?.connections || [];

    // Include user's own ID to fetch their stories
    const userIdsToFetch = [userId, ...connectionIds];

    // Fetch stories from last 24 hours
    const twentyFourHoursAgo = new Date(
      Date.now() - STORY_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    // Pagination calculation
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const stories = await Story.aggregate([
      {
        $match: {
          user: { $in: userIdsToFetch },
          createdAt: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $sort: { createdAt: -1 }, // Most recent first
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $lookup: {
          from: "profiles",
          localField: "user",
          foreignField: "user",
          as: "profileInfo",
        },
      },
      {
        $unwind: {
          path: "$profileInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        // Process viewers to ensure unique entries and get viewed status
        $addFields: {
          // Ensure viewers have userId and get unique count
          uniqueViewersCount: {
            $size: {
              $reduce: {
                input: "$viewers",
                initialValue: [],
                in: {
                  $cond: {
                    if: { $in: ["$$this.userId", "$$value"] },
                    then: "$$value",
                    else: { $concatArrays: ["$$value", ["$$this.userId"]] },
                  },
                },
              },
            },
          },
          hasCurrentUserViewed: {
            $in: [userId, "$viewers.userId"],
          },
        },
      },
      {
        $group: {
          _id: "$user",
          userId: { $first: "$user" },
          userName: { $first: "$userInfo.name" },
          userUsername: { $first: "$userInfo.username" },
          profilePicture: { $first: "$profileInfo.profilePicture" },
          stories: {
            $push: {
              _id: "$_id",
              mediaUrl: "$mediaUrl",
              type: "$type",
              caption: "$caption",
              createdAt: "$createdAt",
              viewers: "$viewers",
              uniqueViewersCount: "$uniqueViewersCount",
              hasCurrentUserViewed: "$hasCurrentUserViewed",
            },
          },
        },
      },
      {
        $addFields: {
          hasUnseen: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: "$stories",
                    as: "story",
                    cond: { $eq: ["$$story.hasCurrentUserViewed", false] },
                  },
                },
              },
              0,
            ],
          },
          totalStories: { $size: "$stories" },
          lastStoryTime: { $max: "$stories.createdAt" },
        },
      },
      {
        $sort: {
          hasUnseen: -1, // Stories with unseen content first
          lastStoryTime: -1, // Most recent stories first
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    // Get total count for pagination
    const totalStoriesCount = await Story.countDocuments({
      user: { $in: userIdsToFetch },
      createdAt: { $gte: twentyFourHoursAgo },
    });

    res.status(200).json({
      success: true,
      data: stories,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(stories.length / parseInt(limit)),
        totalStories: totalStoriesCount,
        hasMore: skip + stories.length < totalStoriesCount,
      },
    });
  } catch (error) {
    console.error("Error fetching stories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stories",
      error: error.message,
    });
  }
};

/**
 * POST /stories/:storyId/view
 * Mark story as viewed (prevents duplicate entries)
 */
exports.viewStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID",
      });
    }

    // Check if story exists and hasn't expired
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Moment not found",
      });
    }

    // Check if story is expired
    const storyAge = Date.now() - new Date(story.createdAt).getTime();
    const expiryMs = STORY_EXPIRY_HOURS * 60 * 60 * 1000;
    if (storyAge > expiryMs) {
      return res.status(410).json({
        success: false,
        message: "Moment has expired",
      });
    }

    // Check if user has already viewed this story
    const hasViewed = story.viewers.some(
      (viewer) => viewer.userId.toString() === userId.toString(),
    );

    if (hasViewed) {
      // Already viewed, just return success without updating
      return res.status(200).json({
        success: true,
        message: "Story already viewed",
        alreadyViewed: true,
      });
    }

    // Add new viewer (only once per user)
    const updatedStory = await Story.findByIdAndUpdate(
      storyId,
      {
        $push: {
          viewers: {
            userId,
            viewedAt: new Date(),
          },
        },
      },
      { new: true },
    );

    // Get unique viewer count
    const uniqueViewerCount = getUniqueViewersCount(updatedStory.viewers);

    res.status(200).json({
      success: true,
      message: "Story marked as viewed",
      data: {
        uniqueViewerCount,
      },
    });
  } catch (error) {
    console.error("Error viewing story:", error);
    res.status(500).json({
      success: false,
      message: "Failed to view story",
      error: error.message,
    });
  }
};

/**
 * GET /stories/:storyId/viewers
 * Get list of unique viewers for a story
 */
exports.getStoryViewers = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID",
      });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Moment not found",
      });
    }

    // Only story owner can view viewers list
    if (story.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view viewers of your own stories",
      });
    }

    // Get unique viewers with user details
    const uniqueViewersMap = new Map();
    story.viewers.forEach((viewer) => {
      const viewerId = viewer.userId.toString();
      if (!uniqueViewersMap.has(viewerId)) {
        uniqueViewersMap.set(viewerId, viewer);
      }
    });

    const uniqueViewers = Array.from(uniqueViewersMap.values());

    // Sort by viewedAt (most recent first)
    uniqueViewers.sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

    // Populate user details
    const viewerDetails = await Promise.all(
      uniqueViewers.map(async (viewer) => {
        const user = await User.findById(viewer.userId)
          .select("name username")
          .lean();
        const profile = await mongoose
          .model("Profile")
          .findOne({ user: viewer.userId })
          .select("profilePicture")
          .lean();

        return {
          _id: viewer._id,
          userId: viewer.userId,
          userName: user?.name || "Unknown User",
          userUsername: user?.username,
          profilePicture: profile?.profilePicture,
          viewedAt: viewer.viewedAt,
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: viewerDetails,
      total: viewerDetails.length,
    });
  } catch (error) {
    console.error("Error fetching story viewers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch viewers",
      error: error.message,
    });
  }
};

/**
 * POST /stories/:storyId/reply
 * Send a reply to a story (creates a chat message with type "story_reply")
 */
exports.replyToStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { message, storyData } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID",
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required",
      });
    }

    // Max message length validation
    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Reply message cannot exceed 1000 characters",
      });
    }

    // Get story and check if it exists
    const story = await Story.findById(storyId).populate("user", "name");
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Moment not found",
      });
    }

    // Check if story has expired
    const storyAge = Date.now() - new Date(story.createdAt).getTime();
    const expiryMs = STORY_EXPIRY_HOURS * 60 * 60 * 1000;
    if (storyAge > expiryMs) {
      return res.status(410).json({
        success: false,
        message: "Story has expired, cannot reply",
      });
    }

    // Cannot reply to own story
    if (story.user._id.toString() === userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot reply to your own story",
      });
    }

    // Check if users are connected
    const isConnected = await areUsersConnected(userId, story.user._id);
    if (!isConnected) {
      return res.status(403).json({
        success: false,
        message: "You must be connected with this user to reply",
      });
    }

    // Get or create direct chat room
    const roomId = getDirectRoomId(userId, story.user._id);
    const room = await ensureRoomExists(roomId, userId);
    if (!room) {
      return res.status(500).json({
        success: false,
        message: "Failed to create or find chat room",
      });
    }

    // Get sender info
    const sender = await User.findById(userId).select("name avatar");

    // Create story reply message
    const reply = await Message.create({
      sender: userId,
      senderName: sender.name,
      senderAvatar: sender.avatar || "",
      roomId,
      message: message.trim(),
      type: "story_reply",
      story: {
        storyId,
        mediaUrl: storyData?.mediaUrl || story.mediaUrl, // 
        thumbnailUrl: storyData?.thumbnailUrl || story.mediaUrl, 
        caption: storyData?.caption || story.caption,
        storyOwnerId: story.user._id,
      },
    });

    // Populate full reply data
    await reply.populate("sender", "name avatar");

    // =================== EMIT SOCKET EVENT ===================
    const io = req.app?.get("io");
    if (io) {
      // Emit to story owner's room
      const storyOwnerSocketRoom = `user_${story.user._id}`;
      io.to(storyOwnerSocketRoom).emit("story_reply_received", {
        storyId,
        message: reply,
        replierName: sender.name,
        replierId: userId,
      });

      // Emit to chat room to update message list
      io.to(roomId).emit("receive_message", {
        _id: reply._id,
        roomId,
        message: reply.message,
        type: "story_reply",
        sender: {
          _id: userId,
          name: sender.name,
          avatar: sender.avatar,
        },
        story: reply.story,
        createdAt: reply.createdAt,
      });

      // Trigger unread count update for story owner
      io.to(storyOwnerSocketRoom).emit("unread_count_changed");
    }

    res.status(201).json({
      success: true,
      message: "Reply sent successfully",
      data: reply,
    });
  } catch (error) {
    console.error("Error replying to story:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send reply",
      error: error.message,
    });
  }
};

/**
 * DELETE /stories/:storyId
 * Delete a story (only by owner)
 */
exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID",
      });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Moment not found",
      });
    }

    // Check if story is already expired
    const storyAge = Date.now() - new Date(story.createdAt).getTime();
    const expiryMs = STORY_EXPIRY_HOURS * 60 * 60 * 1000;
    const isExpired = storyAge > expiryMs;

    if (story.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own stories",
      });
    }

    await Story.findByIdAndDelete(storyId);

    // Emit socket event for story deletion
    const io = req.app?.get("io");
    if (io) {
      io.emit("story_deleted", {
        storyId,
        userId,
      });
    }

    res.status(200).json({
      success: true,
      message: isExpired
        ? "Story already expired and removed"
        : "Story deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting story:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete story",
      error: error.message,
    });
  }
};

/**
 * GET /stories/expired/cleanup
 * Manual endpoint to trigger cleanup of expired stories (Admin only)
 * Should be protected with admin middleware
 */
exports.cleanupExpiredStories = async (req, res) => {
  try {
    // Add admin check here if needed
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: "Admin access required" });
    // }

    const result = await deleteExpiredStories();

    res.status(200).json({
      success: true,
      message: `Cleaned up ${result?.deletedCount || 0} expired stories`,
      deletedCount: result?.deletedCount || 0,
    });
  } catch (error) {
    console.error("Error cleaning up stories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cleanup stories",
      error: error.message,
    });
  }
};

// Export cleanup function for cron jobs
exports.deleteExpiredStories = deleteExpiredStories;
