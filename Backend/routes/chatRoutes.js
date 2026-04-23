// backend/routes/chatRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const {
  uploadAudioMessage,
  uploadAttachments,
  uploadSingleAttachment,
} = require("../middleware/uploadMiddleware");
const fs = require("fs");

// Import models
const User = require("../models/User");
const Profile = require("../models/Profile");
const Message = require("../models/Message");
const ChatRoom = require("../models/ChatRoom");

// Import controllers
const {
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
  markRoomAsRead,
  markRoomAsUnread,
} = require("../controllers/chatController");

// All routes require authentication
router.use(protect);

// ============================================
// CHAT ROOMS - SPECIFIC ROUTES FIRST
// ============================================

// Get all chat rooms for current user
router.get("/rooms", getUserChatRooms);

// Get or create direct room with another user
router.get("/room/:otherUserId", getOrCreateDirectRoom);

// Get other user's profile
router.get("/user-profile/:otherUserId", getOtherUserProfile);

// Specific routes - Must come BEFORE /room/:roomId
router.post("/room/:roomId/read", markRoomAsRead);
router.post("/room/:roomId/unread", markRoomAsUnread);
router.get("/room/:roomId/unread-count", async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const count = await Message.getUnreadCount(roomId, userId);
    res.json({ success: true, data: { unreadCount: count } });
  } catch (error) {
    console.error("Get unread count error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get unread count" });
  }
});

// Generic route - Keep AFTER specific routes
router.get("/room/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const room = await ChatRoom.findOne({ roomId }).lean();
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }

    let otherUser = null;
    if (room.type === "direct") {
      const otherUserId = room.participants.find(
        (p) => p.toString() !== userId.toString(),
      );
      if (otherUserId) {
        otherUser = await User.findById(otherUserId)
          .select("name email")
          .lean();
        const otherProfile = await Profile.findOne({ user: otherUserId })
          .select("profilePicture")
          .lean();
        if (otherUser) otherUser.avatar = otherProfile?.profilePicture || "";
      }
    }

    res.json({ success: true, data: { ...room, otherUser } });
  } catch (error) {
    console.error("Get room error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get room details" });
  }
});

// ============================================
// UNREAD COUNTS
// ============================================

router.get("/unread-counts", async (req, res) => {
  try {
    const userId = req.user.id;
    const unreadCounts = await Message.getAllUnreadCounts(userId);
    const countsMap = {};
    unreadCounts.forEach((item) => {
      countsMap[item._id] = item.unreadCount;
    });
    res.json({ success: true, data: countsMap });
  } catch (error) {
    console.error("Get unread counts error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get unread counts" });
  }
});

// ============================================
// MESSAGES
// ============================================

router.get("/messages/:roomId", getMessageHistory);
router.delete("/message/:messageId", deleteMessage);

router.post("/message/:messageId/read", async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const message = await Message.markMessageAsRead(messageId, userId);
    if (!message)
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    res.json({ success: true, data: message });
  } catch (error) {
    console.error("Mark message as read error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark message as read" });
  }
});

router.post("/message/:messageId/delivered", async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const message = await Message.markMessageAsDelivered(messageId, userId);
    if (!message)
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    res.json({ success: true, data: message });
  } catch (error) {
    console.error("Mark message as delivered error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark message as delivered" });
  }
});

// ============================================
// AUDIO MESSAGES
// ============================================

