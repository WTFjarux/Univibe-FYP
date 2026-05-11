// models/OTP.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const otpSchema = new mongoose.Schema(
  {
    // User's email (not linked to User model - works for unregistered users too)
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },

    // Hashed OTP (never store plain text OTP)
    otp: {
      type: String,
      required: [true, "OTP is required"],
    },

    // Purpose of this OTP (for future extensibility)
    purpose: {
      type: String,
      enum: ["password_reset", "email_verification", "login"],
      default: "password_reset",
    },

    // Track failed verification attempts (max 5)
    attempts: {
      type: Number,
      default: 0,
    },

    // Whether this OTP has been used/verified
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Whether this OTP has been used to reset password
    isUsed: {
      type: Boolean,
      default: false,
    },

    // Expiry time (OTP valid for 10 minutes)
    expiresAt: {
      type: Date,
      required: true,
    },

    // IP address for rate limiting (optional but recommended)
    ipAddress: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// ============================================
// INDEXES
// ============================================

// TTL Index: MongoDB automatically deletes documents when expiresAt is reached
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Query index: Find OTP by email and purpose
otpSchema.index({ email: 1, purpose: 1 });

// Rate limiting index: Check recent OTPs for an email
otpSchema.index({ email: 1, createdAt: -1 });

// ============================================
// PRE-SAVE MIDDLEWARE - Hash OTP before saving
// ============================================
otpSchema.pre("save", async function (next) {
  // Only hash if OTP is modified and not already hashed
  if (!this.isModified("otp")) return next();

  try {
    // Check if OTP is already hashed (bcrypt hashes are 60 chars and start with $2)
    if (this.otp.length < 20) {
      const salt = await bcrypt.genSalt(10);
      this.otp = await bcrypt.hash(this.otp, salt);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// ============================================
// INSTANCE METHODS
// ============================================

/**
 * Compare a plain text OTP with the hashed OTP
 */
otpSchema.methods.compareOTP = async function (candidateOTP) {
  return await bcrypt.compare(candidateOTP, this.otp);
};

/**
 * Check if OTP is expired
 */
otpSchema.methods.isExpired = function () {
  return this.expiresAt < new Date();
};

/**
 * Check if max attempts reached
 */
otpSchema.methods.isMaxAttemptsReached = function () {
  return this.attempts >= 5;
};

/**
 * Check if OTP is still valid for verification
 */
otpSchema.methods.isValid = function () {
  return (
    !this.isExpired() &&
    !this.isMaxAttemptsReached() &&
    !this.isVerified &&
    !this.isUsed
  );
};

/**
 * Increment failed attempts
 */
otpSchema.methods.incrementAttempts = async function () {
  this.attempts += 1;
  await this.save();
  return this.attempts;
};

/**
 * Mark OTP as verified
 */
otpSchema.methods.markAsVerified = async function () {
  this.isVerified = true;
  await this.save();
};

/**
 * Mark OTP as used (after password reset)
 */
otpSchema.methods.markAsUsed = async function () {
  this.isUsed = true;
  await this.save();
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Generate a 6-digit OTP and save it
 */
otpSchema.statics.generateOTP = async function (
  email,
  purpose = "password_reset",
  ipAddress = "",
) {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Set expiry to 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Create and save OTP document
  const otpDoc = await this.create({
    email: email.toLowerCase().trim(),
    otp, // Will be hashed by pre-save middleware
    purpose,
    expiresAt,
    ipAddress,
  });

  // Return the original OTP (for sending in email) and the document
  return { otp, otpDoc };
};

/**
 * Find latest valid OTP for an email
 */
otpSchema.statics.findLatestOTP = async function (
  email,
  purpose = "password_reset",
) {
  return await this.findOne({
    email: email.toLowerCase().trim(),
    purpose,
    isVerified: false,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

/**
 * Check if user can request a new OTP (rate limit: 1 per 60 seconds)
 */
otpSchema.statics.canRequestNewOTP = async function (
  email,
  purpose = "password_reset",
) {
  const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);

  const recentOTP = await this.findOne({
    email: email.toLowerCase().trim(),
    purpose,
    createdAt: { $gt: sixtySecondsAgo },
  });

  return !recentOTP; // true if can request, false if rate limited
};

/**
 * Invalidate all existing OTPs for an email
 */
otpSchema.statics.invalidateAllOTPs = async function (
  email,
  purpose = "password_reset",
) {
  await this.updateMany(
    {
      email: email.toLowerCase().trim(),
      purpose,
      isVerified: false,
      isUsed: false,
    },
    {
      $set: { isUsed: true },
    },
  );
};

/**
 * Clean up expired OTPs (housekeeping - can be called by a cron job)
 */
otpSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

const OTP = mongoose.model("OTP", otpSchema);
module.exports = OTP;
