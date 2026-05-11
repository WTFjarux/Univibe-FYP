// backend/models/User.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    // Basic user information
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },

    // ============================================
    // TOKEN VERSIONING FOR SECURITY
    // ============================================
    // Incremented when password changes to invalidate all existing tokens
    tokenVersion: {
      type: Number,
      default: 0,
    },

    // Role and permissions
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // Profile completion status
    profileComplete: {
      type: Boolean,
      default: false,
    },

    // Username
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },

    // ============================================
    // CONNECTION SYSTEM
    // ============================================

    // Array of user IDs that this user is connected with (mutual connections)
    connections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Track pending connection requests sent by this user
    connectionRequestsSent: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Track pending connection requests received by this user
    connectionRequestsReceived: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Connection stats (denormalized for performance)
    connectionCount: {
      type: Number,
      default: 0,
    },

    // ============================================
    // CONTENT MANAGEMENT
    // ============================================

    // Saved posts - posts the user has bookmarked
    savedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],

    // Hidden posts - posts the user has hidden from feed
    hiddenPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],

    // Muted users - users whose content the user doesn't want to see
    mutedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Timestamps for tracking actions
    savedPostsTimestamps: [
      {
        postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
        savedAt: { type: Date, default: Date.now },
      },
    ],

    mutedUsersTimestamps: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        mutedAt: { type: Date, default: Date.now },
      },
    ],

    // ============================================
    // EMAIL VERIFICATION SYSTEM
    // ============================================

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      select: false,
    },

    emailVerificationTokenExpires: {
      type: Date,
      select: false,
    },

    emailVerificationSentAt: {
      type: Date,
      select: false,
    },

    // ============================================
    // ONLINE STATUS SYSTEM
    // ============================================

    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    socketId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// ============================================
// INDEXES
// ============================================

// Connection indexes
userSchema.index({ connections: 1 });
userSchema.index({ connectionRequestsSent: 1 });
userSchema.index({ connectionRequestsReceived: 1 });

// Content management indexes
userSchema.index({ savedPosts: 1 });
userSchema.index({ hiddenPosts: 1 });
userSchema.index({ mutedUsers: 1 });

// Other indexes
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isOnline: 1 });

// Compound indexes for better query performance
userSchema.index({ savedPosts: 1, createdAt: -1 });

// Full-text search index for user discovery
userSchema.index({ name: "text", username: "text" });

// ============================================
// PASSWORD HASHING MIDDLEWARE
// ============================================
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ============================================
// INSTANCE METHODS
// ============================================

// Compare password for login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ============================================
// CONNECTION MANAGEMENT METHODS
// ============================================

/**
 * Check if user is connected to another user
 */
userSchema.methods.isConnectedWith = function (userId) {
  return this.connections.some((id) => id.toString() === userId.toString());
};

/**
 * Check if a connection request has been sent to another user
 */
userSchema.methods.hasSentRequestTo = function (userId) {
  return this.connectionRequestsSent.some(
    (id) => id.toString() === userId.toString(),
  );
};

/**
 * Check if a connection request has been received from another user
 */
userSchema.methods.hasReceivedRequestFrom = function (userId) {
  return this.connectionRequestsReceived.some(
    (id) => id.toString() === userId.toString(),
  );
};

/**
 * Get connection status with another user
 */
userSchema.methods.getConnectionStatus = function (userId) {
  if (this.isConnectedWith(userId)) return "connected";
  if (this.hasSentRequestTo(userId)) return "request_sent";
  if (this.hasReceivedRequestFrom(userId)) return "request_received";
  return "not_connected";
};

/**
 * Send a connection request to another user
 * Added block check before sending request
 */
userSchema.methods.sendConnectionRequest = async function (userId) {
  const User = mongoose.model("User");
  const Block = mongoose.model("Block");

  // Check if blocked (either direction)
  const isBlocked = await Block.exists({
    $or: [
      { blocker: this._id, blocked: userId },
      { blocker: userId, blocked: this._id },
    ],
  });

  if (isBlocked) {
    throw new Error("Cannot send connection request to this user");
  }

  // Check if already connected
  if (this.isConnectedWith(userId)) {
    throw new Error("Already connected with this user");
  }

  // Check if request already sent
  if (this.hasSentRequestTo(userId)) {
    throw new Error("Connection request already sent");
  }

  // Get recipient
  const recipient = await User.findById(userId);
  if (!recipient) {
    throw new Error("User not found");
  }

  // Check if they already sent a request to us (auto-accept)
  if (this.hasReceivedRequestFrom(userId)) {
    // Check block again for auto-accept case
    const blockExists = await Block.exists({
      $or: [
        { blocker: this._id, blocked: userId },
        { blocker: userId, blocked: this._id },
      ],
    });

    if (blockExists) {
      throw new Error("Cannot accept connection request due to block");
    }

    await this.acceptConnectionRequest(userId);
    return { autoAccepted: true };
  }

  // Send new request
  this.connectionRequestsSent.push(userId);
  await this.save();

  // Add to recipient's received requests
  recipient.connectionRequestsReceived.push(this._id);
  await recipient.save();

  return { autoAccepted: false };
};

