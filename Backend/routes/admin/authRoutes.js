// backend/routes/admin/auth.js

const express = require("express");
const router = express.Router();
const {
  adminLogin,
  adminLogout,
  logoutAllSessions,
  getAdminProfile,
  refreshToken,
  verifyToken,
  changePassword,
} = require("../../controllers/admin/adminAuthController");
const { adminProtect } = require("../../middleware/adminAuth");
const {
  adminLoginLimiter,
  adminApiLimiter,
} = require("../../middleware/rateLimiter");
const rateLimit = require("express-rate-limit");

// ============================================
// ADDITIONAL SECURITY MIDDLEWARE
// ============================================

// Rate limiting for password changes (more restrictive)
const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    message: "Too many password change attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID (more accurate than IP)
    return req.user?._id?.toString() || req.ip;
  },
});

// Rate limiting for token refresh (prevent abuse)
const refreshTokenLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 refresh attempts per 5 minutes
  message: {
    success: false,
    message: "Too many token refresh attempts. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?._id?.toString() || req.ip;
  },
});

// Rate limiting for token verification (prevent hammering)
const verifyTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 verifications per minute
  message: {
    success: false,
    message: "Too many verification requests.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// SECURITY HEADERS MIDDLEWARE
// ============================================
const securityHeaders = (req, res, next) => {
  // Prevent browsers from incorrectly detecting non-HTML as HTML
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Enable XSS filter in browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Prevent MIME type sniffing
  res.setHeader("X-Download-Options", "noopen");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Cache control for auth endpoints (never cache)
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  next();
};

// ============================================
// REQUEST VALIDATION MIDDLEWARE
// ============================================
const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;

  // Check for missing fields
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  // Validate email format
  const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  // Check password length (basic check before deeper validation)
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters",
    });
  }

  // Sanitize email (trim and lowercase)
  req.body.email = email.trim().toLowerCase();

  next();
};

const validatePasswordChange = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password are required",
    });
  }

  // Enforce strong password policy
  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 8 characters",
    });
  }

  // Check password complexity
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    return res.status(400).json({
      success: false,
      message:
        "Password must include uppercase, lowercase, number, and special character",
    });
  }

  // Prevent password reuse
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password must be different from current password",
    });
  }

  next();
};

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

// Admin login - with rate limiting, input validation, and security headers
router.post(
  "/login",
  securityHeaders,
  adminLoginLimiter,
  validateLoginInput,
  adminLogin,
);

// ============================================
// PROTECTED ROUTES (Authentication Required)
// ============================================

// Apply general rate limiting and security headers to all protected routes
router.use(adminProtect);
router.use(securityHeaders);
router.use(adminApiLimiter);

// Verify token (for frontend auth check on page load)
router.get("/verify", verifyTokenLimiter, verifyToken);

// Get current admin profile
router.get("/profile", getAdminProfile);

// Refresh token (with rotation)
router.post("/refresh", refreshTokenLimiter, refreshToken);

// Logout (single session)
router.post("/logout", adminLogout);

// Logout all sessions (enhanced security)
router.post("/logout-all", logoutAllSessions);

// Change password
router.put(
  "/change-password",
  passwordChangeLimiter,
  validatePasswordChange,
  changePassword,
);

module.exports = router;
