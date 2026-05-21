const Story = require("../models/Story");
const User = require("../models/User");
const Message = require("../models/Message");
const ChatRoom = require("../models/ChatRoom");
const Block = require("../models/Block");
const BlockService = require("../services/blockService");
const mongoose = require("mongoose");

// =================== CONSTANTS ===================
const STORY_EXPIRY_HOURS = 24;
const MAX_CAPTION_LENGTH = 2200;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// =================== HELPER FUNCTIONS ===================

/**
 * Generates a deterministic direct message room ID from two user IDs
 * Sorts IDs to ensure same room ID regardless of order
 */
const getDirectRoomId = (id1, id2) => {
  const ids = [id1.toString(), id2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

/**
 * Checks if two users are connected (friends/following)
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
 * Ensures a chat room exists between two users, creating one if needed
 * Only creates room if users are connected
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
 * Deletes stories older than STORY_EXPIRY_HOURS
 * MongoDB TTL index also handles this, but this allows manual cleanup
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
 * Validates caption length against MAX_CAPTION_LENGTH
 */
const validateCaption = (caption) => {
  if (!caption) return true;
  return caption.length <= MAX_CAPTION_LENGTH;
};

/**
 * Counts unique viewer IDs from viewers array
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

/**
 * Emits socket event to connected users when a new story is created
 * Notifies all users who are connected to the story creator
 */
const emitNewStoryEvent = async (io, userId, story) => {
  try {
    // Get all users who have this user in their connections
    const connectedUsers = await User.find({
      connections: userId,
    })
      .select("_id")
      .lean();

    const connectedUserIds = connectedUsers.map((u) => u._id.toString());

    // Emit to each connected user's socket room
    connectedUserIds.forEach((connectedUserId) => {
      io.to(`user_${connectedUserId}`).emit("new_story", {
        userId: userId.toString(),
        story: story,
      });
    });

    console.log(
      `📢 new_story event emitted to ${connectedUserIds.length} users`,
    );
  } catch (error) {
    console.error("emitNewStoryEvent error:", error.message);
    // Non-blocking - story creation succeeds even if notification fails
  }
};

// =================== CONTROLLERS ===================

/**
 * POST /api/stories
 * Creates a new story
 * Body: { caption? }
 * File: media (image/video)
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

    // Validate media presence
    if (!req.file && !req.storyMediaInfo) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Validate file size
    if (req.file && req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `File size cannot exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

    // Determine media URL and type from upload middleware or multer
    const mediaUrl =
      req.storyMediaInfo?.url || `/uploads/stories/${req.file.filename}`;
    const type =
      req.storyMediaInfo?.type ||
      (req.file?.mimetype?.startsWith("video") ? "video" : "image");

    // Create story document
    const story = await Story.create({
      user: userId,
      mediaUrl,
      type,
      caption: caption ? caption.trim() : "",
    });

    // Populate user info for response
    await story.populate("user", "name username avatar");

    // Emit real-time event to connected users (non-blocking)
    const io = req.app?.get("io");
    if (io) {
      emitNewStoryEvent(io, userId, story.toObject()).catch((err) => {
        console.error("Failed to emit new_story event:", err.message);
      });
    }

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
 * GET /api/stories
 * Fetches stories from the current user and their connections
 * Query: { page?, limit? }
 * Returns stories grouped by user with seen/unseen status
 */
exports.getStories = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    // Get user's connections and blocked/muted users in parallel
    const [user, blockedUserIds] = await Promise.all([
      User.findById(userId).select("connections mutedUsers").lean(),
      BlockService.getBlockedUserIds(userId),
    ]);

    const connectionIds = user?.connections || [];
    const mutedUserIds = user?.mutedUsers?.map((id) => id.toString()) || [];

    // Combine blocked and muted users into exclusion list
    const excludedUserIds = [...new Set([...blockedUserIds, ...mutedUserIds])];

    // Filter out blocked/muted users from connections
    const validConnectionIds = connectionIds.filter(
      (id) => !excludedUserIds.includes(id.toString()),
    );

    // Include current user's own stories + valid connections' stories
    const userIdsToFetch = [userId, ...validConnectionIds];

    const twentyFourHoursAgo = new Date(
      Date.now() - STORY_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Aggregate pipeline: fetch, enrich, group, and sort stories
    const stories = await Story.aggregate([
      // Step 1: Filter stories by user and expiry
      {
        $match: {
          user: { $in: userIdsToFetch },
          createdAt: { $gte: twentyFourHoursAgo },
        },
      },
      // Step 2: Sort newest first before grouping
      {
        $sort: { createdAt: -1 },
      },
      // Step 3: Join with users collection for user info
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
      // Step 4: Join with profiles collection for avatar
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
      // Step 5: Compute per-story fields
      {
        $addFields: {
          // FIXED: Use $setUnion for reliable deduplication of viewer IDs
          uniqueViewersCount: {
            $size: {
              $setUnion: [
                {
                  $map: {
                    input: "$viewers",
                    as: "v",
                    in: { $toString: "$$v.userId" },
                  },
                },
              ],
            },
          },
          // Check if current user has viewed this story
          hasCurrentUserViewed: {
            $in: [userId, "$viewers.userId"],
          },
        },
      },
      // Step 6: Group stories by user
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
      // Step 7: Compute group-level fields
      {
        $addFields: {
          // Group has unseen stories if any story hasn't been viewed
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
      // Step 8: Sort groups: unseen first, then by most recent
      {
        $sort: {
          hasUnseen: -1,
          lastStoryTime: -1,
        },
      },
      // Step 9: Paginate
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    // Get total count for pagination metadata
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
 * POST /api/stories/:storyId/view
 * Marks a story as viewed by the current user
 * Uses atomic operation to prevent race condition duplicates
 */
exports.viewStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    // Validate story ID format
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

    // Check story expiry
    const storyAge = Date.now() - new Date(story.createdAt).getTime();
    const expiryMs = STORY_EXPIRY_HOURS * 60 * 60 * 1000;
    if (storyAge > expiryMs) {
      return res.status(410).json({
        success: false,
        message: "Moment has expired",
      });
    }

    // Check block status (skip for own stories)
    if (story.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, story.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "You cannot view this story",
          isBlocked: true,
        });
      }
    }

    // Atomic findOneAndUpdate with $ne condition
    // This prevents race condition where concurrent requests could
    // both pass the hasViewed check and push duplicate viewer entries
    const updatedStory = await Story.findOneAndUpdate(
      {
        _id: storyId,
        "viewers.userId": { $ne: userId }, // Only update if user hasn't viewed
      },
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

    // If updatedStory is null, user already viewed OR story doesn't exist
    if (!updatedStory) {
      // Double-check: story might have been deleted
      const stillExists = await Story.findById(storyId);
      if (!stillExists) {
        return res.status(404).json({
          success: false,
          message: "Moment not found",
        });
      }

      // Story exists but user already viewed it
      return res.status(200).json({
        success: true,
        message: "Story already viewed",
        alreadyViewed: true,
        data: {
          uniqueViewerCount: getUniqueViewersCount(stillExists.viewers),
        },
      });
    }

    // Get accurate unique viewer count from updated document
    const uniqueViewerCount = getUniqueViewersCount(updatedStory.viewers);

    res.status(200).json({
      success: true,
      message: "Story marked as viewed",
      alreadyViewed: false,
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
 * GET /api/stories/:storyId/viewers
 * Returns list of unique viewers for a story (owner only)
 * Uses aggregation to avoid N+1 queries, supports pagination
 */
exports.getStoryViewers = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query; // FIXED: Added pagination

    // Validate story ID
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID",
      });
    }

    // Verify story exists and belongs to current user
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

    // FIXED: Use aggregation to avoid N+1 queries
    // Deduplicate viewers, join with user and profile, paginate
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const viewerDetails = await Story.aggregate([
      // Match the specific story
      { $match: { _id: new mongoose.Types.ObjectId(storyId) } },
      // Unwind viewers array
      { $unwind: "$viewers" },
      // Group by viewer userId to deduplicate, keep latest viewedAt
      {
        $group: {
          _id: "$viewers.userId",
          viewedAt: { $max: "$viewers.viewedAt" },
          viewerDocId: { $first: "$viewers._id" },
        },
      },
      // Sort by most recent view
      { $sort: { viewedAt: -1 } },
      // Lookup user info
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      // Lookup profile for avatar
      {
        $lookup: {
          from: "profiles",
          localField: "_id",
          foreignField: "user",
          as: "profileInfo",
        },
      },
      {
        $unwind: { path: "$profileInfo", preserveNullAndEmptyArrays: true },
      },
      // Shape the output
      {
        $project: {
          _id: "$viewerDocId",
          userId: "$_id",
          userName: { $ifNull: ["$userInfo.name", "Unknown User"] },
          userUsername: "$userInfo.username",
          profilePicture: "$profileInfo.profilePicture",
          viewedAt: "$viewedAt",
        },
      },
      // Get total count before pagination
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: parseInt(limit) }],
        },
      },
    ]);

    const total = viewerDetails[0]?.metadata[0]?.total || 0;
    const data = viewerDetails[0]?.data || [];

    res.status(200).json({
      success: true,
      data: data,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalViewers: total,
        hasMore: skip + data.length < total,
      },
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
 * POST /api/stories/:storyId/reply
 * Sends a reply to a story, creating a chat message with story_reply type
 * Requires: connection between users, no block
 */
exports.replyToStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { message, storyData } = req.body;
    const userId = req.user._id;

    // Validate story ID
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID",
      });
    }

    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Reply message is required",
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Reply message cannot exceed 1000 characters",
      });
    }

    // Find story with owner info
    const story = await Story.findById(storyId).populate("user", "name");
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Moment not found",
      });
    }

    // Check story expiry
    const storyAge = Date.now() - new Date(story.createdAt).getTime();
    const expiryMs = STORY_EXPIRY_HOURS * 60 * 60 * 1000;
    if (storyAge > expiryMs) {
      return res.status(410).json({
        success: false,
        message: "Story has expired, cannot reply",
      });
    }

    // Prevent self-reply
    if (story.user._id.toString() === userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot reply to your own story",
      });
    }

    // Check block status
    const isBlocked = await Block.areUsersBlocked(userId, story.user._id);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You cannot reply to this story",
      });
    }

    // Check connection status
    const isConnected = await areUsersConnected(userId, story.user._id);
    if (!isConnected) {
      return res.status(403).json({
        success: false,
        message: "You must be connected with this user to reply",
      });
    }

    // Get or create chat room
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

    // Create reply message with story metadata
    const reply = await Message.create({
      sender: userId,
      senderName: sender.name,
      senderAvatar: sender.avatar || "",
      roomId,
      message: message.trim(),
      type: "story_reply",
      story: {
        storyId,
        mediaUrl: storyData?.mediaUrl || story.mediaUrl,
        thumbnailUrl: storyData?.thumbnailUrl || story.mediaUrl,
        caption: storyData?.caption || story.caption,
        storyOwnerId: story.user._id,
      },
    });

    await reply.populate("sender", "name avatar");

    // Emit real-time events
    const io = req.app?.get("io");
    if (io) {
      const storyOwnerSocketRoom = `user_${story.user._id}`;

      // Notify story owner about the reply
      io.to(storyOwnerSocketRoom).emit("story_reply_received", {
        storyId,
        message: reply,
        replierName: sender.name,
        replierId: userId,
      });

      // Send message to the chat room
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
 * DELETE /api/stories/:storyId
 * Deletes a story (owner only)
 * Emits socket event to notify connected clients
 */
exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user._id;

    // Validate story ID
    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID",
      });
    }

    // Find story
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Moment not found",
      });
    }

    // Check expiry status (for informative message only)
    const storyAge = Date.now() - new Date(story.createdAt).getTime();
    const expiryMs = STORY_EXPIRY_HOURS * 60 * 60 * 1000;
    const isExpired = storyAge > expiryMs;

    // Only owner can delete
    if (story.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own stories",
      });
    }

    // Delete the story
    await Story.findByIdAndDelete(storyId);

    // Emit deletion event for real-time UI updates
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
 * GET /api/stories/expired/cleanup (or called via cron)
 * Manually triggers cleanup of expired stories
 */
exports.cleanupExpiredStories = async (req, res) => {
  try {
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

// Export for cron jobs or other modules
exports.deleteExpiredStories = deleteExpiredStories;
