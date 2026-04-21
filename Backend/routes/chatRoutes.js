// Backend/routes/chatRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const { uploadAudioMessage } = require("../middleware/uploadMiddleware");
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
} = require("../controllers/chatController");

// All routes require authentication
router.use(protect);

// Chat rooms
router.get("/rooms", getUserChatRooms);
router.get("/room/:otherUserId", getOrCreateDirectRoom);
router.get("/user-profile/:otherUserId", getOtherUserProfile);

// Messages
router.get("/messages/:roomId", getMessageHistory);
router.delete("/message/:messageId", deleteMessage);

// Audio specific endpoints - FULLY UPDATED with reply support including senderId
router.post("/upload-audio", uploadAudioMessage, async (req, res) => {
  try {
    console.log("=== AUDIO UPLOAD ===");
    console.log("File received:", req.file ? "Yes" : "No");
    console.log("Audio info:", req.audioInfo);
    console.log("Request body:", req.body);

    if (!req.file || !req.audioInfo) {
      return res.status(400).json({
        success: false,
        message: "No audio file uploaded",
      });
    }

    const {
      roomId,
      duration,
      replyToId,
      replyToMessage,
      replyToSender,
      replyToSenderId, // ✅ ADD THIS - Get senderId from frontend
      replyToType,
      replyToMediaUrl,
      replyToDuration,
    } = req.body;

    const userId = req.user.id;

    // Verify file exists on disk
    if (!fs.existsSync(req.file.path)) {
      console.error("File not found at path:", req.file.path);
      return res.status(500).json({
        success: false,
        message: "File not saved properly",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profile = await Profile.findOne({ user: userId });

    // Construct URL - use req.audioInfo.url or create it manually
    const audioUrl =
      req.audioInfo.url || `/uploads/chat/audio/${req.file.filename}`;
    const fileSize = req.file.size;

    console.log("💾 Saving audio message:");
    console.log("   URL:", audioUrl);
    console.log("   Size:", fileSize);
    console.log("   Duration:", duration);
    console.log("   ReplyTo data:", {
      replyToId,
      replyToType,
      replyToDuration,
      replyToSender,
      replyToSenderId, // ✅ Log senderId
    });

    const messageData = {
      sender: userId,
      senderName: user.name,
      senderAvatar: profile?.profilePicture || "",
      roomId: roomId,
      message: "🎤 Voice message",
      type: "audio",
      mediaUrl: audioUrl,
      mediaSize: fileSize,
      mediaName: req.file.originalname || `voice_${Date.now()}.m4a`,
      mediaMimeType: req.file.mimetype,
      duration: parseInt(duration) || 0,
      status: "sent",
    };

    // Add replyTo data if present - NOW WITH SENDERID INCLUDED
    if (replyToId) {
      messageData.replyTo = {
        messageId: replyToId,
        message: replyToMessage || "Media message",
        senderName: replyToSender || "Unknown",
        senderId: replyToSenderId || null, // ✅ ADD THIS - Save the senderId
        type: replyToType || "text",
        mediaUrl: replyToMediaUrl || "",
        duration: replyToDuration ? parseInt(replyToDuration) : 0,
      };
      console.log("✅ Added replyTo with type:", messageData.replyTo.type);
      console.log("✅ replyTo senderId:", messageData.replyTo.senderId);
    }

    const message = new Message(messageData);
    const savedMessage = await message.save();

    console.log("✅ Message saved with ID:", savedMessage._id);
    console.log("✅ Saved mediaUrl:", savedMessage.mediaUrl);
    console.log("✅ Saved replyTo:", savedMessage.replyTo);
    console.log("✅ Saved replyTo.senderId:", savedMessage.replyTo?.senderId);

    // Update chat room last message
    await ChatRoom.findOneAndUpdate(
      { roomId },
      {
        lastMessage: {
          message: "🎤 Voice message",
          sender: userId,
          sentAt: new Date(),
        },
        $inc: { messageCount: 1 },
      },
      { upsert: true },
    );

    // Return the saved message with full replyTo data
    res.status(200).json({
      success: true,
      message: "Audio uploaded successfully",
      url: audioUrl,
      data: {
        _id: savedMessage._id,
        type: savedMessage.type,
        duration: savedMessage.duration,
        createdAt: savedMessage.createdAt,
        mediaUrl: savedMessage.mediaUrl,
        replyTo: savedMessage.replyTo, // Include full replyTo in response
      },
    });
  } catch (error) {
    console.error("Audio upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload audio: " + error.message,
    });
  }
});

// Audio played tracking
router.put("/audio/:messageId/played", markAudioAsPlayed);
router.get("/rooms/:roomId/unplayed-audio", getUnplayedAudio);

// Reaction routes
router.post("/message/:messageId/react", addReaction);
router.delete("/message/:messageId/react", removeReaction);
router.get("/message/:messageId/reactions", getMessageReactions);

module.exports = router;
