/**
 * models/Message.js — Mongoose Schema for Chat Messages
 *
 * Stores all chat messages with sender, room, and content info.
 * Works for both 1-on-1 chats and group rooms
 * Supports text, images, audio, video, and file messages
 *
 * 🔴 UPDATED: WhatsApp-level read/unread system with readBy array
 */

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    // ============================================
    // SENDER INFORMATION
    // ============================================
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

    // ============================================
    // ROOM INFORMATION
    // ============================================
    roomId: {
      type: String,
      required: true,
      index: true,
    },

    // ============================================
    // MESSAGE CONTENT
    // ============================================
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    // Message type
    type: {
      type: String,
      enum: ["text", "image", "audio", "video", "file", "location"],
      default: "text",
    },

    // Media file attachment
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

    //location

    locationData: {
      latitude: { type: Number },
      longitude: { type: Number },
      locationName: { type: String, default: "" },
    },

    // Audio specific fields
    duration: {
      type: Number,
      default: 0,
    },
    isPlayed: {
      type: Boolean,
      default: false,
    },
    waveformData: {
      type: [Number],
      default: [],
    },

    // Legacy attachment field (for backward compatibility)
    attachment: {
      url: { type: String, default: "" },
      type: { type: String, default: "" },
      size: { type: Number, default: 0 },
      name: { type: String, default: "" },
    },

    // ============================================
    // REPLY THREADING
    // ============================================
    replyTo: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      message: { type: String },
      senderName: { type: String },
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      type: {
        type: String,
        enum: ["text", "image", "audio", "video", "file", "location"],
        default: "text",
      },
      mediaUrl: { type: String, default: "" },
      duration: { type: Number, default: 0 },
    },

    // ============================================
    // 🔴 WHATSAPP-LEVEL READ RECEIPTS
    // ============================================
    // Array of users who have read this message
    // Sender is automatically added when message is created
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Array of users who have received/delivered this message
    deliveredTo: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ============================================
    // REACTIONS
    // ============================================
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reaction: {
          type: String,
          enum: ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🙏", "👏", "🔥"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ============================================
    // SOFT DELETE
    // ============================================
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

    // ============================================
    // MESSAGE STATUS (Legacy - maintained for backward compatibility)
    // ============================================
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

// ============================================
// INDEXES
// ============================================
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ "readBy.user": 1 });
messageSchema.index({ "deliveredTo.user": 1 });
messageSchema.index({ type: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ "replyTo.messageId": 1 });
messageSchema.index({ "replyTo.senderId": 1 });

// Compound index for unread message queries
messageSchema.index({ roomId: 1, "readBy.user": 1 });

// ============================================
// VIRTUALS
// ============================================

// Check if message is read by a specific user
messageSchema.virtual("isReadBy").get(function () {
  return (userId) => {
    return this.readBy.some((r) => r.user.toString() === userId.toString());
  };
});

// Check if message is delivered to a specific user
messageSchema.virtual("isDeliveredTo").get(function () {
  return (userId) => {
    return this.deliveredTo.some(
      (d) => d.user.toString() === userId.toString(),
    );
  };
});

