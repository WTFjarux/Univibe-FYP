/**
 * routes/chatRoutes.js — Chat API Routes
 *
 * REST endpoints for chat functionality
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const {
  getOrCreateDirectRoom,
  getMessageHistory,
  getUserChatRooms,
  deleteMessage,
} = require("../controllers/chatController");

// All routes require authentication
router.use(protect);

// Chat rooms
router.get("/rooms", getUserChatRooms);
router.get("/room/:otherUserId", getOrCreateDirectRoom);

// Messages
router.get("/messages/:roomId", getMessageHistory);
router.delete("/message/:messageId", deleteMessage);

module.exports = router;
