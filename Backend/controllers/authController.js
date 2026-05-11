// Backend/controllers/authController.js
const User = require("../models/User");
const Profile = require("../models/Profile");
const { generateToken } = require("../middleware/authmiddleware");
const { sendVerificationEmail } = require("../services/verificationService");
const { createInitialProfile } = require("../services/profileService");
const { renderTemplate } = require("../utils/templateLoader");
const OTP = require("../models/OTP");
const jwt = require("jsonwebtoken");
const emailService = require("../services/emailService");

/**
 * Register a new user
 * Creates user account and sends verification email
 * NO profile created, NO token returned until email is verified
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        const hoursSinceCreation =
          (Date.now() - existingUser.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreation > 24) {
          await User.findByIdAndDelete(existingUser._id);
        } else {
          return res.status(400).json({
            success: false,
            message:
              "An account with this email already exists. Please check your email for verification link or try again later.",
            code: "PENDING_VERIFICATION",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      isEmailVerified: false,
    });

    const emailSent = await sendVerificationEmail(user);

    res.status(201).json({
      success: true,
      message: emailSent
        ? "Registration successful! Check your email to verify your account."
        : "Registration successful! Email verification may be delayed.",
      requiresVerification: true,
      email: user.email,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
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
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email }).select(
      "+password +emailVerificationToken +emailVerificationTokenExpires +emailVerificationSentAt",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    if (!user.isEmailVerified) {
      if (user.emailVerificationToken && user.isVerificationTokenExpired()) {
        const emailSent = await sendVerificationEmail(user);

        if (emailSent) {
          return res.status(403).json({
            success: false,
            message:
              "Verification link expired. A new verification email has been sent.",
            code: "VERIFICATION_EXPIRED_RESENT",
            needsVerification: true,
            canResend: user.canResendVerification(),
          });
        }
      }

      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
        code: "EMAIL_NOT_VERIFIED",
        needsVerification: true,
        canResend: user.canResendVerification(),
        userEmail: user.email,
      });
    }

    // ✅ Check if profile is TRULY complete (not default with "Undecided" major)
    const profile = await Profile.findOne({ user: user._id });
    const isProfileTrulyComplete =
      profile &&
      profile.major &&
      profile.major !== "Undecided" &&
      user.profileComplete === true;

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: isProfileTrulyComplete,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

/**
 * Serve HTML page for email verification
 */
const verifyEmailPage = (req, res) => {
  try {
    const html = renderTemplate("emailVerification");
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
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
 * Creates default profile but does NOT mark as complete
 */
const verifyEmailAPI = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token required",
      });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
    }).select("+emailVerificationToken +emailVerificationTokenExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token",
      });
    }

    if (!user.isVerificationTokenValid(token)) {
      return res.status(400).json({
        success: false,
        message: "Verification link has expired",
        code: "TOKEN_EXPIRED",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    // ✅ Don't set profileComplete here - it stays false
    await user.save();

    const updatedUser = await User.findById(user._id);
    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: "Error loading verified user",
      });
    }

    // Create default profile placeholder (NOT marked as complete)
    try {
      await createInitialProfile(updatedUser);
      // ❌ REMOVED: updatedUser.profileComplete = true;
      // ❌ REMOVED: await updatedUser.save();
    } catch (profileError) {
      console.error(
        "Profile creation error during verification:",
        profileError,
      );
    }

    const newToken = generateToken(updatedUser);

    res.json({
      success: true,
      message: "Email verified successfully!",
      token: newToken,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profileComplete: false, // ✅ Not complete until setup form is submitted
        isEmailVerified: updatedUser.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
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
        message: "Email required",
      });
    }

    const user = await User.findOne({ email }).select(
      "+emailVerificationToken +emailVerificationTokenExpires +emailVerificationSentAt",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    if (!user.canResendVerification()) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another verification email",
        code: "RESEND_COOLDOWN",
        retryAfter: 300,
      });
    }

    const emailSent = await sendVerificationEmail(user);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email",
      });
    }

    res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Get current authenticated user info
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * Check user's email verification status (requires auth)
 */
const checkVerificationStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "email isEmailVerified emailVerificationToken emailVerificationTokenExpires emailVerificationSentAt",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const tokenExpired =
      user.emailVerificationToken && user.isVerificationTokenExpired();

    res.json({
      success: true,
      isEmailVerified: user.isEmailVerified,
      canResend: user.canResendVerification(),
      tokenExpired,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Check verification status error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking verification status",
    });
  }
};

/**
 * Check verification status by email (no auth required)
 */
const checkVerificationByEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email required",
      });
    }

    const user = await User.findOne({ email }).select("isEmailVerified email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      isEmailVerified: user.isEmailVerified,
      email: user.email,
    });
  } catch (error) {
    console.error("Check verification by email error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking verification status",
    });
  }
};

/**
 * Refresh authentication token
 */
const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const newToken = generateToken(user);

    res.json({
      success: true,
      message: "Token refreshed",
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
    });
  }
};

/**
 * Verify email and refresh token in one call
 */
const verifyAndRefreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
        needsVerification: true,
        userEmail: user.email,
      });
    }

    const newToken = generateToken(user);

    res.json({
      success: true,
      message: "Token updated with verification status",
      token: newToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileComplete: user.profileComplete,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Verify and refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying and refreshing token",
    });
  }
};

