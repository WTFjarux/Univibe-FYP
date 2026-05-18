// backend/controllers/admin/adminAuthController.js

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../../models/User");
const { getAdminModel } = require("../../config/database");

/**
 * Admin Authentication Controller
 * Handles admin login, token management, and session security
 */

// ============================================
// CONSTANTS
// ============================================
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const REFRESH_TOKEN_BYTES = 40;

// ============================================
// ADMIN LOGIN
// ============================================
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user WITH password field (NO lean() - need instance methods)
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password +tokenVersion +refreshToken",
    );

    // CRITICAL SECURITY: Same error for all failure cases
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check account status
    if (user.isBanned) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check suspension (auto-lift if expired)
    if (user.isSuspended) {
      if (user.suspendedUntil && new Date() > user.suspendedUntil) {
        // Auto-lift expired suspension
        user.isSuspended = false;
        user.suspendReason = null;
        user.suspendedAt = null;
        user.suspendedUntil = null;
        await user.save();
      } else {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check email verification
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in as admin.",
      });
    }

    // ============================================
    // VERIFY ADMIN ROLE (Cross-DB compatible)
    // ============================================
    const AdminRole = getAdminModel("AdminRole");
    const userIdAsString = user._id.toString();

    // Try multiple formats to find the admin role
    let adminRole = null;

    // Try 1: Original ObjectId
    adminRole = await AdminRole.findOne({
      user: user._id,
      isActive: true,
    });

    // Try 2: String format
    if (!adminRole) {
      adminRole = await AdminRole.findOne({
        user: userIdAsString,
        isActive: true,
      });
    }

    // Try 3: New ObjectId from string
    if (!adminRole) {
      try {
        adminRole = await AdminRole.findOne({
          user: new mongoose.Types.ObjectId(userIdAsString),
          isActive: true,
        });
      } catch (err) {
        // Ignore ObjectId conversion errors
      }
    }

    if (!adminRole) {
      console.error(`Admin role not found for user: ${userIdAsString}`);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user, adminRole);
    const refreshToken = await generateRefreshToken();

    // Update user record
    user.isOnline = true;
    user.lastSeen = new Date();
    user.refreshToken = refreshToken.hashedToken;
    await user.save();

    // Update admin last active
    adminRole.lastActive = new Date();
    await adminRole.save();

    // Log successful login
    const ModerationLog = getAdminModel("ModerationLog");
    if (ModerationLog) {
      try {
        await ModerationLog.logAction({
          admin: user._id,
          action: "admin_login",
          targetType: "System",
          targetId: user._id,
          details: {
            event: "admin_login_success",
            role: adminRole.role,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      } catch (logError) {
        console.error("Failed to log login:", logError.message);
      }
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken: refreshToken.plainToken,
        expiresIn: getExpiresInSeconds(
          process.env.ADMIN_JWT_EXPIRES_IN || "12h",
        ),
        admin: {
          id: user._id,
          name: user.name,
          role: adminRole.role,
          permissions: adminRole.permissions,
        },
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error.message);
    res.status(500).json({
      success: false,
      message: "An error occurred. Please try again.",
    });
  }
};

// ============================================
// ADMIN LOGOUT
// ============================================
const adminLogout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
      refreshToken: null,
      $inc: { tokenVersion: 1 },
    });

    const AdminRole = getAdminModel("AdminRole");
    await AdminRole.findOneAndUpdate(
      { user: req.user._id.toString() },
      { lastActive: new Date() },
    );

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Admin Logout Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

