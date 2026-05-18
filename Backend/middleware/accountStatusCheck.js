// backend/middleware/accountStatusCheck.js

const User = require("../models/User");

/**
 * Middleware to check if user account is banned or suspended
 * Should be applied AFTER auth middleware (after req.user is set)
 */
const checkAccountStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select("isBanned isSuspended suspendedUntil banReason suspendReason")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Check if banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Your account has been banned. Reason: ${user.banReason || "Violation of terms"}`,
        code: "ACCOUNT_BANNED",
        bannedReason: user.banReason,
      });
    }

    // Check if suspended
    if (user.isSuspended) {
      // Check if suspension has expired
      if (user.suspendedUntil && new Date() > new Date(user.suspendedUntil)) {
        // Auto-lift suspension
        await User.findByIdAndUpdate(req.user._id, {
          isSuspended: false,
          suspendReason: null,
          suspendedAt: null,
          suspendedUntil: null,
        });
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Your account is suspended until ${new Date(user.suspendedUntil).toLocaleString()}. Reason: ${user.suspendReason || "Violation of terms"}`,
        code: "ACCOUNT_SUSPENDED",
        suspendedUntil: user.suspendedUntil,
        suspendReason: user.suspendReason,
      });
    }

    next();
  } catch (error) {
    console.error("Account status check error:", error);
    next(); // Allow request on error to prevent blocking users
  }
};

module.exports = checkAccountStatus;