/**
 * Accept a connection request from another user
 */
userSchema.methods.acceptConnectionRequest = async function (userId) {
  const User = mongoose.model("User");
  const Block = mongoose.model("Block");

  // Verify request exists
  if (!this.hasReceivedRequestFrom(userId)) {
    throw new Error("No connection request from this user");
  }

  // Check if blocked
  const isBlocked = await Block.exists({
    $or: [
      { blocker: this._id, blocked: userId },
      { blocker: userId, blocked: this._id },
    ],
  });

  if (isBlocked) {
    // Remove the request since they're blocked
    await this.rejectConnectionRequest(userId);
    throw new Error("Cannot accept connection request from blocked user");
  }

  // Get the requester
  const requester = await User.findById(userId);
  if (!requester) {
    throw new Error("User not found");
  }

  // Add to current user's connections
  this.connections.push(userId);
  this.connectionRequestsReceived = this.connectionRequestsReceived.filter(
    (id) => id.toString() !== userId.toString(),
  );
  this.connectionCount = this.connections.length;
  await this.save();

  // Add to requester's connections
  requester.connections.push(this._id);
  requester.connectionRequestsSent = requester.connectionRequestsSent.filter(
    (id) => id.toString() !== this._id.toString(),
  );
  requester.connectionCount = requester.connections.length;
  await requester.save();

  return true;
};

/**
 * Reject a connection request from another user
 */
userSchema.methods.rejectConnectionRequest = async function (userId) {
  const User = mongoose.model("User");

  // Verify request exists
  if (!this.hasReceivedRequestFrom(userId)) {
    throw new Error("No connection request from this user");
  }

  // Remove from current user's received requests
  this.connectionRequestsReceived = this.connectionRequestsReceived.filter(
    (id) => id.toString() !== userId.toString(),
  );
  await this.save();

  // Remove from requester's sent requests
  const requester = await User.findById(userId);
  if (requester) {
    requester.connectionRequestsSent = requester.connectionRequestsSent.filter(
      (id) => id.toString() !== this._id.toString(),
    );
    await requester.save();
  }

  return true;
};

/**
 * Remove a connection
 */
userSchema.methods.removeConnection = async function (userId) {
  const User = mongoose.model("User");

  // Verify connection exists
  if (!this.isConnectedWith(userId)) {
    throw new Error("Not connected with this user");
  }

  // Remove from current user's connections
  this.connections = this.connections.filter(
    (id) => id.toString() !== userId.toString(),
  );
  this.connectionCount = this.connections.length;
  await this.save();

  // Remove from other user's connections
  const otherUser = await User.findById(userId);
  if (otherUser) {
    otherUser.connections = otherUser.connections.filter(
      (id) => id.toString() !== this._id.toString(),
    );
    otherUser.connectionCount = otherUser.connections.length;
    await otherUser.save();
  }

  return true;
};

/**
 * Get mutual connections with another user
 */
userSchema.methods.getMutualConnections = async function (userId) {
  const User = mongoose.model("User");
  const otherUser = await User.findById(userId).select("connections");
  if (!otherUser) return [];

  const myConnectionIds = this.connections.map((id) => id.toString());
  const theirConnectionIds = otherUser.connections.map((id) => id.toString());

  return myConnectionIds.filter((id) => theirConnectionIds.includes(id));
};

// ============================================
// CONTENT MANAGEMENT METHODS
// ============================================

/**
 * Save a post
 */
userSchema.methods.savePost = async function (postId) {
  if (!this.savedPosts.includes(postId)) {
    this.savedPosts.push(postId);
    this.savedPostsTimestamps.push({
      postId: postId,
      savedAt: new Date(),
    });
    await this.save();
    return { saved: true, message: "Post saved successfully" };
  }
  return { saved: false, message: "Post already saved" };
};

/**
 * Unsave a post
 */
userSchema.methods.unsavePost = async function (postId) {
  const wasSaved = this.savedPosts.includes(postId);
  this.savedPosts = this.savedPosts.filter(
    (id) => id.toString() !== postId.toString(),
  );
  this.savedPostsTimestamps = this.savedPostsTimestamps.filter(
    (item) => item.postId.toString() !== postId.toString(),
  );
  await this.save();
  return {
    unsaved: wasSaved,
    message: wasSaved ? "Post removed from saved" : "Post was not saved",
  };
};