// ============================================
// GET CURRENT ADMIN PROFILE
// ============================================
const getAdminProfile = async (req, res) => {
  try {
    const AdminRole = getAdminModel("AdminRole");
    const adminRole = await AdminRole.findOne({
      user: req.user._id.toString(),
      isActive: true,
    }).lean();

    if (!adminRole) {
      return res.status(403).json({
        success: false,
        message: "Admin access revoked",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: req.user._id,
        name: req.user.name,
        role: adminRole.role,
        permissions: adminRole.permissions,
        lastActive: adminRole.lastActive,
      },
    });
  } catch (error) {
    console.error("Get Admin Profile Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
};

// ============================================
// REFRESH TOKEN
// ============================================
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: providedToken } = req.body;

    if (!providedToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const user = await User.findById(req.user._id).select(
      "+refreshToken +tokenVersion",
    );

    if (!user || !user.refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const isValid = await verifyRefreshToken(providedToken, user.refreshToken);
    if (!isValid) {
      user.refreshToken = null;
      user.tokenVersion += 1;
      await user.save();
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    if (user.isBanned || user.isSuspended) {
      return res.status(401).json({
        success: false,
        message: "Account is no longer active",
      });
    }

    const AdminRole = getAdminModel("AdminRole");
    const adminRole = await AdminRole.findOne({
      user: req.user._id.toString(),
      isActive: true,
    }).lean();

    if (!adminRole) {
      return res.status(403).json({
        success: false,
        message: "Admin access revoked",
      });
    }

    const newAccessToken = generateAccessToken(user, adminRole);
    const newRefreshToken = await generateRefreshToken();

    user.refreshToken = newRefreshToken.hashedToken;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken.plainToken,
        expiresIn: getExpiresInSeconds(
          process.env.ADMIN_JWT_EXPIRES_IN || "12h",
        ),
      },
    });
  } catch (error) {
    console.error("Token Refresh Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to refresh token",
    });
  }
};

// ============================================
// VERIFY TOKEN
// ============================================
const verifyToken = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Token is valid",
      data: {
        id: req.user._id,
        role: req.user.role,
        permissions: req.user.permissions,
      },
    });
  } catch (error) {
    console.error("Token Verification Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Token verification failed",
    });
  }
};

// ============================================
// CHANGE PASSWORD
// ============================================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user._id).select(
      "+password +refreshToken",
    );

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshToken = null;
    await user.save();

    const AdminRole = getAdminModel("AdminRole");
    const adminRole = await AdminRole.findOne({
      user: req.user._id.toString(),
      isActive: true,
    });

    const accessToken = generateAccessToken(user, adminRole);
    const refreshToken = await generateRefreshToken();

    user.refreshToken = refreshToken.hashedToken;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: {
        accessToken,
        refreshToken: refreshToken.plainToken,
        expiresIn: getExpiresInSeconds(
          process.env.ADMIN_JWT_EXPIRES_IN || "12h",
        ),
      },
    });
  } catch (error) {
    console.error("Change Password Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

// ============================================
// LOGOUT ALL SESSIONS
// ============================================
const logoutAllSessions = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      refreshToken: null,
      $inc: { tokenVersion: 1 },
      isOnline: false,
      lastSeen: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Logged out from all devices",
    });
  } catch (error) {
    console.error("Logout All Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to logout from all sessions",
    });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateAccessToken = (user, adminRole) => {
  const payload = {
    sub: user._id.toString(),
    role: adminRole.role,
    permissions: adminRole.permissions,
    tv: user.tokenVersion || 0,
    type: "access",
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "12h",
    issuer: "univibe-admin",
    audience: "univibe-admin-panel",
    jwtid: crypto.randomBytes(16).toString("hex"),
  });
};

const generateRefreshToken = async () => {
  const plainToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(plainToken)
    .digest("hex");
  return { plainToken, hashedToken };
};

const verifyRefreshToken = async (providedToken, storedHashedToken) => {
  if (!providedToken || !storedHashedToken) return false;
  const hashedProvided = crypto
    .createHash("sha256")
    .update(providedToken)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hashedProvided),
    Buffer.from(storedHashedToken),
  );
};

const getExpiresInSeconds = (expiresIn) => {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 43200;
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 3600;
    case "d":
      return value * 86400;
    default:
      return 43200;
  }
};

module.exports = {
  adminLogin,
  adminLogout,
  getAdminProfile,
  refreshToken,
  verifyToken,
  changePassword,
  logoutAllSessions,
};
