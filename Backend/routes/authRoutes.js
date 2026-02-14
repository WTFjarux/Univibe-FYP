const express = require('express');
const { 
  register, 
  login, 
  verifyEmailPage,    // HTML page for verification
  verifyEmailAPI,     // API endpoint for verification
  resendVerification, 
  getMe,
  checkVerificationStatus,
  refreshToken,
  verifyAndRefreshToken 
} = require('../controllers/authController');
const { protect } = require('../middleware/authmiddleware');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/resend-verification', resendVerification);

// Email verification routes
router.get('/verify-email/:token', verifyEmailPage);    // HTML page (user clicks from email)
router.get('/verify-email-api/:token', verifyEmailAPI); // API endpoint (called by HTML page)

// Protected routes
router.get('/me', protect, getMe);
router.get('/check-verification', protect, checkVerificationStatus);
router.get('/refresh-token', protect, refreshToken); // ✅ Add this route
router.get('/verify-and-refresh', protect, verifyAndRefreshToken); // ✅ Add this route

module.exports = router;