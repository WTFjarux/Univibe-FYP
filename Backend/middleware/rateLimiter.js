// backend/middleware/rateLimiter.js

const rateLimit = require("express-rate-limit");

/**
 * Helper to safely get client IP
 * Properly handles both IPv4 and IPv6
 */
const getSafeIP = (req) => {
  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "127.0.0.1"
  );
};

/**
 * Admin login rate limiter
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
  keyGenerator: (req, res) => {
    const ip = getSafeIP(req);
    const email = req.body?.email?.toLowerCase() || "unknown";
    return `${ip}:login:${email}`;
  },
  skipSuccessfulRequests: true,
});

/**
 * General admin API rate limiter
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
  keyGenerator: (req, res) => {
    const ip = getSafeIP(req);
    return req.user?._id ? `${ip}:api:user:${req.user._id}` : `${ip}:api`;
  },
});

/**
 * Content modification rate limiter
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
  keyGenerator: (req, res) => {
    const ip = getSafeIP(req);
    return req.user?._id ? `${ip}:modify:user:${req.user._id}` : `${ip}:modify`;
  },
});

/**
 * Bulk operation rate limiter
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
  keyGenerator: (req, res) => {
    const ip = getSafeIP(req);
    return req.user?._id ? `${ip}:bulk:user:${req.user._id}` : `${ip}:bulk`;
  },
});

module.exports = {
  adminLoginLimiter,
  adminApiLimiter,
  contentModificationLimiter,
  bulkOperationLimiter,
};