/**
 * Check if post is saved
 */
userSchema.methods.isPostSaved = function (postId) {
  return this.savedPosts.some((id) => id.toString() === postId.toString());
};

/**
 * Hide a post
 */
userSchema.methods.hidePost = async function (postId) {
  if (!this.hiddenPosts.includes(postId)) {
    this.hiddenPosts.push(postId);
    await this.save();
    return { hidden: true, message: "Post hidden successfully" };
  }
  return { hidden: false, message: "Post already hidden" };
};

/**
 * Unhide a post
 */
userSchema.methods.unhidePost = async function (postId) {
  const wasHidden = this.hiddenPosts.includes(postId);
  this.hiddenPosts = this.hiddenPosts.filter(
    (id) => id.toString() !== postId.toString(),
  );
  await this.save();
  return {
    unhidden: wasHidden,
    message: wasHidden ? "Post unhidden successfully" : "Post was not hidden",
  };
};

/**
 * Check if post is hidden
 */
userSchema.methods.isPostHidden = function (postId) {
  return this.hiddenPosts.some((id) => id.toString() === postId.toString());
};

/**
 * Mute a user
 */
userSchema.methods.muteUser = async function (userIdToMute) {
  if (userIdToMute.toString() === this._id.toString()) {
    throw new Error("You cannot mute yourself");
  }

  if (!this.mutedUsers.includes(userIdToMute)) {
    this.mutedUsers.push(userIdToMute);
    this.mutedUsersTimestamps.push({
      userId: userIdToMute,
      mutedAt: new Date(),
    });
    await this.save();
    return { muted: true, message: "User muted successfully" };
  }

  // If already muted, unmute
  return await this.unmuteUser(userIdToMute);
};

/**
 * Unmute a user
 */
userSchema.methods.unmuteUser = async function (userIdToUnmute) {
  const wasMuted = this.mutedUsers.includes(userIdToUnmute);
  this.mutedUsers = this.mutedUsers.filter(
    (id) => id.toString() !== userIdToUnmute.toString(),
  );
  this.mutedUsersTimestamps = this.mutedUsersTimestamps.filter(
    (item) => item.userId.toString() !== userIdToUnmute.toString(),
  );
  await this.save();
  return {
    muted: false,
    message: wasMuted ? "User unmuted successfully" : "User was not muted",
  };
};

/**
 * Check if user is muted
 */
userSchema.methods.isUserMuted = function (userId) {
  return this.mutedUsers.some((id) => id.toString() === userId.toString());
};

// ============================================
// BLOCK MANAGEMENT METHODS (VIA SEPARATE COLLECTION)
// ============================================

/**
 * Check if a user is blocked (delegates to Block model)
 */
userSchema.methods.isUserBlocked = async function (userId) {
  const Block = mongoose.model("Block");
  const block = await Block.findOne({
    $or: [
      { blocker: this._id, blocked: userId },
      { blocker: userId, blocked: this._id },
    ],
  });
  return !!block;
};

/**
 * Check if current user has blocked another user
 */
userSchema.methods.hasBlocked = async function (userId) {
  const Block = mongoose.model("Block");
  const block = await Block.findOne({
    blocker: this._id,
    blocked: userId,
  });
  return !!block;
};

/**
 * Check if current user is blocked by another user
 */
userSchema.methods.isBlockedBy = async function (userId) {
  const Block = mongoose.model("Block");
  const block = await Block.findOne({
    blocker: userId,
    blocked: this._id,
  });
  return !!block;
};

// ============================================
// HELPER METHODS FOR QUERY BUILDING
// ============================================

/**
 * Get all muted user IDs
 */
userSchema.methods.getMutedUserIds = function () {
  return this.mutedUsers.map((id) => id.toString());
};

/**
 * Get all hidden post IDs
 */
userSchema.methods.getHiddenPostIds = function () {
  return this.hiddenPosts.map((id) => id.toString());
};

/**
 * Get all saved post IDs
 */
userSchema.methods.getSavedPostIds = function () {
  return this.savedPosts.map((id) => id.toString());
};

// ============================================
// EMAIL VERIFICATION METHODS
// ============================================

userSchema.methods.generateEmailVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = verificationToken;
  this.emailVerificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  this.emailVerificationSentAt = Date.now();
  return verificationToken;
};

userSchema.methods.isVerificationTokenValid = function (token) {
  return (
    this.emailVerificationToken === token &&
    this.emailVerificationTokenExpires > Date.now()
  );
};

userSchema.methods.isVerificationTokenExpired = function () {
  return this.emailVerificationTokenExpires < Date.now();
};

userSchema.methods.canResendVerification = function () {
  if (!this.emailVerificationSentAt) return true;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return this.emailVerificationSentAt < fiveMinutesAgo;
};

