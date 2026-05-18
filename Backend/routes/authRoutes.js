// backend/routes/authRoutes.js

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
  changePassword,
  forgotPassword,
  verifyOTP,
  resetPassword,
} = require("../controllers/authController");
const {
  protect,
  protectWithStatusCheck,x
} = require("../middleware/authmiddleware");

const router = express.Router();

// ============================================
// Public Routes (No Authentication Required)
// ============================================
router.post("/register", register);
router.post("/login", login);
router.post("/resend-verification", resendVerification);
router.post("/check-verification-by-email", checkVerificationByEmail);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

// ============================================
// Email Verification Routes (Public)
// ============================================
router.get("/verify-email/:token", verifyEmailPage);
router.get("/verify-email-api/:token", verifyEmailAPI);

// ============================================
// Protected Routes (Auth only - read operations)
// ============================================
router.get("/me", protect, getMe);
router.get("/check-verification", protect, checkVerificationStatus);
router.get("/refresh-token", protect, refreshToken);
router.get("/verify-and-refresh", protect, verifyAndRefreshToken);

// ============================================
// Protected Routes (Auth + Status Check - write operations)
// ============================================
router.post("/change-password", protectWithStatusCheck, changePassword);

module.exports = router;
