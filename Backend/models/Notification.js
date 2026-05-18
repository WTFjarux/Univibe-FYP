// backend/models/Notification.js

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        // ============================================
        // CONNECTION TYPES
        // ============================================
        "connection_request",
        "connection_accepted",

        // ============================================
        // COMMENT TYPES
        // ============================================
        "comment",
        "comment_like",
        "comment_reply",

        // ============================================
        // POST TYPES
        // ============================================
        "like",
        "repost",
        "mention",

        // ============================================
        // EVENT TYPES
        // ============================================
        "event_rsvp",
        "event_interest",
        "event_invite",
        "event_reminder",
        "event_approved",
        "event_rejected",

        // ============================================
        // CONTENT MODERATION TYPES
        // ============================================
        "post_removed",

        // ============================================
        // ADMIN USER MANAGEMENT TYPES (NEW)
        // ============================================
        "warning", // User received a warning
        "account_suspended", // User account temporarily suspended
        "account_banned", // User account permanently banned
        "account_unbanned", // User account unbanned
        "account_reactivated", // User account reactivated after suspension

        // ============================================
        // SYSTEM TYPES
        // ============================================
        "system", // System-generated notifications
        "welcome", // Welcome message
        "verification", // Email verification
        "password_reset", // Password reset
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "targetModel",
    },
    targetModel: {
      type: String,
      enum: [
        "Post",
        "Comment",
        "Event",
        "User",
        "UserWarning", // 🆕 Added for warning notifications
        "Connection",
        "Message",
      ],
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// ============================================
// INDEXES
// ============================================

// Core indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, lastInteractionAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

// Type-based indexes for filtering
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

// Target indexes for finding notifications about specific content
notificationSchema.index({ targetId: 1, targetModel: 1 });

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get unread notification count for a user
 */
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({ recipient: userId, read: false });
};

/**
 * Mark all notifications as read for a user
 */
notificationSchema.statics.markAllAsRead = async function (userId) {
  return await this.updateMany(
    { recipient: userId, read: false },
    { read: true, lastInteractionAt: new Date() },
  );
};

/**
 * Get notifications by type
 */
notificationSchema.statics.getByType = async function (
  userId,
  type,
  page = 1,
  limit = 20,
) {
  const skip = (page - 1) * limit;
  return await this.find({ recipient: userId, type })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "name username profilePicture");
};

/**
 * Get moderation-related notifications
 */
notificationSchema.statics.getModerationNotifications = async function (
  userId,
  page = 1,
  limit = 20,
) {
  const moderationTypes = [
    "warning",
    "account_suspended",
    "account_banned",
    "account_unbanned",
    "post_removed",
  ];
  const skip = (page - 1) * limit;
  return await this.find({
    recipient: userId,
    type: { $in: moderationTypes },
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "name username");
};

/**
 * Delete old notifications (cleanup)
 */
notificationSchema.statics.cleanupOld = async function (daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  // Only delete read notifications older than cutoff
  return await this.deleteMany({
    read: true,
    createdAt: { $lt: cutoffDate },
  });
};

/**
 * Create a moderation notification
 */
notificationSchema.statics.createModerationNotification = async function (
  recipientId,
  senderId,
  type,
  title,
  message,
  targetId = null,
  targetModel = null,
) {
  return await this.create({
    recipient: recipientId,
    sender: senderId,
    type,
    title,
    message,
    targetId,
    targetModel,
    metadata: {
      moderationAction: true,
      timestamp: new Date(),
    },
  });
};

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Mark notification as read
 */
notificationSchema.methods.markAsRead = async function () {
  this.read = true;
  this.lastInteractionAt = new Date();
  return await this.save();
};

/**
 * Update interaction timestamp
 */
notificationSchema.methods.updateInteraction = async function () {
  this.lastInteractionAt = new Date();
  return await this.save();
};

/**
 * Check if notification is a moderation type
 */
notificationSchema.methods.isModerationNotification = function () {
  const moderationTypes = [
    "warning",
    "account_suspended",
    "account_banned",
    "account_unbanned",
    "post_removed",
  ];
  return moderationTypes.includes(this.type);
};

module.exports = mongoose.model("Notification", notificationSchema);
