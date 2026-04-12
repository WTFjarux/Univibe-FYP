/**
 * controllers/chatController.js — REST API for Chat
 *
 * Handles HTTP endpoints for chat functionality
 */

const Message = require("../models/Message");
const User = require("../models/User");
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

    // Mark messages as read
    await Message.updateMany(
      { roomId, "readBy.userId": { $ne: currentUserId } },
      { $addToSet: { readBy: { userId: currentUserId, readAt: new Date() } } },
    );

    res.status(200).json({
      success: true,
      data: {
        roomId,
        messages: messages.reverse(),
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting message history:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get user's chat rooms
 */
const getUserChatRooms = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const chatRooms = await ChatRoom.find({
      "participants.userId": currentUserId,
    })
      .populate("participants.userId", "name email")
      .sort({ updatedAt: -1 });

    // Format response
    const formattedRooms = chatRooms.map((room) => {
      if (room.type === "direct") {
        // Get other participant info
        const otherParticipant = room.participants.find(
          (p) => p.userId._id.toString() !== currentUserId,
        );
        return {
          roomId: room.roomId,
          type: room.type,
          name: otherParticipant?.userId?.name || "Unknown",
          lastMessage: room.lastMessage,
          updatedAt: room.updatedAt,
        };
      }

      return {
        roomId: room.roomId,
        type: room.type,
        name: room.name,
        avatar: room.avatar,
        lastMessage: room.lastMessage,
        updatedAt: room.updatedAt,
      };
    });

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
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    if (message.sender.toString() !== currentUserId) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
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

module.exports = {
  getOrCreateDirectRoom,
  getMessageHistory,
  getUserChatRooms,
  deleteMessage,
};