// ============================================
// ONLINE STATUS METHODS
// ============================================

/**
 * Update user's online status
 */
userSchema.methods.updateOnlineStatus = async function (
  isOnline,
  socketId = null,
) {
  this.isOnline = isOnline;
  this.lastSeen = new Date();
  if (socketId) this.socketId = socketId;
  if (!isOnline) this.socketId = "";
  await this.save();
  return this;
};

/**
 * Get user's online status
 * Respects block - blocked users can't see online status
 */
userSchema.methods.getOnlineStatus = function (requesterId) {
  // If requester is blocked by this user, don't show online status
  // This check is done at the route level using middleware
  return {
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
  };
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get blocked user IDs for a user (from Block collection)
 * This replaces the old this.blockedUsers approach
 */
userSchema.statics.getBlockedUserIds = async function (userId) {
  const Block = mongoose.model("Block");
  const blocks = await Block.find({
    $or: [{ blocker: userId }, { blocked: userId }],
  }).lean();

  const blockedIds = new Set();

  blocks.forEach((block) => {
    if (block.blockDirection === "mutual") {
      // In mutual blocks, both users are blocked from each other
      blockedIds.add(block.blocker.toString());
      blockedIds.add(block.blocked.toString());
    } else if (block.blocker.toString() === userId.toString()) {
      // Current user blocked someone - they're blocked
      blockedIds.add(block.blocked.toString());
    } else {
      // Someone blocked current user - they're blocked from viewing
      blockedIds.add(block.blocker.toString());
    }
  });

  // Remove self from set
  blockedIds.delete(userId.toString());
  return Array.from(blockedIds);
};

/**
 * Check if two users are blocked (either direction)
 */
userSchema.statics.areUsersBlocked = async function (userId1, userId2) {
  const Block = mongoose.model("Block");
  const block = await Block.findOne({
    $or: [
      { blocker: userId1, blocked: userId2 },
      { blocker: userId2, blocked: userId1 },
    ],
  }).lean();

  return !!block;
};

/**
 * Get connection suggestions based on mutual connections
 * Excludes blocked users
 */
userSchema.statics.getConnectionSuggestions = async function (
  userId,
  limit = 10,
) {
  const User = this;
  const user = await User.findById(userId);
  if (!user) return [];

  // Get blocked user IDs
  const blockedUserIds = await User.getBlockedUserIds(userId);

  // Get IDs to exclude
  const excludedIds = [
    userId,
    ...user.connections.map((id) => id.toString()),
    ...user.connectionRequestsSent.map((id) => id.toString()),
    ...user.connectionRequestsReceived.map((id) => id.toString()),
    ...blockedUserIds,
    ...user.mutedUsers.map((id) => id.toString()),
  ];

  // Find users with mutual connections
  const suggestions = await User.aggregate([
    {
      $match: {
        _id: {
          $nin: excludedIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        profileComplete: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "connections",
        foreignField: "_id",
        as: "mutualConnections",
      },
    },
    {
      $addFields: {
        mutualCount: {
          $size: {
            $filter: {
              input: "$mutualConnections",
              cond: { $in: ["$$this._id", user.connections] },
            },
          },
        },
      },
    },
    { $sort: { mutualCount: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $project: {
        password: 0,
        emailVerificationToken: 0,
        emailVerificationTokenExpires: 0,
        emailVerificationSentAt: 0,
      },
    },
  ]);

  return suggestions;
};

/**
 * Get all online friends (respecting blocks)
 */
userSchema.statics.getOnlineFriends = async function (userId) {
  const user = await this.findById(userId);
  if (!user) return [];

  // Get blocked users to exclude
  const blockedUserIds = await this.getBlockedUserIds(userId);

  // Filter out blocked users from connections
  const visibleConnections = user.connections.filter(
    (connId) => !blockedUserIds.includes(connId.toString()),
  );

  const onlineFriends = await this.find({
    _id: { $in: visibleConnections },
    isOnline: true,
  }).select("name email username profilePicture isOnline lastSeen");

  return onlineFriends;
};

/**
 * Clean up old content management data (for housekeeping)
 */
userSchema.statics.cleanupOldTimestamps = async function (daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await this.updateMany(
    {},
    {
      $pull: {
        savedPostsTimestamps: { savedAt: { $lt: cutoffDate } },
        mutedUsersTimestamps: { mutedAt: { $lt: cutoffDate } },
      },
    },
  );

  return result;
};

// ============================================
// SERIALIZATION
// ============================================

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.emailVerificationToken;
  delete user.emailVerificationTokenExpires;
  delete user.emailVerificationSentAt;
  return user;
};

module.exports = mongoose.model("User", userSchema);
