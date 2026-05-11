// backend/routes/userRoutes.js

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const { protect } = require("../middleware/authmiddleware");
const {
  filterBlockedUsers,
  checkBlockStatus,
} = require("../middleware/blockMiddleware");
const BlockService = require("../services/blockService");
const { isUserOnline } = require("../socket/utils/roomManager");

// Apply block filtering to all routes
router.use(protect);
router.use(filterBlockedUsers);

// =============================================================================
// HELPER: Validate MongoDB ObjectId
// =============================================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && id.match(/^[0-9a-fA-F]{24}$/);
};

// =============================================================================
// USER ROUTES
// =============================================================================

/**
 * GET /api/users/search
 * Exclude blocked users from search results
 */
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    const blockedUserIds = req.blockedUserIds;

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const users = await User.find({
      _id: { $nin: [...blockedUserIds, req.user._id] },
      $or: [
        { name: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
      ],
    })
      .select("name username profilePicture")
      .limit(20)
      .lean();

    res.json({ success: true, data: users });
  } catch (error) {
    console.error("Search users error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /api/users/suggestions
 * Get connection suggestions excluding blocked users
 */
router.get("/suggestions", async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;

    const suggestions = await User.getConnectionSuggestions(userId, limit);

    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("Get suggestions error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /api/users/online-friends
 * Get online connected users excluding blocked users
 */
router.get("/online-friends", async (req, res) => {
  try {
    const userId = req.user._id;
    const onlineFriends = await User.getOnlineFriends(userId);

    res.json({ success: true, data: onlineFriends });
  } catch (error) {
    console.error("Get online friends error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /api/users/:userId/online-status
 * Check if a user is currently online
 * Blocked users can't see each other's online status
 */
router.get("/:userId/online-status", checkBlockStatus, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.json({
        success: true,
        isOnline: false,
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(userId).select("isOnline lastSeen").lean();

    if (!user) {
      return res.json({
        success: true,
        isOnline: false,
        message: "User not found",
      });
    }

    const socketOnline = isUserOnline ? isUserOnline(userId) : false;

    res.json({
      success: true,
      isOnline: socketOnline || user.isOnline || false,
      lastSeen: user.lastSeen || null,
    });
  } catch (error) {
    console.error("Get online status error:", error.message);
    res.json({
      success: true,
      isOnline: false,
      message: "Could not determine status",
    });
  }
});

/**
 * GET /api/users/:userId
 * Add block check
 */
router.get("/:userId", checkBlockStatus, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await User.findById(userId)
      .select("name username email isOnline lastSeen")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Get user error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =============================================================================
// ERROR HANDLER
// =============================================================================

router.use((err, req, res, next) => {
  console.error("User route error:", err.message);

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

module.exports = router;
