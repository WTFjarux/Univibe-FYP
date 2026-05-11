// Backend/middleware/authmiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and attaches user to request
 * Now also checks tokenVersion for password change invalidation
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from Authorization header
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token",
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Fetch user with required fields
      req.user = await User.findById(decoded.id)
        .select("-password")
        .select("+isEmailVerified +email +name +role +tokenVersion");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found or account deleted",
        });
      }

      // ✅ CHECK TOKEN VERSION
      // If tokenVersion in JWT doesn't match user's current tokenVersion,
      // it means the password was changed and this token is invalid
      if (
        decoded.tokenVersion !== undefined &&
        req.user.tokenVersion !== undefined
      ) {
        if (decoded.tokenVersion !== req.user.tokenVersion) {
          return res.status(401).json({
            success: false,
            message:
              "Password has been changed. Please login again with your new password.",
            code: "TOKEN_VERSION_MISMATCH",
          });
        }
      }

      // Attach decoded token data for reference
      req.tokenData = decoded;

      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired, please login again",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Not authorized, token failed",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error in authentication",
    });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this resource`,
      });
    }

    next();
  };
};

/**
 * Generate JWT token for authenticated user
 * Includes user ID, email, role, verification status, and tokenVersion
 */
const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    isEmailVerified: Boolean(user.isEmailVerified),
    tokenVersion: user.tokenVersion || 0, // ✅ Include tokenVersion
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

/**
 * Legacy token generation by user ID only
 * @deprecated Use generateToken for new implementations
 */
const generateTokenById = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

/**
 * Generate token with custom payload
 */
const generateTokenWithData = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

/**
 * Check email verification status from token without database query
 */
const isEmailVerifiedFromToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.isEmailVerified || false;
  } catch (error) {
    return false;
  }
};

/**
 * Decode token without verification
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

module.exports = {
  protect,
  generateToken,
  generateTokenById,
  generateTokenWithData,
  isEmailVerifiedFromToken,
  decodeToken,
  authorize,
};
