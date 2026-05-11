// backend/controllers/storyController.js

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

const getDirectRoomId = (id1, id2) => {
  const ids = [id1.toString(), id2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

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

const validateCaption = (caption) => {
  if (!caption) return true;
  return caption.length <= MAX_CAPTION_LENGTH;
};

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

exports.createStory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { caption } = req.body;

    if (caption && !validateCaption(caption)) {
      return res.status(400).json({
        success: false,
        message: `Caption cannot exceed ${MAX_CAPTION_LENGTH} characters`,
      });
    }

    if (!req.file && !req.storyMediaInfo) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    if (req.file && req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `File size cannot exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      });
    }

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

exports.getStories = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const [user, blockedUserIds] = await Promise.all([
      User.findById(userId).select("connections mutedUsers").lean(),
      BlockService.getBlockedUserIds(userId),
    ]);

    const connectionIds = user?.connections || [];
    const mutedUserIds = user?.mutedUsers?.map((id) => id.toString()) || [];
    const excludedUserIds = [...new Set([...blockedUserIds, ...mutedUserIds])];

    const validConnectionIds = connectionIds.filter(
      (id) => !excludedUserIds.includes(id.toString()),
    );

    const userIdsToFetch = [userId, ...validConnectionIds];

    const twentyFourHoursAgo = new Date(
      Date.now() - STORY_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const stories = await Story.aggregate([
      {
        $match: {
          user: { $in: userIdsToFetch },
          createdAt: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $sort: { createdAt: -1 },
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
        $addFields: {
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
          hasUnseen: -1,
          lastStoryTime: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

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

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Moment not found",
      });
    }

    const storyAge = Date.now() - new Date(story.createdAt).getTime();
    const expiryMs = STORY_EXPIRY_HOURS * 60 * 60 * 1000;
    if (storyAge > expiryMs) {
      return res.status(410).json({
        success: false,
        message: "Moment has expired",
      });
    }

    if (story.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, story.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "You cannot view this story",
        });
      }
    }

    const hasViewed = story.viewers.some(
      (viewer) => viewer.userId.toString() === userId.toString(),
    );

    if (hasViewed) {
      return res.status(200).json({
        success: true,
        message: "Story already viewed",
        alreadyViewed: true,
      });
    }

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

    if (story.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view viewers of your own stories",
      });
    }

    const uniqueViewersMap = new Map();
    story.viewers.forEach((viewer) => {
      const viewerId = viewer.userId.toString();
      if (!uniqueViewersMap.has(viewerId)) {
        uniqueViewersMap.set(viewerId, viewer);
      }
    });

    const uniqueViewers = Array.from(uniqueViewersMap.values());
    uniqueViewers.sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

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

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Reply message cannot exceed 1000 characters",
      });
    }

    const story = await Story.findById(storyId).populate("user", "name");
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Moment not found",
      });
    }

    const storyAge = Date.now() - new Date(story.createdAt).getTime();
    const expiryMs = STORY_EXPIRY_HOURS * 60 * 60 * 1000;
    if (storyAge > expiryMs) {
      return res.status(410).json({
        success: false,
        message: "Story has expired, cannot reply",
      });
    }

    if (story.user._id.toString() === userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Cannot reply to your own story",
      });
    }

    const isBlocked = await Block.areUsersBlocked(userId, story.user._id);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "You cannot reply to this story",
      });
    }

    const isConnected = await areUsersConnected(userId, story.user._id);
    if (!isConnected) {
      return res.status(403).json({
        success: false,
        message: "You must be connected with this user to reply",
      });
    }

    const roomId = getDirectRoomId(userId, story.user._id);
    const room = await ensureRoomExists(roomId, userId);
    if (!room) {
      return res.status(500).json({
        success: false,
        message: "Failed to create or find chat room",
      });
    }

    const sender = await User.findById(userId).select("name avatar");

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

    const io = req.app?.get("io");
    if (io) {
      const storyOwnerSocketRoom = `user_${story.user._id}`;
      io.to(storyOwnerSocketRoom).emit("story_reply_received", {
        storyId,
        message: reply,
        replierName: sender.name,
        replierId: userId,
      });

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

exports.deleteExpiredStories = deleteExpiredStories;