router.post("/upload-audio", uploadAudioMessage, async (req, res) => {
  try {
    if (!req.file || !req.audioInfo) {
      return res
        .status(400)
        .json({ success: false, message: "No audio file uploaded" });
    }

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

    const userId = req.user.id;

    if (!fs.existsSync(req.file.path)) {
      return res
        .status(500)
        .json({ success: false, message: "File not saved properly" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const profile = await Profile.findOne({ user: userId });
    const audioUrl =
      req.audioInfo.url || `/uploads/chat/audio/${req.file.filename}`;

    const messageData = {
      sender: userId,
      senderName: user.name,
      senderAvatar: profile?.profilePicture || "",
      roomId,
      message: "🎤 Voice message",
      type: "audio",
      mediaUrl: audioUrl,
      mediaSize: req.file.size,
      mediaName: req.file.originalname || `voice_${Date.now()}.m4a`,
      mediaMimeType: req.file.mimetype,
      duration: parseInt(duration) || 0,
      status: "sent",
      readBy: [{ user: userId, readAt: new Date() }],
      deliveredTo: [{ user: userId, deliveredAt: new Date() }],
    };

    if (replyToId) {
      messageData.replyTo = {
        messageId: replyToId,
        message: replyToMessage || "Media message",
        senderName: replyToSender || "Unknown",
        senderId: replyToSenderId || null,
        type: replyToType || "text",
        mediaUrl: replyToMediaUrl || "",
        duration: replyToDuration ? parseInt(replyToDuration) : 0,
      };
    }

    const message = new Message(messageData);
    const savedMessage = await message.save();

    await ChatRoom.findOneAndUpdate(
      { roomId },
      {
        lastMessage: {
          message: "🎤 Voice message",
          sentAt: new Date(),
          senderId: userId,
          senderName: user.name,
          type: "audio",
          readBy: [userId],
        },
        updatedAt: new Date(),
        $inc: { messageCount: 1 },
      },
      { upsert: true },
    );

    res.status(200).json({
      success: true,
      url: audioUrl,
      data: {
        _id: savedMessage._id,
        type: savedMessage.type,
        duration: savedMessage.duration,
        createdAt: savedMessage.createdAt,
        mediaUrl: savedMessage.mediaUrl,
        replyTo: savedMessage.replyTo,
        readBy: savedMessage.readBy,
        deliveredTo: savedMessage.deliveredTo,
      },
    });
  } catch (error) {
    console.error("Audio upload error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to upload audio: " + error.message,
      });
  }
});

router.put("/audio/:messageId/played", markAudioAsPlayed);
router.get("/rooms/:roomId/unplayed-audio", getUnplayedAudio);

// ============================================
// 🔴 ATTACHMENT UPLOADS (MULTIPLE FILES)
// ============================================

// Upload multiple attachments (images, videos, documents)
router.post("/upload-attachments", uploadAttachments, async (req, res) => {
  try {
    const { roomId, tempId } = req.body;
    const userId = req.user.id;

    if (!roomId) {
      return res
        .status(400)
        .json({ success: false, message: "Room ID is required" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const profile = await Profile.findOne({ user: userId });

    // Handle location shares (no files needed)
    if (req.body.type === "location") {
      const locationObj =
        typeof req.body.locationData === "string"
          ? JSON.parse(req.body.locationData)
          : req.body.locationData;

      const messageData = {
        sender: userId,
        senderName: user.name,
        senderAvatar: profile?.profilePicture || "",
        roomId,
        message: `📍 ${locationObj?.locationName || "Location Shared"}`,
        type: "location",
        locationData: locationObj,
        status: "sent",
        readBy: [{ user: userId, readAt: new Date() }],
        deliveredTo: [{ user: userId, deliveredAt: new Date() }],
      };

      const message = new Message(messageData);
      const savedMessage = await message.save();

      await ChatRoom.findOneAndUpdate(
        { roomId },
        {
          lastMessage: {
            message: messageData.message,
            sentAt: new Date(),
            senderId: userId,
            senderName: user.name,
            type: "location",
            readBy: [userId],
          },
          updatedAt: new Date(),
          $inc: { messageCount: 1 },
        },
        { upsert: true },
      );

      return res.status(200).json({
        success: true,
        data: [
          {
            _id: savedMessage._id,
            type: "location",
            locationData: savedMessage.locationData,
            createdAt: savedMessage.createdAt,
            sender: savedMessage.sender,
            senderName: savedMessage.senderName,
          },
        ],
      });
    }

    // Handle file uploads
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });
    }

    // Process each file and create messages
    const savedMessages = await Promise.all(
      req.files.map(async (file) => {
        let messageText = "";
        let messageType = "file";

        if (file.mimetype.startsWith("image/")) {
          messageText = "📷 Photo";
          messageType = "image";
        } else if (file.mimetype.startsWith("video/")) {
          messageText = "🎥 Video";
          messageType = "video";
        } else {
          messageText = `📎 ${file.originalname}`;
          messageType = "file";
        }

        const messageData = {
          sender: userId,
          senderName: user.name,
          senderAvatar: profile?.profilePicture || "",
          roomId,
          message: messageText,
          type: messageType,
          mediaUrl: `/uploads/chat/attachments/${file.filename}`,
          mediaSize: file.size,
          mediaName: file.originalname,
          mediaMimeType: file.mimetype,
          status: "sent",
          readBy: [{ user: userId, readAt: new Date() }],
          deliveredTo: [{ user: userId, deliveredAt: new Date() }],
        };

        const message = new Message(messageData);
        return message.save();
      }),
    );

    // Update room last message
    const lastMsg = savedMessages[savedMessages.length - 1];
    const lastMessageText =
      savedMessages.length === 1
        ? lastMsg.message
        : `📎 ${savedMessages.length} attachments`;

    await ChatRoom.findOneAndUpdate(
      { roomId },
      {
        lastMessage: {
          message: lastMessageText,
          sentAt: new Date(),
          senderId: userId,
          senderName: user.name,
          type: lastMsg.type,
          readBy: [userId],
        },
        updatedAt: new Date(),
        $inc: { messageCount: savedMessages.length },
      },
      { upsert: true },
    );

    res.status(200).json({
      success: true,
      count: savedMessages.length,
      data: savedMessages.map((msg) => ({
        _id: msg._id,
        type: msg.type,
        mediaUrl: msg.mediaUrl,
        mediaName: msg.mediaName,
        mediaSize: msg.mediaSize,
        mediaMimeType: msg.mediaMimeType,
        createdAt: msg.createdAt,
        sender: msg.sender,
        senderName: msg.senderName,
        senderAvatar: msg.senderAvatar,
        readBy: msg.readBy,
        deliveredTo: msg.deliveredTo,
      })),
    });
  } catch (error) {
    console.error("Attachment upload error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to upload attachments: " + error.message,
      });
  }
});

// Upload single attachment (backward compatibility)
router.post("/upload-attachment", uploadSingleAttachment, async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const { roomId, type, tempId } = req.body;
    const userId = req.user.id;

    if (!roomId) {
      return res
        .status(400)
        .json({ success: false, message: "Room ID is required" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const profile = await Profile.findOne({ user: userId });

    let messageText = "";
    let messageType = type || "file";

    switch (type) {
      case "image":
        messageText = "📷 Photo";
        messageType = "image";
        break;
      case "video":
        messageText = "🎥 Video";
        messageType = "video";
        break;
      default:
        messageText = `📎 ${req.file.originalname}`;
        messageType = "file";
    }

    const messageData = {
      sender: userId,
      senderName: user.name,
      senderAvatar: profile?.profilePicture || "",
      roomId,
      message: messageText,
      type: messageType,
      mediaUrl: `/uploads/chat/attachments/${req.file.filename}`,
      mediaSize: req.file.size,
      mediaName: req.file.originalname,
      mediaMimeType: req.file.mimetype,
      status: "sent",
      readBy: [{ user: userId, readAt: new Date() }],
      deliveredTo: [{ user: userId, deliveredAt: new Date() }],
    };

    const message = new Message(messageData);
    const savedMessage = await message.save();

    await ChatRoom.findOneAndUpdate(
      { roomId },
      {
        lastMessage: {
          message: messageText,
          sentAt: new Date(),
          senderId: userId,
          senderName: user.name,
          type: messageType,
          readBy: [userId],
        },
        updatedAt: new Date(),
        $inc: { messageCount: 1 },
      },
      { upsert: true },
    );

    res.status(200).json({
      success: true,
      data: [
        {
          _id: savedMessage._id,
          type: savedMessage.type,
          mediaUrl: savedMessage.mediaUrl,
          mediaName: savedMessage.mediaName,
          mediaSize: savedMessage.mediaSize,
          mediaMimeType: savedMessage.mediaMimeType,
          createdAt: savedMessage.createdAt,
          sender: savedMessage.sender,
          senderName: savedMessage.senderName,
          senderAvatar: savedMessage.senderAvatar,
          readBy: savedMessage.readBy,
          deliveredTo: savedMessage.deliveredTo,
        },
      ],
    });
  } catch (error) {
    console.error("Attachment upload error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to upload attachment: " + error.message,
      });
  }
});

// ============================================
// REACTIONS
// ============================================

router.post("/message/:messageId/react", addReaction);
router.delete("/message/:messageId/react", removeReaction);
router.get("/message/:messageId/reactions", getMessageReactions);

module.exports = router;
