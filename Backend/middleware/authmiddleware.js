// Backend/middleware/authmiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and attaches user to request
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

      // Fetch user with verification status
      req.user = await User.findById(decoded.id)
        .select("-password")
        .select("+isEmailVerified +email +name +role");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found or account deleted",
        });
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
 * Restricts access to specific user roles
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
 * Includes user ID, email, role, and verification status
 */
const generateToken = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    isEmailVerified: Boolean(user.isEmailVerified),
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
 * Useful for specialized tokens or testing
 */
const generateTokenWithData = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

/**
 * Check email verification status from token without database query
 * Useful for quick verification checks
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
 * Useful for inspecting token payload without validation
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
