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
      required: false,
      trim: true,
      maxlength: 500,
      default: "",
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

    // SIMPLIFIED VISIBILITY - campus and connections
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
      index: true,
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

// ============================================
// MIDDLEWARE: Soft Delete Filter System
// ============================================

/**
 * Pre-middleware function to exclude soft-deleted posts
 * Only applies if includeDeleted() was NOT called on the query
 */
const applySoftDeleteFilter = function () {
  // Only apply if includeDeleted was NOT explicitly called
  if (!this._includeDeleted) {
    const query = this.getQuery();
    // Don't apply if query already has an isDeleted condition
    if (!("isDeleted" in query)) {
      this.where({ isDeleted: false });
    }
  }
  // IMPORTANT: Don't reset _includeDeleted here - let it persist
};

/**
 * Post-middleware function to reset the includeDeleted flag
 * Runs after the query completes to clean up
 */
const resetIncludeDeletedFlag = function () {
  this._includeDeleted = false;
};

// Apply pre-middleware to all find operations
postSchema.pre(/^find/, applySoftDeleteFilter);
postSchema.pre("countDocuments", applySoftDeleteFilter);
postSchema.pre("findOne", applySoftDeleteFilter);
postSchema.pre("findOneAndUpdate", applySoftDeleteFilter);
postSchema.pre("findOneAndDelete", applySoftDeleteFilter);
postSchema.pre("findOneAndRemove", applySoftDeleteFilter);

// Apply post-middleware to reset the flag after query completes
postSchema.post(/^find/, resetIncludeDeletedFlag);
postSchema.post("countDocuments", resetIncludeDeletedFlag);
postSchema.post("findOne", resetIncludeDeletedFlag);
postSchema.post("findOneAndUpdate", resetIncludeDeletedFlag);
postSchema.post("findOneAndDelete", resetIncludeDeletedFlag);
postSchema.post("findOneAndRemove", resetIncludeDeletedFlag);

// ============================================
// DATABASE INDEXES FOR PERFORMANCE
// ============================================
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ campus: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ visibility: 1 });
postSchema.index({ isAnonymous: 1 });
postSchema.index({ commentCount: -1 });
postSchema.index({ user: 1, visibility: 1 });
postSchema.index({ campus: 1, visibility: 1 });
postSchema.index({ isDeleted: 1, createdAt: -1 });
postSchema.index({ isDeleted: 1, deletedAt: 1 });

// ============================================
// VIRTUALS
// ============================================

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

// ============================================
// INSTANCE METHODS
// ============================================

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
    const filenames = this.images.map((img) => img.filename);
    // Image deletion should be handled in the controller
    // using the deletePostImages function since it needs req object
  }

  await this.deleteOne();
  return true;
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

// ============================================
// STATIC METHODS
// ============================================

// === STATIC METHOD TO GET SOFT-DELETED POSTS ===
postSchema.statics.getDeletedPosts = function (options = {}) {
  return this.find({ isDeleted: true, ...options })
    .includeDeleted()
    .sort({ deletedAt: -1 });
};

// === STATIC METHOD TO PERMANENTLY DELETE OLD SOFT-DELETED POSTS ===
postSchema.statics.cleanupOldDeletedPosts = async function (daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const oldDeletedPosts = await this.find({
    isDeleted: true,
    deletedAt: { $lt: cutoffDate },
  }).includeDeleted();

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

// ============================================
// QUERY HELPERS
// ============================================

// === QUERY HELPER TO INCLUDE SOFT-DELETED POSTS ===
postSchema.query.includeDeleted = function () {

  this._includeDeleted = true;
  return this;
};

// === QUERY HELPER TO EXPLICITLY EXCLUDE SOFT-DELETED POSTS ===
postSchema.query.excludeDeleted = function () {

  this._includeDeleted = false;
  return this;
};

const Post = mongoose.model("Post", postSchema);
module.exports = Post;
