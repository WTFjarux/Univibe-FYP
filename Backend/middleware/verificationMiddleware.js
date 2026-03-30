// Backend/middleware/verificationMiddleware.js
const User = require("../models/User");

/**
 * Middleware to check if user's email is verified
 * Blocks access to protected routes if email is not verified
 * Skips verification for profile setup endpoint
 */
const checkEmailVerified = async (req, res, next) => {
  try {
    // Skip verification for profile setup
    if (req.originalUrl.includes("/api/profile/setup")) {
      return next();
    }

    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Block access if email not verified
    if (!req.user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email address before accessing this feature",
        code: "EMAIL_NOT_VERIFIED",
        needsVerification: true,
        userEmail: req.user.email,
        canResend: true,
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while checking verification status",
    });
  }
};

module.exports = { checkEmailVerified };