// Get formatted duration for audio messages
messageSchema.virtual("formattedDuration").get(function () {
  if (!this.duration) return "0:00";
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

// Get formatted duration for reply audio
messageSchema.virtual("replyToFormattedDuration").get(function () {
  if (!this.replyTo || !this.replyTo.duration) return "0:00";
  const minutes = Math.floor(this.replyTo.duration / 60);
  const seconds = this.replyTo.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

// Check if message has media
messageSchema.virtual("hasMedia").get(function () {
  return ["image", "audio", "video", "file"].includes(this.type);
});

// Get media icon based on type
messageSchema.virtual("mediaIcon").get(function () {
  const icons = {
    image: "📷",
    audio: "🎤",
    video: "🎥",
    file: "📎",
  };
  return icons[this.type] || "📄";
});

// Get reply media icon
messageSchema.virtual("replyMediaIcon").get(function () {
  if (!this.replyTo) return null;
  const icons = {
    image: "📷",
    audio: "🎤",
    video: "🎥",
    file: "📎",
  };
  return icons[this.replyTo.type] || "💬";
});

// Get read count (how many participants have read)
messageSchema.virtual("readCount").get(function () {
  return this.readBy.length;
});

// Get delivered count
messageSchema.virtual("deliveredCount").get(function () {
  return this.deliveredTo.length;
});

// ============================================
// CONFIGURATION
// ============================================
messageSchema.set("toJSON", { virtuals: true });
messageSchema.set("toObject", { virtuals: true });

// ============================================
// MIDDLEWARE
// ============================================

// Pre-save: Set default message text for audio
messageSchema.pre("save", function (next) {
  if (this.type === "audio" && (!this.message || this.message === "")) {
    const minutes = Math.floor(this.duration / 60);
    const seconds = this.duration % 60;
    this.message = `🎤 Voice message (${minutes}:${seconds.toString().padStart(2, "0")})`;
  }
  next();
});

// Pre-save: Auto-detect reply type
messageSchema.pre("save", function (next) {
  if (this.replyTo && this.replyTo.message && !this.replyTo.type) {
    if (
      this.replyTo.message === "🎤 Voice message" ||
      (this.replyTo.mediaUrl && this.replyTo.mediaUrl.includes("audio"))
    ) {
      this.replyTo.type = "audio";
    } else if (
      this.replyTo.message === "📷 Photo" ||
      (this.replyTo.mediaUrl && this.replyTo.mediaUrl.includes("image"))
    ) {
      this.replyTo.type = "image";
    } else {
      this.replyTo.type = "text";
    }
  }
  next();
});

// ============================================
// 🔴 STATIC METHODS - READ RECEIPTS
// ============================================

/**
 * Mark a single message as read by a user
 */
messageSchema.statics.markMessageAsRead = async function (messageId, userId) {
  return this.findByIdAndUpdate(
    messageId,
    {
      $addToSet: {
        readBy: { user: userId, readAt: new Date() },
      },
    },
    { new: true },
  );
};

/**
 * Mark all messages in a room as read by a user
 * Returns count of updated messages
 */
messageSchema.statics.markRoomAsRead = async function (roomId, userId) {
  const result = await this.updateMany(
    {
      roomId,
      sender: { $ne: userId }, // Don't mark own messages (already read)
      "readBy.user": { $ne: userId }, // Not already read by this user
      isDeleted: false,
    },
    {
      $addToSet: {
        readBy: { user: userId, readAt: new Date() },
      },
    },
  );

  return result.modifiedCount;
};

/**
 * Mark a message as delivered to a user
 */
messageSchema.statics.markMessageAsDelivered = async function (
  messageId,
  userId,
) {
  return this.findByIdAndUpdate(
    messageId,
    {
      $addToSet: {
        deliveredTo: { user: userId, deliveredAt: new Date() },
      },
    },
    { new: true },
  );
};

/**
 * Get unread message count for a user in a specific room
 */
messageSchema.statics.getUnreadCount = async function (roomId, userId) {
  return this.countDocuments({
    roomId,
    sender: { $ne: userId },
    "readBy.user": { $ne: userId },
    isDeleted: false,
  });
};

/**
 * Get all unread message counts for a user across all rooms
 */
messageSchema.statics.getAllUnreadCounts = async function (userId) {
  const result = await this.aggregate([
    {
      $match: {
        sender: { $ne: new mongoose.Types.ObjectId(userId) },
        "readBy.user": { $ne: new mongoose.Types.ObjectId(userId) },
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$roomId",
        unreadCount: { $sum: 1 },
      },
    },
  ]);

  return result;
};

// ============================================
// STATIC METHODS - QUERIES
// ============================================

/**
 * Get messages for a room with full population
 */
messageSchema.statics.getMessages = async function (
  roomId,
  limit = 50,
  before = null,
  userId = null,
) {
  let query = { roomId, isDeleted: false };

  // Exclude messages deleted for this user
  if (userId) {
    query.deletedFor = { $ne: userId };
  }

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate("sender", "name email avatar")
    .populate("readBy.user", "name avatar")
    .populate("deliveredTo.user", "name avatar")
    .populate("reactions.user", "name")
    .populate("replyTo.messageId")
    .lean();
};

/**
 * Get messages with reply data populated
 */
messageSchema.statics.getMessagesWithReplies = async function (
  roomId,
  limit = 50,
  before = null,
  userId = null,
) {
  let query = { roomId, isDeleted: false };

  if (userId) {
    query.deletedFor = { $ne: userId };
  }

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate("sender", "name email avatar")
    .populate("readBy.user", "name avatar")
    .populate("replyTo.messageId", "type mediaUrl duration message senderName")
    .lean();
};

// ============================================
// STATIC METHODS - AUDIO
// ============================================

/**
 * Mark audio message as played
 */
messageSchema.statics.markAudioAsPlayed = async function (messageId, userId) {
  return this.findByIdAndUpdate(messageId, { isPlayed: true }, { new: true });
};

/**
 * Get unplayed audio messages for a user in a room
 */
messageSchema.statics.getUnplayedAudio = async function (userId, roomId) {
  return this.find({
    roomId,
    type: "audio",
    isPlayed: false,
    sender: { $ne: userId },
    isDeleted: false,
  }).sort({ createdAt: 1 });
};

// ============================================
// STATIC METHODS - REACTIONS
// ============================================

/**
 * Add or update reaction on a message
 */
messageSchema.statics.toggleReaction = async function (
  messageId,
  userId,
  reaction,
) {
  const message = await this.findById(messageId);
  if (!message) return null;

  const existingIndex = message.reactions.findIndex(
    (r) => r.user.toString() === userId.toString(),
  );

  if (existingIndex !== -1) {
    if (message.reactions[existingIndex].reaction === reaction) {
      // Remove reaction if same emoji
      message.reactions.splice(existingIndex, 1);
    } else {
      // Update reaction
      message.reactions[existingIndex].reaction = reaction;
      message.reactions[existingIndex].createdAt = new Date();
    }
  } else {
    // Add new reaction
    message.reactions.push({ user: userId, reaction });
  }

  return message.save();
};

/**
 * Remove reaction from a message
 */
messageSchema.statics.removeReaction = async function (messageId, userId) {
  return this.findByIdAndUpdate(
    messageId,
    {
      $pull: { reactions: { user: userId } },
    },
    { new: true },
  );
};

// ============================================
// STATIC METHODS - DELETE
// ============================================

/**
 * Soft delete message for a specific user
 */
messageSchema.statics.softDeleteForUser = async function (messageId, userId) {
  return this.findByIdAndUpdate(
    messageId,
    {
      $addToSet: { deletedFor: userId },
    },
    { new: true },
  );
};

/**
 * Permanently delete message (admin only)
 */
messageSchema.statics.permanentDelete = async function (messageId) {
  return this.findByIdAndUpdate(
    messageId,
    {
      isDeleted: true,
      message: "This message was deleted",
      mediaUrl: "",
      type: "text",
    },
    { new: true },
  );
};

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;
