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
      required: false, // Changed from true to false
      trim: true,
      maxlength: 500,
      default: "", // Add default empty string
    },

    // === ANONYMOUS POSTING FIELDS ===
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

    // Comment count (denormalized for performance)
    commentCount: {
      type: Number,
      default: 0,
    },

    // OPTIONAL: Cache recent comments for performance
    recentComments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
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

    // SIMPLIFIED VISIBILITY - Only campus and connections
    visibility: {
      type: String,
      enum: ["campus", "connections"], // Removed: "following", "private"
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// === CUSTOM VALIDATION: Ensure either content or images exist ===
postSchema.pre("validate", function (next) {
  // Check if there's content (not empty string) OR images
  const hasContent = this.content && this.content.trim().length > 0;
  const hasImages = this.images && this.images.length > 0;

  if (!hasContent && !hasImages) {
    next(new Error("Post must have either content or at least one image"));
  } else {
    next();
  }
});

// === DATABASE INDEXES FOR PERFORMANCE ===
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ campus: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ visibility: 1 });
postSchema.index({ isAnonymous: 1 });
postSchema.index({ commentCount: -1 });
postSchema.index({ user: 1, visibility: 1 }); // Added for connection queries
postSchema.index({ campus: 1, visibility: 1 }); // Added for campus queries

// === VIRTUAL FOR COMMENTS (lazy loading) ===
postSchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
  options: { sort: { createdAt: -1 } },
});

// === VIRTUAL FOR TOP-LEVEL COMMENTS ===
postSchema.virtual("topLevelComments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "post",
  match: { parentComment: null, isDeleted: false },
  options: { sort: { createdAt: -1 } },
});

// === METHOD TO UPDATE COMMENT COUNT ===
postSchema.methods.updateCommentCount = async function () {
  const Comment = mongoose.model("Comment");
  const count = await Comment.countDocuments({
    post: this._id,
    isDeleted: false,
  });
  this.commentCount = count;
  return this.save();
};

// === METHOD TO GET RECENT COMMENTS ===
postSchema.methods.getRecentComments = async function (limit = 5) {
  const Comment = mongoose.model("Comment");
  return await Comment.find({
    post: this._id,
    isDeleted: false,
  })
    .populate("user", "name username profilePicture")
    .sort({ createdAt: -1 })
    .limit(limit);
};

// === METHOD TO GET COMMENT THREAD ===
postSchema.methods.getCommentThread = async function (commentId) {
  const Comment = mongoose.model("Comment");
  return await Comment.getThread(commentId);
};

// === METHOD TO CHECK IF USER CAN VIEW POST ===
postSchema.methods.canUserView = async function (
  userId,
  userConnections,
  userCampus,
) {
  // Always visible to post owner
  if (this.user.toString() === userId.toString()) {
    return true;
  }

  // Anonymous posts visible to everyone
  if (this.isAnonymous) {
    return true;
  }

  // Check visibility settings
  if (this.visibility === "campus") {
    return this.campus === userCampus;
  }

  if (this.visibility === "connections") {
    return userConnections.includes(this.user.toString());
  }

  return false;
};

const Post = mongoose.model("Post", postSchema);
module.exports = Post;
