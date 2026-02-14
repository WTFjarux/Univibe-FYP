const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Basic user information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Never return password in queries
  },
  
  // Role and permissions
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  // Profile completion status
  profileComplete: {
    type: Boolean,
    default: false
  },
  
  // Username (optional, can be set later)
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true,
    lowercase: true
  },
  

  // EMAIL VERIFICATION SYSTEM (SIGNUP/ACCOUNT)
  
  // Has the user verified their signup email?
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  
  // Token sent in verification email (clickable link)
  emailVerificationToken: {
    type: String,
    select: false // Security: don't expose in API responses
  },
  
  // When does the verification token expire? (24 hours)
  emailVerificationTokenExpires: {
    type: Date,
    select: false
  },
  
  // When was the last verification email sent?
  emailVerificationSentAt: {
    type: Date,
    select: false
  }
  
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// MIDDLEWARE: Password Hashing

// Hash password before saving to database
userSchema.pre('save', async function(next) {
  // Only hash password if it was modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// INSTANCE METHODS

// Compare password for login
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate verification token for email verification
userSchema.methods.generateEmailVerificationToken = function() {
  // Create cryptographically secure random token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  // Set token and expiry (24 hours from now)
  this.emailVerificationToken = verificationToken;
  this.emailVerificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  this.emailVerificationSentAt = Date.now();
  
  return verificationToken;
};

// Check if verification token is valid and not expired
userSchema.methods.isVerificationTokenValid = function(token) {
  return (
    this.emailVerificationToken === token &&
    this.emailVerificationTokenExpires > Date.now()
  );
};

// Check if token has expired (for auto-resend)
userSchema.methods.isVerificationTokenExpired = function() {
  return this.emailVerificationTokenExpires < Date.now();
};

// Check if we can resend verification email (prevent spam)
userSchema.methods.canResendVerification = function() {
  // If never sent, allow resend
  if (!this.emailVerificationSentAt) return true;
  
  // Don't allow resend if sent less than 5 minutes ago
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return this.emailVerificationSentAt < fiveMinutesAgo;
};

// SERIALIZATION: Remove sensitive data from JSON

userSchema.methods.toJSON = function() {
  const user = this.toObject();
  
  // Remove sensitive information
  delete user.password;
  delete user.emailVerificationToken;
  delete user.emailVerificationTokenExpires;
  delete user.emailVerificationSentAt;
  
  return user;
};

module.exports = mongoose.model('User', userSchema);