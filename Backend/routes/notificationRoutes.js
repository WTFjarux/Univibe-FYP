// Backend/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { protect } = require("../middleware/authmiddleware");

// Apply authentication to all routes
router.use(protect);

// Get all notifications
router.get("/", notificationController.getNotifications);

// Mark notification as read
router.put("/:notificationId/read", notificationController.markAsRead);

// Mark all as read
router.put("/read-all", notificationController.markAllAsRead);

// Mark notification as unread
router.put("/:notificationId/unread", notificationController.markAsUnread);

// Delete notification
router.delete("/:notificationId", notificationController.deleteNotification);

// Get unread count
router.get("/unread-count", notificationController.getUnreadCount);

module.exports = router;
