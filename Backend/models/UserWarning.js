const mongoose = require("mongoose");

const userWarningSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Who issued the warning
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Warning details
    type: {
      type: String,
      enum: ["warning", "temporary_ban", "permanent_ban", "content_removal"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    reason: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    // Related content (optional)
    relatedContent: {
      contentType: {
        type: String,
        enum: ["Post", "Comment", "Event"],
      },
      contentId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },

    // Duration for temporary bans
    duration: {
      type: Number, // in hours
      default: null,
    },
    expiresAt: {
      type: Date,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    revokedAt: Date,
    revokeReason: String,

    // Notification
    notifyUser: {
      type: Boolean,
      default: true,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
userWarningSchema.index({ user: 1, isActive: 1 });
userWarningSchema.index({ user: 1, createdAt: -1 });
userWarningSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for expired warnings

// Pre-save to set expiry
userWarningSchema.pre("save", function (next) {
  if (this.duration && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + this.duration * 60 * 60 * 1000);
  }
  next();
});

// Static method to get active warnings for a user
userWarningSchema.statics.getActiveWarnings = async function (userId) {
  return await this.find({
    user: userId,
    isActive: true,
    $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
  })
    .populate("issuedBy", "name username")
    .sort({ createdAt: -1 });
};

// Static method to get warning count for a user
userWarningSchema.statics.getWarningCount = async function (userId) {
  return await this.countDocuments({
    user: userId,
    isActive: true,
  });
};

module.exports = { schema: userWarningSchema, name: "UserWarning" };
