// Backend/routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const { uploadAudioMessage } = require("../middleware/uploadMiddleware");

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

// Audio specific endpoints
router.post("/upload-audio", uploadAudioMessage, async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No audio file uploaded" });
    }

    const { roomId, duration } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const profile = await Profile.findOne({ user: userId });

    const message = new Message({
      sender: userId,
      senderName: user.name,
      senderAvatar: profile?.profilePicture || "",
      roomId: roomId,
      message: "🎤 Voice message",
      type: "audio",
      mediaUrl: req.audioInfo.url,
      mediaSize: req.file.size,
      mediaMimeType: req.file.mimetype,
      duration: parseInt(duration) || 0,
      status: "sent",
    });

    await message.save();

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

    res.status(200).json({
      success: true,
      message: "Audio uploaded successfully",
      url: req.audioInfo.url,
      data: {
        _id: message._id,
        type: message.type,
        duration: message.duration,
        createdAt: message.createdAt,
        mediaUrl: req.audioInfo.url,
      },
    });
  } catch (error) {
    console.error("Audio upload error:", error.message);
    res
      .status(500)
      .json({
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
