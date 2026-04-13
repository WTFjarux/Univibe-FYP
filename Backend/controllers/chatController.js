/**
 * controllers/chatController.js — REST API for Chat
 *
 * Handles HTTP endpoints for chat functionality including audio messages and reactions
 */

const Message = require("../models/Message");
const User = require("../models/User");
const Profile = require("../models/Profile");
const ChatRoom = require("../models/ChatRoom");

/**
 * Get or create a direct message room
 */
const getOrCreateDirectRoom = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.user.id;

    // Generate room ID (sorted user IDs)
    const roomId = getDirectRoomId(currentUserId, otherUserId);

    let chatRoom = await ChatRoom.findOne({ roomId });

    if (!chatRoom) {
      chatRoom = new ChatRoom({
        roomId,
        type: "direct",
        participants: [
          { userId: currentUserId, joinedAt: new Date(), role: "member" },
          { userId: otherUserId, joinedAt: new Date(), role: "member" },
        ],
        createdBy: currentUserId,
      });
      await chatRoom.save();
    }

    res.status(200).json({
      success: true,
      data: {
        roomId: chatRoom.roomId,
        type: chatRoom.type,
        createdAt: chatRoom.createdAt,
      },
    });
  } catch (error) {
    console.error("Error getting/creating room:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Helper function to generate direct room ID
 */
const getDirectRoomId = (userId1, userId2) => {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

/**
 * Get message history for a room
 */
const getMessageHistory = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;
    const currentUserId = req.user.id;

    let query = { roomId, isDeleted: false };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("sender", "name email")
      .lean();

    // Format messages with reactions and audio duration
    const formattedMessages = messages.map((msg) => ({
      ...msg,
      formattedDuration: msg.duration
        ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, "0")}`
        : null,
      reactions: msg.reactions || [],
    }));

    // Mark messages as read
    await Message.updateMany(
      { roomId, "readBy.userId": { $ne: currentUserId } },
      { $addToSet: { readBy: { userId: currentUserId, readAt: new Date() } } },
    );

    res.status(200).json({
      success: true,
      data: {
        roomId,
        messages: formattedMessages.reverse(),
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting message history:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get user's chat rooms with profile pictures
 */
const getUserChatRooms = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const chatRooms = await ChatRoom.find({
      "participants.userId": currentUserId,
    })
      .populate("participants.userId", "name email")
      .sort({ updatedAt: -1 });

    // Format response with profile pictures
    const formattedRooms = await Promise.all(
      chatRooms.map(async (room) => {
        if (room.type === "direct") {
          // Get other participant info
          const otherParticipant = room.participants.find(
            (p) => p.userId._id.toString() !== currentUserId,
          );

          const otherUserId = otherParticipant?.userId?._id;

          // Fetch profile picture for the other user
          let profilePicture = null;
          if (otherUserId) {
            const profile = await Profile.findOne({ user: otherUserId }).lean();
            if (profile && profile.profilePicture) {
              profilePicture = profile.profilePicture;
            }
          }

          return {
            roomId: room.roomId,
            type: room.type,
            name: otherParticipant?.userId?.name || "Unknown",
            otherUserId: otherUserId || null,
            otherUserAvatar: profilePicture || null,
            lastMessage: room.lastMessage,
            updatedAt: room.updatedAt,
          };
        }

        return {
          roomId: room.roomId,
          type: room.type,
          name: room.name,
          avatar: room.avatar,
          otherUserId: null,
          otherUserAvatar: null,
          lastMessage: room.lastMessage,
          updatedAt: room.updatedAt,
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: formattedRooms,
    });
  } catch (error) {
    console.error("Error getting chat rooms:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Delete a message (soft delete)
 */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.sender.toString() !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    message.isDeleted = true;
    message.deletedFor.push(currentUserId);
    await message.save();

    res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get other user's profile info for chat
 */
const getOtherUserProfile = async (req, res) => {
  try {
    const { otherUserId } = req.params;

    const profile = await Profile.findOne({ user: otherUserId }).lean();
    const user = await User.findById(otherUserId)
      .select("name email username")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profilePicture: profile?.profilePicture || null,
        fullName: profile?.fullName || user.name,
        bio: profile?.bio || "",
        campus: profile?.campus || "",
      },
    });
  } catch (error) {
    console.error("Error getting other user profile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Mark audio message as played
 */
const markAudioAsPlayed = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Update isPlayed field if it exists
    if (message.type === "audio") {
      message.isPlayed = true;
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: "Audio marked as played",
    });
  } catch (error) {
    console.error("Error marking audio as played:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get unplayed audio messages for a room
 */
const getUnplayedAudio = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const unplayedAudio = await Message.find({
      roomId,
      type: "audio",
      isPlayed: false,
      sender: { $ne: userId },
      isDeleted: false,
    }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: unplayedAudio,
    });
  } catch (error) {
    console.error("Error getting unplayed audio:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// REACTION HANDLERS
// ============================================

/**
 * Add or update reaction to a message
 */
const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = req.user.id;

    // Validate reaction
    const validReactions = ["👍", "❤️", "😂", "😮", "😢", "😡"];
    if (!validReactions.includes(reaction)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reaction",
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Initialize reactions array if it doesn't exist
    if (!message.reactions) {
      message.reactions = [];
    }

    // Check if user already reacted
    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId,
    );

    if (existingReactionIndex !== -1) {
      // Update existing reaction
      message.reactions[existingReactionIndex].reaction = reaction;
      message.reactions[existingReactionIndex].createdAt = new Date();
    } else {
      // Add new reaction
      message.reactions.push({
        userId,
        reaction,
        createdAt: new Date(),
      });
    }

    await message.save();

    // Populate user info for reactions
    const populatedMessage = await Message.findById(messageId)
      .populate("reactions.userId", "name username")
      .lean();

    res.status(200).json({
      success: true,
      reactions: populatedMessage.reactions || [],
      message: "Reaction added successfully",
    });
  } catch (error) {
    console.error("Error adding reaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add reaction",
    });
  }
};

/**
 * Remove reaction from a message
 */
const removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Initialize reactions array if it doesn't exist
    if (!message.reactions) {
      message.reactions = [];
    }

    // Remove user's reaction
    message.reactions = message.reactions.filter(
      (r) => r.userId.toString() !== userId,
    );

    await message.save();

    // Populate user info for reactions
    const populatedMessage = await Message.findById(messageId)
      .populate("reactions.userId", "name username")
      .lean();

    res.status(200).json({
      success: true,
      reactions: populatedMessage.reactions || [],
      message: "Reaction removed successfully",
    });
  } catch (error) {
    console.error("Error removing reaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove reaction",
    });
  }
};

/**
 * Get all reactions for a message
 */
const getMessageReactions = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate("reactions.userId", "name username")
      .lean();

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    res.status(200).json({
      success: true,
      reactions: message.reactions || [],
    });
  } catch (error) {
    console.error("Error getting message reactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get reactions",
    });
  }
};

module.exports = {
  getOrCreateDirectRoom,
  getMessageHistory,
  getUserChatRooms,
  deleteMessage,
  getOtherUserProfile,
  markAudioAsPlayed,
  getUnplayedAudio,
  addReaction,
  removeReaction,
  getMessageReactions,
};
