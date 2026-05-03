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

    // SIMPLIFIED VISIBILITY -  campus and connections
    visibility: {
      type: String,
      enum: ["campus", "connections"], 
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

    // === SOFT DELETE FIELDS ===
    isDeleted: {
      type: Boolean,
      default: false,
      index: true, // Add index for faster queries
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    permanentlyDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// === CUSTOM VALIDATION: Ensure either content or images exist ===
postSchema.pre("validate", function (next) {
  // Skip validation if post is being soft deleted
  if (this.isDeleted) {
    return next();
  }

  // Check if there's content (not empty string) OR images
  const hasContent = this.content && this.content.trim().length > 0;
  const hasImages = this.images && this.images.length > 0;

  if (!hasContent && !hasImages) {
    next(new Error("Post must have either content or at least one image"));
  } else {
    next();
  }
});

// === MIDDLEWARE: Automatically exclude soft-deleted posts from queries ===
postSchema.pre(/^find/, function () {
  // Only apply to find queries, not to countDocuments or other operations
  if (this.getQuery().includeDeleted !== true) {
    this.where({ isDeleted: false });
  }
  // Remove the flag so it doesn't affect other queries
  delete this.getQuery().includeDeleted;
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
postSchema.index({ isDeleted: 1, createdAt: -1 }); // Index for soft-deleted posts
postSchema.index({ isDeleted: 1, deletedAt: 1 }); // Index for cleanup queries

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

// === METHOD TO SOFT DELETE A POST ===
postSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
  return this;
};

// === METHOD TO RESTORE A SOFT-DELETED POST ===
postSchema.methods.restore = async function () {
  this.isDeleted = false;
  this.deletedAt = null;
  await this.save();
  return this;
};

// === METHOD TO PERMANENTLY DELETE A POST ===
postSchema.methods.permanentDelete = async function () {
  // Remove associated images
  if (this.images && this.images.length > 0) {
    // You'll need to import your deletePostImages function or handle here
    const filenames = this.images.map((img) => img.filename);
    // Note: This requires access to the deletePostImages function
    // You might want to handle image deletion in the controller instead
  }

  await this.deleteOne();
  return true;
};

// === STATIC METHOD TO GET SOFT-DELETED POSTS ===
postSchema.statics.getDeletedPosts = function (options = {}) {
  return this.find({ isDeleted: true, ...options }).sort({ deletedAt: -1 });
};

// === STATIC METHOD TO PERMANENTLY DELETE OLD SOFT-DELETED POSTS ===
postSchema.statics.cleanupOldDeletedPosts = async function (daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const oldDeletedPosts = await this.find({
    isDeleted: true,
    deletedAt: { $lt: cutoffDate },
  });

  let deletedCount = 0;
  for (const post of oldDeletedPosts) {
    // Delete associated comments
    const Comment = mongoose.model("Comment");
    await Comment.deleteMany({ post: post._id });

    // Delete associated notifications
    const Notification = mongoose.model("Notification");
    await Notification.deleteMany({ targetId: post._id, targetModel: "Post" });

    // Delete the post
    await post.deleteOne();
    deletedCount++;
  }

  return deletedCount;
};

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
  // Don't show soft-deleted posts
  if (this.isDeleted) {
    return false;
  }

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

// === METHOD TO CHECK IF USER CAN DELETE/RESTORE POST ===
postSchema.methods.canUserModify = function (userId) {
  return this.user.toString() === userId.toString();
};

// === QUERY HELPER TO INCLUDE SOFT-DELETED POSTS ===
postSchema.query.includeDeleted = function () {
  return this.where({ includeDeleted: true });
};

const Post = mongoose.model("Post", postSchema);
module.exports = Post;
