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
      required: false,
      default: null,
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
        // COMMUNITY TYPES (NEW)
        // ============================================
        "community_approved",
        "community_rejected",
        "join_request",
        "join_approved",
        "join_rejected",
        "community_invite",
        "invitation_pending",
        "invitation_accepted",
        "invitation_approved",
        "invitation_rejected",
        "member_joined",
        "member_removed",
        "role_updated",

        // ============================================
        // ADMIN USER MANAGEMENT TYPES
        // ============================================
        "warning",
        "account_suspended",
        "account_banned",
        "account_unbanned",
        "account_reactivated",
        "report_resolved",
        "content_removed",

        // ============================================
        // SYSTEM TYPES
        // ============================================
        "system",
        "welcome",
        "verification",
        "password_reset",
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
        "Community", // ✅ Added
        "UserWarning",
        "Connection",
        "Message",
        "Report",
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

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, lastInteractionAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ targetId: 1, targetModel: 1 });

// ============================================
// STATIC METHODS
// ============================================

notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({ recipient: userId, read: false });
};

notificationSchema.statics.markAllAsRead = async function (userId) {
  return await this.updateMany(
    { recipient: userId, read: false },
    { read: true, lastInteractionAt: new Date() },
  );
};

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
    "community_approved", // ✅ Added
    "community_rejected", // ✅ Added
  ];
  const skip = (page - 1) * limit;
  return await this.find({ recipient: userId, type: { $in: moderationTypes } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "name username");
};

notificationSchema.statics.cleanupOld = async function (daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  return await this.deleteMany({ read: true, createdAt: { $lt: cutoffDate } });
};

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
    metadata: { moderationAction: true, timestamp: new Date() },
  });
};

// ============================================
// INSTANCE METHODS
// ============================================

notificationSchema.methods.markAsRead = async function () {
  this.read = true;
  this.lastInteractionAt = new Date();
  return await this.save();
};

notificationSchema.methods.updateInteraction = async function () {
  this.lastInteractionAt = new Date();
  return await this.save();
};

notificationSchema.methods.isModerationNotification = function () {
  const moderationTypes = [
    "warning",
    "account_suspended",
    "account_banned",
    "account_unbanned",
    "post_removed",
    "community_approved",
    "community_rejected",
  ];
  return moderationTypes.includes(this.type);
};

module.exports = mongoose.model("Notification", notificationSchema);
