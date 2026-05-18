// backend/middleware/adminAuth.js

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { getAdminModel } = require("../config/database");

/**
 * Enhanced Admin Authentication Middleware
 * 
 * Validates:
 * - JWT token existence and validity
 * - Token type (must be 'access')
 * - Token version (invalidation support)
 * - User account status (not banned/suspended)
 * - Admin role existence and active status
 * 
 * Attaches to request:
 * - req.user: Minimal user info (id, name)
 * - req.adminRole: Full admin role with permissions
 * - req.sessionId: Unique session identifier
 */
const adminProtect = async (req, res, next) => {
  try {
    // ============================================
    // 1. EXTRACT TOKEN
    // ============================================
    let token;

    // Primary: Authorization header (Bearer token)
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // REMOVED: Cookie-based token extraction
    // This was a security risk (CSRF vulnerable)
    // Always use Authorization header for admin operations

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid access token.",
        code: "TOKEN_MISSING",
      });
    }

    // ============================================
    // 2. VERIFY JWT
    // ============================================
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "univibe-admin",
        audience: "univibe-admin-panel",
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please refresh your token or login again.",
          code: "TOKEN_EXPIRED",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid authentication token.",
          code: "INVALID_TOKEN",
        });
      }

      if (error.name === "NotBeforeError") {
        return res.status(401).json({
          success: false,
          message: "Token is not yet active.",
          code: "TOKEN_NOT_ACTIVE",
        });
      }

      throw error;
    }

    // ============================================
    // 3. VALIDATE TOKEN TYPE
    // ============================================
    if (decoded.type !== "access") {
      return res.status(401).json({
        success: false,
        message: "Invalid token type. Access token required.",
        code: "INVALID_TOKEN_TYPE",
      });
    }

    // ============================================
    // 4. GET USER (MINIMAL FIELDS)
    // ============================================
    const user = await User.findById(decoded.sub)
      .select("+tokenVersion +isBanned +isSuspended +suspendedUntil")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
        code: "USER_NOT_FOUND",
      });
    }

    // ============================================
    // 5. CHECK ACCOUNT STATUS
    // ============================================
    
    // Check if banned
    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been banned. Please contact support.",
        code: "ACCOUNT_BANNED",
      });
    }

    // Check if suspended and suspension hasn't expired
    if (user.isSuspended) {
      // Check if suspension has expired
      if (user.suspendedUntil && new Date() > new Date(user.suspendedUntil)) {
        // Auto-lift expired suspension
        await User.findByIdAndUpdate(user._id, {
          isSuspended: false,
          suspendReason: null,
          suspendedAt: null,
          suspendedUntil: null,
        });
      } else {
        return res.status(403).json({
          success: false,
          message: "Your account is currently suspended.",
          code: "ACCOUNT_SUSPENDED",
          suspendedUntil: user.suspendedUntil,
        });
      }
    }

    // ============================================
    // 6. VERIFY TOKEN VERSION
    // ============================================
    if (decoded.tv < (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        message: "Session invalidated. Please login again.",
        code: "TOKEN_VERSION_MISMATCH",
      });
    }

    // ============================================
    // 7. VERIFY ADMIN ROLE
    // ============================================
    const AdminRole = getAdminModel("AdminRole");
    const adminRole = await AdminRole.findOne({
      user: user._id,
      isActive: true,
    }).lean();

    if (!adminRole) {
      return res.status(403).json({
        success: false,
        message: "Admin access required. You do not have admin privileges.",
        code: "ADMIN_ACCESS_REQUIRED",
      });
    }

    // ============================================
    // 8. VERIFY ROLE MATCHES TOKEN
    // ============================================
    if (decoded.role !== adminRole.role) {
      return res.status(403).json({
        success: false,
        message: "Admin role has changed. Please login again.",
        code: "ROLE_CHANGED",
      });
    }

    // ============================================
    // 9. ATTACH TO REQUEST (MINIMAL DATA)
    // ============================================
    req.user = {
      _id: user._id,
      name: user.name,
      tokenVersion: user.tokenVersion,
    };

    req.adminRole = adminRole;
    req.sessionId = decoded.jti; // JWT ID for tracking

    // ============================================
    // 10. UPDATE LAST ACTIVE (ONLY ONCE PER 5 MINUTES)
    // ============================================
    const FIVE_MINUTES = 5 * 60 * 1000;
    const lastActive = adminRole.lastActive ? new Date(adminRole.lastActive).getTime() : 0;
    const now = Date.now();

    if (now - lastActive > FIVE_MINUTES) {
      // Update without waiting
      AdminRole.findOneAndUpdate(
        { user: user._id },
        { lastActive: new Date() }
      ).catch(err => console.error("Failed to update lastActive:", err.message));
    }

    next();
  } catch (error) {
    console.error("Admin Auth Middleware Error:", error.message);
    
    // Don't expose internal errors
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable. Please try again.",
        code: "SERVICE_UNAVAILABLE",
      });
    }

    res.status(500).json({
      success: false,
      message: "Authentication check failed. Please try again.",
      code: "AUTH_CHECK_FAILED",
    });
  }
};

/**
 * Optional: Check specific permission
 * Use after adminProtect middleware
 * 
 * @param {string} permission - Permission to check
 * @returns {Function} Middleware function
 * 
 * Example:
 * router.delete('/posts/:id', adminProtect, requirePermission('deletePosts'), deletePost);
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.adminRole) {
      return res.status(500).json({
        success: false,
        message: "Admin role not loaded",
        code: "ROLE_NOT_LOADED",
      });
    }

    // Super admin has all permissions
    if (req.adminRole.role === "super_admin") {
      return next();
    }

    // Check specific permission
    if (!req.adminRole.permissions || !req.adminRole.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to ${permission}.`,
        code: "PERMISSION_DENIED",
      });
    }

    next();
  };
};

module.exports = { 
  adminProtect,
  requirePermission 
};