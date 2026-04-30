// Backend/routes/authRoutes.js
const express = require("express");
const {
  register,
  login,
  verifyEmailPage,
  verifyEmailAPI,
  resendVerification,
  getMe,
  checkVerificationStatus,
  checkVerificationByEmail,
  refreshToken,
  verifyAndRefreshToken,
} = require("../controllers/authController");
const { protect } = require("../middleware/authmiddleware");

const router = express.Router();

// ============================================
// Public Routes (No Authentication Required)
// ============================================
router.post("/register", register);
router.post("/login", login);
router.post("/resend-verification", resendVerification);
router.post("/check-verification-by-email", checkVerificationByEmail);

// ============================================
// Email Verification Routes
// ============================================
router.get("/verify-email/:token", verifyEmailPage);
router.get("/verify-email-api/:token", verifyEmailAPI);

// ============================================
// Protected Routes (Require Authentication)
// ============================================
router.get("/me", protect, getMe);
router.get("/check-verification", protect, checkVerificationStatus);
router.get("/refresh-token", protect, refreshToken);
router.get("/verify-and-refresh", protect, verifyAndRefreshToken);

module.exports = router;
