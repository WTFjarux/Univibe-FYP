// Backend/models/Post.js
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    // === REQUIRED FIELDS ===
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    // === NEW: ANONYMOUS POSTING FIELDS ===
    isAnonymous: {
      type: Boolean,
      default: false,
      required: true,
    },

    // === IMAGES (supports multiple images) ===
    images: [
      {
        filename: String,
        url: String,
        path: String,
        mimetype: String,
        size: Number,
      },
    ],

    // === ENGAGEMENT METRICS ===
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        content: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    reposts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // === POST METADATA ===
    tags: [
      {
        type: String,
      },
    ],

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // === POST SETTINGS ===
    campus: {
      type: String,
      required: true,
    },

    // Who can see this post - UPDATED ENUM VALUES
    visibility: {
      type: String,
      enum: ["campus", "connections", "following", "private"],
      default: "campus",
    },

    // === POST STATUS FLAGS ===
    isPinned: {
      type: Boolean,
      default: false,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: Date,
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  },
);

// === DATABASE INDEXES FOR PERFORMANCE ===
postSchema.index({ user: 1, createdAt: -1 }); // User's posts in chronological order
postSchema.index({ campus: 1, createdAt: -1 }); // Campus feed
postSchema.index({ tags: 1 }); // Search by tags
postSchema.index({ visibility: 1 }); // Filter by visibility
postSchema.index({ isAnonymous: 1 }); // Filter anonymous posts

const Post = mongoose.model("Post", postSchema);
module.exports = Post;
