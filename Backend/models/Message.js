// backend/models/Message.js
// Schema + Indexes only. Static methods in ./Message.statics.js

const mongoose = require("mongoose");

const reactionEnum = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "😡",
  "🎉",
  "🙏",
  "👏",
  "🔥",
];
const messageTypes = ["text", "image", "audio", "video", "file", "location"];

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderName: { type: String, required: true },
    senderAvatar: { type: String, default: "" },

    roomId: { type: String, required: true, index: true },

    message: { type: String, required: true, trim: true, maxlength: 5000 },
    type: { type: String, enum: messageTypes, default: "text" },

    // Media
    mediaUrl: { type: String, default: "" },
    mediaSize: { type: Number, default: 0 },
    mediaName: { type: String, default: "" },
    mediaMimeType: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" }, // ✅ NEW: thumbnail

    // Location
    locationData: {
      latitude: Number,
      longitude: Number,
      locationName: { type: String, default: "" },
    },

    // Audio
    duration: { type: Number, default: 0 },
    isPlayed: { type: Boolean, default: false },

    // Reply
    replyTo: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      message: String,
      senderName: String,
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      type: { type: String, enum: messageTypes, default: "text" },
      mediaUrl: { type: String, default: "" },
      thumbnailUrl: { type: String, default: "" },
      duration: { type: Number, default: 0 },
    },

    isForwarded: { type: Boolean, default: false },
    originalMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    originalSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    forwardedAt: { type: Date, default: null },

    // Read receipts
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],
    deliveredTo: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        deliveredAt: { type: Date, default: Date.now },
      },
    ],

    // Reactions
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reaction: { type: String, enum: reactionEnum },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Legacy
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
  },
  { timestamps: true },
);

// ============================================
// INDEXES
// ============================================
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ "readBy.user": 1 });
messageSchema.index({ "deliveredTo.user": 1 });
messageSchema.index({ roomId: 1, "readBy.user": 1 });

// ============================================
// PRE-SAVE HOOKS
// ============================================
messageSchema.pre("save", function (next) {
  if (this.type === "audio" && !this.message) {
    const m = Math.floor(this.duration / 60);
    const s = (this.duration % 60).toString().padStart(2, "0");
    this.message = `🎤 Voice message (${m}:${s})`;
  }
  if (this.replyTo?.message && !this.replyTo.type) {
    if (
      this.replyTo.message === "🎤 Voice message" ||
      this.replyTo.mediaUrl?.includes("audio")
    )
      this.replyTo.type = "audio";
    else if (
      this.replyTo.message === "Photo" ||
      this.replyTo.mediaUrl?.includes("image")
    )
      this.replyTo.type = "image";
    else this.replyTo.type = "text";
  }
  next();
});

// ============================================
// CONFIG
// ============================================
messageSchema.set("toJSON", { virtuals: true });
messageSchema.set("toObject", { virtuals: true });

// ============================================
// LOAD STATIC METHODS FROM SEPARATE FILE
// ============================================
require("./Message.statics")(messageSchema);

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;
