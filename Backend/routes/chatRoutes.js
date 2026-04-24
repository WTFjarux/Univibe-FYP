// backend/routes/chatRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const {
  uploadAudioMessage,
  uploadAttachments,
} = require("../middleware/uploadMiddleware");
const { generateThumbnails } = require("../middleware/thumbnailMiddleware");

const ctrl = require("../controllers/chatController");

// All routes require authentication
router.use(protect);

// ── ROOMS ────────────────────────────────────────────────────
router.get("/rooms", ctrl.getUserChatRooms);
router.get("/room/:otherUserId", ctrl.getOrCreateDirectRoom);
router.get("/room/:roomId", ctrl.getRoomDetails);
router.post("/room/:roomId/read", ctrl.markRoomAsRead);
router.post("/room/:roomId/unread", ctrl.markRoomAsUnread);

// ── MESSAGES ─────────────────────────────────────────────────
router.get("/messages/:roomId", ctrl.getMessageHistory);
router.get("/messages/:roomId/light", ctrl.getMessagesLight);
router.delete("/message/:messageId", ctrl.deleteMessage);
router.post("/message/:messageId/read", ctrl.markMessageAsRead);
router.post("/message/:messageId/delivered", ctrl.markMessageAsDelivered);

// ── UPLOADS ──────────────────────────────────────────────────
// ✅ Single route with both middlewares
router.post("/upload-audio", uploadAudioMessage, ctrl.uploadAudio);
router.post(
  "/upload-attachments",
  uploadAttachments,
  generateThumbnails,
  ctrl.uploadAttachments,
);

// ── AUDIO ────────────────────────────────────────────────────
router.put("/audio/:messageId/played", ctrl.markAudioAsPlayed);

// ── REACTIONS ────────────────────────────────────────────────
router.post("/message/:messageId/react", ctrl.addReaction);
router.delete("/message/:messageId/react", ctrl.removeReaction);

// ── USER ─────────────────────────────────────────────────────
router.get("/user-profile/:otherUserId", ctrl.getOtherUserProfile);

module.exports = router;
