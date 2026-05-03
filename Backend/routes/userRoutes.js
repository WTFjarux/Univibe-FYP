// backend/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/authmiddleware");

// All routes require authentication
router.use(protect);

/**
 * GET /api/users/:userId/online-status
 * Check if a user is currently online
 */
router.get("/:userId/online-status", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("isOnline lastSeen")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      isOnline: user.isOnline || false,
      lastSeen: user.lastSeen || null,
    });
  } catch (error) {
    console.error("Get online status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
