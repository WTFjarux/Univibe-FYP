const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    // Reference to the post this comment belongs to
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true, // Important for querying comments by post
    },

    // User who wrote the comment
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Comment content
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    // For nested replies - reference to parent comment
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true, // For finding replies to a comment
    },

    // For tracking the thread hierarchy
    rootComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true, // For finding all comments in a thread
    },

    // Replies to this comment (just IDs for quick access)
    replies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    // Track likes on comments
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Track if comment was edited
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,

    // For anonymous handling
    isFromAnonymousPost: {
      type: Boolean,
      default: false,
    },

    // NEW: Allow users to comment anonymously on any post
    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // Depth of nesting (1 = top-level, 2 = reply, 3 = reply to reply, etc.)
    depth: {
      type: Number,
      default: 1,
      min: 1,
      max: 5, // Limit nesting depth to prevent infinite nesting
    },

    // Path for efficient thread retrieval (MongoDB-friendly format)
    path: {
      type: String,
      index: true,
    },

    // For soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Compound indexes for efficient querying
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });
commentSchema.index({ user: 1, createdAt: -1 });
commentSchema.index({ rootComment: 1, createdAt: 1 });

// Virtual for like count
commentSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

// Virtual for reply count
commentSchema.virtual("replyCount").get(function () {
  return this.replies.length;
});

// Method to check if user liked the comment
commentSchema.methods.isLikedByUser = function (userId) {
  return this.likes.some(id => id.toString() === userId.toString());
};

// Method to toggle like
commentSchema.methods.toggleLike = function (userId) {
  const index = this.likes.findIndex(id => id.toString() === userId.toString());
  if (index === -1) {
    this.likes.push(userId);
    return true; // Liked
  } else {
    this.likes.splice(index, 1);
    return false; // Unliked
  }
};

// Static method to get comment thread
commentSchema.statics.getThread = async function (commentId) {
  const comment = await this.findById(commentId)
    .populate('user', 'name username profilePicture')
    .lean();

  if (!comment) return null;

  const getReplies = async (parentId) => {
    const replies = await this.find({ parentComment: parentId, isDeleted: false })
      .populate('user', 'name username profilePicture')
      .sort({ createdAt: 1 })
      .lean();

    for (let reply of replies) {
      reply.replies = await getReplies(reply._id);
    }
    return replies;
  };

  comment.replies = await getReplies(commentId);
  return comment;
};

// Pre-save middleware to set path and rootComment
commentSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Set the path for hierarchical querying
    if (!this.parentComment) {
      // Top-level comment
      this.rootComment = this._id;
      this.path = `${this.post}_${this._id}`;
    } else {
      // Find parent to get rootComment and set path
      const parent = await this.constructor.findById(this.parentComment);
      if (parent) {
        this.rootComment = parent.rootComment || parent._id;
        this.path = `${parent.path}_${this._id}`;
      }
    }
  }
  next();
});

// Post-save middleware to update parent's replies array
commentSchema.post('save', async function(doc) {
  if (doc.parentComment) {
    // Add this reply to parent's replies array
    await doc.constructor.findByIdAndUpdate(doc.parentComment, {
      $addToSet: { replies: doc._id }
    });
  }
  
  // Update post comment count
  const Post = mongoose.model('Post');
  await Post.findByIdAndUpdate(doc.post, {
    $inc: { commentCount: 1 }
  });
});

// Pre-remove middleware to clean up references
commentSchema.pre('remove', async function(next) {
  // Remove from parent's replies array
  if (this.parentComment) {
    await this.constructor.findByIdAndUpdate(this.parentComment, {
      $pull: { replies: this._id }
    });
  }
  
  // Remove all replies to this comment
  await this.constructor.deleteMany({ parentComment: this._id });
  
  // Update post comment count
  const Post = mongoose.model('Post');
  await Post.findByIdAndUpdate(this.post, {
    $inc: { commentCount: -1 }
  });
  
  next();
});

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;