// backend/routes/chatRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const {
  uploadAudioMessage,
  uploadAttachments,
  uploadVideo,
} = require("../middleware/uploadMiddleware");
const { generateThumbnails } = require("../middleware/thumbnailMiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

const ctrl = require("../controllers/chatController");

router.use(protect);

router.get("/rooms", ctrl.getUserChatRooms);
router.get("/direct/:otherUserId", ctrl.getOrCreateDirectRoom);
router.get("/room/:roomId", ctrl.getRoomDetails);
router.post("/room/:roomId/read", ctrl.markRoomAsRead);
router.post("/room/:roomId/unread", ctrl.markRoomAsUnread);
router.delete("/room/:roomId/history", ctrl.deleteChatHistory);

router.get("/messages/:roomId", ctrl.getMessageHistory);
router.get("/messages/:roomId/light", ctrl.getMessagesLight);

router.post(
  "/messages/forward",
  preventBlockedInteractions,
  ctrl.forwardMessage,
);
router.post("/share-post", preventBlockedInteractions, ctrl.sharePost);

router.delete("/message/:messageId", ctrl.deleteMessage);
router.post("/message/:messageId/read", ctrl.markMessageAsRead);
router.post("/message/:messageId/delivered", ctrl.markMessageAsDelivered);

router.post("/upload-audio", uploadAudioMessage, ctrl.uploadAudio);

router.post(
  "/upload-attachments",
  uploadAttachments,
  generateThumbnails,
  ctrl.uploadAttachments,
);

router.post(
  "/upload-video",
  uploadVideo,
  generateThumbnails,
  ctrl.uploadAttachments,
);

router.put("/audio/:messageId/played", ctrl.markAudioAsPlayed);

router.post("/message/:messageId/react", ctrl.addReaction);
router.delete("/message/:messageId/react", ctrl.removeReaction);

router.get("/user-profile/:otherUserId", ctrl.getOtherUserProfile);
router.get("/unread-count", protect, ctrl.getUnreadChatCount);

router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

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
