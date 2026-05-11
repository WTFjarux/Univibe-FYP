// backend/controllers/chatController.js

const Message = require("../models/Message");
const User = require("../models/User");
const Profile = require("../models/Profile");
const ChatRoom = require("../models/ChatRoom");
const Block = require("../models/Block");
const BlockService = require("../services/blockService");
const fs = require("fs");
const mongoose = require("mongoose");

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const getDirectRoomId = (id1, id2) => {
  const ids = [id1.toString(), id2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

const formatMessage = (msg, currentUserId) => ({
  _id: msg._id,
  sender: msg.sender?._id || msg.sender,
  senderName: msg.senderName,
  senderAvatar: msg.sender?.avatar || msg.senderAvatar,
  roomId: msg.roomId,
  message: msg.message,
  type: msg.type,
  createdAt: msg.createdAt,
  status: msg.status,
  mediaUrl: msg.mediaUrl,
  mediaName: msg.mediaName,
  mediaSize: msg.mediaSize,
  duration: msg.duration,
  thumbnailUrl: msg.thumbnailUrl,
  locationData: msg.locationData,
  isForwarded: msg.isForwarded || false,
  originalMessageId: msg.originalMessageId || null,
  originalSenderId: msg.originalSenderId || null,
  originalSenderName: msg.originalSenderName || null,
  forwardedAt: msg.forwardedAt || null,
  sharedPost: msg.sharedPost || null,
  story: msg.story || null,
  replyTo: msg.replyTo?.messageId
    ? {
        messageId: msg.replyTo.messageId,
        message: msg.replyTo.message,
        senderName: msg.replyTo.senderName,
        senderId: msg.replyTo.senderId,
        type: msg.replyTo.type || "text",
        mediaUrl: msg.replyTo.mediaUrl,
        thumbnailUrl: msg.replyTo.thumbnailUrl || "",
        duration: msg.replyTo.duration,
      }
    : null,
  reactions: (msg.reactions || []).map((r) => ({
    userId: r.user?._id || r.user,
    reaction: r.reaction,
    createdAt: r.createdAt,
    userName: r.user?.name,
  })),
  readBy: (msg.readBy || []).map((r) => r.user?._id || r.user),
  deliveredTo: (msg.deliveredTo || []).map((d) => ({
    user: d.user?._id || d.user,
    deliveredAt: d.deliveredAt,
  })),
});

const isUserBlocked = async (userId, targetUserId) => {
  try {
    return await Block.areUsersBlocked(userId, targetUserId);
  } catch (error) {
    console.error("isUserBlocked error:", error);
    return true;
  }
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

        const isBlocked = await isUserBlocked(userId, otherUserId);
        if (isBlocked) return null;

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
              userId: otherUserId,
              joinedAt: new Date(),
              role: "member",
              lastReadAt: new Date(),
            },
          ],
          createdBy: userId,
          messageCount: 0,
        });
      }
    }
  }
  return room;
};

// -----------------------------------------------------------------------------
// Room Controllers
// -----------------------------------------------------------------------------

