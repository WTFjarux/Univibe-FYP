// backend/routes/chatRoutes.js

const express = require("express");
const router = express.Router();
const {
  protect,
  protectWithStatusCheck,
} = require("../middleware/authmiddleware");
const {
  uploadAudioMessage,
  uploadAttachments,
  uploadVideo,
} = require("../middleware/uploadMiddleware");
const { generateThumbnails } = require("../middleware/thumbnailMiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

const ctrl = require("../controllers/chatController");

// All routes require authentication
router.use(protect);

// ============================================
// READ OPERATIONS (Auth only - no status check)
// ============================================
router.get("/rooms", ctrl.getUserChatRooms);
router.get("/direct/:otherUserId", ctrl.getOrCreateDirectRoom);
router.get("/room/:roomId", ctrl.getRoomDetails);
router.get("/messages/:roomId", ctrl.getMessageHistory);
router.get("/messages/:roomId/light", ctrl.getMessagesLight);
router.get("/user-profile/:otherUserId", ctrl.getOtherUserProfile);
router.get("/unread-count", ctrl.getUnreadChatCount);

// ============================================
// WRITE OPERATIONS (Auth + Status Check)
// ============================================
router.post("/room/:roomId/read", protectWithStatusCheck, ctrl.markRoomAsRead);
router.post(
  "/room/:roomId/unread",
  protectWithStatusCheck,
  ctrl.markRoomAsUnread,
);
router.delete(
  "/room/:roomId/history",
  protectWithStatusCheck,
  ctrl.deleteChatHistory,
);
router.post(
  "/messages/forward",
  protectWithStatusCheck,
  preventBlockedInteractions,
  ctrl.forwardMessage,
);
router.post(
  "/share-post",
  protectWithStatusCheck,
  preventBlockedInteractions,
  ctrl.sharePost,
);
router.delete(
  "/message/:messageId",
  protectWithStatusCheck,
  ctrl.deleteMessage,
);
router.post(
  "/message/:messageId/read",
  protectWithStatusCheck,
  ctrl.markMessageAsRead,
);
router.post(
  "/message/:messageId/delivered",
  protectWithStatusCheck,
  ctrl.markMessageAsDelivered,
);
router.post(
  "/upload-audio",
  protectWithStatusCheck,
  uploadAudioMessage,
  ctrl.uploadAudio,
);
router.post(
  "/upload-attachments",
  protectWithStatusCheck,
  uploadAttachments,
  generateThumbnails,
  ctrl.uploadAttachments,
);
router.post(
  "/upload-video",
  protectWithStatusCheck,
  uploadVideo,
  generateThumbnails,
  ctrl.uploadAttachments,
);
router.put(
  "/audio/:messageId/played",
  protectWithStatusCheck,
  ctrl.markAudioAsPlayed,
);
router.post(
  "/message/:messageId/react",
  protectWithStatusCheck,
  ctrl.addReaction,
);
router.delete(
  "/message/:messageId/react",
  protectWithStatusCheck,
  ctrl.removeReaction,
);

// 404 handler
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Error handler
router.use((err, req, res, next) => {
  console.error("Chat route error:", err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File too large. Maximum size is 200MB.",
    });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      message: "Too many files. Maximum 10 files per upload.",
    });
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      message: `Unexpected file field: ${err.field}`,
    });
  }
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

module.exports = router;