/**
 * Change user password
 * Requires current password for verification
 * Increments tokenVersion to invalidate all existing tokens
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    // Prevent same password
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Get user with password field
    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password and invalidate all existing tokens
    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    console.log(
      `🔐 Password changed for user: ${user.email} (tokenVersion: ${user.tokenVersion})`,
    );

    res.json({
      success: true,
      message:
        "Password changed successfully. Please login again with your new password.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while changing password",
    });
  }
};

// ============================================
// PASSWORD RESET VIA OTP
// ============================================

/**
 * Step 1: Forgot Password - Send OTP to email
 * Public route - no authentication required
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // For security, don't reveal if email exists or not
      // Return success even if email not found to prevent email enumeration
      return res.json({
        success: true,
        message: "If an account with this email exists, an OTP has been sent.",
      });
    }

    // Check rate limit (1 OTP per 60 seconds)
    const canRequest = await OTP.canRequestNewOTP(email);
    if (!canRequest) {
      return res.status(429).json({
        success: false,
        message: "Please wait 60 seconds before requesting another OTP",
        code: "OTP_RATE_LIMIT",
        retryAfter: 60,
      });
    }

    // Invalidate any existing unused OTPs for this email
    await OTP.invalidateAllOTPs(email, "password_reset");

    // Generate new OTP
    const ipAddress = req.ip || req.connection?.remoteAddress || "";
    const { otp, otpDoc } = await OTP.generateOTP(
      email,
      "password_reset",
      ipAddress,
    );

    // Send OTP via email
    const emailSent = await emailService.sendPasswordResetOTP(
      email,
      otp,
      user.name,
    );

    if (!emailSent) {
      // If email fails, delete the OTP record
      await OTP.findByIdAndDelete(otpDoc._id);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }

    console.log(`📧 Password reset OTP sent to: ${email}`);

    res.json({
      success: true,
      message: "OTP has been sent to your email. Valid for 10 minutes.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing request",
    });
  }
};

/**
 * Step 2: Verify OTP
 * Public route - no authentication required
 * Returns a temporary reset token to use in step 3
 */
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP format. Must be 6 digits.",
      });
    }

    // Find the latest valid OTP for this email
    const otpDoc = await OTP.findLatestOTP(email, "password_reset");

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "No OTP found or OTP has expired. Please request a new one.",
        code: "OTP_NOT_FOUND",
      });
    }

    // Check if max attempts reached
    if (otpDoc.isMaxAttemptsReached()) {
      // Invalidate this OTP
      await otpDoc.markAsUsed();
      return res.status(429).json({
        success: false,
        message: "Maximum attempts reached. Please request a new OTP.",
        code: "OTP_MAX_ATTEMPTS",
      });
    }

    // Check if OTP is expired
    if (otpDoc.isExpired()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
        code: "OTP_EXPIRED",
      });
    }

    // Verify OTP
    const isValid = await otpDoc.compareOTP(otp);

    if (!isValid) {
      // Increment failed attempts
      const attempts = await otpDoc.incrementAttempts();
      const remainingAttempts = 5 - attempts;

      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : "No attempts remaining."}`,
        code: "OTP_INVALID",
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
      });
    }

    // OTP is valid - mark as verified
    await otpDoc.markAsVerified();

    // Find the user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate a temporary reset token (valid for 5 minutes)
    const resetToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        purpose: "password_reset",
        otpId: otpDoc._id.toString(),
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" },
    );

    console.log(`✅ OTP verified for: ${email}`);

    res.json({
      success: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while verifying OTP",
    });
  }
};

/**
 * Step 3: Reset Password
 * Uses the temporary reset token from OTP verification
 * Public route - no authentication required
 */
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    // Verify the reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(400).json({
          success: false,
          message: "Reset token has expired. Please request a new OTP.",
          code: "RESET_TOKEN_EXPIRED",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Invalid reset token",
        code: "INVALID_RESET_TOKEN",
      });
    }

    // Verify token purpose
    if (decoded.purpose !== "password_reset") {
      return res.status(400).json({
        success: false,
        message: "Invalid reset token purpose",
      });
    }

    // Find the user
    const user = await User.findById(decoded.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify email matches
    if (user.email !== decoded.email) {
      return res.status(400).json({
        success: false,
        message: "Token email mismatch",
      });
    }

    // Check if new password is same as old
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your old password",
      });
    }

    // Mark OTP as used
    if (decoded.otpId) {
      await OTP.findByIdAndUpdate(decoded.otpId, { isUsed: true });
    }

    // Reset the password (this also increments tokenVersion)
    await user.resetPassword(newPassword);

    console.log(`🔐 Password reset successful for: ${user.email}`);

    res.json({
      success: true,
      message:
        "Password reset successfully. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resetting password",
    });
  }
};

/**
 * Cleanup unverified accounts older than 24 hours
 */
const cleanupUnverifiedAccounts = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await User.deleteMany({
      isEmailVerified: false,
      createdAt: { $lt: twentyFourHoursAgo },
    });

    if (result.deletedCount > 0) {
      console.log(`Cleaned up ${result.deletedCount} unverified accounts`);
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
};

// Run cleanup every hour and on startup
setInterval(cleanupUnverifiedAccounts, 60 * 60 * 1000);
cleanupUnverifiedAccounts();

module.exports = {
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
  cleanupUnverifiedAccounts,
};
