// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const {
  getOrCreateDirectRoom,
  getMessageHistory,
  getUserChatRooms,
  deleteMessage,
  getOtherUserProfile, // Add this
} = require("../controllers/chatController");

// All routes require authentication
router.use(protect);

// Chat rooms
router.get("/rooms", getUserChatRooms);
router.get("/room/:otherUserId", getOrCreateDirectRoom);
router.get("/user-profile/:otherUserId", getOtherUserProfile); // Add this route

// Messages
router.get("/messages/:roomId", getMessageHistory);
router.delete("/message/:messageId", deleteMessage);

module.exports = router;
