/**
 * models/ChatRoom.js — Chat Room Model
 * Updated: Added clearedBy array to support per-user chat history deletion
 */

const mongoose = require("mongoose");

const chatRoomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        joinedAt: { type: Date, default: Date.now },
        role: {
          type: String,
          enum: ["member", "admin", "owner"],
          default: "member",
        },
        lastReadAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessage: {
      message: { type: String, default: "" },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      sentAt: { type: Date, default: Date.now },
    },
    messageCount: {
      type: Number,
      default: 0,
    },

    // Tracks when each user cleared their chat history
    // Messages before clearedAt timestamp are hidden only for that user
    clearedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        clearedAt: {
          type: Date,
          default: Date.now,
          required: true,
        },
        // When true, receiving a new message will make the chat visible again
        // Old messages remain hidden, only new messages appear
        restoreOnNewMessage: {
          type: Boolean,
          default: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Index for efficient querying of clearedBy per user
chatRoomSchema.index({ "clearedBy.user": 1 });

// Helper: Check if a specific user has cleared this room
chatRoomSchema.methods.isClearedByUser = function (userId) {
  return this.clearedBy.some(
    (entry) => entry.user.toString() === userId.toString(),
  );
};

// Helper: Get the clear timestamp for a specific user
chatRoomSchema.methods.getClearTimestamp = function (userId) {
  const entry = this.clearedBy.find(
    (entry) => entry.user.toString() === userId.toString(),
  );
  return entry ? entry.clearedAt : null;
};

// Helper: Remove user from clearedBy array (when chat is restored)
chatRoomSchema.methods.restoreForUser = function (userId) {
  this.clearedBy = this.clearedBy.filter(
    (entry) => entry.user.toString() !== userId.toString(),
  );
  return this.save();
};

module.exports = mongoose.model("ChatRoom", chatRoomSchema);
