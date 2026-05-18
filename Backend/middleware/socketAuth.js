// backend/middleware/socketAuth.js

const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authenticate socket connection and check account status
 */
const authenticateSocket = async (socket) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      throw new Error("Authentication token missing");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ FIXED: Use only exclusion OR only inclusion, not both
    // Exclude password, but include everything else (moderation fields are already included by default)
    const user = await User.findById(decoded.id)
      .select(
        "-password -emailVerificationToken -emailVerificationTokenExpires -emailVerificationSentAt",
      )
      .lean();

    if (!user) {
      throw new Error("User not found");
    }

    // Check if account is banned
    if (user.isBanned) {
      throw new Error(
        `Your account has been permanently banned. Reason: ${user.banReason || "Violation of community guidelines"}`,
      );
    }

    // Check if account is suspended
    if (user.isSuspended) {
      if (user.suspendedUntil && new Date() > new Date(user.suspendedUntil)) {
        // Auto-lift suspension
        await User.findByIdAndUpdate(user._id, {
          isSuspended: false,
          suspendReason: undefined,
          suspendedAt: undefined,
          suspendedUntil: undefined,
        });
        console.log(`✅ Suspension auto-lifted for user: ${user._id}`);
      } else {
        const timeLeft = user.suspendedUntil
          ? Math.ceil(
              (new Date(user.suspendedUntil) - new Date()) / (1000 * 60 * 60),
            )
          : "unknown";
        throw new Error(
          `Your account is suspended for approximately ${timeLeft} more hours. Reason: ${user.suspendReason || "Violation of community guidelines"}`,
        );
      }
    }

    // Check token version (force logout)
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (decoded.tokenVersion !== user.tokenVersion) {
        throw new Error(
          "Session expired. You have been logged out. Please login again.",
        );
      }
    }

    // Attach user info to socket
    socket.user = user;
    socket.userId = user._id.toString();

    return user;
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * Socket.IO middleware for authentication + account status
 */
const socketAuthMiddleware = (socket, next) => {
  authenticateSocket(socket)
    .then(() => next())
    .catch((error) => {
      console.log(`🚫 Socket connection rejected: ${error.message}`);
      next(new Error(error.message));
    });
};

module.exports = { authenticateSocket, socketAuthMiddleware };
