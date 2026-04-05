// Backend/controllers/notificationController.js
const Notification = require("../models/Notification");
const User = require("../models/User");
const Profile = require("../models/Profile");

/**
 * Create a notification (internal helper)
 */
const createNotification = async (
  recipientId,
  senderId,
  type,
  title,
  message,
  targetId = null,
  targetModel = null,
) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      targetId,
      targetModel,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

/**
 * Delete pending connection request notifications from a specific sender
 */
const deletePendingConnectionNotifications = async (recipientId, senderId) => {
  try {
    const result = await Notification.deleteMany({
      recipient: recipientId,
      sender: senderId,
      type: "connection_request",
      read: false,
    });
    return result.deletedCount;
  } catch (error) {
    console.error("Delete pending connection notifications error:", error);
    return 0;
  }
};

/**
 * Get all notifications for current user
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({ recipient: userId })
      .populate("sender", "name username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get profile pictures for senders
    const senderIds = notifications.map((n) => n.sender._id);
    const profiles = await Profile.find({ user: { $in: senderIds } })
      .select("user profilePicture fullName")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = {
        profilePicture: profile.profilePicture,
        fullName: profile.fullName,
      };
    });

    const enrichedNotifications = notifications.map((notification) => ({
      ...notification,
      sender: {
        ...notification.sender,
        profilePicture:
          profileMap[notification.sender._id.toString()]?.profilePicture ||
          null,
        fullName:
          profileMap[notification.sender._id.toString()]?.fullName ||
          notification.sender.name,
      },
    }));

    const total = await Notification.countDocuments({ recipient: userId });
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    res.status(200).json({
      success: true,
      data: {
        notifications: enrichedNotifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

/**
 * Mark a notification as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark as read",
    });
  }
};

/**
 * Mark a notification as unread
 */
exports.markAsUnread = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: false },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as unread",
    });
  } catch (error) {
    console.error("Mark as unread error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark as unread",
    });
  }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true },
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all as read",
    });
  }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

/**
 * Delete all pending connection request notifications from a specific sender
 * This is useful when a user cancels and resends a connection request
 */
exports.deletePendingConnectionNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { senderId } = req.params;

    const deletedCount = await deletePendingConnectionNotifications(
      userId,
      senderId,
    );

    res.status(200).json({
      success: true,
      message: `${deletedCount} pending connection request notification(s) deleted`,
      deletedCount,
    });
  } catch (error) {
    console.error("Delete pending connection notifications error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete notifications",
    });
  }
};

/**
 * Get unread notification count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count",
    });
  }
};

// Export helper for use in other controllers
exports.createNotification = createNotification;
