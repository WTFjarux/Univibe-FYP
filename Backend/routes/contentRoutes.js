// backend/routes/contentRoutes.js
const express = require("express");
const router = express.Router();
const contentController = require("../controllers/contentController");
const { protect } = require("../middleware/authmiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");
const { getAdminModel } = require("../config/database");

router.use(protect);

// Saved posts
router.post(
  "/save/:postId",
  preventBlockedInteractions,
  contentController.toggleSavePost,
);
router.get("/saved", contentController.getSavedPosts);

// Hidden posts
router.post(
  "/hide/:postId",
  preventBlockedInteractions,
  contentController.hidePost,
);
router.post(
  "/unhide/:postId",
  preventBlockedInteractions,
  contentController.unhidePost,
);
router.get("/hidden", contentController.getHiddenPosts);

// Muted users
router.post(
  "/mute/:userId",
  preventBlockedInteractions,
  contentController.toggleMuteUser,
);
router.get("/muted", contentController.getMutedUsers);

// Blocked users
router.post("/block/:userId", contentController.toggleBlockUser);
router.get("/blocked", contentController.getBlockedUsers);

// Report content
router.post("/report", protect, async (req, res) => {
  try {
    const { targetType, targetId, reason, description } = req.body;
    const userId = req.user._id;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Target type, target ID, and reason are required",
      });
    }

    const validTypes = ["Post", "Comment", "User", "Event"];
    if (!validTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid target type",
      });
    }

    const Report = getAdminModel("Report");
    const existingReport = await Report.findOne({
      reportedBy: userId,
      targetType,
      targetId,
      status: { $in: ["pending", "reviewing"] },
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: "You have already reported this content",
      });
    }

    const report = await Report.create({
      reportedBy: userId,
      targetType,
      targetId,
      reason,
      description: description || "",
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
    });
  } catch (error) {
    console.error("Report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit report",
    });
  }
});
module.exports = router;
