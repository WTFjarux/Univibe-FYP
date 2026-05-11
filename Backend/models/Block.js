// backend/models/Block.js

const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Blocker is required"],
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Blocked user is required"],
    },
    blockedAt: {
      type: Date,
      default: Date.now,
    },
    blockDirection: {
      type: String,
      enum: ["one_way", "mutual"],
      default: "one_way",
    },
    reason: {
      type: String,
      enum: ["harassment", "spam", "inappropriate", "other", null],
      default: null,
    },
    metadata: {
      previousConnectionStatus: {
        type: String,
        enum: ["connected", "request_pending", "none", null],
        default: null,
      },
      blockedFrom: {
        type: String,
        enum: ["profile", "post", "comment", "chat", "search", "other"],
        default: "profile",
      },
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================
// INDEXES
// ============================================

blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
blockSchema.index({ blocked: 1, blocker: 1 });
blockSchema.index({ blocker: 1, blockDirection: 1 });
blockSchema.index({ blocked: 1, blockDirection: 1 });
blockSchema.index({ blocker: 1, blockedAt: -1 });
blockSchema.index({ blocked: 1, blockedAt: -1 });
blockSchema.index({ blocked: 1, blocker: 1, blockDirection: 1 });

// ============================================
// MIDDLEWARE
// ============================================

blockSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get all blocked user IDs for a user (both directions)
 */
blockSchema.statics.getBlockedUserIds = async function (userId) {
  const blocks = await this.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  }).lean();

  const blockedIds = new Set();

  blocks.forEach((block) => {
    if (block.blockDirection === "mutual") {
      blockedIds.add(block.blocker.toString());
      blockedIds.add(block.blocked.toString());
    } else if (block.blocker.toString() === userId.toString()) {
      blockedIds.add(block.blocked.toString());
    } else {
      blockedIds.add(block.blocker.toString());
    }
  });

  blockedIds.delete(userId.toString());
  return Array.from(blockedIds);
};

/**
 * Check if two users are blocked (either direction)
 */
blockSchema.statics.areUsersBlocked = async function (userId1, userId2) {
  const block = await this.findOne({
    $or: [
      { blocker: userId1, blocked: userId2 },
      { blocker: userId2, blocked: userId1 },
    ],
  }).lean();

  return !!block;
};

/**
 * Get block record between two users
 */
blockSchema.statics.getBlockRecord = async function (userId1, userId2) {
  return await this.findOne({
    $or: [
      { blocker: userId1, blocked: userId2 },
      { blocker: userId2, blocked: userId1 },
    ],
  });
};

/**
 * Get users who have blocked a specific user
 */
blockSchema.statics.getBlockersOfUser = async function (userId) {
  const blocks = await this.find({ blocked: userId })
    .populate("blocker", "name username")
    .lean();
  return blocks;
};

/**
 * Get users blocked by a specific user
 */
blockSchema.statics.getUsersBlockedByUser = async function (userId) {
  const blocks = await this.find({ blocker: userId })
    .populate("blocked", "name username")
    .lean();
  return blocks;
};

/**
 * Get block statistics for a user
 */
blockSchema.statics.getBlockStats = async function (userId) {
  const [blockedByUser, userBlockedBy, mutualBlocks] = await Promise.all([
    this.countDocuments({ blocker: userId, blockDirection: "one_way" }),
    this.countDocuments({ blocked: userId, blockDirection: "one_way" }),
    this.countDocuments({
      $or: [
        { blocker: userId, blockDirection: "mutual" },
        { blocked: userId, blockDirection: "mutual" },
      ],
    }),
  ]);

  return {
    blockedByUser,
    userBlockedBy,
    mutualBlocks,
    total: blockedByUser + userBlockedBy + mutualBlocks / 2,
  };
};

/**
 * Clean up orphaned blocks
 */
blockSchema.statics.cleanupOrphanedBlocks = async function () {
  const User = mongoose.model("User");

  const blocks = await this.find({}).lean();
  const userIds = new Set();

  blocks.forEach((block) => {
    userIds.add(block.blocker.toString());
    userIds.add(block.blocked.toString());
  });

  const existingUsers = await User.find({
    _id: { $in: Array.from(userIds) },
  })
    .select("_id")
    .lean();

  const existingUserIds = new Set(existingUsers.map((u) => u._id.toString()));

  const orphanedBlocks = blocks.filter(
    (block) =>
      !existingUserIds.has(block.blocker.toString()) ||
      !existingUserIds.has(block.blocked.toString()),
  );

  if (orphanedBlocks.length > 0) {
    const blockIdsToRemove = orphanedBlocks.map((b) => b._id);
    await this.deleteMany({ _id: { $in: blockIdsToRemove } });
  }

  return orphanedBlocks.length;
};

// ============================================
// INSTANCE METHODS
// ============================================

blockSchema.methods.makeMutual = async function () {
  if (this.blockDirection === "one_way") {
    this.blockDirection = "mutual";
    this.updatedAt = new Date();
    await this.save();
  }
  return this;
};

const Block = mongoose.model("Block", blockSchema);

module.exports = Block;
