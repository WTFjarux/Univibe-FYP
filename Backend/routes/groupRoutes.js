// backend/routes/groupRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const groupCtrl = require("../controllers/groupController");
const { uploadGroupPhoto } = require("../middleware/uploadMiddleware");

// =============================================================================
// MIDDLEWARE - Authentication
// =============================================================================

router.use(protect);

// =============================================================================
// GROUP ROUTES
// =============================================================================

// Create a new group chat
router.post("/create", groupCtrl.createGroup);

// Get group members list
router.get("/:roomId/members", groupCtrl.getMembers);

// Add members to a group (admin only or as per settings)
router.put("/:roomId/add-members", groupCtrl.addMembers);

// Remove a member from group (admin only or self-remove)
router.put("/:roomId/remove-member", groupCtrl.removeMember);

// Leave a group chat
router.post("/:roomId/leave", groupCtrl.leaveGroup);

// Update group information (name, icon, description, settings)
router.put("/:roomId/update", groupCtrl.updateGroup);

// Promote member to admin (owner only)
router.put("/:roomId/make-admin", groupCtrl.makeAdmin);

// Demote admin to member (owner only)
router.put("/:roomId/remove-admin", groupCtrl.removeAdmin);

// =============================================================================
// ERROR HANDLER
// =============================================================================

router.use((err, req, res, next) => {
  console.error("Group route error:", err);

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

router.post("/upload-photo", uploadGroupPhoto, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const photoUrl = `/uploads/group-photos/${req.file.filename}`;
    res.json({ success: true, url: photoUrl });
  } catch (error) {
    console.error("Upload group photo error:", error);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});
module.exports = router;
