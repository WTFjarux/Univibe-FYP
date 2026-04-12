// Backend/models/User.js
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
    // ONLINE STATUS SYSTEM (ADDED FOR SOCKET.IO)
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
userSchema.index({ connections: 1 });
userSchema.index({ connectionRequestsSent: 1 });
userSchema.index({ connectionRequestsReceived: 1 });
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ isOnline: 1 }); // Added for faster online status queries

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
 */
userSchema.methods.sendConnectionRequest = async function (userId) {
  const User = mongoose.model("User");

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

  // Verify request exists
  if (!this.hasReceivedRequestFrom(userId)) {
    throw new Error("No connection request from this user");
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
// ONLINE STATUS METHODS (ADDED FOR SOCKET.IO)
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
 */
userSchema.methods.getOnlineStatus = function () {
  return {
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
  };
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get connection suggestions based on mutual connections
 */
userSchema.statics.getConnectionSuggestions = async function (
  userId,
  limit = 10,
) {
  const User = this;
  const user = await User.findById(userId);
  if (!user) return [];

  // Get IDs to exclude
  const excludedIds = [
    userId,
    ...user.connections.map((id) => id.toString()),
    ...user.connectionRequestsSent.map((id) => id.toString()),
    ...user.connectionRequestsReceived.map((id) => id.toString()),
  ];

  // Find users with mutual connections
  const suggestions = await User.aggregate([
    {
      $match: {
        _id: { $nin: excludedIds.map((id) => new mongoose.Types.ObjectId(id)) },
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
 * Get all online users (friends/connections)
 */
userSchema.statics.getOnlineFriends = async function (userId) {
  const user = await this.findById(userId);
  if (!user) return [];

  const onlineFriends = await this.find({
    _id: { $in: user.connections },
    isOnline: true,
  }).select("name email username profilePicture isOnline lastSeen");

  return onlineFriends;
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
