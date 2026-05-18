// backend/middleware/rateLimiter.js

const rateLimit = require("express-rate-limit");

/**
 * Admin login rate limiter
 * Prevents brute force attacks on admin login
 */
const adminLoginLimiter = rateLimit({
  windowMs:
    parseInt(process.env.ADMIN_LOGIN_RATE_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
  max: parseInt(process.env.ADMIN_LOGIN_RATE_LIMIT) || 5,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase() || "unknown";
    return `login:${req.ip}:${email}`;
  },
  skipSuccessfulRequests: true,
});

/**
 * General admin API rate limiter
 * Applied to all protected admin routes
 */
const adminApiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `api:${req.user?._id?.toString() || req.ip}`;
  },
});

/**
 * Content modification rate limiter
 * More restrictive for sensitive operations
 */
const contentModificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many modifications. Please slow down.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `modify:${req.user?._id?.toString() || req.ip}`;
  },
});

/**
 * Bulk operation rate limiter
 * Very restrictive for bulk delete/update operations
 */
const bulkOperationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: "Bulk operations are rate limited. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `bulk:${req.user?._id?.toString() || req.ip}`;
  },
});

module.exports = {
  adminLoginLimiter,
  adminApiLimiter,
  contentModificationLimiter,
  bulkOperationLimiter,
};