exports.getOrCreateDirectRoom = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user.id;

    if (!otherUserId || !otherUserId.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID format" });
    }

    if (otherUserId === userId) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot create chat with yourself" });
    }

    const isBlocked = await isUserBlocked(userId, otherUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Cannot start chat with this user due to blocking",
        isBlocked: true,
      });
    }

    const otherUser = await User.findById(otherUserId)
      .select("_id name")
      .lean();
    if (!otherUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isConnected = await areUsersConnected(userId, otherUserId);
    if (!isConnected) {
      return res.status(403).json({
        success: false,
        message:
          "You can only chat with your connections. Please connect first.",
      });
    }

    const roomId = getDirectRoomId(userId, otherUserId);
    let room = await ChatRoom.findOne({ roomId });

    if (!room) {
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
            userId: otherUserId,
            joinedAt: new Date(),
            role: "member",
            lastReadAt: new Date(),
          },
        ],
        createdBy: userId,
        messageCount: 0,
      });
    }

    const clearedAt = room.getClearTimestamp
      ? room.getClearTimestamp(userId)
      : null;
    const isCleared = room.isClearedByUser
      ? room.isClearedByUser(userId)
      : false;

    res.json({
      success: true,
      data: {
        roomId: room.roomId,
        type: room.type,
        name: room.name || otherUser.name,
        isCleared,
        clearedAt,
        isActive: room.isActive !== false,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (e) {
    console.error("getOrCreateDirectRoom error:", e.message);
    if (e.name === "ValidationError") {
      const messages = Object.values(e.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: messages,
      });
    }
    if (e.name === "CastError")
      return res
        .status(400)
        .json({ success: false, message: "Invalid ID format" });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getUserChatRooms = async (req, res) => {
  try {
    const blockedUserIds = await BlockService.getBlockedUserIds(req.user.id);

    const rooms = await ChatRoom.find({
      "participants.userId": req.user.id,
      isActive: { $ne: false },
      $or: [{ messageCount: { $gt: 0 } }, { type: "group" }],
    })
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = await Promise.all(
      rooms.map(async (room) => {
        const clearedEntry = (room.clearedBy || []).find(
          (c) => c.user.toString() === req.user.id,
        );
        const clearedAt = clearedEntry ? clearedEntry.clearedAt : null;
        const messageQuery = {
          roomId: room.roomId,
          isDeleted: false,
          deletedFor: { $ne: req.user.id },
        };
        if (clearedAt) messageQuery.createdAt = { $gt: clearedAt };
        const lastMsg = await Message.findOne(messageQuery)
          .sort({ createdAt: -1 })
          .select("message type createdAt sender senderName readBy")
          .lean();

        let otherUser = null,
          otherProfile = null;
        if (room.type === "direct") {
          const otherParticipant = room.participants.find(
            (p) => p.userId.toString() !== req.user.id,
          );
          if (otherParticipant) {
            const otherId = otherParticipant.userId.toString();
            if (blockedUserIds.includes(otherId)) {
              return null;
            }
            otherUser = await User.findById(otherParticipant.userId)
              .select("name username")
              .lean();
            otherProfile = await Profile.findOne({
              user: otherParticipant.userId,
            })
              .select("profilePicture")
              .lean();
          }
        }

        const unreadQuery = {
          roomId: room.roomId,
          sender: { $ne: req.user.id },
          "readBy.user": { $ne: req.user.id },
          isDeleted: false,
          deletedFor: { $ne: req.user.id },
        };
        if (clearedAt) unreadQuery.createdAt = { $gt: clearedAt };
        const unreadCount = await Message.countDocuments(unreadQuery);

        return {
          roomId: room.roomId,
          type: room.type,
          name:
            room.type === "group"
              ? room.name
              : otherUser?.name || room.name || "Unknown",
          groupIcon: room.groupIcon || null,
          groupPhoto: room.groupPhoto || room.groupIcon || null,
          groupDescription: room.groupDescription || "",
          participantCount: room.participants?.length || 0,
          otherUserId:
            room.type === "direct" ? otherUser?._id?.toString() || null : null,
          otherUserAvatar: otherProfile?.profilePicture || null,
          isCleared: !!clearedAt,
          clearedAt,
          unreadCount: unreadCount || 0,
          lastMessage: lastMsg
            ? {
                message:
                  lastMsg.type === "audio"
                    ? "Voice message"
                    : lastMsg.type === "story_reply"
                      ? "📸 Story reply"
                      : lastMsg.message,
                sentAt: lastMsg.createdAt,
                senderId: lastMsg.sender?.toString(),
                senderName: lastMsg.senderName,
                type: lastMsg.type,
                readBy: (lastMsg.readBy || []).map(
                  (r) => r.user?.toString() || r.toString(),
                ),
              }
            : null,
          updatedAt: lastMsg?.createdAt || room.updatedAt,
          createdAt: room.createdAt,
          participants: room.participants.map((p) => p.userId.toString()),
          groupSettings: room.groupSettings || null,
          isPinned: room.isPinned || false,
          isMuted: room.isMuted || false,
        };
      }),
    );

    const filtered = formatted.filter(Boolean);

    res.json({ success: true, data: filtered });
  } catch (e) {
    console.error("getUserChatRooms error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getRoomDetails = async (req, res) => {
  try {
    const room = await ChatRoom.findOne({ roomId: req.params.roomId })
      .populate("participants.userId", "name username avatar")
      .lean();

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    const isParticipant = room.participants.some(
      (p) => (p.userId?._id || p.userId).toString() === req.user.id,
    );
    if (!isParticipant) {
      return res
        .status(403)
        .json({ success: false, message: "Not a participant" });
    }

    if (room.type === "direct") {
      const otherParticipant = room.participants.find(
        (p) => (p.userId?._id || p.userId).toString() !== req.user.id,
      );
      if (otherParticipant) {
        const otherId = (
          otherParticipant.userId?._id || otherParticipant.userId
        ).toString();
        const isBlocked = await isUserBlocked(req.user.id, otherId);
        if (isBlocked) {
          return res.status(403).json({
            success: false,
            message: "Cannot access this chat due to blocking",
            isBlocked: true,
          });
        }
      }
    }

    const participantIds = room.participants.map(
      (p) => p.userId?._id || p.userId,
    );
    const profiles = await Profile.find({ user: { $in: participantIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((p) => {
      profilePictureMap[p.user.toString()] = p.profilePicture || "";
    });

    const clearedEntry = (room.clearedBy || []).find(
      (c) => c.user.toString() === req.user.id,
    );

    const formattedParticipants = room.participants.map((p) => {
      const uid = (p.userId?._id || p.userId).toString();
      return {
        userId: uid,
        name: p.userId?.name || "Unknown",
        username: p.userId?.username || "",
        avatar: profilePictureMap[uid] || p.userId?.avatar || "",
        role: p.role || "member",
        joinedAt: p.joinedAt,
        lastReadAt: p.lastReadAt,
      };
    });

    let otherUser = null;
    if (room.type === "direct") {
      const otherParticipant = room.participants.find(
        (p) => (p.userId?._id || p.userId).toString() !== req.user.id,
      );
      if (otherParticipant) {
        const uid = otherParticipant.userId?._id || otherParticipant.userId;
        const user = await User.findById(uid).select("name username").lean();
        const profile = await Profile.findOne({ user: uid })
          .select("profilePicture")
          .lean();
        otherUser = {
          _id: user?._id,
          name: user?.name,
          username: user?.username,
          avatar: profile?.profilePicture || null,
        };
      }
    }

    res.json({
      success: true,
      data: {
        roomId: room.roomId,
        type: room.type,
        name: room.name,
        groupIcon: room.groupIcon,
        groupPhoto: room.groupPhoto || room.groupIcon,
        groupDescription: room.groupDescription,
        participantCount: room.participants?.length || 0,
        participants: formattedParticipants,
        groupSettings: room.groupSettings,
        createdBy: room.createdBy,
        lastMessage: room.lastMessage,
        messageCount: room.messageCount,
        otherUser,
        isCleared: !!clearedEntry,
        clearedAt: clearedEntry ? clearedEntry.clearedAt : null,
        updatedAt: room.updatedAt,
        createdAt: room.createdAt,
        isActive: room.isActive !== false,
      },
    });
  } catch (e) {
    console.error("getRoomDetails error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteChatHistory = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const room = await ChatRoom.findOne({ roomId });
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Chat room not found" });
    if (!room.participants.some((p) => p.userId.toString() === userId))
      return res
        .status(403)
        .json({ success: false, message: "Not a participant" });
    room.clearedBy = room.clearedBy.filter(
      (entry) => entry.user.toString() !== userId,
    );
    room.clearedBy.push({
      user: userId,
      clearedAt: new Date(),
      restoreOnNewMessage: true,
    });
    await room.save();
    res.json({
      success: true,
      message: "Chat history deleted successfully",
      roomId,
    });
  } catch (e) {
    console.error("deleteChatHistory error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// Message Controllers
// -----------------------------------------------------------------------------

exports.getMessageHistory = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;

    const room = await ChatRoom.findOne({ roomId })
      .select("clearedBy type participants")
      .lean();

    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    let otherUserId = null;
    if (room.type === "direct") {
      const otherParticipant = room.participants.find(
        (p) => p.userId.toString() !== req.user.id,
      );
      if (otherParticipant) {
        otherUserId = otherParticipant.userId.toString();
      }
    }

    if (otherUserId) {
      const isBlocked = await isUserBlocked(req.user.id, otherUserId);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Cannot access messages due to blocking",
          isBlocked: true,
        });
      }
    }

    if (!room.participants.some((p) => p.userId.toString() === req.user.id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not a participant" });
    }

    const clearedEntry = (room.clearedBy || []).find(
      (c) => c.user.toString() === req.user.id,
    );
    const clearedAt = clearedEntry ? clearedEntry.clearedAt : null;

    const messages = await Message.getMessages(
      roomId,
      parseInt(limit),
      before,
      req.user.id,
    );

    res.json({
      success: true,
      data: {
        roomId,
        roomType: room.type,
        messages: messages.reverse().map((m) => formatMessage(m, req.user.id)),
        hasMore: messages.length === parseInt(limit),
        clearedAt,
        isCleared: !!clearedAt,
      },
    });
  } catch (e) {
    console.error("getMessageHistory error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getMessagesLight = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 30, before } = req.query;
    const room = await ChatRoom.findOne({ roomId })
      .select("clearedBy type participants")
      .lean();
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    if (!room.participants.some((p) => p.userId.toString() === req.user.id))
      return res
        .status(403)
        .json({ success: false, message: "Not a participant" });

    if (room.type === "direct") {
      const otherParticipant = room.participants.find(
        (p) => p.userId.toString() !== req.user.id,
      );
      if (otherParticipant) {
        const isBlocked = await isUserBlocked(
          req.user.id,
          otherParticipant.userId.toString(),
        );
        if (isBlocked) {
          return res.status(403).json({
            success: false,
            message: "Cannot access messages due to blocking",
            isBlocked: true,
          });
        }
      }
    }

    const clearedEntry = (room.clearedBy || []).find(
      (c) => c.user.toString() === req.user.id,
    );
    const clearedAt = clearedEntry ? clearedEntry.clearedAt : null;
    const messages = await Message.getMessagesLight(
      roomId,
      parseInt(limit),
      before,
      req.user.id,
    );
    res.json({
      success: true,
      data: {
        roomId,
        roomType: room.type,
        messages: messages.reverse().map((m) => formatMessage(m, req.user.id)),
        hasMore: messages.length === parseInt(limit),
        clearedAt,
        isCleared: !!clearedAt,
      },
    });
  } catch (e) {
    console.error("getMessagesLight error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg)
      return res.status(404).json({ success: false, message: "Not found" });
    if (msg.sender.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: "Unauthorized" });
    msg.isDeleted = true;
    msg.deletedFor.push(req.user.id);
    await msg.save();
    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    console.error("deleteMessage error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markMessageAsRead = async (req, res) => {
  try {
    const msg = await Message.markMessageAsRead(
      req.params.messageId,
      req.user.id,
    );
    if (!msg)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: msg });
  } catch (e) {
    console.error("markMessageAsRead error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markMessageAsDelivered = async (req, res) => {
  try {
    const msg = await Message.markMessageAsDelivered(
      req.params.messageId,
      req.user.id,
    );
    res.json({ success: true, data: msg });
  } catch (e) {
    console.error("markMessageAsDelivered error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// Forwarding Messages
// -----------------------------------------------------------------------------

exports.forwardMessage = async (req, res) => {
  try {
    const { messageId, targetChatIds } = req.body;
    const userId = req.user.id;
    if (
      !messageId ||
      !targetChatIds ||
      !Array.isArray(targetChatIds) ||
      targetChatIds.length === 0
    )
      return res.status(400).json({
        success: false,
        message: "messageId and targetChatIds required",
      });
    if (targetChatIds.length > 10)
      return res
        .status(400)
        .json({ success: false, message: "Maximum 10 chats" });

    for (const targetRoomId of targetChatIds) {
      const room = await ChatRoom.findOne({ roomId: targetRoomId }).lean();
      if (room && room.type === "direct") {
        const otherParticipant = room.participants.find(
          (p) => p.userId.toString() !== userId,
        );
        if (otherParticipant) {
          const isBlocked = await isUserBlocked(
            userId,
            otherParticipant.userId.toString(),
          );
          if (isBlocked) {
            return res.status(403).json({
              success: false,
              message: "Cannot forward to this chat due to blocking",
              isBlocked: true,
            });
          }
        }
      }
    }

    const originalMessage = await Message.findById(messageId)
      .populate("sender", "name")
      .lean();
    if (!originalMessage)
      return res
        .status(404)
        .json({ success: false, message: "Original message not found" });
    if (originalMessage.isDeleted)
      return res
        .status(400)
        .json({ success: false, message: "Cannot forward deleted message" });
    const originalRoom = await ChatRoom.findOne({
      roomId: originalMessage.roomId,
    });
    if (!originalRoom)
      return res
        .status(404)
        .json({ success: false, message: "Original chat room not found" });
    if (!originalRoom.isParticipant(userId))
      return res.status(403).json({ success: false, message: "No access" });
    const targetRooms = await ChatRoom.find({
      roomId: { $in: targetChatIds },
      "participants.userId": userId,
    }).lean();
    const validRoomIds = targetRooms.map((r) => r.roomId);
    if (!validRoomIds.length)
      return res
        .status(400)
        .json({ success: false, message: "No valid target chats" });
    const user = await User.findById(userId).select("name").lean();
    const profile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();
    const forwardedMessages = [];
    const io = req.app.get("io");
    await Promise.all(
      validRoomIds.map(async (targetRoomId) => {
        if (targetRoomId === originalMessage.roomId) return;
        const forwardedData = {
          sender: userId,
          senderName: user?.name || "Unknown",
          senderAvatar: profile?.profilePicture || "",
          roomId: targetRoomId,
          message: originalMessage.message,
          type: originalMessage.type,
          isForwarded: true,
          originalMessageId: originalMessage._id,
          originalSenderId:
            originalMessage.sender._id || originalMessage.sender,
          originalSenderName:
            originalMessage.senderName ||
            originalMessage.sender?.name ||
            "Unknown",
          forwardedAt: new Date(),
          readBy: [{ user: userId, readAt: new Date() }],
          deliveredTo: [{ user: userId, deliveredAt: new Date() }],
        };
        if (["image", "video", "file"].includes(originalMessage.type)) {
          forwardedData.mediaUrl = originalMessage.mediaUrl || "";
          forwardedData.thumbnailUrl = originalMessage.thumbnailUrl || "";
          forwardedData.mediaSize = originalMessage.mediaSize || 0;
          forwardedData.mediaName = originalMessage.mediaName || "";
          forwardedData.mediaMimeType = originalMessage.mediaMimeType || "";
          if (originalMessage.type === "video" && originalMessage.duration)
            forwardedData.duration = originalMessage.duration;
        } else if (originalMessage.type === "audio") {
          forwardedData.mediaUrl = originalMessage.mediaUrl || "";
          forwardedData.duration = originalMessage.duration || 0;
        } else if (originalMessage.type === "location") {
          forwardedData.locationData = originalMessage.locationData || {};
        }
        if (originalMessage.replyTo?.messageId) {
          forwardedData.replyTo = {
            messageId: originalMessage.replyTo.messageId,
            message: originalMessage.replyTo.message,
            senderName: originalMessage.replyTo.senderName,
            senderId: originalMessage.replyTo.senderId,
            type: originalMessage.replyTo.type || "text",
            mediaUrl: originalMessage.replyTo.mediaUrl,
            thumbnailUrl: originalMessage.replyTo.thumbnailUrl || "",
            duration: originalMessage.replyTo.duration,
          };
        }
        const forwardedMessage = await Message.create(forwardedData);
        forwardedMessages.push(forwardedMessage);
        await ChatRoom.findOneAndUpdate(
          { roomId: targetRoomId },
          {
            lastMessage: {
              message: forwardedData.message?.substring(0, 100) || "",
              sentAt: new Date(),
              senderId: userId,
              senderName: user?.name || "Unknown",
              type: originalMessage.type,
              readBy: [userId],
            },
            updatedAt: new Date(),
            $inc: { messageCount: 1 },
            $pull: { clearedBy: { user: userId } },
          },
        );
        if (io) {
          const populated = await Message.findById(forwardedMessage._id)
            .populate("sender", "name avatar")
            .lean();
          io.to(targetRoomId).emit(
            "receive_message",
            formatMessage(populated, userId),
          );
        }
      }),
    );
    const successful = forwardedMessages.filter(Boolean);
    res.json({
      success: true,
      message: `Forwarded to ${successful.length} chat(s)`,
      data: {
        forwardedCount: successful.length,
        forwardedMessages: successful.map((m) => formatMessage(m, userId)),
      },
    });
  } catch (e) {
    console.error("forwardMessage error:", e);
    res
      .status(500)
      .json({ success: false, message: "Failed to forward message" });
  }
};

// -----------------------------------------------------------------------------
// Read / Unread
// -----------------------------------------------------------------------------

exports.markRoomAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    if (!roomId || !userId)
      return res
        .status(400)
        .json({ success: false, message: "Missing roomId or userId" });
    let room = await ensureRoomExists(roomId, userId);
    if (!room)
      return res.json({
        success: true,
        message: "No room to mark as read",
        modifiedCount: 0,
      });
    await ChatRoom.findOneAndUpdate(
      { roomId },
      { $set: { "participants.$[elem].lastReadAt": new Date() } },
      { arrayFilters: [{ "elem.userId": userId }] },
    );
    const currentRoom = await ChatRoom.findOne({ roomId }).lean();
    if (currentRoom?.lastMessage?.sender?.toString() !== userId)
      await ChatRoom.findOneAndUpdate(
        { roomId },
        { $addToSet: { "lastMessage.readBy": userId } },
      );
    const modifiedCount = await Message.markRoomAsRead(roomId, userId);
    res.json({ success: true, message: "Marked as read", modifiedCount });
  } catch (error) {
    console.error("markRoomAsRead error:", error.message);
    res.json({
      success: true,
      message: "Read receipt processed",
      modifiedCount: 0,
    });
  }
};

exports.markRoomAsUnread = async (req, res) => {
  try {
    const lastMsg = await Message.findOne({
      roomId: req.params.roomId,
      isDeleted: false,
    }).sort({ createdAt: -1 });
    if (lastMsg) {
      lastMsg.readBy = lastMsg.readBy.filter(
        (r) => r.user.toString() !== req.user.id,
      );
      await lastMsg.save();
    }
    res.json({ success: true });
  } catch (e) {
    console.error("markRoomAsUnread error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// Share Post, Uploads, Audio, Reactions, User
// -----------------------------------------------------------------------------

exports.sharePost = async (req, res) => {
  try {
    const { postId, targetChatIds, comment } = req.body;
    const userId = req.user.id;

    if (
      !postId ||
      !targetChatIds ||
      !Array.isArray(targetChatIds) ||
      targetChatIds.length === 0
    ) {
      return res
        .status(400)
        .json({ success: false, message: "postId and targetChatIds required" });
    }

    if (targetChatIds.length > 10) {
      return res
        .status(400)
        .json({ success: false, message: "Maximum 10 chats" });
    }

    for (const targetRoomId of targetChatIds) {
      const room = await ChatRoom.findOne({ roomId: targetRoomId }).lean();
      if (room && room.type === "direct") {
        const otherParticipant = room.participants.find(
          (p) => p.userId.toString() !== userId,
        );
        if (otherParticipant) {
          const isBlocked = await isUserBlocked(
            userId,
            otherParticipant.userId.toString(),
          );
          if (isBlocked) {
            return res.status(403).json({
              success: false,
              message:
                "Cannot share post with a user who has blocked you or you have blocked",
              isBlocked: true,
            });
          }
        }
      }
    }

    const Post = require("../models/Post");
    const post = await Post.findById(postId)
      .populate("user", "name username")
      .lean();

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    const postAuthorId = post.user?._id || post.user;
    const authorProfile = await Profile.findOne({ user: postAuthorId })
      .select("profilePicture")
      .lean();

    const targetRooms = await ChatRoom.find({
      roomId: { $in: targetChatIds },
      "participants.userId": userId,
    }).lean();

    const validRoomIds = targetRooms.map((r) => r.roomId);
    if (!validRoomIds.length) {
      return res
        .status(400)
        .json({ success: false, message: "No valid target chats" });
    }

    const user = await User.findById(userId).select("name").lean();
    const profile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    const sharedMessages = [];
    const io = req.app.get("io");

    await Promise.all(
      validRoomIds.map(async (targetRoomId) => {
        const messageText = comment || "";
        const postImage =
          post.images && post.images.length > 0 ? post.images[0].url : "";

        const sharedPostData = {
          sender: userId,
          senderName: user?.name || "Unknown",
          senderAvatar: profile?.profilePicture || "",
          roomId: targetRoomId,
          message: messageText,
          type: "post",
          sharedPost: {
            postId: post._id,
            postContent: post.content ? post.content.substring(0, 200) : "",
            postImage,
            postAuthorId,
            postAuthorName: post.isAnonymous
              ? "Anonymous"
              : post.user?.name || "Unknown",
            postAuthorUsername: post.isAnonymous
              ? "anonymous"
              : post.user?.username || "user",
            postAuthorAvatar: post.isAnonymous
              ? ""
              : authorProfile?.profilePicture || "",
            isAnonymous: post.isAnonymous || false,
            postCreatedAt: post.createdAt,
          },
          readBy: [{ user: userId, readAt: new Date() }],
          deliveredTo: [{ user: userId, deliveredAt: new Date() }],
        };

        const sharedMessage = await Message.create(sharedPostData);
        sharedMessages.push(sharedMessage);

        await ChatRoom.findOneAndUpdate(
          { roomId: targetRoomId },
          {
            lastMessage: {
              message: messageText || "Shared a post",
              sentAt: new Date(),
              senderId: userId,
              senderName: user?.name || "Unknown",
              type: "post",
              readBy: [userId],
            },
            updatedAt: new Date(),
            $inc: { messageCount: 1 },
            $pull: { clearedBy: { user: userId } },
          },
        );

        if (io) {
          const populated = await Message.findById(sharedMessage._id)
            .populate("sender", "name avatar")
            .lean();
          io.to(targetRoomId).emit(
            "receive_message",
            formatMessage(populated, userId),
          );
        }
      }),
    );

    res.json({
      success: true,
      message: `Post shared to ${sharedMessages.length} chat(s)`,
      data: {
        sharedCount: sharedMessages.length,
        sharedMessages: sharedMessages.map((m) => formatMessage(m, userId)),
      },
    });
  } catch (e) {
    console.error("sharePost error:", e);
    res.status(500).json({ success: false, message: "Failed to share post" });
  }
};

exports.uploadAudio = async (req, res) => {
  try {
    const {
      roomId,
      duration,
      replyToId,
      replyToMessage,
      replyToSender,
      replyToSenderId,
      replyToType,
      replyToMediaUrl,
      replyToDuration,
    } = req.body;
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file" });

    const room = await ChatRoom.findOne({ roomId }).lean();
    if (room && room.type === "direct") {
      const otherParticipant = room.participants.find(
        (p) => p.userId.toString() !== req.user.id,
      );
      if (otherParticipant) {
        const isBlocked = await isUserBlocked(
          req.user.id,
          otherParticipant.userId.toString(),
        );
        if (isBlocked) {
          if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(403).json({
            success: false,
            message: "Cannot send message due to blocking",
            isBlocked: true,
          });
        }
      }
    }

    await ensureRoomExists(roomId, req.user.id);
    const user = await User.findById(req.user.id);
    const profile = await Profile.findOne({ user: req.user.id });
    const audioUrl = `/uploads/chat/audio/${req.file.filename}`;
    const data = {
      sender: req.user.id,
      senderName: user.name,
      senderAvatar: profile?.profilePicture || "",
      roomId,
      message: "Voice message",
      type: "audio",
      mediaUrl: audioUrl,
      mediaSize: req.file.size,
      mediaName: req.file.originalname,
      mediaMimeType: req.file.mimetype,
      duration: parseInt(duration) || 0,
      readBy: [{ user: req.user.id, readAt: new Date() }],
      deliveredTo: [{ user: req.user.id, deliveredAt: new Date() }],
    };
    if (replyToId)
      data.replyTo = {
        messageId: replyToId,
        message: replyToMessage,
        senderName: replyToSender,
        senderId: replyToSenderId,
        type: replyToType,
        mediaUrl: replyToMediaUrl,
        duration: parseInt(replyToDuration) || 0,
      };
    const msg = await Message.create(data);
    const io = req.app.get("io");
    if (io)
      io.to(roomId).emit("receive_message", formatMessage(msg, req.user.id));
    await ChatRoom.findOneAndUpdate(
      { roomId },
      {
        lastMessage: {
          message: "Voice message",
          sentAt: new Date(),
          senderId: req.user.id,
          senderName: user.name,
          type: "audio",
          readBy: [req.user.id],
        },
        updatedAt: new Date(),
        $inc: { messageCount: 1 },
        $pull: { clearedBy: { user: req.user.id } },
      },
      { upsert: true },
    );
    res.json({
      success: true,
      url: audioUrl,
      data: formatMessage(msg, req.user.id),
    });
  } catch (e) {
    console.error("uploadAudio error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.uploadAttachments = async (req, res) => {
  try {
    const { roomId } = req.body;

    const room = await ChatRoom.findOne({ roomId }).lean();
    if (room && room.type === "direct") {
      const otherParticipant = room.participants.find(
        (p) => p.userId.toString() !== req.user.id,
      );
      if (otherParticipant) {
        const isBlocked = await isUserBlocked(
          req.user.id,
          otherParticipant.userId.toString(),
        );
        if (isBlocked) {
          if (req.files?.length) {
            req.files.forEach((file) => {
              if (file.path && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            });
          }
          return res.status(403).json({
            success: false,
            message: "Cannot send message due to blocking",
            isBlocked: true,
          });
        }
      }
    }

    const user = await User.findById(req.user.id);
    const profile = await Profile.findOne({ user: req.user.id });
    await ensureRoomExists(roomId, req.user.id);
    if (req.body.type === "location") {
      const loc =
        typeof req.body.locationData === "string"
          ? JSON.parse(req.body.locationData)
          : req.body.locationData;
      const msg = await Message.create({
        sender: req.user.id,
        senderName: user.name,
        senderAvatar: profile?.profilePicture || "",
        roomId,
        message: `Location: ${loc?.locationName || "Unknown"}`,
        type: "location",
        locationData: loc,
        readBy: [{ user: req.user.id }],
        deliveredTo: [{ user: req.user.id }],
      });
      const io = req.app.get("io");
      if (io)
        io.to(roomId).emit("receive_message", formatMessage(msg, req.user.id));
      await ChatRoom.findOneAndUpdate(
        { roomId },
        {
          lastMessage: {
            message: msg.message,
            sentAt: new Date(),
            senderId: req.user.id,
            senderName: user.name,
            type: "location",
            readBy: [req.user.id],
          },
          updatedAt: new Date(),
          $inc: { messageCount: 1 },
          $pull: { clearedBy: { user: req.user.id } },
        },
        { upsert: true },
      );
      return res.json({
        success: true,
        data: [formatMessage(msg, req.user.id)],
      });
    }
    if (!req.files?.length)
      return res.status(400).json({ success: false, message: "No files" });
    const messages = await Promise.all(
      req.files.map(async (file) => {
        const isImage = file.mimetype?.startsWith("image/"),
          isVideo = file.mimetype?.startsWith("video/");
        let messageText = `File: ${file.originalname}`,
          messageType = "file";
        if (isImage) {
          messageText = "Photo";
          messageType = "image";
        } else if (isVideo) {
          messageText = "Video";
          messageType = "video";
        }
        const messageData = {
          sender: req.user.id,
          senderName: user.name,
          senderAvatar: profile?.profilePicture || "",
          roomId,
          message: messageText,
          type: messageType,
          mediaUrl: `/uploads/chat/attachments/${file.filename}`,
          thumbnailUrl: file.thumbnailUrl || "",
          mediaSize: file.size,
          mediaName: file.originalname,
          mediaMimeType: file.mimetype,
          readBy: [{ user: req.user.id }],
          deliveredTo: [{ user: req.user.id }],
        };
        if (isVideo && file.metadata?.duration)
          messageData.duration = Math.round(file.metadata.duration);
        return Message.create(messageData);
      }),
    );
    const io = req.app.get("io");
    const formattedMessages = messages.map((m) =>
      formatMessage(m, req.user.id),
    );
    if (io)
      formattedMessages.forEach((msg) =>
        io.to(roomId).emit("receive_message", msg),
      );
    const lastMsg = messages[messages.length - 1];
    let lastMessageText = lastMsg.message;
    if (messages.length > 1) {
      const typeCount = messages.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
      }, {});
      const parts = [];
      if (typeCount.image)
        parts.push(`${typeCount.image} photo${typeCount.image > 1 ? "s" : ""}`);
      if (typeCount.video)
        parts.push(`${typeCount.video} video${typeCount.video > 1 ? "s" : ""}`);
      if (typeCount.file)
        parts.push(`${typeCount.file} file${typeCount.file > 1 ? "s" : ""}`);
      lastMessageText = `Sent ${parts.join(", ")}`;
    }
    await ChatRoom.findOneAndUpdate(
      { roomId },
      {
        lastMessage: {
          message: lastMessageText,
          sentAt: new Date(),
          senderId: req.user.id,
          senderName: user.name,
          type: lastMsg.type,
          readBy: [req.user.id],
        },
        updatedAt: new Date(),
        $inc: { messageCount: messages.length },
        $pull: { clearedBy: { user: req.user.id } },
      },
      { upsert: true },
    );
    res.json({ success: true, data: formattedMessages });
  } catch (e) {
    console.error("uploadAttachments error:", e);
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.markAudioAsPlayed = async (req, res) => {
  try {
    await Message.markAudioAsPlayed(req.params.messageId);
    res.json({ success: true });
  } catch (e) {
    console.error("markAudioAsPlayed error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.addReaction = async (req, res) => {
  try {
    const { reaction, remove } = req.body;
    if (remove) {
      const msg = await Message.removeReaction(
        req.params.messageId,
        req.user.id,
      );
      return res.json({ success: true, reactions: msg?.reactions || [] });
    }
    const msg = await Message.toggleReaction(
      req.params.messageId,
      req.user.id,
      reaction,
    );
    res.json({ success: true, reactions: msg?.reactions || [] });
  } catch (e) {
    console.error("addReaction error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeReaction = async (req, res) => {
  try {
    const msg = await Message.removeReaction(req.params.messageId, req.user.id);
    res.json({ success: true, reactions: msg?.reactions || [] });
  } catch (e) {
    console.error("removeReaction error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getOtherUserProfile = async (req, res) => {
  try {
    const isBlocked = await isUserBlocked(req.user.id, req.params.otherUserId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Cannot view this profile due to blocking",
        isBlocked: true,
      });
    }

    const user = await User.findById(req.params.otherUserId)
      .select("name username")
      .lean();
    const profile = await Profile.findOne({ user: req.params.otherUserId })
      .select("profilePicture bio")
      .lean();
    if (!user)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({
      success: true,
      data: {
        ...user,
        profilePicture: profile?.profilePicture,
        bio: profile?.bio,
      },
    });
  } catch (e) {
    console.error("getOtherUserProfile error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getUnreadChatCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;

    const blockedUserIds = await BlockService.getBlockedUserIds(userId);

    const rooms = await ChatRoom.find({
      "participants.userId": userId,
      isActive: { $ne: false },
    }).select("roomId clearedBy participants type");

    let totalUnread = 0;

    for (const room of rooms) {
      if (room.type === "direct") {
        const otherParticipant = room.participants.find(
          (p) => p.userId.toString() !== userId.toString(),
        );
        if (
          otherParticipant &&
          blockedUserIds.includes(otherParticipant.userId.toString())
        ) {
          continue;
        }
      }

      const clearedEntry = (room.clearedBy || []).find(
        (c) => c.user.toString() === userId.toString(),
      );
      const clearedAt = clearedEntry ? clearedEntry.clearedAt : null;

      const unreadQuery = {
        roomId: room.roomId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
        isDeleted: false,
        deletedFor: { $ne: userId },
      };

      if (clearedAt) {
        unreadQuery.createdAt = { $gt: clearedAt };
      }

      const count = await Message.countDocuments(unreadQuery);
      totalUnread += count;
    }

    res.json({
      success: true,
      count: totalUnread,
    });
  } catch (error) {
    console.error("Get unread chat count error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get unread chat count",
    });
  }
};
