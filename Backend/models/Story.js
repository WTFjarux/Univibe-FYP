const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    caption: {
      type: String,
      default: "",
      maxlength: 2200,
      trim: true,
    },
    viewers: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // Auto-delete after 24 hours (TTL index)
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for fetching user's recent stories
storySchema.index({ user: 1, createdAt: -1 });

// Optimize viewer lookups
storySchema.index({ "viewers.userId": 1 });

// Compound index for efficient "unseen stories since last view" queries
storySchema.index({ user: 1, "viewers.userId": 1, createdAt: -1 });

// Pre-save hook to enforce caption length server-side
storySchema.pre("save", function (next) {
  if (this.caption && this.caption.length > 2200) {
    const err = new Error("Caption cannot exceed 2200 characters");
    return next(err);
  }
  next();
});

module.exports = mongoose.model("Story", storySchema);
