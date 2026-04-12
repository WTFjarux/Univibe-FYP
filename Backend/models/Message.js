/**
 * models/Message.js — Mongoose Schema for Chat Messages
 *
 * Stores all chat messages with sender, room, and content info.
 * Works for both 1-on-1 chats and group rooms
 */

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // Sender information
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderAvatar: {
      type: String,
      default: "",
    },

    // Room identifier
    roomId: {
      type: String,
      required: true,
      index: true,
    },

    // Message content
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    // Message type
    type: {
      type: String,
      enum: ["text", "image", "audio", "video", "file"],
      default: "text",
    },

    // File attachment
    attachment: {
      url: { type: String, default: "" },
      type: { type: String, default: "" },
      size: { type: Number, default: 0 },
      name: { type: String, default: "" },
    },

    // Reply threading
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Read receipts
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
    isRead: {
      type: Boolean,
      default: false,
    },

    // Reactions
    reactions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reaction: { type: String, enum: ["👍", "❤️", "😂", "😮", "😢", "😡"] },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Message status
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ "readBy.userId": 1 });

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
