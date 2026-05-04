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
        "connection_request",
        "connection_accepted",
        "comment",
        "like",
        "mention",
        "event_rsvp",
        "event_interest",
        "event_invite",
        "event_reminder",
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
      enum: ["Post", "Comment", "Event", "User"],
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
      index: true, // Important for sorting performance
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

// Index for efficient queries
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, lastInteractionAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
