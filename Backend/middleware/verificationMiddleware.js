// middleware/verificationMiddleware.js
const User = require('../models/User');

/**
 * Middleware to check if user's email is verified
 * Blocks access to protected routes if email is not verified
 */
const checkEmailVerified = async (req, res, next) => {
  try {
    // Only log problematic cases
    const shouldLog = process.env.NODE_ENV === 'development' && !req.user?.isEmailVerified;
    
    if (shouldLog) {
      console.log('🔍 Verification check for:', req.originalUrl);
    }

    // ✅ SKIP VERIFICATION FOR PROFILE SETUP
    if (req.originalUrl.includes('/api/profile/setup')) {
      return next();
    }

    // Check from database
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!req.user.isEmailVerified) {
      console.warn('❌ Email not verified for:', req.user.email);
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before accessing this feature',
        code: 'EMAIL_NOT_VERIFIED',
        needsVerification: true,
        userEmail: req.user.email,
        canResend: true
      });
    }

    next();
  } catch (error) {
    console.error('Verification middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking verification status'
    });
  }
};

module.exports = { checkEmailVerified };