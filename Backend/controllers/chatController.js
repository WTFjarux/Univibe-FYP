// backend/controllers/chatController.js

const Message = require("../models/Message");
const User = require("../models/User");
const Profile = require("../models/Profile");
const ChatRoom = require("../models/ChatRoom");

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate direct room ID (sorted user IDs for consistency)
 */
const getDirectRoomId = (userId1, userId2) => {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

/**
 * Detect reply type from message content
 */
const detectReplyType = (replyTo) => {
  if (!replyTo) return "text";

  if (
    replyTo.message === "🎤 Voice message" ||
    replyTo.message?.includes("Voice message") ||
    replyTo.mediaUrl?.includes("audio")
  ) {
    return "audio";
  }

  if (
    replyTo.message === "📷 Photo" ||
    replyTo.message?.includes("Photo") ||
    replyTo.mediaUrl?.includes("image")
  ) {
    return "image";
  }

  return "text";
};

// ============================================
// CHAT ROOM CONTROLLERS
// ============================================

/**
 * Get or create a direct message room
 */
const getOrCreateDirectRoom = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.user.id;

    const roomId = getDirectRoomId(currentUserId, otherUserId);

    let chatRoom = await ChatRoom.findOne({ roomId });

    if (!chatRoom) {
      chatRoom = new ChatRoom({
        roomId,
        type: "direct",
        // 🔴 FIXED: Pass participant objects (not strings)
        participants: [
          {
            userId: currentUserId,
            joinedAt: new Date(),
            role: "member",
            lastReadAt: new Date(),
          },
          {
            userId: otherUserId,
            joinedAt: new Date(),
            role: "member",
            lastReadAt: new Date(),
          },
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
        participants: chatRoom.participants,
        createdAt: chatRoom.createdAt,
      },
    });
  } catch (error) {
    console.error("Error getting/creating room:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Get user's chat rooms with full read receipt data
 */
const getUserChatRooms = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 🔴 FIXED: Query by participant.userId (embedded document)
    const chatRooms = await ChatRoom.find({
      "participants.userId": currentUserId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    // Format response with profile pictures and read receipts
    const formattedRooms = await Promise.all(
      chatRooms.map(async (room) => {
        // Get the last message
        const lastMessage = await Message.findOne({
          roomId: room.roomId,
          isDeleted: false,
          deletedFor: { $ne: currentUserId },
        })
          .sort({ createdAt: -1 })
          .lean();

        if (room.type === "direct") {
          // Find the other participant's userId
          const otherParticipant = room.participants.find(
            (p) => p.userId.toString() !== currentUserId,
          );

          const otherUserId = otherParticipant?.userId;
          let otherUser = null;
          let profilePicture = null;

          if (otherUserId) {
            otherUser = await User.findById(otherUserId)
              .select("name email username")
              .lean();

            const profile = await Profile.findOne({ user: otherUserId }).lean();
            profilePicture = profile?.profilePicture || null;
          }

          // Build lastMessage with readBy array
          const lastMessageData = lastMessage
            ? {
                message:
                  lastMessage.type === "audio"
                    ? "🎤 Voice message"
                    : lastMessage.message,
                sentAt: lastMessage.createdAt,
                senderId: lastMessage.sender,
                senderName: lastMessage.senderName,
                type: lastMessage.type,
                readBy:
                  lastMessage.readBy?.map(
                    (r) => r.user?.toString() || r.toString(),
                  ) || [],
              }
            : null;

          return {
            roomId: room.roomId,
            type: room.type,
            name: otherUser?.name || "Unknown",
            otherUserId: otherUserId?.toString() || null,
            otherUserAvatar: profilePicture,
            lastMessage: lastMessageData,
            updatedAt: lastMessage?.createdAt || room.updatedAt,
            participants: room.participants.map((p) => p.userId.toString()),
            isPinned: false,
            isMuted: false,
          };
        }

        // Group chat
        return {
          roomId: room.roomId,
          type: room.type,
          name: room.name || "Group Chat",
          avatar: room.avatar,
          otherUserId: null,
          otherUserAvatar: null,
          lastMessage: lastMessage
            ? {
                message:
                  lastMessage.type === "audio"
                    ? "🎤 Voice message"
                    : lastMessage.message,
                sentAt: lastMessage.createdAt,
                senderId: lastMessage.sender,
                senderName: lastMessage.senderName,
                type: lastMessage.type,
                readBy:
                  lastMessage.readBy?.map(
                    (r) => r.user?.toString() || r.toString(),
                  ) || [],
              }
            : null,
          updatedAt: lastMessage?.createdAt || room.updatedAt,
          participants: room.participants.map((p) => p.userId.toString()),
          isPinned: false,
          isMuted: false,
        };
      }),
    );

    // Sort by most recent message
    formattedRooms.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
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
 * Get message history with full read receipt data
 */
const getMessageHistory = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;
    const currentUserId = req.user.id;

    let query = {
      roomId,
      isDeleted: false,
      deletedFor: { $ne: currentUserId },
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("sender", "name email avatar")
      .populate("readBy.user", "name avatar")
      .populate("deliveredTo.user", "name avatar")
      .populate("reactions.user", "name")
      .lean();

    // Format messages with proper read/delivered arrays
    const formattedMessages = messages.map((msg) => ({
      ...msg,
      formattedDuration: msg.duration
        ? `${Math.floor(msg.duration / 60)}:${(msg.duration % 60).toString().padStart(2, "0")}`
        : null,
      reactions: msg.reactions || [],
      readBy: (msg.readBy || []).map((r) => ({
        userId: r.user?._id || r.user,
        readAt: r.readAt,
      })),
      deliveredTo: (msg.deliveredTo || []).map((d) => ({
        userId: d.user?._id || d.user,
        deliveredAt: d.deliveredAt,
      })),
      replyTo: msg.replyTo
        ? {
            messageId: msg.replyTo.messageId,
            message: msg.replyTo.message,
            senderName: msg.replyTo.senderName,
            senderId: msg.replyTo.senderId || null,
            type: msg.replyTo.type || detectReplyType(msg.replyTo),
            mediaUrl: msg.replyTo.mediaUrl || "",
            duration: msg.replyTo.duration || 0,
          }
        : null,
    }));

    // Mark messages as delivered when fetched
    const unDeliveredMessages = messages.filter(
      (msg) =>
        !msg.deliveredTo?.some(
          (d) => d.user?.toString() === currentUserId.toString(),
        ),
    );

    if (unDeliveredMessages.length > 0) {
      await Promise.all(
        unDeliveredMessages.map((msg) =>
          Message.findByIdAndUpdate(
            msg._id,
            {
              $addToSet: {
                deliveredTo: { user: currentUserId, deliveredAt: new Date() },
              },
            },
            { new: true },
          ),
        ),
      );
    }

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
 * Mark all messages in a room as read
 */
const markRoomAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const modifiedCount = await Message.markRoomAsRead(roomId, userId);

    // Update room's lastMessage.readBy
    const room = await ChatRoom.findOne({ roomId });
    if (room?.lastMessage) {
      if (!room.lastMessage.readBy) {
        room.lastMessage.readBy = [];
      }
      if (
        !room.lastMessage.readBy.some(
          (id) => id.toString() === userId.toString(),
        )
      ) {
        room.lastMessage.readBy.push(userId);
        await room.save();
      }
    }

    // Get other participant for socket notification
    const otherParticipant = room?.participants.find(
      (p) => p.userId.toString() !== userId.toString(),
    );

    res.status(200).json({
      success: true,
      message: `Marked ${modifiedCount} messages as read`,
      modifiedCount,
      otherUserId: otherParticipant?.userId.toString() || null,
    });
  } catch (error) {
    console.error("Error marking room as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Mark room as unread for current user
 * This removes the user from readBy array of the last message
 */
const markRoomAsUnread = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Find the room
    const room = await ChatRoom.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Remove user from lastMessage.readBy
    if (room.lastMessage && room.lastMessage.readBy) {
      room.lastMessage.readBy = room.lastMessage.readBy.filter(
        (id) => id.toString() !== userId.toString(),
      );
      await room.save();
    }

    // Also remove user from readBy of the actual last message
    const lastMessage = await Message.findOne({ roomId }).sort({
      createdAt: -1,
    });

    if (lastMessage) {
      lastMessage.readBy = lastMessage.readBy.filter(
        (r) => r.user.toString() !== userId.toString(),
      );
      await lastMessage.save();
    }

    res.status(200).json({
      success: true,
      message: "Room marked as unread",
    });
  } catch (error) {
    console.error("Error marking room as unread:", error);
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

// ============================================
// AUDIO CONTROLLERS
// ============================================

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
      deletedFor: { $ne: userId },
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
// REACTION CONTROLLERS
// ============================================

/**
 * Add or update reaction to a message
 */
const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction, remove } = req.body;
    const userId = req.user.id;

    const validReactions = [
      "👍",
      "❤️",
      "😂",
      "😮",
      "😢",
      "😡",
      "🎉",
      "🙏",
      "👏",
      "🔥",
    ];

    if (!remove && !validReactions.includes(reaction)) {
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

    if (!message.reactions) {
      message.reactions = [];
    }

    if (remove) {
      message.reactions = message.reactions.filter(
        (r) => r.user.toString() !== userId,
      );
    } else {
      const existingIndex = message.reactions.findIndex(
        (r) => r.user.toString() === userId,
      );

      if (existingIndex !== -1) {
        message.reactions[existingIndex].reaction = reaction;
        message.reactions[existingIndex].createdAt = new Date();
      } else {
        message.reactions.push({
          user: userId,
          reaction,
          createdAt: new Date(),
        });
      }
    }

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate("reactions.user", "name username")
      .lean();

    res.status(200).json({
      success: true,
      reactions: populatedMessage.reactions || [],
      message: remove ? "Reaction removed" : "Reaction added",
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

    if (!message.reactions) {
      message.reactions = [];
    }

    message.reactions = message.reactions.filter(
      (r) => r.user.toString() !== userId,
    );

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate("reactions.user", "name username")
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
      .populate("reactions.user", "name username")
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

// ============================================
// EXPORTS
// ============================================

module.exports = {
  getOrCreateDirectRoom,
  getMessageHistory,
  getUserChatRooms,
  markRoomAsRead,
  markRoomAsUnread,
  deleteMessage,
  getOtherUserProfile,
  markAudioAsPlayed,
  getUnplayedAudio,
  addReaction,
  removeReaction,
  getMessageReactions,
};
