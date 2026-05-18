// backend/models/ModerationLog.js

const mongoose = require("mongoose");

const moderationLogSchema = new mongoose.Schema(
  {
    // Admin who performed the action
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Action details
    action: {
      type: String,
      enum: [
        // Post actions
        "post_approved",
        "post_rejected",
        "post_deleted",
        "post_restored",

        // Comment actions
        "comment_deleted",
        "comment_approved",

        // User moderation actions
        "user_banned",
        "user_unbanned",
        "user_warned",
        "user_suspended",
        "user_unsuspended", // 🆕 Added
        "user_force_logout", // 🆕 Added
        "user_role_changed", // 🆕 Added (renamed from role_changed)

        // Warning actions
        "warning_revoked", // 🆕 Added

        // Event actions
        "event_approved",
        "event_rejected",
        "event_featured",

        // Report actions
        "report_resolved",
        "report_dismissed",

        // Bulk actions
        "bulk_action",

        // Settings
        "settings_updated",
      ],
      required: true,
    },

    // Target of the action (polymorphic)
    targetType: {
      type: String,
      enum: [
        "Post",
        "Comment",
        "User",
        "Event",
        "Report",
        "System",
        "UserWarning",
      ], // 🆕 Added UserWarning
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // Action metadata
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reason: {
      type: String,
      maxlength: 500,
    },

    // For bulk actions
    bulkActionId: {
      type: String,
      index: true,
    },
    affectedCount: {
      type: Number,
      default: 1,
    },

    // IP and device info for security
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
moderationLogSchema.index({ admin: 1, createdAt: -1 });
moderationLogSchema.index({ action: 1, createdAt: -1 });
moderationLogSchema.index({ targetType: 1, targetId: 1 });
moderationLogSchema.index({ createdAt: -1 });

// Static method to log an action
moderationLogSchema.statics.logAction = async function (data) {
  return await this.create(data);
};

// Static method to get recent actions
moderationLogSchema.statics.getRecentActions = async function (limit = 50) {
  return await this.find()
    .populate("admin", "name username")
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to get actions by admin
moderationLogSchema.statics.getAdminActions = async function (
  adminId,
  limit = 50,
) {
  return await this.find({ admin: adminId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = { schema: moderationLogSchema, name: "ModerationLog" };
