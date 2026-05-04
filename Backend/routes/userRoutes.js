// backend/routes/userRoutes.js

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
const { protect } = require("../middleware/authmiddleware");
const { isUserOnline } = require("../socket/utils/roomManager");

// All routes require authentication
router.use(protect);

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
 * GET /api/users/:userId/online-status
 * Check if a user is currently online
 * Returns false gracefully for invalid IDs instead of crashing
 */
router.get("/:userId/online-status", async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ Validate ObjectId BEFORE querying database
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

    // Check socket online status as well
    const socketOnline = isUserOnline ? isUserOnline(userId) : false;

    res.json({
      success: true,
      isOnline: socketOnline || user.isOnline || false,
      lastSeen: user.lastSeen || null,
    });
  } catch (error) {
    console.error("Get online status error:", error.message);
    // Return false instead of error for better UX
    res.json({
      success: true,
      isOnline: false,
      message: "Could not determine status",
    });
  }
});

/**
 * GET /api/users/:userId
 * Get user by ID
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate ObjectId
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
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/**
 * GET /api/users/search
 * Search users by name or username
 */
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const users = await User.find({
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
