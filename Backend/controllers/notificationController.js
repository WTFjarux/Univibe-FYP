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
 * Delete ALL connection-related notifications between two users
 * This cleans up both connection_request and connection_accepted notifications
 * when two users disconnect
 */
const deleteAllConnectionNotificationsBetweenUsers = async (
  userId1,
  userId2,
) => {
  try {
    const result = await Notification.deleteMany({
      $or: [
        // All connection notifications from user1 to user2
        {
          recipient: userId1,
          sender: userId2,
          type: { $in: ["connection_request", "connection_accepted"] },
        },
        // All connection notifications from user2 to user1
        {
          recipient: userId2,
          sender: userId1,
          type: { $in: ["connection_request", "connection_accepted"] },
        },
      ],
    });
    console.log(
      `Deleted ${result.deletedCount} connection notifications between users ${userId1} and ${userId2}`,
    );
    return result.deletedCount;
  } catch (error) {
    console.error(
      "Delete all connection notifications between users error:",
      error,
    );
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
      .sort({ lastInteractionAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // ✅ Get profile pictures for senders (handle null sender)
    const senderIds = notifications
      .filter((n) => n.sender != null && n.sender._id != null)
      .map((n) => n.sender._id);

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

    // Get profile pictures for likers in grouped notifications
    const allLikerIds = [];
    notifications.forEach((notification) => {
      if (notification.metadata?.isGrouped && notification.metadata?.likers) {
        notification.metadata.likers.forEach((liker) => {
          allLikerIds.push(liker.userId);
        });
      }
    });

    let likerProfileMap = {};
    if (allLikerIds.length > 0) {
      const likerProfiles = await Profile.find({ user: { $in: allLikerIds } })
        .select("user profilePicture")
        .lean();
      likerProfiles.forEach((profile) => {
        likerProfileMap[profile.user.toString()] = profile.profilePicture;
      });
    }

    const enrichedNotifications = notifications.map((notification) => {
      const senderId = notification.sender?._id?.toString();

      // ✅ Handle null sender gracefully
      const enrichedNotification = {
        ...notification,
        sender: notification.sender
          ? {
              ...notification.sender,
              profilePicture: senderId
                ? profileMap[senderId]?.profilePicture || null
                : null,
              fullName: senderId
                ? profileMap[senderId]?.fullName || notification.sender.name
                : notification.sender.name || "System",
            }
          : {
              _id: null,
              name: "System",
              username: "system",
              email: null,
              profilePicture: null,
              fullName: "System",
            },
      };

      if (
        enrichedNotification.metadata?.isGrouped &&
        enrichedNotification.metadata?.likers
      ) {
        enrichedNotification.metadata = {
          ...enrichedNotification.metadata,
          likers: enrichedNotification.metadata.likers.map((liker) => ({
            ...liker,
            profilePicture: likerProfileMap[liker.userId.toString()] || null,
          })),
        };
      }

      return enrichedNotification;
    });

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
          pages: Math.ceil(total / parseInt(limit)),
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

// Export helpers for use in other controllers
exports.createNotification = createNotification;
exports.deletePendingConnectionNotifications =
  deletePendingConnectionNotifications;
exports.deleteAllConnectionNotificationsBetweenUsers =
  deleteAllConnectionNotificationsBetweenUsers;
