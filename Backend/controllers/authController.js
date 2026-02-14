const User = require('../models/User');
const { generateToken } = require('../middleware/authmiddleware');
const { sendVerificationEmail } = require('../services/verificationService');
const { createInitialProfile } = require('../services/profileService');
const { renderTemplate } = require('../utils/templateLoader');

/**
 * Register a new user
 * Creates user account, sends verification email, and creates initial profile
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create user with email verification disabled initially
    const user = await User.create({ 
      name, 
      email, 
      password,
      isEmailVerified: false
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(user);
    if (!emailSent) {
      console.warn(`Verification email failed for user: ${user._id}`);
    }

    // Create initial profile (non-blocking)
    try {
      await createInitialProfile(user);
    } catch (profileError) {
      console.error('Profile creation failed:', profileError.message);
      // Continue - user can complete profile later
    }

    // Generate authentication token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: emailSent 
        ? 'Registration successful! Check your email to verify your account.' 
        : 'Registration successful! Email verification may be delayed.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
        isEmailVerified: user.isEmailVerified,
        needsVerification: !user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Registration error:', error.message);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

/**
 * Authenticate user login
 * Checks credentials and email verification status
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }

    // Find user with password and verification fields
    const user = await User.findOne({ email })
      .select('+password +emailVerificationToken +emailVerificationTokenExpires +emailVerificationSentAt');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check email verification status
    if (!user.isEmailVerified) {
      // Handle expired verification tokens
      if (user.emailVerificationToken && user.isVerificationTokenExpired()) {
        const emailSent = await sendVerificationEmail(user);
        
        if (emailSent) {
          return res.status(403).json({
            success: false,
            message: 'Verification link expired. New email sent.',
            code: 'VERIFICATION_EXPIRED_RESENT',
            needsVerification: true,
            canResend: user.canResendVerification()
          });
        }
      }
      
      // User not verified - block login
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
        needsVerification: true,
        canResend: user.canResendVerification(),
        userEmail: user.email
      });
    }

    // Login successful - generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/**
 * Serve HTML page for email verification
 * This is the page users see when clicking verification links
 */
const verifyEmailPage = (req, res) => {
  try {
    const html = renderTemplate('emailVerification');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error loading verification page:', error.message);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1 style="color: #ff4444;">Error</h1>
          <p>Could not load verification page. Please try again.</p>
        </body>
      </html>
    `);
  }
};

/**
 * API endpoint to verify email from token
 * Called by the HTML verification page via AJAX
 */
const verifyEmailAPI = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token required'
      });
    }

    // Find user by verification token
    const user = await User.findOne({
      emailVerificationToken: token
    }).select('+emailVerificationToken +emailVerificationTokenExpires');

    if (!user) {
      console.warn('Invalid verification token attempt');
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Check token validity
    if (!user.isVerificationTokenValid(token)) {
      console.warn('Expired verification token for:', user.email);
      return res.status(400).json({
        success: false,
        message: 'Verification link has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Mark email as verified and clear token
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await user.save();

    // Reload user to ensure fresh data
    const updatedUser = await User.findById(user._id);
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Error loading verified user'
      });
    }

    // Generate new token with verified status
    const newToken = generateToken(updatedUser);
    console.log(`✅ Email verified: ${updatedUser.email}`);

    res.json({
      success: true,
      message: 'Email verified successfully!',
      token: newToken,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profileComplete: updatedUser.profileComplete,
        isEmailVerified: updatedUser.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Email verification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
};

/**
 * Resend verification email to user
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email required'
      });
    }

    const user = await User.findOne({ email })
      .select('+emailVerificationToken +emailVerificationTokenExpires +emailVerificationSentAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Check cooldown period
    if (!user.canResendVerification()) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another verification email',
        code: 'RESEND_COOLDOWN',
        retryAfter: 300
      });
    }

    const emailSent = await sendVerificationEmail(user);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }

    console.log(`📧 Verification email resent to: ${email}`);
    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get current authenticated user info
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Check user's email verification status
 * Used by frontend to poll verification status
 */
const checkVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('email isEmailVerified emailVerificationToken emailVerificationTokenExpires emailVerificationSentAt');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check token expiration
    let tokenExpired = false;
    if (user.emailVerificationToken && user.isVerificationTokenExpired()) {
      tokenExpired = true;
    }

    res.json({
      success: true,
      isEmailVerified: user.isEmailVerified,
      canResend: user.canResendVerification(),
      tokenExpired: tokenExpired,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    console.error('Check verification error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error checking verification status'
    });
  }
};

/**
 * Refresh authentication token
 * Useful when token data is stale (e.g., after email verification)
 */
const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate fresh token with current user data
    const newToken = generateToken(user);
    console.log(`🔄 Token refreshed for: ${user.email}`);

    res.json({
      success: true,
      message: 'Token refreshed',
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token'
    });
  }
};

/**
 * Verify email and refresh token in one call
 * Used by frontend after email verification completes
 */
const verifyAndRefreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify email is confirmed
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
        needsVerification: true,
        userEmail: user.email
      });
    }

    // Generate fresh token
    const newToken = generateToken(user);

    res.json({
      success: true,
      message: 'Token updated with verification status',
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Verify and refresh error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error verifying and refreshing token'
    });
  }
};

module.exports = { 
  register, 
  login, 
  verifyEmailPage,
  verifyEmailAPI,
  resendVerification, 
  getMe,
  checkVerificationStatus,
  refreshToken,
  verifyAndRefreshToken
};