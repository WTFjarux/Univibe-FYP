/**
 * models/Message.js — Mongoose Schema for Chat Messages
 *
 * Stores all chat messages with sender, room, and content info.
 * Works for both 1-on-1 chats and group rooms
 * Supports text, images, audio, video, and file messages
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

    // Media file attachment (for images, audio, video, files)
    mediaUrl: {
      type: String,
      default: "",
    },
    mediaSize: {
      type: Number,
      default: 0,
    },
    mediaName: {
      type: String,
      default: "",
    },
    mediaMimeType: {
      type: String,
      default: "",
    },

    // Audio specific fields
    duration: {
      type: Number, // Duration in seconds for audio messages
      default: 0,
    },
    isPlayed: {
      type: Boolean, // Track if voice message has been played
      default: false,
    },
    waveformData: {
      type: [Number], // Optional: waveform data for visual representation
      default: [],
    },

    // Legacy attachment field (for backward compatibility)
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
messageSchema.index({ type: 1 }); // Index for filtering by message type
messageSchema.index({ createdAt: -1 }); // For pagination

// Virtual for getting audio duration in minutes:seconds format
messageSchema.virtual("formattedDuration").get(function () {
  if (!this.duration) return "0:00";
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

// Virtual for checking if message has media
messageSchema.virtual("hasMedia").get(function () {
  return ["image", "audio", "video", "file"].includes(this.type);
});

// Virtual for getting media icon based on type
messageSchema.virtual("mediaIcon").get(function () {
  const icons = {
    image: "📷",
    audio: "🎤",
    video: "🎥",
    file: "📎",
  };
  return icons[this.type] || "📄";
});

// Ensure virtuals are included in JSON output
messageSchema.set("toJSON", { virtuals: true });
messageSchema.set("toObject", { virtuals: true });

// Pre-save middleware to set default message text for audio
messageSchema.pre("save", function (next) {
  if (this.type === "audio" && (!this.message || this.message === "")) {
    const minutes = Math.floor(this.duration / 60);
    const seconds = this.duration % 60;
    this.message = `🎤 Voice message (${minutes}:${seconds.toString().padStart(2, "0")})`;
  }
  next();
});

// Static method to mark audio as played
messageSchema.statics.markAudioAsPlayed = async function (messageId, userId) {
  return this.findByIdAndUpdate(messageId, { isPlayed: true }, { new: true });
};

// Static method to get unplayed audio messages for a user
messageSchema.statics.getUnplayedAudio = async function (userId, roomId) {
  return this.find({
    roomId,
    type: "audio",
    isPlayed: false,
    sender: { $ne: userId },
    isDeleted: false,
  }).sort({ createdAt: 1 });
};

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
