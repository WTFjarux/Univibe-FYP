const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ✅ Get user WITH verification status
      req.user = await User.findById(decoded.id)
        .select('-password')
        .select('+isEmailVerified +email +name +role');
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found or account deleted'
        });
      }

      // 🔥 CRITICAL: Log only if there's a verification mismatch
      if (decoded.isEmailVerified !== req.user.isEmailVerified) {
        console.warn('⚠️ Token/DB verification mismatch:', {
          userId: decoded.id,
          tokenVerified: decoded.isEmailVerified,
          dbVerified: req.user.isEmailVerified
        });
      }

      // Attach decoded token data to request
      req.tokenData = decoded;

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired, please login again'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Optional: Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this resource`
      });
    }
    
    next();
  };
};

// Main token generation function
const generateToken = (user) => {
  const payload = { 
    id: user._id,
    email: user.email,
    role: user.role,
    isEmailVerified: Boolean(user.isEmailVerified)
  };
  
  // Only log during verification or important events
  if (process.env.NODE_ENV === 'development' && payload.isEmailVerified) {
    console.log('🔐 Generated token for verified user:', user.email);
  }
  
  return jwt.sign(
    payload, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    }
  );
};

// Backward compatibility
const generateTokenById = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

// Optional: Generate token with custom data
const generateTokenWithData = (payload) => {
  return jwt.sign(
    payload, 
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    }
  );
};

// Quick verification check from token
const isEmailVerifiedFromToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.isEmailVerified || false;
  } catch (error) {
    return false;
  }
};

// Function to decode token without verification
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
  authorize
};