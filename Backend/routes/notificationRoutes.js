// Backend/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { protect } = require("../middleware/authmiddleware");

// Apply authentication to all routes
router.use(protect);

// Get all notifications
router.get("/", notificationController.getNotifications);

// Get unread count
router.get("/unread-count", notificationController.getUnreadCount);

// Mark notification as read
router.put("/:notificationId/read", notificationController.markAsRead);

// Mark notification as unread
router.put("/:notificationId/unread", notificationController.markAsUnread);

// Mark all as read
router.put("/read-all", notificationController.markAllAsRead);

// Delete notification
router.delete("/:notificationId", notificationController.deleteNotification);

// Delete all pending connection request notifications from a specific sender
// This prevents duplicate/spam notifications when users cancel and resend requests
router.delete(
  "/connection-requests/:senderId",
  notificationController.deletePendingConnectionNotifications,
);

module.exports = router;
